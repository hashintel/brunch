import { readFile } from 'node:fs/promises';

import { ingestAgentResult } from './agent-result.js';
import type { AgentStreamEvent } from './agent-result.js';
import type { AgentRunnerRuntime, ExecutionPorts } from './execution-ports.js';
import {
  attemptExhaustedTransitionId,
  attemptRetryTransitionId,
  attemptResetTransitionId,
  attemptSuccessTransitionId,
  blockedPlanSliceSteps,
  compileExecutorTopology,
  normalizeSchedulerPlanMode,
  projectSchedulerPlan,
  readyPlanSliceIds,
  SLICE_ATTEMPT_LIMIT,
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
  readonly enabledTransitions: readonly ExecutableExecutorTransition[];
  readonly readySteps: readonly ReadyStep[];
  readonly blockedSteps: readonly BlockedStep[];
  transitionForReadyStep(step: ReadyStep): ExecutableExecutorTransition | undefined;
}

type ExecutableExecutorTransition = ExecutorTransition & { readonly step: ReadyStep };

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
  const completed = new Set(state.completedSliceIds ?? []);
  return plan?.slices?.find((slice) => !completed.has(slice.id))?.id;
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
  if (!completedSliceHistoryIsValid(plan, state.completedSliceIds ?? [])) return undefined;

  const transitionIds = [
    ...baseRunTransitionHistory(state.status),
    ...completedSliceTransitionHistory(state, plan, state.completedSliceIds ?? []),
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
              ...activeStageTransitionHistory(state, 'agent', currentSliceId),
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
              ...completedStageTransitionHistory(state, 'agent', currentSliceId, true),
              ...activeStageTransitionHistory(state, 'verify', currentSliceId),
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
              ...completedStageTransitionHistory(state, 'agent', currentSliceId, true),
              ...completedStageTransitionHistory(state, 'verify', currentSliceId, true),
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

function completedSliceHistoryIsValid(
  plan: SchedulerPlan | undefined,
  completedSliceIds: readonly string[],
): boolean {
  const completed = new Set<string>();
  const slicesById = new Map((plan?.slices ?? []).map((slice) => [slice.id, slice]));
  for (const sliceId of completedSliceIds) {
    const slice = slicesById.get(sliceId);
    if (!slice || completed.has(sliceId)) return false;
    if ((slice.depends_on ?? []).some((dependencyId) => !completed.has(dependencyId))) return false;
    const epic = plan?.epics?.find((candidate) => candidate.id === slice.epic_id);
    if (
      epic?.depends_on?.some((dependencyId) =>
        (plan?.slices ?? [])
          .filter((candidate) => candidate.epic_id === dependencyId)
          .some((candidate) => !completed.has(candidate.id)),
      )
    ) {
      return false;
    }
    completed.add(sliceId);
  }
  return true;
}

export function materializeExecutorPetriRuntime(
  state: RunMetadata,
  plan: SchedulerPlan | undefined,
): ExecutorPetriRuntime {
  const topology = compileExecutorTopology(plan);
  const currentMarking = materializeCurrentMarking(topology, state, plan);
  const enabledTransitions = topology.transitions.filter(
    (transition): transition is ExecutableExecutorTransition =>
      transition.step !== undefined && isPetriTransitionEnabled(transition, currentMarking, state, plan),
  );

  return {
    topology,
    currentMarking,
    enabledTransitions,
    readySteps: enabledTransitions.map((transition) => transition.step),
    blockedSteps: blockedExecutorSteps(state, plan),
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
      if (inFlightSliceId(state, plan)) return false;
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
      return currentAttemptSuccessTransitionId('agent', state, plan);
    case 'test_result':
      return currentAttemptSuccessTransitionId('verify', state, plan);
    case 'slice_complete':
      return currentSliceTransitionId('slice_complete', state, plan);
  }
}

function readyStepsEqual(left: ReadyStep, right: ReadyStep): boolean {
  if (left.kind !== right.kind) return false;
  return 'sliceId' in left && 'sliceId' in right ? left.sliceId === right.sliceId : true;
}

function epicIdForSlice(plan: SchedulerPlan | undefined, sliceId: string): string | undefined {
  return plan?.slices?.find((slice) => slice.id === sliceId)?.epic_id;
}

function derivedFromForSlice(
  plan: SchedulerPlan | undefined,
  sliceId: string,
): readonly string[] | undefined {
  return plan?.slices?.find((slice) => slice.id === sliceId)?.derived_from;
}

function blockedExecutorSteps(state: RunMetadata, plan: SchedulerPlan | undefined): readonly BlockedStep[] {
  const activeSliceId = inFlightSliceId(state, plan);
  if (activeSliceId) {
    return readyPlanSliceIds(plan, state.completedSliceIds ?? [])
      .filter((sliceId) => sliceId !== activeSliceId)
      .map<BlockedStep>((sliceId) => {
        const epicId = epicIdForSlice(plan, sliceId);
        const derivedFrom = derivedFromForSlice(plan, sliceId);
        return {
          kind: 'slice_start',
          sliceId,
          ...(epicId === undefined ? {} : { epicId }),
          ...(derivedFrom === undefined ? {} : { derivedFrom }),
          blockers: [{ kind: 'active_slice', sliceId: activeSliceId }],
        };
      });
  }
  return state.status === 'reports_initialized' || state.status === 'slice_completed'
    ? blockedPlanSliceSteps(plan, state.completedSliceIds ?? [])
    : [];
}

function materializeCurrentMarking(
  topology: ExecutorTopology,
  state: RunMetadata,
  plan: SchedulerPlan | undefined,
): Record<string, number> {
  if (state.status === 'abandoned') return {};
  const history = projectExecutorPetriTransitionHistory(state, plan);
  if (!history) throw new Error(`Cannot project Petri transition history for run status ${state.status}`);
  const replay = replayTransitionHistory(topology, history.transitionIds);
  if (!replay) throw new Error(`Cannot replay Petri transition history for run status ${state.status}`);
  return replay.currentMarking;
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
  kind: 'slice_execute' | 'slice_complete',
  state: RunMetadata,
  plan: SchedulerPlan | undefined,
): string | undefined {
  const sliceId = activeOrNextPetriSliceId(state, plan);
  return sliceId ? sliceTransitionId(kind, sliceId) : undefined;
}

function currentAttemptSuccessTransitionId(
  stage: 'agent' | 'verify',
  state: RunMetadata,
  plan: SchedulerPlan | undefined,
): string | undefined {
  const sliceId = activeOrNextPetriSliceId(state, plan);
  const attempt = (state.activeSliceAttempts ?? 0) + 1;
  return sliceId && attempt <= SLICE_ATTEMPT_LIMIT
    ? attemptSuccessTransitionId(stage, sliceId, attempt)
    : undefined;
}

function attemptFailureTransitionHistory(
  stage: 'agent' | 'verify',
  sliceId: string,
  failures: number,
): readonly string[] {
  const retries = Array.from({ length: Math.min(failures, SLICE_ATTEMPT_LIMIT - 1) }, (_, index) =>
    attemptRetryTransitionId(stage, sliceId, index + 1),
  );
  return failures >= SLICE_ATTEMPT_LIMIT
    ? [...retries, attemptExhaustedTransitionId(stage, sliceId)]
    : retries;
}

function completedStageTransitionHistory(
  state: RunMetadata,
  stage: 'agent' | 'verify',
  sliceId: string,
  fallbackToFirstAttempt: boolean,
): readonly string[] {
  const cycles = state.sliceAttemptHistory?.[sliceId]?.[stage] ?? [];
  if (cycles.length === 0) {
    return fallbackToFirstAttempt ? [attemptSuccessTransitionId(stage, sliceId, 1)] : [];
  }
  return cycles.flatMap((cycle) => {
    if (cycle.outcome === 'reset') return [attemptResetTransitionId(stage, sliceId)];
    const failures = cycle.outcome === 'succeeded' ? cycle.attempts - 1 : cycle.attempts;
    const transitions = attemptFailureTransitionHistory(stage, sliceId, failures);
    return cycle.outcome === 'succeeded'
      ? [...transitions, attemptSuccessTransitionId(stage, sliceId, cycle.attempts)]
      : transitions;
  });
}

function activeStageTransitionHistory(
  state: RunMetadata,
  stage: 'agent' | 'verify',
  sliceId: string,
): readonly string[] {
  const completed = completedStageTransitionHistory(state, stage, sliceId, false);
  const latest = state.sliceAttemptHistory?.[sliceId]?.[stage]?.at(-1);
  if (latest?.outcome === 'exhausted' && state.activeSliceAttempts === latest.attempts) return completed;
  return [...completed, ...attemptFailureTransitionHistory(stage, sliceId, state.activeSliceAttempts ?? 0)];
}

function completedSliceTransitionHistory(
  state: RunMetadata,
  plan: SchedulerPlan | undefined,
  completedSliceIds: readonly string[],
): readonly string[] {
  if (!plan?.slices?.length) return [];
  const history: string[] = [];
  const completedSlices = new Set<string>();
  const completedEpics = new Set<string>();
  for (const sliceId of completedSliceIds) {
    history.push(
      sliceTransitionId('slice_start', sliceId),
      sliceTransitionId('slice_execute', sliceId),
      ...completedStageTransitionHistory(state, 'agent', sliceId, true),
      ...completedStageTransitionHistory(state, 'verify', sliceId, true),
      sliceTransitionId('slice_complete', sliceId),
    );
    completedSlices.add(sliceId);
    appendCompletedEpicGates(plan, completedSlices, completedEpics, history);
  }
  return history;
}

function appendCompletedEpicGates(
  plan: SchedulerPlan,
  completedSlices: ReadonlySet<string>,
  completedEpics: Set<string>,
  history: string[],
): void {
  let changed = true;
  while (changed) {
    changed = false;
    for (const epic of plan.epics ?? []) {
      if (completedEpics.has(epic.id)) continue;
      const members = (plan.slices ?? []).filter((slice) => slice.epic_id === epic.id);
      if (!members.every((slice) => completedSlices.has(slice.id))) continue;
      if (!(epic.depends_on ?? []).every((epicId) => completedEpics.has(epicId))) continue;
      history.push(`epic_integrate:${epic.id}`);
      if (epic.verification?.length) history.push(`epic_verify:${epic.id}`);
      history.push(`epic_complete:${epic.id}`);
      completedEpics.add(epic.id);
      changed = true;
    }
  }
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
  const plan = projectSchedulerPlan(JSON.parse(await readFile(path, 'utf8')));
  return normalizeSchedulerPlanMode(plan) === 'brownfield' ? 'host_source_deferred' : 'plan_only';
}
