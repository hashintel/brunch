import { agentResultPath, agentStreamPath } from '../agent-result.js';
import {
  IsolatedSliceOperationError,
  prepareIsolatedSlice,
  runIsolatedAgentAttempt,
  runIsolatedVerifyAttempt,
  sliceAttemptDisposition,
  thrownSliceEffectReason,
} from '../isolated-slice-operations.js';
import {
  attemptExhaustedTransitionId,
  attemptRetryTransitionId,
  attemptSuccessTransitionId,
  SLICE_ATTEMPT_LIMIT,
  sliceTransitionId,
  type ReadyStep,
} from '../orchestrate-topology.js';
import { appendSliceAttemptCycle, type SliceAttemptHistory } from '../run.js';
import { sliceExecutionRequestPath } from '../slice-execute.js';
import { sliceWorkspacePath } from '../slice-workspace.js';
import { verifyStreamPath } from '../test-result.js';
import { ParallelAuthorityError, type BatchAuthority } from './authority.js';
import { emitParallelStepProgress } from './progress.js';
import type {
  ParallelSliceBatchContext,
  ParallelSliceStep,
  SliceEffectFailure,
  SliceEffectResult,
} from './types.js';

export async function executeIsolatedSlice(args: {
  readonly ctx: ParallelSliceBatchContext;
  readonly state: import('../run.js').RunMetadata;
  readonly plan: import('../orchestrate-topology.js').SchedulerPlan;
  readonly step: ParallelSliceStep;
  readonly authority: BatchAuthority;
}): Promise<SliceEffectResult> {
  const { ctx, step, authority } = args;
  const slice = args.plan.slices?.find((candidate) => candidate.id === step.sliceId);
  const epicId = step.epicId ?? slice?.epic_id;
  const runWorktreeDir = args.state.worktreeDir;
  if (!slice || !runWorktreeDir) {
    return failed(step.sliceId, 'slice_execute', 'parallel_slice_input_unavailable', {});
  }
  const workspaceDir = sliceWorkspacePath(ctx.cwd, ctx.runId, step.sliceId);
  const executeStep = { ...step, kind: 'slice_execute' as const };
  emitParallelStepProgress(ctx, 'started', executeStep, args.state);
  let workspace: Awaited<ReturnType<typeof prepareIsolatedSlice>>;
  try {
    workspace = await prepareIsolatedSlice({
      runId: ctx.runId,
      sliceId: step.sliceId,
      ...(epicId === undefined ? {} : { epicId }),
      runWorktreeDir,
      sliceWorktreeDir: workspaceDir,
      requestPath: sliceExecutionRequestPath(ctx.cwd, ctx.runId, step.sliceId),
      gitSliceIntegration: ctx.ports.gitSliceIntegration,
      recordReport: async (event) => {
        await authority.fire(sliceTransitionId('slice_execute', step.sliceId));
        await authority.appendReport(event);
      },
    });
  } catch (error) {
    if (error instanceof ParallelAuthorityError) throw error;
    return failed(
      step.sliceId,
      'slice_execute',
      error instanceof IsolatedSliceOperationError
        ? error.reason
        : thrownSliceEffectReason('slice_workspace_threw', error),
      {},
    );
  }
  if (workspace.status === 'failed') {
    return failed(step.sliceId, 'slice_execute', 'slice_workspace_failed', {});
  }

  const requestPath = sliceExecutionRequestPath(ctx.cwd, ctx.runId, step.sliceId);
  emitParallelStepProgress(ctx, 'completed', executeStep, args.state);

  let attemptHistory: SliceAttemptHistory = {};
  const agent = await runAgentAttempts({
    ctx,
    authority,
    sliceId: step.sliceId,
    ...(epicId === undefined ? {} : { epicId }),
    workspaceDir,
    requestPath,
    state: args.state,
    step,
  });
  attemptHistory = mergeAttemptHistory(attemptHistory, agent.attemptHistory);
  if (agent.status === 'failed') return failed(step.sliceId, 'agent_result', agent.reason, attemptHistory);

  const verification = await runVerifyAttempts({
    ctx,
    authority,
    verifyTarget: args.state.verifyTarget,
    sliceId: step.sliceId,
    ...(epicId === undefined ? {} : { epicId }),
    workspaceDir,
    step,
    state: args.state,
  });
  attemptHistory = mergeAttemptHistory(attemptHistory, verification.attemptHistory);
  if (verification.status === 'failed') {
    return failed(step.sliceId, 'test_result', verification.reason, attemptHistory);
  }
  return {
    status: 'succeeded',
    sliceId: step.sliceId,
    ...(epicId === undefined ? {} : { epicId }),
    workspaceDir,
    baseSha: workspace.baseSha,
    attemptHistory,
  };
}

async function runAgentAttempts(args: {
  readonly ctx: ParallelSliceBatchContext;
  readonly authority: BatchAuthority;
  readonly sliceId: string;
  readonly epicId?: string;
  readonly workspaceDir: string;
  readonly requestPath: string;
  readonly state: import('../run.js').RunMetadata;
  readonly step: ParallelSliceStep;
}): Promise<
  | { readonly status: 'succeeded'; readonly attemptHistory: SliceAttemptHistory }
  | { readonly status: 'failed'; readonly reason: string; readonly attemptHistory: SliceAttemptHistory }
> {
  for (let attempt = 1; attempt <= SLICE_ATTEMPT_LIMIT; attempt += 1) {
    const streamPath = agentStreamPath(args.ctx.cwd, args.ctx.runId, args.sliceId, attempt);
    const agentStep = { ...args.step, kind: 'agent_result' as const };
    emitParallelStepProgress(args.ctx, 'started', agentStep, args.state);
    let attemptResult: Awaited<ReturnType<typeof runIsolatedAgentAttempt>>;
    let report: Record<string, unknown> | undefined;
    try {
      attemptResult = await runIsolatedAgentAttempt({
        runId: args.ctx.runId,
        sliceId: args.sliceId,
        ...(args.epicId === undefined ? {} : { epicId: args.epicId }),
        worktreeDir: args.workspaceDir,
        requestPath: args.requestPath,
        resultPath: agentResultPath(args.ctx.cwd, args.ctx.runId, args.sliceId, attempt),
        streamPath,
        agentRunner: args.ctx.ports.agentRunner,
        ...(args.ctx.runtime ? { runtime: args.ctx.runtime } : {}),
        recordReport: async (event) => {
          report = event;
        },
        ...(args.ctx.onAgentUpdate ? { onUpdate: args.ctx.onAgentUpdate } : {}),
      });
    } catch (error) {
      if (error instanceof ParallelAuthorityError) throw error;
      return {
        status: 'failed',
        reason: thrownSliceEffectReason('agent_run_threw', error),
        attemptHistory: {},
      };
    }
    const result = attemptResult.result;
    if (result.status === 'completed') {
      await args.authority.fire(attemptSuccessTransitionId('agent', args.sliceId, attempt));
      if (report) await args.authority.appendReport(report);
      emitParallelStepProgress(args.ctx, 'completed', agentStep, args.state);
      return {
        status: 'succeeded',
        attemptHistory: attemptHistory(args.sliceId, 'agent', 'succeeded', attempt),
      };
    }
    await args.authority.attemptFailed(args.sliceId, args.epicId, 'agent_result', attempt, result.message);
    await args.authority.fire(
      sliceAttemptDisposition(attempt) === 'retry'
        ? attemptRetryTransitionId('agent', args.sliceId, attempt)
        : attemptExhaustedTransitionId('agent', args.sliceId),
    );
  }
  return {
    status: 'failed',
    reason: 'agent_run_failed',
    attemptHistory: attemptHistory(args.sliceId, 'agent', 'exhausted', SLICE_ATTEMPT_LIMIT),
  };
}

async function runVerifyAttempts(args: {
  readonly ctx: ParallelSliceBatchContext;
  readonly authority: BatchAuthority;
  readonly verifyTarget: import('../execution-ports.js').VerifyTarget | undefined;
  readonly sliceId: string;
  readonly epicId?: string;
  readonly workspaceDir: string;
  readonly step: ParallelSliceStep;
  readonly state: import('../run.js').RunMetadata;
}): Promise<
  | { readonly status: 'succeeded'; readonly attemptHistory: SliceAttemptHistory }
  | { readonly status: 'failed'; readonly reason: string; readonly attemptHistory: SliceAttemptHistory }
> {
  for (let attempt = 1; attempt <= SLICE_ATTEMPT_LIMIT; attempt += 1) {
    const streamPath = verifyStreamPath(args.ctx.cwd, args.ctx.runId, args.sliceId, attempt);
    const verifyStep = { ...args.step, kind: 'test_result' as const };
    emitParallelStepProgress(args.ctx, 'started', verifyStep, args.state);
    let attemptResult: Awaited<ReturnType<typeof runIsolatedVerifyAttempt>>;
    let report: Record<string, unknown> | undefined;
    try {
      attemptResult = await runIsolatedVerifyAttempt({
        runId: args.ctx.runId,
        sliceId: args.sliceId,
        ...(args.epicId === undefined ? {} : { epicId: args.epicId }),
        worktreeDir: args.workspaceDir,
        streamPath,
        testRunner: args.ctx.ports.testRunner,
        ...(args.verifyTarget ? { verifyTarget: args.verifyTarget } : {}),
        ...(args.ctx.signal ? { signal: args.ctx.signal } : {}),
        recordReport: async (event) => {
          report = event;
        },
        ...(args.ctx.onVerifyUpdate ? { onUpdate: args.ctx.onVerifyUpdate } : {}),
      });
    } catch (error) {
      if (error instanceof ParallelAuthorityError) throw error;
      return {
        status: 'failed',
        reason: thrownSliceEffectReason('test_run_threw', error),
        attemptHistory: {},
      };
    }
    const result = attemptResult.result;
    if (result.status === 'completed') {
      await args.authority.fire(attemptSuccessTransitionId('verify', args.sliceId, attempt));
      if (report) await args.authority.appendReport(report);
      emitParallelStepProgress(args.ctx, 'completed', verifyStep, args.state);
      return result.verdict === 'passed'
        ? {
            status: 'succeeded',
            attemptHistory: attemptHistory(args.sliceId, 'verify', 'succeeded', attempt),
          }
        : {
            status: 'failed',
            reason: 'slice_verification_not_passed',
            attemptHistory: attemptHistory(args.sliceId, 'verify', 'succeeded', attempt),
          };
    }
    await args.authority.attemptFailed(args.sliceId, args.epicId, 'test_result', attempt, result.message);
    await args.authority.fire(
      sliceAttemptDisposition(attempt) === 'retry'
        ? attemptRetryTransitionId('verify', args.sliceId, attempt)
        : attemptExhaustedTransitionId('verify', args.sliceId),
    );
  }
  return {
    status: 'failed',
    reason: 'test_run_failed',
    attemptHistory: attemptHistory(args.sliceId, 'verify', 'exhausted', SLICE_ATTEMPT_LIMIT),
  };
}

function attemptHistory(
  sliceId: string,
  stage: 'agent' | 'verify',
  outcome: 'succeeded' | 'exhausted',
  attempts: number,
): SliceAttemptHistory {
  return appendSliceAttemptCycle(
    { runId: '', specId: '', planPath: '', status: 'reports_initialized' },
    sliceId,
    stage,
    { outcome, attempts },
  );
}

export function mergeAttemptHistory(
  left: SliceAttemptHistory | undefined,
  right: SliceAttemptHistory,
): SliceAttemptHistory {
  const merged: Record<string, Record<string, readonly unknown[]>> = {};
  for (const history of [left ?? {}, right]) {
    for (const [sliceId, stages] of Object.entries(history)) {
      const target = merged[sliceId] ?? {};
      for (const [stage, cycles] of Object.entries(stages))
        target[stage] = [...(target[stage] ?? []), ...(cycles ?? [])];
      merged[sliceId] = target;
    }
  }
  return merged as SliceAttemptHistory;
}

function failed(
  sliceId: string,
  step: ReadyStep['kind'],
  reason: string,
  history: SliceAttemptHistory,
): SliceEffectFailure {
  return { status: 'failed', sliceId, step, reason, attemptHistory: history };
}
