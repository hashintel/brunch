// Owns the predicates that decide whether two observations of executor Petri/run
// state agree — ordered id-list equality, marking equality, and the terminal-summary
// family split across writer (`petri-events.ts`), reader authority
// (`observer-read.ts`), replay (`petri-replay.ts`), and lifecycle (`orchestrate.ts`).
// Import these; do not re-copy them into a consumer. Copies were byte-identical at
// introduction, so the first divergent edit made those seams silently disagree about
// "equal" and "terminal" while each consumer's own suite stayed green.

import type { PetriTerminalEvent, PetriTerminalEventPayload } from './petri-events.js';
import type { ParallelSliceBatchSnapshot } from './petri-marking.js';
import type { PetriProjection } from './petri-projection.js';
import type { RunMetadata } from './run.js';

export type TerminalSummary = Pick<
  PetriProjection,
  'terminalEventKind' | 'haltedReason' | 'terminalTs' | 'failedSliceIds'
>;

// Tolerates `undefined` on either side so absent and empty id lists stay
// distinguishable: `undefined` equals only `undefined`, never `[]`.
export function stringArraysEqual(
  left: readonly string[] | undefined,
  right: readonly string[] | undefined,
): boolean {
  if (left === undefined || right === undefined) return left === right;
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function petriMarkingsEqual(left: Record<string, number>, right: Record<string, number>): boolean {
  const leftEntries = Object.entries(left);
  return (
    leftEntries.length === Object.keys(right).length &&
    leftEntries.every(([placeId, count]) => right[placeId] === count)
  );
}

export function terminalMatchesPayload(
  existing: PetriTerminalEvent,
  proposed: PetriTerminalEventPayload,
): boolean {
  return (
    existing.kind === proposed.kind &&
    (existing.kind !== 'net_halted' ||
      (proposed.kind === 'net_halted' && existing.reason === proposed.reason)) &&
    stringArraysEqual(existing.failedSliceIds, proposed.failedSliceIds)
  );
}

export function mergeTerminalSummary(
  current: TerminalSummary | undefined | null,
  event: PetriTerminalEvent,
): TerminalSummary | undefined | null {
  const next =
    event.kind === 'net_halted'
      ? typeof event.reason === 'string'
        ? {
            terminalEventKind: 'net_halted' as const,
            haltedReason: event.reason,
            terminalTs: event.ts,
            failedSliceIds: event.failedSliceIds,
          }
        : undefined
      : {
          terminalEventKind: event.kind,
          terminalTs: event.ts,
          failedSliceIds: event.failedSliceIds,
        };
  if (current === null) return null;
  if (next === undefined) return null;
  if (current === undefined) return next;
  return current.terminalEventKind === next.terminalEventKind &&
    current.haltedReason === next.haltedReason &&
    current.terminalTs === next.terminalTs &&
    stringArraysEqual(current.failedSliceIds, next.failedSliceIds)
    ? current
    : null;
}

export function sanitizeTerminalSummary(
  snapshot: {
    readonly terminalEventKind?: PetriProjection['terminalEventKind'] | undefined;
    readonly haltedReason?: string | undefined;
    readonly terminalTs?: string | undefined;
    readonly failedSliceIds?: readonly string[] | undefined;
    readonly parallelSliceBatch?: ParallelSliceBatchSnapshot;
  },
  metadata: RunMetadata,
  replayProjection?: {
    readonly terminalEventKind?: PetriProjection['terminalEventKind'] | undefined;
    readonly haltedReason?: string | undefined;
    readonly terminalTs?: string | undefined;
    readonly failedSliceIds?: readonly string[] | undefined;
  },
): TerminalSummary {
  if (snapshot.terminalEventKind === undefined && snapshot.haltedReason === undefined) {
    // A matching snapshot may lag the journal by the terminal fact (the append
    // wake-up races the marking persist). Backfill from replay truth only — never
    // from metadata expectation, so completion stays journal-ordered.
    if (!replayProjection?.terminalEventKind) return {};
    if (replayProjection.terminalTs === undefined || replayProjection.failedSliceIds === undefined) return {};
    return {
      terminalEventKind: replayProjection.terminalEventKind,
      ...(replayProjection.haltedReason === undefined ? {} : { haltedReason: replayProjection.haltedReason }),
      terminalTs: replayProjection.terminalTs,
      failedSliceIds: replayProjection.failedSliceIds,
    };
  }
  if (
    replayProjection?.terminalEventKind === undefined &&
    snapshot.parallelSliceBatch === undefined &&
    metadata.status !== 'promotion_prepared' &&
    metadata.status !== 'landed' &&
    metadata.status !== 'abandoned'
  ) {
    return {};
  }
  const checkable = replayProjection?.terminalEventKind ? replayProjection : snapshot;
  if (!checkable?.terminalEventKind) {
    return {};
  }
  if (checkable.terminalTs === undefined || checkable.failedSliceIds === undefined) return {};
  if (snapshot.terminalEventKind !== checkable.terminalEventKind) {
    return {};
  }
  if (snapshot.haltedReason !== checkable.haltedReason) {
    return {};
  }
  if (snapshot.terminalTs !== checkable.terminalTs) return {};
  if (!stringArraysEqual(snapshot.failedSliceIds, checkable.failedSliceIds)) return {};
  return {
    terminalEventKind: checkable.terminalEventKind,
    ...(checkable.haltedReason === undefined ? {} : { haltedReason: checkable.haltedReason }),
    terminalTs: checkable.terminalTs,
    failedSliceIds: checkable.failedSliceIds,
  };
}
