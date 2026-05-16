// Patch-list module's functional core (D132).
// Events are the internal primitive — append-only — shaped to match A71's
// future server-side `appendPatch(spec, patch[])` so migration is a reducer
// swap, not a public-API rewrite. Public surface is `patch-list-host.tsx`.
//
// Per-chat scoping (FE-716 C5c, Shape A): each patch carries
// `producerChatId: number | null`. A null value means "popover / global
// origin"; a numeric value scopes the patch to one secondary chat. The
// reducer itself stays oblivious to the scope — partitioning is enforced
// at the selector layer (`usePatchListForChat`). Apply batches honour the
// per-chat scope implicitly because each chat's apply only ever passes
// `patchIds` derived from its own staged slice; cross-chat undo is not
// supported in V1 (per-`apply()`-batch undo only — chat scope is implicit
// in the patch ids of the batch).

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
  /**
   * Origin scope of the patch. `null` = popover / global (legacy default,
   * what `usePatchList()` sees). A numeric value names the secondary chat
   * that produced the patch; only `usePatchListForChat(chatId)` surfaces it.
   * Required-but-nullable so the type system surfaces every stage call site
   * (Shape A from FE-716 C5c planning).
   */
  producerChatId: number | null;
  // Snapshot of the anchor item's reference code (e.g. "C1", "D5") at stage
  // time. Optional — populated by callers that have it in hand (side-chat
  // pinnedItem, future direct-edit row) so consumers like PatchListOverlay
  // can render the kind-tinted reference badge without re-querying the
  // entity store. When absent, consumers fall back to summary-only.
  anchorReferenceCode?: string;
}

export interface AnnotatePatch extends PatchBase {
  kind: 'annotate';
  body: string;
}

export type EditImpactTier = 'none' | 'soft' | 'hard';

export interface EditPatch extends PatchBase {
  kind: 'edit';
  newContent: string;
  newRationale?: string;
  // Server-pre-classified at proposal time (design §4.1); rendered as a tier
  // chip on the patch entry so users see soft / hard before clicking Apply.
  // Optional because legacy paths (annotate auto-apply, manually-staged tests)
  // may stage without server pre-classification.
  impact?: EditImpactTier;
  // Snapshot of the anchor item's current content at stage time. Populated
  // by callers that have it in hand (e.g. structured-list direct-edit, or
  // inline secondary-chat patch staging) so consumers like PatchListOverlay
  // can render a word-level <ContentDiff> without re-querying the entity
  // store. Optional — when absent, consumers fall back to summary-only
  // display (FE-665 follow-up).
  currentContent?: string;
}

export interface EdgePatch extends PatchBase {
  kind: 'edge';
  targetAnchor: PatchAnchor;
  relation: string; // EdgeRelation from api-types
}

export interface DrillDownPatch extends PatchBase {
  kind: 'drill-down';
  focusArea: string;
}

export type Patch = AnnotatePatch | EditPatch | EdgePatch | DrillDownPatch;

// Distributive Omit so that the discriminated union is preserved per-member.
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type StagePatchInput = DistributiveOmit<Patch, 'id' | 'createdAt'>;

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
  appliedMeta: ReadonlyArray<{ patchId: string; applied: unknown }>;
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
      appliedMeta: ReadonlyArray<{ patchId: string; applied: unknown }>;
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
          {
            type: 'BatchApplied',
            batchId: action.batchId,
            patchIds: action.patchIds,
            appliedMeta: action.appliedMeta,
          },
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
  lastBatchPatches: readonly Patch[];
  lastBatchAppliedMeta: readonly { patchId: string; applied: unknown }[];
}

interface FoldAccumulator {
  byId: Map<string, Patch>;
  stagedOrder: string[]; // patchIds, in stage order
  appliedPatchIds: Set<string>;
  appliedBatches: Array<{
    batchId: string;
    patchIds: readonly string[];
    appliedMeta: ReadonlyArray<{ patchId: string; applied: unknown }>;
  }>;
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
        acc.appliedBatches.push({
          batchId: event.batchId,
          patchIds: event.patchIds,
          appliedMeta: event.appliedMeta,
        });
        for (const id of event.patchIds) {
          acc.appliedPatchIds.add(id);
          const idx = acc.stagedOrder.indexOf(id);
          if (idx >= 0) acc.stagedOrder.splice(idx, 1);
        }
        break;
      case 'BatchUndone':
        // Terminal: undone patches don't re-stage, so the auto-apply effect (D131)
        // doesn't immediately reapply them.
        acc.undoneBatchIds.add(event.batchId);
        break;
    }
  }

  return acc;
}

// V3.0 polish (FE-674): hard-impact apply marks its applied metadata with
// `noUndo: true` because the source mutation can't be reversed without going
// through the reconciliation queue (card 3 ships Resolve; full restore-via-
// re-PATCH lands later). A batch where every entry is noUndo should keep the
// Undo button hidden so the user isn't offered a click that does nothing.
function batchHasUndoableEntry(appliedMeta: ReadonlyArray<{ patchId: string; applied: unknown }>): boolean {
  if (appliedMeta.length === 0) {
    return true;
  }
  return appliedMeta.some((entry) => {
    if (!entry.applied || typeof entry.applied !== 'object') return true;
    const record = entry.applied as { noUndo?: unknown };
    return record.noUndo !== true;
  });
}

export function deriveState(reducerState: PatchListReducerState): DerivedPatchListState {
  const acc = foldEvents(reducerState.events);
  const staged = acc.stagedOrder
    .map((id) => acc.byId.get(id))
    .filter((patch): patch is Patch => patch !== undefined);

  const lastBatch = [...acc.appliedBatches].reverse().find((batch) => !acc.undoneBatchIds.has(batch.batchId));
  const lastBatchPatches =
    lastBatch?.patchIds
      .map((id) => acc.byId.get(id))
      .filter((patch): patch is Patch => patch !== undefined) ?? [];

  // The most-recent BatchApplied (irrespective of whether it was undone) anchors
  // `lastBatchAppliedMeta`; once undone, the meta clears so dependent listeners
  // don't keep treating those applieds as "current".
  const mostRecentApplied = acc.appliedBatches.at(-1);
  const lastBatchAppliedMeta =
    mostRecentApplied && !acc.undoneBatchIds.has(mostRecentApplied.batchId)
      ? mostRecentApplied.appliedMeta
      : [];

  return {
    staged,
    count: staged.length,
    canUndo:
      lastBatch !== undefined &&
      reducerState.pendingUndos.has(lastBatch.batchId) &&
      batchHasUndoableEntry(lastBatch.appliedMeta),
    isApplying: reducerState.isApplying,
    lastBatchId: lastBatch?.batchId ?? null,
    lastBatchPatches,
    lastBatchAppliedMeta,
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
