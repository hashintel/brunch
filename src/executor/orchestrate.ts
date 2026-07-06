import { readFile } from 'node:fs/promises';

import { ingestAgentResult } from './agent-result.js';
import type { AgentStreamEvent } from './agent-result.js';
import type { AgentRunnerRuntime, ExecutionPorts } from './execution-ports.js';
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

// The driver composes the existing `execute_*` lifecycle steps into a single
// self-advancing run. It owns no side effects of its own: each ReadyStep maps
// to one step function, and the run.json status IS the loop state (D102-L).

export type ReadyStep =
  | { readonly kind: 'worktree_create' }
  | { readonly kind: 'populate' }
  | { readonly kind: 'source_policy' }
  | { readonly kind: 'source_copy' }
  | { readonly kind: 'report_init' }
  | { readonly kind: 'slice_start'; readonly sliceId: string }
  | { readonly kind: 'slice_execute' }
  | { readonly kind: 'agent_result' }
  | { readonly kind: 'test_result' }
  | { readonly kind: 'slice_complete' }
  | { readonly kind: 'run_complete' }
  | { readonly kind: 'petri_export' }
  | { readonly kind: 'promotion' };

/** The minimal plan projection the scheduler needs to resolve the slice frontier. */
export interface SchedulerPlan {
  readonly mode?: 'greenfield' | 'brownfield';
  readonly slices?: readonly { readonly id: string }[];
}

export interface RunScheduler {
  /** Pure: given current run facts, return the ready step frontier (`[]` when done). */
  ready(state: RunMetadata, plan: SchedulerPlan | undefined): readonly ReadyStep[];
}

// A set-returning scheduler (length-1 today) leaves room for a future
// PetriScheduler that fires several enabled transitions at once (D102-L,
// geolog-and-petri-execution) without reshaping the driver loop.
export const linearScheduler: RunScheduler = {
  ready(state, plan) {
    switch (state.status) {
      case 'created':
        return [{ kind: 'worktree_create' }];
      case 'worktree_created':
        return [{ kind: 'populate' }];
      case 'worktree_populated':
        return [{ kind: 'source_policy' }];
      case 'source_policy_selected':
        return [{ kind: 'source_copy' }];
      case 'source_copied':
        return [{ kind: 'report_init' }];
      case 'reports_initialized':
      case 'slice_completed': {
        // Slice-frontier readiness derives from completion facts, not the coarse
        // status: the next step is the first plan slice not yet completed.
        const completed = new Set(state.completedSliceIds ?? []);
        const next = plan?.slices?.find((slice) => !completed.has(slice.id));
        return next ? [{ kind: 'slice_start', sliceId: next.id }] : [{ kind: 'run_complete' }];
      }
      case 'slice_started':
        return [{ kind: 'slice_execute' }];
      case 'slice_execution_requested':
        return [{ kind: 'agent_result' }];
      case 'agent_result_ingested':
        return [{ kind: 'test_result' }];
      case 'test_result_ingested':
        return [{ kind: 'slice_complete' }];
      case 'run_completed':
        return [{ kind: 'petri_export' }];
      case 'petri_exported':
        return [{ kind: 'promotion' }];
      case 'promotion_prepared':
        return [];
    }
  },
};

export interface DriveContext {
  readonly cwd: string;
  readonly runId: string;
  readonly ports: ExecutionPorts;
  readonly sourcePolicy?: SourcePolicyKind;
  readonly runtime?: AgentRunnerRuntime;
  readonly signal?: AbortSignal;
  /** Fired before each ready step starts (observer hook; errors are swallowed). */
  readonly onStepStart?: (step: ReadyStep['kind'], runStatus: RunMetadata['status'], progress: DriveStepProgress) => void;
  /** Fired after each step that advanced run.json (observer hook; errors are swallowed). */
  readonly onStepComplete?: (step: ReadyStep['kind'], runStatus: RunMetadata['status'], progress: DriveStepProgress) => void;
  /** Fired when the sealed worker emits normalized stream events during agent_result. */
  readonly onAgentUpdate?: (event: AgentStreamEvent) => void;
  /** Fired when the verify runner emits normalized stream events during test_result. */
  readonly onVerifyUpdate?: (event: VerifyStreamEvent) => void;
}

export interface DriveStepProgress {
  readonly phase: 'started' | 'completed';
  readonly step: ReadyStep;
  readonly fromStatus: RunMetadata['status'];
  readonly runStatus: RunMetadata['status'];
  readonly activeEpicId?: string;
  readonly activeSliceId?: string;
  readonly completedSliceIds: readonly string[];
}

export type DriveOutcome =
  | { readonly status: 'completed'; readonly runStatus: RunMetadata['status'] }
  | {
      readonly status: 'halted';
      readonly step: ReadyStep['kind'];
      readonly runStatus: RunMetadata['status'];
      readonly reason: string;
    }
  | { readonly status: 'missing_run'; readonly runId: string };

interface StepResult {
  readonly status: string;
  readonly runStatus: RunMetadata['status'] | 'not_started';
}

/**
 * Drive a run to `promotion_prepared` (run-local land) by repeatedly executing the
 * scheduler's ready step. Host promotion/land stays out of scope: the scheduler
 * reports no ready step once the run reaches `promotion_prepared`.
 */
export async function drive(
  ctx: DriveContext,
  scheduler: RunScheduler = linearScheduler,
): Promise<DriveOutcome> {
  const metadataPath = runMetadataPath(ctx.cwd, ctx.runId);
  // ceiling: coarse halt detection — a step that leaves run.json's status
  // unchanged is treated as stuck. Replace with per-step outcome classification
  // if steps gain retry/abort semantics beyond advance-or-hold.
  for (;;) {
    const state = await readRunMetadata(metadataPath);
    if (!state) return { status: 'missing_run', runId: ctx.runId };

    const plan = await planForScheduler(ctx.cwd, state);
    const [next] = scheduler.ready(state, plan);
    if (!next) return { status: 'completed', runStatus: state.status };

    try {
      ctx.onStepStart?.(next.kind, state.status, progressForStep('started', next, state, state.status));
    } catch {
      // Observer failures never affect the drive.
    }

    const result = await runStep(next, ctx);
    if (result.runStatus === state.status) {
      return { status: 'halted', step: next.kind, runStatus: state.status, reason: result.status };
    }
    if (result.runStatus !== 'not_started') {
      try {
        ctx.onStepComplete?.(next.kind, result.runStatus, progressForStep('completed', next, state, result.runStatus));
      } catch {
        // Observer failures never affect the drive.
      }
    }
  }
}

function progressForStep(
  phase: DriveStepProgress['phase'],
  step: ReadyStep,
  state: RunMetadata,
  runStatus: RunMetadata['status'],
): DriveStepProgress {
  return {
    phase,
    step,
    fromStatus: state.status,
    runStatus,
    ...(state.activeEpicId ? { activeEpicId: state.activeEpicId } : {}),
    ...(state.activeSliceId ? { activeSliceId: state.activeSliceId } : {}),
    completedSliceIds: state.completedSliceIds ?? [],
  };
}

async function planForScheduler(cwd: string, state: RunMetadata): Promise<SchedulerPlan | undefined> {
  if (state.status !== 'reports_initialized' && state.status !== 'slice_completed') return undefined;
  const path = state.populatedPlanPath ?? populatedPlanPath(cwd, state.runId);
  return JSON.parse(await readFile(path, 'utf8')) as SchedulerPlan;
}

async function runStep(step: ReadyStep, ctx: DriveContext): Promise<StepResult> {
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

async function sourcePolicyForRun(ctx: DriveContext): Promise<SourcePolicyKind> {
  if (ctx.sourcePolicy) return ctx.sourcePolicy;

  const metadata = await readRunMetadata(runMetadataPath(ctx.cwd, ctx.runId));
  const path = metadata?.populatedPlanPath ?? populatedPlanPath(ctx.cwd, ctx.runId);
  const plan = JSON.parse(await readFile(path, 'utf8')) as SchedulerPlan;
  return plan.mode === 'greenfield' ? 'plan_only' : 'host_source_deferred';
}
