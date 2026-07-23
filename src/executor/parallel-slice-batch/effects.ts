import { agentResultPath, agentStreamPath } from '../agent-result.js';
import {
  IsolatedSliceOperationError,
  mergeAttemptHistory,
  prepareIsolatedSlice,
  readSliceRequestContext,
  runIsolatedAgentAttempt,
  runIsolatedVerifyAttempt,
  thrownSliceEffectReason,
} from '../isolated-slice-operations.js';
import { sliceTransitionId, type ReadyStep } from '../orchestrate-topology.js';
import { runDirPath } from '../run.js';
import { sliceExecutionRequestPath } from '../slice-execute.js';
import {
  MAX_REPAIR_CYCLES,
  MAX_STAGE_ATTEMPTS,
  sliceRepairProtocol,
  sliceRepairTopology,
  type ActiveSliceRepairContext,
  type PendingSliceRepair,
  type SliceRepairHistory,
} from '../slice-repair-cycle.js';
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
  const sliceContext = await readSliceRequestContext({
    cwd: ctx.cwd,
    runId: ctx.runId,
    ...(args.state.populatedPlanPath ? { populatedPlanPath: args.state.populatedPlanPath } : {}),
    sliceId: step.sliceId,
  });
  if (sliceContext.status === 'invalid') {
    return failed(step.sliceId, 'slice_execute', `plan_slice_invalid: ${sliceContext.message}`, {});
  }
  let workspace: Awaited<ReturnType<typeof prepareIsolatedSlice>>;
  try {
    workspace = await prepareIsolatedSlice({
      runId: ctx.runId,
      sliceId: step.sliceId,
      ...(epicId === undefined ? {} : { epicId }),
      runWorktreeDir,
      sliceWorktreeDir: workspaceDir,
      requestPath: sliceExecutionRequestPath(ctx.cwd, ctx.runId, step.sliceId),
      requestContext: sliceContext.requestContext,
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

  let attemptHistory: SliceRepairHistory = {};
  let repairContext: ActiveSliceRepairContext | undefined;
  let repairAuthority: PendingSliceRepair | undefined;
  for (let cycle = 1; cycle <= MAX_REPAIR_CYCLES; cycle += 1) {
    if (repairContext) {
      if (!repairAuthority) {
        return failed(step.sliceId, 'agent_result', 'repair_context_authority_missing', attemptHistory);
      }
      try {
        await sliceRepairProtocol.validateActiveRepair({
          authority: repairAuthority,
          reference: repairContext,
          trusted: {
            runDir: runDirPath(ctx.cwd, ctx.runId),
            runId: ctx.runId,
            sliceId: step.sliceId,
            ...(args.state.verifyTarget === undefined ? {} : { target: args.state.verifyTarget }),
            policy: sliceRepairProtocol.policy,
            history: attemptHistory,
          },
        });
      } catch (error) {
        return failed(
          step.sliceId,
          'agent_result',
          thrownSliceEffectReason('repair_context_unreadable', error),
          attemptHistory,
        );
      }
    }
    const agent = await runAgentAttempts({
      ctx,
      authority,
      sliceId: step.sliceId,
      ...(epicId === undefined ? {} : { epicId }),
      cycle,
      workspaceDir,
      requestPath,
      attemptHistory,
      ...(repairContext === undefined ? {} : { repairContext }),
      ...(repairAuthority === undefined ? {} : { repairAuthority }),
      state: args.state,
      step,
    });
    attemptHistory = mergeAttemptHistory(attemptHistory, agent.historyDelta);
    if (agent.status === 'failed') {
      return failed(step.sliceId, 'agent_result', agent.reason, attemptHistory);
    }

    const verification = await runVerifyAttempts({
      ctx,
      authority,
      verifyTarget: args.state.verifyTarget,
      sliceId: step.sliceId,
      ...(epicId === undefined ? {} : { epicId }),
      cycle,
      workspaceDir,
      attemptHistory,
      step,
      state: args.state,
    });
    attemptHistory = mergeAttemptHistory(attemptHistory, verification.historyDelta);
    if (verification.status === 'failed') {
      return failed(step.sliceId, 'test_result', verification.reason, attemptHistory);
    }
    const trustedRepairState = {
      runDir: runDirPath(ctx.cwd, ctx.runId),
      runId: ctx.runId,
      sliceId: step.sliceId,
      ...(args.state.verifyTarget === undefined ? {} : { target: args.state.verifyTarget }),
      policy: sliceRepairProtocol.policy,
      history: attemptHistory,
    };
    const decision = sliceRepairProtocol.completeVerification({
      trusted: trustedRepairState,
      verdict: verification.verdict,
      cycle,
      verifyArtifactOrdinal: verification.artifactAttempt,
      stageAttempt: verification.stageAttempt,
      exitCode: verification.exitCode,
      stdout: verification.diagnostics.stdout,
      stderr: verification.diagnostics.stderr,
    });
    if (decision.kind === 'pass') {
      await authority.fire(verification.verdictTransitionId);
      return {
        status: 'succeeded',
        sliceId: step.sliceId,
        ...(epicId === undefined ? {} : { epicId }),
        cycle,
        workspaceDir,
        baseSha: workspace.baseSha,
        attemptHistory,
      };
    }
    if (decision.kind === 'exhaust') {
      await authority.fire(verification.verdictTransitionId);
      return failed(step.sliceId, 'test_result', 'slice_verification_not_passed', attemptHistory);
    }
    const pending = decision.pending;
    await authority.stageRepair(pending, attemptHistory);
    let materialized;
    try {
      materialized = await sliceRepairProtocol.materializeRepair({
        pending,
        trusted: trustedRepairState,
      });
    } catch (error) {
      return failed(
        step.sliceId,
        'test_result',
        thrownSliceEffectReason('repair_context_materialization_failed', error),
        attemptHistory,
      );
    }
    await authority.markRepairMaterialized(materialized);
    await authority.fire(verification.verdictTransitionId);
    await authority.fire(sliceRepairTopology.verifyRepairTransitionId(step.sliceId, cycle));
    await authority.clearRepair(step.sliceId);
    repairContext = sliceRepairProtocol.activateRepair({
      pending: materialized,
      trusted: trustedRepairState,
    });
    repairAuthority = materialized;
  }
  throw new Error('repair cycle loop exhausted without a decision');
}

async function runAgentAttempts(args: {
  readonly ctx: ParallelSliceBatchContext;
  readonly authority: BatchAuthority;
  readonly sliceId: string;
  readonly epicId?: string;
  readonly cycle: number;
  readonly workspaceDir: string;
  readonly requestPath: string;
  readonly attemptHistory: SliceRepairHistory;
  readonly repairContext?: ActiveSliceRepairContext;
  readonly repairAuthority?: PendingSliceRepair;
  readonly state: import('../run.js').RunMetadata;
  readonly step: ParallelSliceStep;
}): Promise<
  | {
      readonly status: 'succeeded';
      readonly historyDelta: import('../slice-repair-cycle.js').SliceRepairHistoryDelta;
    }
  | {
      readonly status: 'failed';
      readonly reason: string;
      readonly historyDelta?: import('../slice-repair-cycle.js').SliceRepairHistoryDelta;
    }
> {
  const firstArtifact = sliceRepairProtocol.nextArtifactOrdinal(
    args.attemptHistory,
    args.sliceId,
    'agent',
    sliceRepairProtocol.policy,
  );
  for (let attempt = 1; attempt <= MAX_STAGE_ATTEMPTS; attempt += 1) {
    const artifactAttempt = firstArtifact + attempt - 1;
    const streamPath = agentStreamPath(args.ctx.cwd, args.ctx.runId, args.sliceId, artifactAttempt);
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
        resultPath: agentResultPath(args.ctx.cwd, args.ctx.runId, args.sliceId, artifactAttempt),
        streamPath,
        cycle: args.cycle,
        attempt,
        artifactAttempt,
        ...(args.repairContext === undefined
          ? {}
          : {
              repairContext: args.repairContext,
              repairContextAuthority: {
                pending: args.repairAuthority!,
                runDir: runDirPath(args.ctx.cwd, args.ctx.runId),
                target: args.state.verifyTarget!,
                history: args.attemptHistory,
              },
            }),
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
      };
    }
    const outcome = attemptResult.outcome;
    if (outcome.status === 'succeeded') {
      await args.authority.fire(outcome.transitionId);
      if (report) await args.authority.appendReport(report);
      emitParallelStepProgress(args.ctx, 'completed', agentStep, args.state);
      return {
        status: 'succeeded',
        historyDelta: outcome.historyDelta,
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
      return {
        status: 'failed',
        reason: outcome.reason,
        ...(outcome.historyDelta === undefined ? {} : { historyDelta: outcome.historyDelta }),
      };
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
  readonly cycle: number;
  readonly workspaceDir: string;
  readonly attemptHistory: SliceRepairHistory;
  readonly step: ParallelSliceStep;
  readonly state: import('../run.js').RunMetadata;
}): Promise<
  | {
      readonly status: 'completed';
      readonly verdict: 'passed' | 'failed';
      readonly exitCode: number;
      readonly artifactAttempt: number;
      readonly stageAttempt: number;
      readonly verdictTransitionId: string;
      readonly diagnostics: Awaited<ReturnType<typeof runIsolatedVerifyAttempt>>['diagnostics'];
      readonly historyDelta: import('../slice-repair-cycle.js').SliceRepairHistoryDelta;
    }
  | {
      readonly status: 'failed';
      readonly reason: string;
      readonly historyDelta?: import('../slice-repair-cycle.js').SliceRepairHistoryDelta;
    }
> {
  const firstArtifact = sliceRepairProtocol.nextArtifactOrdinal(
    args.attemptHistory,
    args.sliceId,
    'verify',
    sliceRepairProtocol.policy,
  );
  for (let attempt = 1; attempt <= MAX_STAGE_ATTEMPTS; attempt += 1) {
    const artifactAttempt = firstArtifact + attempt - 1;
    const streamPath = verifyStreamPath(args.ctx.cwd, args.ctx.runId, args.sliceId, artifactAttempt);
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
        cycle: args.cycle,
        attempt,
        artifactAttempt,
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
      };
    }
    const outcome = attemptResult.outcome;
    if (outcome.status === 'succeeded' || outcome.status === 'verification_failed') {
      await args.authority.fire(outcome.transitionId);
      if (report) await args.authority.appendReport(report);
      emitParallelStepProgress(args.ctx, 'completed', verifyStep, args.state);
      if (attemptResult.result.status !== 'completed') {
        throw new Error('completed verification outcome has no completed result');
      }
      return {
        status: 'completed',
        verdict: attemptResult.result.verdict,
        exitCode: attemptResult.result.exitCode,
        artifactAttempt,
        stageAttempt: attempt,
        verdictTransitionId: outcome.verdictTransitionId!,
        diagnostics: attemptResult.diagnostics,
        historyDelta: outcome.historyDelta,
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
      return {
        status: 'failed',
        reason: outcome.reason,
        ...(outcome.historyDelta === undefined ? {} : { historyDelta: outcome.historyDelta }),
      };
    }
  }
  throw new Error('verify attempt loop exhausted without an outcome');
}

export { mergeAttemptHistory };

function failed(
  sliceId: string,
  step: ReadyStep['kind'],
  reason: string,
  history: SliceRepairHistory,
): SliceEffectFailure {
  return { status: 'failed', sliceId, step, reason, attemptHistory: history };
}
