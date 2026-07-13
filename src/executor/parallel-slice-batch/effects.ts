import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { agentResultPath, agentStreamPath, type AgentStreamEvent } from '../agent-result.js';
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
import { verifyStreamPath, type VerifyStreamEvent } from '../test-result.js';
import type { BatchAuthority } from './authority.js';
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
  if (!slice || !epicId || !runWorktreeDir) {
    return failed(step.sliceId, 'slice_execute', 'parallel_slice_input_unavailable', {});
  }
  const workspaceDir = sliceWorkspacePath(ctx.cwd, ctx.runId, step.sliceId);
  const workspace = await ctx.ports.gitSliceIntegration.prepare({
    runWorktreeDir,
    sliceWorktreeDir: workspaceDir,
    sliceId: step.sliceId,
  });
  if (workspace.status === 'failed') {
    return failed(step.sliceId, 'slice_execute', 'slice_workspace_failed', {});
  }

  const requestPath = sliceExecutionRequestPath(ctx.cwd, ctx.runId, step.sliceId);
  await mkdir(dirname(requestPath), { recursive: true });
  await writeFile(
    requestPath,
    `${JSON.stringify({ runId: ctx.runId, sliceId: step.sliceId, epicId, action: 'execute_slice', status: 'requested' }, null, 2)}\n`,
    'utf8',
  );
  await authority.fire(sliceTransitionId('slice_execute', step.sliceId));
  await authority.appendReport({
    event: 'slice_execution_requested',
    runId: ctx.runId,
    epicId,
    sliceId: step.sliceId,
    status: 'slice_execution_requested',
  });

  let attemptHistory: SliceAttemptHistory = {};
  const agent = await runAgentAttempts({
    ctx,
    authority,
    sliceId: step.sliceId,
    epicId,
    workspaceDir,
    requestPath,
  });
  attemptHistory = mergeAttemptHistory(attemptHistory, agent.attemptHistory);
  if (agent.status === 'failed') return failed(step.sliceId, 'agent_result', agent.reason, attemptHistory);

  const verification = await runVerifyAttempts({
    ctx,
    authority,
    verifyTarget: args.state.verifyTarget,
    sliceId: step.sliceId,
    epicId,
    workspaceDir,
  });
  attemptHistory = mergeAttemptHistory(attemptHistory, verification.attemptHistory);
  if (verification.status === 'failed') {
    return failed(step.sliceId, 'test_result', verification.reason, attemptHistory);
  }
  return {
    status: 'succeeded',
    sliceId: step.sliceId,
    epicId,
    workspaceDir,
    baseSha: workspace.baseSha,
    attemptHistory,
  };
}

async function runAgentAttempts(args: {
  readonly ctx: ParallelSliceBatchContext;
  readonly authority: BatchAuthority;
  readonly sliceId: string;
  readonly epicId: string;
  readonly workspaceDir: string;
  readonly requestPath: string;
}): Promise<
  | { readonly status: 'succeeded'; readonly attemptHistory: SliceAttemptHistory }
  | { readonly status: 'failed'; readonly reason: string; readonly attemptHistory: SliceAttemptHistory }
> {
  for (let attempt = 1; attempt <= SLICE_ATTEMPT_LIMIT; attempt += 1) {
    const streamPath = agentStreamPath(args.ctx.cwd, args.ctx.runId, args.sliceId, attempt);
    let sequence = 0;
    let streamQueue = Promise.resolve();
    const result = await args.ctx.ports.agentRunner.run({
      worktreeDir: args.workspaceDir,
      requestPath: args.requestPath,
      resultPath: agentResultPath(args.ctx.cwd, args.ctx.runId, args.sliceId, attempt),
      runId: args.ctx.runId,
      epicId: args.epicId,
      sliceId: args.sliceId,
      ...(args.ctx.runtime ? { runtime: args.ctx.runtime } : {}),
      onUpdate: (update) => {
        const event: AgentStreamEvent = {
          event: 'agent_stream',
          runId: args.ctx.runId,
          epicId: args.epicId,
          sliceId: args.sliceId,
          sequence: sequence++,
          kind: update.kind,
          message: update.message,
        };
        const write = streamQueue.then(() =>
          appendStream(streamPath, event, () => args.ctx.onAgentUpdate?.(event)),
        );
        streamQueue = write.catch(() => undefined);
        return write;
      },
    });
    await streamQueue;
    if (result.status === 'completed') {
      await args.authority.fire(attemptSuccessTransitionId('agent', args.sliceId, attempt));
      await args.authority.appendReport({
        event: 'slice_agent_result',
        runId: args.ctx.runId,
        epicId: args.epicId,
        sliceId: args.sliceId,
        status: 'completed',
        ...(result.summary ? { summary: result.summary } : {}),
      });
      return {
        status: 'succeeded',
        attemptHistory: attemptHistory(args.sliceId, 'agent', 'succeeded', attempt),
      };
    }
    await args.authority.attemptFailed(args.sliceId, args.epicId, 'agent_result', attempt, result.message);
    await args.authority.fire(
      attempt < SLICE_ATTEMPT_LIMIT
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
  readonly epicId: string;
  readonly workspaceDir: string;
}): Promise<
  | { readonly status: 'succeeded'; readonly attemptHistory: SliceAttemptHistory }
  | { readonly status: 'failed'; readonly reason: string; readonly attemptHistory: SliceAttemptHistory }
> {
  for (let attempt = 1; attempt <= SLICE_ATTEMPT_LIMIT; attempt += 1) {
    const streamPath = verifyStreamPath(args.ctx.cwd, args.ctx.runId, args.sliceId, attempt);
    let sequence = 0;
    const result = await args.ctx.ports.testRunner.run({
      worktreeDir: args.workspaceDir,
      ...(args.verifyTarget ? { verifyTarget: args.verifyTarget } : {}),
      ...(args.ctx.signal ? { signal: args.ctx.signal } : {}),
      onUpdate: async (update) => {
        const event: VerifyStreamEvent = {
          event: 'verify_stream',
          runId: args.ctx.runId,
          epicId: args.epicId,
          sliceId: args.sliceId,
          sequence: sequence++,
          kind: update.kind,
          message: update.message,
        };
        await appendStream(streamPath, event, () => args.ctx.onVerifyUpdate?.(event));
      },
    });
    if (result.status === 'completed') {
      await args.authority.fire(attemptSuccessTransitionId('verify', args.sliceId, attempt));
      await args.authority.appendReport({
        event: 'slice_test_result',
        runId: args.ctx.runId,
        epicId: args.epicId,
        sliceId: args.sliceId,
        status: result.verdict,
        exitCode: result.exitCode,
        ...(result.target ? { target: result.target } : {}),
      });
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
      attempt < SLICE_ATTEMPT_LIMIT
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

async function appendStream(path: string, event: object, notify: () => void): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(event)}\n`, 'utf8');
  try {
    notify();
  } catch {
    /* Observer failures never affect execution. */
  }
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
