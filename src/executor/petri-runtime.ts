import { readFile } from 'node:fs/promises';

import { ingestAgentResult } from './agent-result.js';
import type { AgentStreamEvent } from './agent-result.js';
import type { AgentRunnerRuntime, ExecutionPorts } from './execution-ports.js';
import {
  blockedPlanSliceSteps,
  compileExecutorTopology,
  normalizeSchedulerPlanMode,
  readyPlanSliceIds,
  sliceTransitionId,
  type BlockedStep,
  type ExecutorTopology,
  type ExecutorTransition,
  type ExecutorTransitionGuard,
  type ReadyStep,
  type SchedulerPlan,
} from './orchestrate-topology.js';
import { replayTransitionHistory } from './petri-replay.js';
import { exportPetri } from './petri.js';
import { populatedPlanPath, populateWorktree } from './populate.js';
import { preparePromotion } from './promotion.js';
import { initializeReports } from './report.js';
import { completeRun } from './run-complete.js';
import { readRunMetadata, runMetadataPath, type RunMetadata } from './run.js';
import { completeSlice } from './slice-complete.js';
import { requestSliceExecution } from './slice-execute.js';
import { startSlice } from './slice-start.js';
import { copyHostSource } from './source-copy.js';
import { selectSourcePolicy, type SourcePolicyKind } from './source-policy.js';
import { ingestTestResult } from './test-result.js';
import type { VerifyStreamEvent } from './test-result.js';
import { createWorktree } from './worktree.js';

export interface ExecutorPetriRuntime {
  readonly topology: ExecutorTopology;
  readonly currentMarking: Record<string, number>;
  readonly enabledTransitions: readonly ExecutorTransition[];
  readonly readySteps: readonly ReadyStep[];
  readonly blockedSteps: readonly BlockedStep[];
  transitionForReadyStep(step: ReadyStep): ExecutorTransition | undefined;
}

export interface ExecutorPetriTransitionHistoryProjection {
  readonly transitionIds: readonly string[];
  readonly currentSliceId?: string;
}

export interface ExecutorTransitionBindingContext {
  readonly cwd: string;
  readonly runId: string;
  readonly ports: ExecutionPorts;
  readonly sourcePolicy?: SourcePolicyKind;
  readonly runtime?: AgentRunnerRuntime;
  readonly signal?: AbortSignal;
  readonly onAgentUpdate?: (event: AgentStreamEvent) => void;
  readonly onVerifyUpdate?: (event: VerifyStreamEvent) => void;
}

export interface ExecutorStepResult {
  readonly status: string;
  readonly runStatus: RunMetadata['status'] | 'not_started';
}

export interface BoundExecutorPetriTransition {
  readonly transition: ExecutorTransition;
  execute(): Promise<ExecutorStepResult>;
}

export interface ExecutorPetriRuntimeBindings {
  readonly runtime: ExecutorPetriRuntime;
  transitionForReadyStep(step: ReadyStep): BoundExecutorPetriTransition | undefined;
}

export function nextIncompletePetriSliceId(
  state: RunMetadata,
  plan: SchedulerPlan | undefined,
): string | undefined {
  return readyPlanSliceIds(plan, state.completedSliceIds ?? [])[0];
}

export function activeOrNextPetriSliceId(
  state: RunMetadata,
  plan: SchedulerPlan | undefined,
): string | undefined {
  return state.activeSliceId ?? nextIncompletePetriSliceId(state, plan);
}

export function enabledPetriTransitionIds(
  state: RunMetadata,
  plan: SchedulerPlan | undefined,
): readonly string[] {
  const runtime = materializeExecutorPetriRuntime(state, plan);
  return runtime.enabledTransitions.map((transition) => transition.id);
}

export function impliedPetriTransitionHistory(
  state: RunMetadata,
  plan: SchedulerPlan | undefined,
): readonly string[] | undefined {
  return projectExecutorPetriTransitionHistory(state, plan)?.transitionIds;
}

export function projectExecutorPetriTransitionHistory(
  state: RunMetadata,
  plan: SchedulerPlan | undefined,
): ExecutorPetriTransitionHistoryProjection | undefined {
  if (state.status === 'created') return { transitionIds: [] };
  if (state.status === 'abandoned') return undefined;

  const transitionIds = [
    ...baseRunTransitionHistory(state.status),
    ...completedSliceTransitionHistory(plan, state.completedSliceIds ?? []),
  ];
  const currentSliceId = inFlightSliceId(state, plan);
  switch (state.status) {
    case 'slice_started':
      return currentSliceId
        ? {
            transitionIds: [...transitionIds, sliceTransitionId('slice_start', currentSliceId)],
            currentSliceId,
          }
        : undefined;
    case 'slice_execution_requested':
      return currentSliceId
        ? {
            transitionIds: [
              ...transitionIds,
              sliceTransitionId('slice_start', currentSliceId),
              sliceTransitionId('slice_execute', currentSliceId),
            ],
            currentSliceId,
          }
        : undefined;
    case 'agent_result_ingested':
      return currentSliceId
        ? {
            transitionIds: [
              ...transitionIds,
              sliceTransitionId('slice_start', currentSliceId),
              sliceTransitionId('slice_execute', currentSliceId),
              sliceTransitionId('agent_result', currentSliceId),
            ],
            currentSliceId,
          }
        : undefined;
    case 'test_result_ingested':
      return currentSliceId
        ? {
            transitionIds: [
              ...transitionIds,
              sliceTransitionId('slice_start', currentSliceId),
              sliceTransitionId('slice_execute', currentSliceId),
              sliceTransitionId('agent_result', currentSliceId),
              sliceTransitionId('test_result', currentSliceId),
            ],
            currentSliceId,
          }
        : undefined;
    case 'slice_completed':
      return { transitionIds };
    case 'run_completed':
      return { transitionIds: [...transitionIds, 'run_complete'] };
    case 'petri_exported':
      return { transitionIds: [...transitionIds, 'run_complete', 'petri_export'] };
    case 'promotion_prepared':
      return { transitionIds: [...transitionIds, 'run_complete', 'petri_export', 'promotion'] };
    default:
      return { transitionIds };
  }
}

export function materializeExecutorPetriRuntime(
  state: RunMetadata,
  plan: SchedulerPlan | undefined,
): ExecutorPetriRuntime {
  const topology = compileExecutorTopology(plan);
  const currentMarking = materializeCurrentMarking(topology, state, plan);
  const enabledTransitions = topology.transitions.filter((transition) =>
    isPetriTransitionEnabled(transition, currentMarking, state, plan),
  );

  return {
    topology,
    currentMarking,
    enabledTransitions,
    readySteps: enabledTransitions.map((transition) => transition.step),
    blockedSteps: blockedExecutorSteps(state, plan, currentMarking),
    transitionForReadyStep(step) {
      return enabledTransitions.find((transition) => readyStepsEqual(transition.step, step));
    },
  };
}

export function bindExecutorPetriRuntime(
  runtime: ExecutorPetriRuntime,
  ctx: ExecutorTransitionBindingContext,
): ExecutorPetriRuntimeBindings {
  return {
    runtime,
    transitionForReadyStep(step) {
      const transition = runtime.transitionForReadyStep(step);
      return transition
        ? {
            transition,
            execute: () => executeExecutorReadyStep(step, ctx),
          }
        : undefined;
    },
  };
}

function isPetriTransitionEnabled(
  transition: ExecutorTransition,
  currentMarking: Record<string, number>,
  state: RunMetadata,
  plan: SchedulerPlan | undefined,
): boolean {
  if (!transition.inputArcs.every((arc) => (currentMarking[arc.placeId] ?? 0) >= arc.weight)) return false;
  return transition.guard ? evaluateTransitionGuard(transition.guard, state, plan) : true;
}

function evaluateTransitionGuard(
  guard: ExecutorTransitionGuard,
  state: RunMetadata,
  plan: SchedulerPlan | undefined,
): boolean {
  switch (guard.kind) {
    case 'slice_ready': {
      const readySliceIds = new Set(readyPlanSliceIds(plan, state.completedSliceIds ?? []));
      return readySliceIds.has(guard.sliceId);
    }
    case 'no_remaining_slices':
      return nextIncompletePetriSliceId(state, plan) === undefined;
    case 'active_slice':
      return activeOrNextPetriSliceId(state, plan) === guard.sliceId;
  }
}

export function resolvePetriTransitionIdForReadyStep(
  step: ReadyStep,
  state: RunMetadata,
  plan: SchedulerPlan | undefined,
): string | undefined {
  return resolveTransitionIdForReadyStep(step, state, plan);
}

function resolveTransitionIdForReadyStep(
  step: ReadyStep,
  state: RunMetadata,
  plan: SchedulerPlan | undefined,
): string | undefined {
  switch (step.kind) {
    case 'worktree_create':
    case 'populate':
    case 'source_policy':
    case 'source_copy':
    case 'report_init':
    case 'run_complete':
    case 'petri_export':
    case 'promotion':
      return step.kind;
    case 'slice_start':
      return sliceTransitionId('slice_start', step.sliceId);
    case 'slice_execute':
      return currentSliceTransitionId('slice_execute', state, plan);
    case 'agent_result':
      return currentSliceTransitionId('agent_result', state, plan);
    case 'test_result':
      return currentSliceTransitionId('test_result', state, plan);
    case 'slice_complete':
      return currentSliceTransitionId('slice_complete', state, plan);
  }
}

function readyStepsEqual(left: ReadyStep, right: ReadyStep): boolean {
  if (left.kind !== right.kind) return false;
  return 'sliceId' in left && 'sliceId' in right ? left.sliceId === right.sliceId : true;
}

function blockedExecutorSteps(
  state: RunMetadata,
  plan: SchedulerPlan | undefined,
  currentMarking: Record<string, number>,
): readonly BlockedStep[] {
  const activeSliceId = inFlightSliceId(state, plan);
  if (activeSliceId) {
    return readyPlanSliceIds(plan, state.completedSliceIds ?? [])
      .filter((sliceId) => sliceId !== activeSliceId)
      .map((sliceId) => ({
        kind: 'slice_start' as const,
        sliceId,
        blockers: [{ kind: 'active_slice' as const, sliceId: activeSliceId }],
      }));
  }
  return currentMarking['run:slice_frontier'] === 1
    ? blockedPlanSliceSteps(plan, state.completedSliceIds ?? [])
    : [];
}

function materializeCurrentMarking(
  topology: ExecutorTopology,
  state: RunMetadata,
  plan: SchedulerPlan | undefined,
): Record<string, number> {
  const history = projectExecutorPetriTransitionHistory(state, plan);
  return history ? (replayTransitionHistory(topology, history.transitionIds)?.currentMarking ?? {}) : {};
}

function baseRunTransitionHistory(status: RunMetadata['status']): readonly string[] {
  switch (status) {
    case 'created':
    case 'abandoned':
      return [];
    case 'worktree_created':
      return ['worktree_create'];
    case 'worktree_populated':
      return ['worktree_create', 'populate'];
    case 'source_policy_selected':
      return ['worktree_create', 'populate', 'source_policy'];
    case 'source_copied':
      return ['worktree_create', 'populate', 'source_policy', 'source_copy'];
    default:
      return ['worktree_create', 'populate', 'source_policy', 'source_copy', 'report_init'];
  }
}

function currentSliceTransitionId(
  kind: 'slice_execute' | 'agent_result' | 'test_result' | 'slice_complete',
  state: RunMetadata,
  plan: SchedulerPlan | undefined,
): string | undefined {
  const sliceId = activeOrNextPetriSliceId(state, plan);
  return sliceId ? sliceTransitionId(kind, sliceId) : undefined;
}

function completedSliceTransitionHistory(
  plan: SchedulerPlan | undefined,
  completedSliceIds: readonly string[],
): readonly string[] {
  if (!plan?.slices?.length) return [];
  return completedSliceIds.flatMap((sliceId) => [
    sliceTransitionId('slice_start', sliceId),
    sliceTransitionId('slice_execute', sliceId),
    sliceTransitionId('agent_result', sliceId),
    sliceTransitionId('test_result', sliceId),
    sliceTransitionId('slice_complete', sliceId),
  ]);
}

function inFlightSliceId(state: RunMetadata, plan: SchedulerPlan | undefined): string | undefined {
  switch (state.status) {
    case 'slice_started':
    case 'slice_execution_requested':
    case 'agent_result_ingested':
    case 'test_result_ingested':
      return activeOrNextPetriSliceId(state, plan);
    default:
      return undefined;
  }
}

export async function executeExecutorReadyStep(
  step: ReadyStep,
  ctx: ExecutorTransitionBindingContext,
): Promise<ExecutorStepResult> {
  const { cwd, runId, ports } = ctx;
  switch (step.kind) {
    case 'worktree_create':
      return createWorktree({
        cwd,
        runId,
        gitWorktree: ports.gitWorktree,
        ...(ctx.signal ? { signal: ctx.signal } : {}),
      });
    case 'populate':
      return populateWorktree({ cwd, runId });
    case 'source_policy':
      return selectSourcePolicy({
        cwd,
        runId,
        policy: await sourcePolicyForRun(ctx),
      });
    case 'source_copy':
      return copyHostSource({ cwd, runId });
    case 'report_init':
      return initializeReports({ cwd, runId });
    case 'slice_start':
      return startSlice({ cwd, runId, sliceId: step.sliceId });
    case 'slice_execute':
      return requestSliceExecution({ cwd, runId });
    case 'agent_result':
      return ingestAgentResult({
        cwd,
        runId,
        agentRunner: ports.agentRunner,
        ...(ctx.runtime ? { runtime: ctx.runtime } : {}),
        ...(ctx.onAgentUpdate ? { onAgentUpdate: ctx.onAgentUpdate } : {}),
      });
    case 'test_result':
      return ingestTestResult({
        cwd,
        runId,
        testRunner: ports.testRunner,
        ...(ctx.signal ? { signal: ctx.signal } : {}),
        ...(ctx.onVerifyUpdate ? { onVerifyUpdate: ctx.onVerifyUpdate } : {}),
      });
    case 'slice_complete':
      return completeSlice({ cwd, runId });
    case 'run_complete':
      return completeRun({ cwd, runId });
    case 'petri_export':
      return exportPetri({ cwd, runId });
    case 'promotion':
      return preparePromotion({ cwd, runId, gitLand: ports.gitLand });
  }
}

async function sourcePolicyForRun(ctx: ExecutorTransitionBindingContext): Promise<SourcePolicyKind> {
  if (ctx.sourcePolicy) return ctx.sourcePolicy;

  const metadata = await readRunMetadata(runMetadataPath(ctx.cwd, ctx.runId));
  const path = metadata?.populatedPlanPath ?? populatedPlanPath(ctx.cwd, ctx.runId);
  const plan = JSON.parse(await readFile(path, 'utf8')) as SchedulerPlan;
  return normalizeSchedulerPlanMode(plan) === 'brownfield' ? 'host_source_deferred' : 'plan_only';
}
