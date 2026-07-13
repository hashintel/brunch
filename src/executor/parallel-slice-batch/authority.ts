import { appendFile } from 'node:fs/promises';

import type {
  ExecutorNetEvent,
  ExecutorTopology,
  ExecutorTransition,
  ReadyStep,
} from '../orchestrate-topology.js';
import { appendPetriEvent } from '../petri-events.js';
import {
  petriMarkingLifecycleProvenance,
  writePetriMarkingSnapshot,
  type ParallelSliceBatchSnapshot,
} from '../petri-marking.js';
import { replayTransitionHistory } from '../petri-replay.js';
import { reportsPath } from '../report.js';
import type { RunMetadata } from '../run.js';
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
    epicId: string,
    step: 'agent_result' | 'test_result',
    attempt: number,
    reason: string,
  ): Promise<void>;
  appendReport(event: object): Promise<void>;
  setBatch(batch: ParallelSliceBatchSnapshot): Promise<void>;
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

  const persist = async (terminal?: { readonly kind: 'net_halted'; readonly reason: string }) => {
    try {
      await writePetriMarkingSnapshot({
        cwd: args.ctx.cwd,
        runId: args.ctx.runId,
        snapshot: {
          currentMarking: marking,
          firedTransitionCount: count,
          lifecycleProvenance: petriMarkingLifecycleProvenance(state),
          ...(batch ? { parallelSliceBatch: batch } : {}),
          ...(terminal ? { terminalEventKind: terminal.kind, haltedReason: terminal.reason } : {}),
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
              epicId,
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
        batch = nextBatch;
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
          await appendPetriEvent({
            cwd: args.ctx.cwd,
            runId: args.ctx.runId,
            event: { kind: 'net_halted', runId: args.ctx.runId, runStatus: state.status, step, reason },
          });
        } catch {
          throw new ParallelAuthorityError('petri_journal_append_failed');
        }
        await persist({ kind: 'net_halted', reason });
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
): ExecutorNetEvent {
  const step =
    transition.step?.kind ??
    (transition.id.startsWith('epic_integrate:')
      ? 'epic_integrate'
      : transition.id.startsWith('epic_verify:')
        ? 'epic_verify'
        : 'epic_complete');
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
