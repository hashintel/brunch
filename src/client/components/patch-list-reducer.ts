// Patch-list module's functional core (D132).
// Events are the internal primitive — append-only — shaped to match A71's
// future server-side `appendPatch(spec, patch[])` so migration is a reducer
// swap, not a public-API rewrite. Public surface is `patch-list-host.tsx`.

import type { KnowledgeKind } from '@/shared/knowledge.js';

// ---- Patch types (closed discriminated union — V2 extends `Patch`) ----

export interface PatchAnchor {
  kind: KnowledgeKind;
  itemId: number;
}

export interface PatchSelectionRange {
  start: number;
  end: number;
}

interface PatchBase {
  id: string;
  anchor: PatchAnchor;
  summary: string;
  selectionRange?: PatchSelectionRange;
  createdAt: number;
}

export interface AnnotatePatch extends PatchBase {
  kind: 'annotate';
  body: string;
}

export type Patch = AnnotatePatch;
// V2: export type Patch = AnnotatePatch | EditPatch | EdgePatch | DrillDownPatch;

export type StagePatchInput = Omit<Patch, 'id' | 'createdAt'>;

// ---- Events (the only writable primitive) ----

export interface PatchStagedEvent {
  type: 'PatchStaged';
  patchId: string;
  patch: Patch;
}
export interface PatchDiscardedEvent {
  type: 'PatchDiscarded';
  patchId: string;
}
export interface PatchSummaryEditedEvent {
  type: 'PatchSummaryEdited';
  patchId: string;
  summary: string;
}
export interface BatchAppliedEvent {
  type: 'BatchApplied';
  batchId: string;
  patchIds: readonly string[];
}
export interface BatchUndoneEvent {
  type: 'BatchUndone';
  batchId: string;
}

export type PatchEvent =
  | PatchStagedEvent
  | PatchDiscardedEvent
  | PatchSummaryEditedEvent
  | BatchAppliedEvent
  | BatchUndoneEvent;

// ---- Reducer state ----

// Undo handles are not serializable, so they sidecar alongside events.
// Migrating to A71 (server-side event log) keeps `events` as the wire format
// and re-derives `pendingUndos` from server response shape — no public-API change.
export interface PatchListReducerState {
  events: readonly PatchEvent[];
  isApplying: boolean;
  pendingUndos: ReadonlyMap<string, () => Promise<void>>;
}

export type PatchListAction =
  | { type: 'STAGE'; patchId: string; patch: Patch }
  | { type: 'DISCARD'; patchId: string }
  | { type: 'EDIT_SUMMARY'; patchId: string; summary: string }
  | { type: 'APPLY_START' }
  | {
      type: 'APPLY_SUCCESS';
      batchId: string;
      patchIds: readonly string[];
      undoHandle: () => Promise<void>;
    }
  | { type: 'APPLY_FAILURE' }
  | { type: 'UNDO_SUCCESS'; batchId: string };

export const initialPatchListState: PatchListReducerState = {
  events: [],
  isApplying: false,
  pendingUndos: new Map(),
};

export function patchListReducer(
  state: PatchListReducerState,
  action: PatchListAction,
): PatchListReducerState {
  switch (action.type) {
    case 'STAGE':
      return {
        ...state,
        events: [...state.events, { type: 'PatchStaged', patchId: action.patchId, patch: action.patch }],
      };
    case 'DISCARD':
      return {
        ...state,
        events: [...state.events, { type: 'PatchDiscarded', patchId: action.patchId }],
      };
    case 'EDIT_SUMMARY':
      return {
        ...state,
        events: [
          ...state.events,
          { type: 'PatchSummaryEdited', patchId: action.patchId, summary: action.summary },
        ],
      };
    case 'APPLY_START':
      return { ...state, isApplying: true };
    case 'APPLY_SUCCESS': {
      const nextUndos = new Map(state.pendingUndos);
      nextUndos.set(action.batchId, action.undoHandle);
      return {
        ...state,
        isApplying: false,
        events: [
          ...state.events,
          { type: 'BatchApplied', batchId: action.batchId, patchIds: action.patchIds },
        ],
        pendingUndos: nextUndos,
      };
    }
    case 'APPLY_FAILURE':
      return { ...state, isApplying: false };
    case 'UNDO_SUCCESS': {
      const nextUndos = new Map(state.pendingUndos);
      nextUndos.delete(action.batchId);
      return {
        ...state,
        events: [...state.events, { type: 'BatchUndone', batchId: action.batchId }],
        pendingUndos: nextUndos,
      };
    }
  }
}

// ---- Pure fold over events → derived state ----

export interface DerivedPatchListState {
  staged: readonly Patch[];
  count: number;
  canUndo: boolean;
  isApplying: boolean;
  lastBatchId: string | null;
}

interface FoldAccumulator {
  byId: Map<string, Patch>;
  stagedOrder: string[]; // patchIds, in stage order
  appliedPatchIds: Set<string>;
  appliedBatches: Array<{ batchId: string; patchIds: readonly string[] }>;
  undoneBatchIds: Set<string>;
}

function foldEvents(events: readonly PatchEvent[]): FoldAccumulator {
  const acc: FoldAccumulator = {
    byId: new Map(),
    stagedOrder: [],
    appliedPatchIds: new Set(),
    appliedBatches: [],
    undoneBatchIds: new Set(),
  };

  for (const event of events) {
    switch (event.type) {
      case 'PatchStaged':
        acc.byId.set(event.patchId, event.patch);
        acc.stagedOrder.push(event.patchId);
        break;
      case 'PatchDiscarded': {
        const idx = acc.stagedOrder.indexOf(event.patchId);
        if (idx >= 0) acc.stagedOrder.splice(idx, 1);
        acc.byId.delete(event.patchId);
        break;
      }
      case 'PatchSummaryEdited': {
        const existing = acc.byId.get(event.patchId);
        if (existing) {
          acc.byId.set(event.patchId, { ...existing, summary: event.summary });
        }
        break;
      }
      case 'BatchApplied':
        acc.appliedBatches.push({ batchId: event.batchId, patchIds: event.patchIds });
        for (const id of event.patchIds) {
          acc.appliedPatchIds.add(id);
          const idx = acc.stagedOrder.indexOf(id);
          if (idx >= 0) acc.stagedOrder.splice(idx, 1);
        }
        break;
      case 'BatchUndone':
        acc.undoneBatchIds.add(event.batchId);
        // Re-stage the patches in their original order so the user can re-apply or revise.
        for (const batch of acc.appliedBatches) {
          if (batch.batchId === event.batchId) {
            for (const id of batch.patchIds) {
              acc.appliedPatchIds.delete(id);
              if (acc.byId.has(id) && !acc.stagedOrder.includes(id)) {
                acc.stagedOrder.push(id);
              }
            }
          }
        }
        break;
    }
  }

  return acc;
}

export function deriveState(reducerState: PatchListReducerState): DerivedPatchListState {
  const acc = foldEvents(reducerState.events);
  const staged = acc.stagedOrder
    .map((id) => acc.byId.get(id))
    .filter((patch): patch is Patch => patch !== undefined);

  const lastBatch = [...acc.appliedBatches].reverse().find((batch) => !acc.undoneBatchIds.has(batch.batchId));

  return {
    staged,
    count: staged.length,
    canUndo: lastBatch !== undefined && reducerState.pendingUndos.has(lastBatch.batchId),
    isApplying: reducerState.isApplying,
    lastBatchId: lastBatch?.batchId ?? null,
  };
}

export function getPendingUndoHandle(
  reducerState: PatchListReducerState,
): { batchId: string; undo: () => Promise<void> } | null {
  const acc = foldEvents(reducerState.events);
  const lastBatch = [...acc.appliedBatches].reverse().find((batch) => !acc.undoneBatchIds.has(batch.batchId));
  if (!lastBatch) return null;
  const undo = reducerState.pendingUndos.get(lastBatch.batchId);
  if (!undo) return null;
  return { batchId: lastBatch.batchId, undo };
}
