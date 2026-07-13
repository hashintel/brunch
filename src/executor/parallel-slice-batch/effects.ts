import { agentResultPath, agentStreamPath } from '../agent-result.js';
import {
  IsolatedSliceOperationError,
  mergeAttemptHistory,
  prepareIsolatedSlice,
  runIsolatedAgentAttempt,
  runIsolatedVerifyAttempt,
  thrownSliceEffectReason,
} from '../isolated-slice-operations.js';
import { SLICE_ATTEMPT_LIMIT, sliceTransitionId, type ReadyStep } from '../orchestrate-topology.js';
import type { SliceAttemptHistory } from '../run.js';
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
        attempt,
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
    const outcome = attemptResult.outcome;
    if (outcome.status === 'succeeded') {
      await args.authority.fire(outcome.transitionId);
      if (report) await args.authority.appendReport(report);
      emitParallelStepProgress(args.ctx, 'completed', agentStep, args.state);
      return {
        status: 'succeeded',
        attemptHistory: outcome.history,
      };
    }
    if (outcome.status === 'verification_failed') {
      throw new Error('agent attempt produced a verification outcome');
    }
    await args.authority.attemptFailed(
      args.sliceId,
      args.epicId,
      outcome.fact.step,
      outcome.fact.attempt,
      outcome.fact.reason,
    );
    await args.authority.fire(outcome.transitionId);
    if (outcome.status === 'exhausted') {
      return { status: 'failed', reason: outcome.reason, attemptHistory: outcome.history };
    }
  }
  throw new Error('agent attempt loop exhausted without an outcome');
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
        attempt,
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
    const outcome = attemptResult.outcome;
    if (outcome.status === 'succeeded' || outcome.status === 'verification_failed') {
      await args.authority.fire(outcome.transitionId);
      if (report) await args.authority.appendReport(report);
      emitParallelStepProgress(args.ctx, 'completed', verifyStep, args.state);
      return outcome.status === 'succeeded'
        ? {
            status: 'succeeded',
            attemptHistory: outcome.history,
          }
        : {
            status: 'failed',
            reason: outcome.reason,
            attemptHistory: outcome.history,
          };
    }
    await args.authority.attemptFailed(
      args.sliceId,
      args.epicId,
      outcome.fact.step,
      outcome.fact.attempt,
      outcome.fact.reason,
    );
    await args.authority.fire(outcome.transitionId);
    if (outcome.status === 'exhausted') {
      return { status: 'failed', reason: outcome.reason, attemptHistory: outcome.history };
    }
  }
  throw new Error('verify attempt loop exhausted without an outcome');
}

export { mergeAttemptHistory };

function failed(
  sliceId: string,
  step: ReadyStep['kind'],
  reason: string,
  history: SliceAttemptHistory,
): SliceEffectFailure {
  return { status: 'failed', sliceId, step, reason, attemptHistory: history };
}
