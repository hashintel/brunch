import { readFile } from 'node:fs/promises';

import { sliceTransitionId, type ExecutorNetEvent } from './orchestrate-topology.js';
import {
  authorityFailure,
  createBatchAuthority,
  ParallelAuthorityError,
} from './parallel-slice-batch/authority.js';
import { executeIsolatedSlice, mergeAttemptHistory } from './parallel-slice-batch/effects.js';
import { emitParallelStepProgress } from './parallel-slice-batch/progress.js';
import type {
  ParallelSliceBatchArgs,
  ParallelSliceBatchResult,
  SliceEffectFailure,
  SliceEffectResult,
} from './parallel-slice-batch/types.js';
import { parsePetriEvent, petriEventsPath } from './petri-events.js';
import type { ParallelSliceSettlement } from './petri-marking.js';
import { projectExecutorPetriTransitionHistory } from './petri-runtime.js';
import { persistRunMetadata, runMetadataPath, type RunMetadata } from './run.js';

export type { ParallelSliceBatchResult };

export async function parallelSliceBatchRecoveryRequired(args: {
  readonly cwd: string;
  readonly runId: string;
  readonly lifecycleFiredTransitionCount: number;
}): Promise<boolean> {
  try {
    const events = (await readFile(petriEventsPath(args.cwd, args.runId), 'utf8'))
      .split('\n')
      .filter(Boolean)
      .map((line) => parsePetriEvent(JSON.parse(line)))
      .filter((event): event is ExecutorNetEvent => event !== undefined);
    return (
      events.filter((event) => event.kind === 'transition_fired').length > args.lifecycleFiredTransitionCount
    );
  } catch (error) {
    return !isNodeError(error) || (error.code !== 'ENOENT' && error.code !== 'EISDIR');
  }
}

/**
 * Executes one co-firable slice frontier without sharing active-slice run.json fields.
 * Journal + marking mutation and fan-in stay serialized; only isolated effects overlap.
 */
export async function executeParallelSliceBatch(
  args: ParallelSliceBatchArgs,
): Promise<ParallelSliceBatchResult> {
  const { ctx, plan, runtime } = args;
  const claimedSliceIds = args.steps.map((step) => step.sliceId);
  const settlements = new Map<string, ParallelSliceSettlement>();
  const authority = createBatchAuthority({
    ctx,
    state: args.state,
    topology: runtime.topology,
    currentMarking: runtime.currentMarking,
    firedTransitionCount: projectExecutorPetriTransitionHistory(args.state, plan)?.transitionIds.length ?? 0,
    batch: { claimedSliceIds, settlements: [] },
  });

  try {
    for (const step of args.steps) {
      await authority.fire(sliceTransitionId('slice_start', step.sliceId));
    }
    for (const step of args.steps) {
      emitParallelStepProgress(ctx, 'started', step, args.state);
      emitParallelStepProgress(ctx, 'completed', step, args.state);
    }
  } catch (error) {
    return {
      status: 'halted',
      runStatus: args.state.status,
      step: 'slice_start',
      reason: error instanceof ParallelAuthorityError ? error.reason : 'petri_claim_persist_failed',
    };
  }

  const effects = args.steps.map(async (step) => {
    try {
      const result = await executeIsolatedSlice({ ctx, state: args.state, plan, step, authority });
      settlements.set(
        step.sliceId,
        result.status === 'succeeded'
          ? { sliceId: step.sliceId, status: 'succeeded' }
          : {
              sliceId: step.sliceId,
              status: 'failed',
              step: result.step,
              reason: result.reason,
            },
      );
      await authority.setBatch({
        claimedSliceIds,
        settlements: claimedSliceIds.flatMap((sliceId) => {
          const settlement = settlements.get(sliceId);
          return settlement ? [settlement] : [];
        }),
      });
      return { status: 'settled' as const, result };
    } catch (error) {
      return { status: 'rejected' as const, error };
    }
  });

  let summary = args.state;
  let halt: SliceEffectFailure | undefined;
  try {
    for (const [index, sliceId] of claimedSliceIds.entries()) {
      const settled = await effects[index]!;
      if (settled.status === 'rejected') return authorityFailure(summary.status, settled.error);
      const result = settled.result;
      if (result.status === 'failed') {
        halt ??= result;
        continue;
      }
      if (halt?.step === 'slice_integrate') continue;

      const integrateStep = {
        kind: 'slice_integrate' as const,
        sliceId,
        ...(result.epicId === undefined ? {} : { epicId: result.epicId }),
      };
      emitParallelStepProgress(ctx, 'started', integrateStep, summary);
      const integrated = await ctx.ports.gitSliceIntegration.integrate({
        runWorktreeDir: summary.worktreeDir!,
        sliceWorktreeDir: result.workspaceDir,
        sliceId,
        baseSha: result.baseSha,
      });
      if (integrated.status !== 'integrated') {
        await authority.appendReport({
          event: integrated.status === 'conflict' ? 'slice_integration_conflict' : 'slice_integration_failed',
          runId: ctx.runId,
          sliceId,
          status: integrated.status,
          message: integrated.message,
        });
        halt = {
          status: 'failed',
          sliceId,
          step: 'slice_integrate',
          reason:
            integrated.status === 'conflict' ? 'slice_integration_conflict' : 'slice_integration_failed',
          attemptHistory: result.attemptHistory,
        };
        continue;
      }

      await authority.fire(sliceTransitionId('slice_integrate', sliceId));
      await authority.appendReport({
        event: 'slice_integrated',
        runId: ctx.runId,
        ...(result.epicId === undefined ? {} : { epicId: result.epicId }),
        sliceId,
        status: 'slice_integrated',
        sliceCommitSha: integrated.sliceCommitSha,
        integrationCommitSha: integrated.integrationCommitSha,
      });
      emitParallelStepProgress(ctx, 'completed', integrateStep, summary);
      const completeStep = {
        kind: 'slice_complete' as const,
        sliceId,
        ...(result.epicId === undefined ? {} : { epicId: result.epicId }),
      };
      emitParallelStepProgress(ctx, 'started', completeStep, summary);
      await authority.fire(sliceTransitionId('slice_complete', sliceId));
      await authority.appendReport({
        event: 'slice_completed',
        runId: ctx.runId,
        ...(result.epicId === undefined ? {} : { epicId: result.epicId }),
        sliceId,
        status: 'slice_completed',
      });
      summary = updateRunSummary(summary, result, integrated.integrationCommitSha);
      await persistRunMetadata(runMetadataPath(ctx.cwd, ctx.runId), summary);
      await authority.setState(summary);
      emitParallelStepProgress(ctx, 'completed', completeStep, summary, summary.status);
    }
  } catch (error) {
    return authorityFailure(summary.status, error);
  }

  if (halt) {
    try {
      await authority.halt(halt.step, halt.reason);
    } catch (error) {
      return authorityFailure(summary.status, error);
    }
    return { status: 'halted', runStatus: summary.status, step: halt.step, reason: halt.reason };
  }

  try {
    await authority.clearBatch();
  } catch (error) {
    return authorityFailure(summary.status, error);
  }
  return { status: 'completed', runStatus: summary.status, firings: authority.firings() };
}

function updateRunSummary(
  summary: RunMetadata,
  result: Extract<SliceEffectResult, { readonly status: 'succeeded' }>,
  integrationCommitSha: string,
): RunMetadata {
  return {
    ...summary,
    status: 'slice_completed',
    completedSliceIds: [...(summary.completedSliceIds ?? []), result.sliceId],
    integratedSliceCommits: {
      ...summary.integratedSliceCommits,
      [result.sliceId]: integrationCommitSha,
    },
    sliceAttemptHistory: mergeAttemptHistory(summary.sliceAttemptHistory, result.attemptHistory),
  };
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
