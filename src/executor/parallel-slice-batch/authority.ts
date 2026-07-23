import { appendFile } from 'node:fs/promises';

import type {
  ExecutorNetEventPayload,
  ExecutorTopology,
  ExecutorTransition,
  ReadyStep,
} from '../orchestrate-topology.js';
import { appendPetriEvent, appendPetriTerminalOnce, type PetriTerminalEvent } from '../petri-events.js';
import {
  petriMarkingLifecycleProvenance,
  writePetriMarkingSnapshot,
  type ParallelSliceBatchSnapshot,
} from '../petri-marking.js';
import { replayTransitionHistory } from '../petri-replay.js';
import { reportsPath } from '../report.js';
import type { RunMetadata } from '../run.js';
import type { PendingSliceRepair, SliceRepairHistory } from '../slice-repair-cycle.js';
import type { ParallelSliceBatchContext, ParallelSliceBatchResult } from './types.js';

export class ParallelAuthorityError extends Error {
  constructor(readonly reason: 'petri_journal_append_failed' | 'petri_marking_persist_failed') {
    super(reason);
  }
}

export interface BatchAuthority {
  fire(transitionId: string): Promise<void>;
  attemptFailed(
    sliceId: string,
    epicId: string | undefined,
    step: 'agent_result' | 'test_result',
    attempt: number,
    reason: string,
  ): Promise<void>;
  appendReport(event: object): Promise<void>;
  setBatch(batch: ParallelSliceBatchSnapshot): Promise<void>;
  stageRepair(pending: PendingSliceRepair, history: SliceRepairHistory): Promise<void>;
  markRepairMaterialized(pending: PendingSliceRepair): Promise<void>;
  clearRepair(sliceId: string): Promise<void>;
  setState(state: RunMetadata): Promise<void>;
  clearBatch(): Promise<void>;
  halt(step: ReadyStep['kind'], reason: string): Promise<void>;
  firings(): number;
}

export function createBatchAuthority(args: {
  readonly ctx: ParallelSliceBatchContext;
  readonly state: RunMetadata;
  readonly topology: ExecutorTopology;
  readonly currentMarking: Record<string, number>;
  readonly firedTransitionCount: number;
  readonly batch: ParallelSliceBatchSnapshot;
}): BatchAuthority {
  let queue = Promise.resolve();
  let reportQueue = Promise.resolve();
  let state = args.state;
  let marking = args.currentMarking;
  let count = args.firedTransitionCount;
  let batch: ParallelSliceBatchSnapshot | undefined = args.batch;
  let firings = 0;
  let failure: unknown;
  const transitions = new Map(args.topology.transitions.map((transition) => [transition.id, transition]));

  const persist = async (terminal?: PetriTerminalEvent) => {
    try {
      await writePetriMarkingSnapshot({
        cwd: args.ctx.cwd,
        runId: args.ctx.runId,
        snapshot: {
          currentMarking: marking,
          firedTransitionCount: count,
          lifecycleProvenance: petriMarkingLifecycleProvenance(state),
          ...(batch ? { parallelSliceBatch: batch } : {}),
          ...(terminal
            ? {
                terminalEventKind: terminal.kind,
                ...(terminal.kind === 'net_halted' && terminal.reason !== undefined
                  ? { haltedReason: terminal.reason }
                  : {}),
                terminalTs: terminal.ts,
                failedSliceIds: terminal.failedSliceIds,
              }
            : {}),
        },
      });
    } catch {
      throw new ParallelAuthorityError('petri_marking_persist_failed');
    }
  };
  const enqueue = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = queue.then(async () => {
      if (failure) throw failure;
      try {
        return await operation();
      } catch (error) {
        failure = error;
        throw error;
      }
    });
    queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };
  const fire = (transitionId: string) =>
    enqueue(async () => {
      const transition = transitions.get(transitionId);
      if (!transition) throw new Error(`missing parallel transition ${transitionId}`);
      try {
        await appendPetriEvent({
          cwd: args.ctx.cwd,
          runId: args.ctx.runId,
          event: transitionEvent(args.ctx.runId, state.status, transition),
        });
      } catch {
        throw new ParallelAuthorityError('petri_journal_append_failed');
      }
      const replay = replayTransitionHistory({ transitions: [transition], initialMarking: marking }, [
        transitionId,
      ]);
      if (!replay) throw new Error(`parallel transition ${transitionId} is not enabled`);
      marking = replay.currentMarking;
      count += 1;
      firings += 1;
      await persist();
    });

  return {
    fire,
    attemptFailed(sliceId, epicId, step, attempt, reason) {
      return enqueue(async () => {
        try {
          await appendPetriEvent({
            cwd: args.ctx.cwd,
            runId: args.ctx.runId,
            event: {
              kind: 'attempt_failed',
              runId: args.ctx.runId,
              runStatus: state.status,
              sliceId,
              ...(epicId === undefined ? {} : { epicId }),
              step,
              attempt,
              reason,
            },
          });
        } catch {
          throw new ParallelAuthorityError('petri_journal_append_failed');
        }
      });
    },
    appendReport(event) {
      const write = reportQueue.then(async () => {
        if (failure) throw failure;
        try {
          await appendFile(
            state.reportsPath ?? reportsPath(args.ctx.cwd, args.ctx.runId),
            `${JSON.stringify(event)}\n`,
            'utf8',
          );
        } catch (error) {
          failure = error;
          throw error;
        }
      });
      reportQueue = write.catch(() => undefined);
      return write;
    },
    setBatch(nextBatch) {
      return enqueue(async () => {
        batch = {
          ...nextBatch,
          ...(batch?.pendingRepairs?.length
            ? {
                pendingRepairs: batch.pendingRepairs,
                pendingRepairHistory: batch.pendingRepairHistory!,
              }
            : {}),
        };
        await persist();
      });
    },
    stageRepair(pending, history) {
      return enqueue(async () => {
        if (!batch) throw new Error('parallel repair requires active batch authority');
        batch = {
          ...batch,
          pendingRepairs: [
            ...(batch.pendingRepairs ?? []).filter((candidate) => candidate.sliceId !== pending.sliceId),
            pending,
          ],
          pendingRepairHistory: {
            ...batch.pendingRepairHistory,
            [pending.sliceId]: history[pending.sliceId]!,
          },
        };
        await persist();
      });
    },
    markRepairMaterialized(pending) {
      return enqueue(async () => {
        if (!batch?.pendingRepairs?.some((candidate) => candidate.sliceId === pending.sliceId)) {
          throw new Error('parallel repair was not durably staged');
        }
        batch = {
          ...batch,
          pendingRepairs: batch.pendingRepairs.map((candidate) =>
            candidate.sliceId === pending.sliceId ? pending : candidate,
          ),
        };
        await persist();
      });
    },
    clearRepair(sliceId) {
      return enqueue(async () => {
        if (!batch) throw new Error('parallel repair requires active batch authority');
        const pendingRepairs = (batch.pendingRepairs ?? []).filter(
          (candidate) => candidate.sliceId !== sliceId,
        );
        const { pendingRepairs: _pendingRepairs, ...withoutPending } = batch;
        const { [sliceId]: _clearedHistory, ...pendingRepairHistory } =
          withoutPending.pendingRepairHistory ?? {};
        const { pendingRepairHistory: _pendingRepairHistory, ...withoutRepairAuthority } = withoutPending;
        batch = {
          ...withoutRepairAuthority,
          ...(pendingRepairs.length === 0 ? {} : { pendingRepairs }),
          ...(Object.keys(pendingRepairHistory).length === 0 ? {} : { pendingRepairHistory }),
        };
        await persist();
      });
    },
    setState(nextState) {
      return enqueue(async () => {
        state = nextState;
        await persist();
      });
    },
    clearBatch() {
      return enqueue(async () => {
        batch = undefined;
        await persist();
      });
    },
    halt(step, reason) {
      return enqueue(async () => {
        try {
          const claimedSliceIds = batch?.claimedSliceIds ?? [];
          const failed = new Set([
            ...(state.failedSliceIds ?? []),
            ...(batch?.settlements ?? []).flatMap((settlement) =>
              settlement.status === 'failed' ? [settlement.sliceId] : [],
            ),
          ]);
          const failedSliceIds = [
            ...new Set((state.failedSliceIds ?? []).filter((sliceId) => !claimedSliceIds.includes(sliceId))),
            ...claimedSliceIds.filter((sliceId) => failed.has(sliceId)),
          ];
          const terminal = await appendPetriTerminalOnce({
            cwd: args.ctx.cwd,
            runId: args.ctx.runId,
            event: {
              kind: 'net_halted',
              runId: args.ctx.runId,
              runStatus: state.status,
              step,
              reason,
              failedSliceIds,
            },
          });
          await persist(terminal);
        } catch {
          throw new ParallelAuthorityError('petri_journal_append_failed');
        }
      });
    },
    firings: () => firings,
  };
}

export function authorityFailure(runStatus: RunMetadata['status'], error: unknown): ParallelSliceBatchResult {
  return {
    status: 'halted',
    runStatus,
    step: 'slice_start',
    reason: error instanceof ParallelAuthorityError ? error.reason : 'parallel_slice_batch_failed',
  };
}

function transitionEvent(
  runId: string,
  status: RunMetadata['status'],
  transition: ExecutorTransition,
): ExecutorNetEventPayload {
  const step =
    transition.step?.kind ??
    (transition.id.startsWith('epic_integrate:')
      ? 'epic_integrate'
      : transition.id.startsWith('epic_verify:')
        ? 'epic_verify'
        : transition.id.startsWith('epic_complete:')
          ? 'epic_complete'
          : transition.id.startsWith('agent_')
            ? 'agent_result'
            : 'test_result');
  return {
    kind: 'transition_fired',
    runId,
    runStatus: status,
    transitionId: transition.id,
    subnetId: transition.subnetId,
    ...(transition.epicId ? { epicId: transition.epicId } : {}),
    ...(transition.derivedFrom ? { derivedFrom: transition.derivedFrom } : {}),
    step,
    contract: transition.contract,
    consumed: transition.inputArcs.map((arc) => arc.placeId),
    produced: transition.outputArcs.map((arc) => arc.placeId),
    fromStatus: status,
    toStatus: status,
  };
}
