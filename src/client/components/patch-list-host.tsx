import { createContext, useCallback, useContext, useMemo, useReducer, useRef, type ReactNode } from 'react';

import {
  deriveState,
  getPendingUndoHandle,
  initialPatchListState,
  patchListReducer,
  type AnnotatePatch,
  type DerivedPatchListState,
  type DrillDownPatch,
  type EdgePatch,
  type EditPatch,
  type Patch,
  type PatchAnchor,
  type StagePatchInput,
} from './patch-list-reducer.js';

export type {
  AnnotatePatch,
  DrillDownPatch,
  EdgePatch,
  EditPatch,
  Patch,
  PatchAnchor,
  PatchSelectionRange,
  StagePatchInput,
} from './patch-list-reducer.js';

export type ApplyPatchFn<P extends Patch> = (
  patch: P,
) => Promise<{ undo: () => Promise<void>; applied?: unknown }>;

export interface PatchAppliers {
  annotate: ApplyPatchFn<AnnotatePatch>;
  edit: ApplyPatchFn<EditPatch>;
  edge: ApplyPatchFn<EdgePatch>;
  drillDown: ApplyPatchFn<DrillDownPatch>;
}

export interface PatchListActions {
  stage: (input: StagePatchInput) => string;
  discard: (id: string) => void;
  editSummary: (id: string, summary: string) => void;
  apply: (patchIds?: readonly string[]) => Promise<void>;
  undo: () => Promise<boolean>;
}

interface PatchListContextValue {
  actions: PatchListActions;
  state: DerivedPatchListState;
  /** Survives <PatchListOverlay /> remounts so the saved toast does not re-fire on route changes. */
  savedToastLastAckBatchIdRef: { current: string | null };
}

const PatchListContext = createContext<PatchListContextValue | null>(null);

export interface PatchListProviderProps {
  appliers: PatchAppliers;
  children: ReactNode;
  /** Test-only seam; production callers rely on the default `crypto.randomUUID()`. */
  idFactory?: () => string;
  /** Test-only seam; production callers rely on the default `Date.now()`. */
  now?: () => number;
}

export function PatchListProvider({ appliers, children, idFactory, now }: PatchListProviderProps) {
  const [reducerState, dispatch] = useReducer(patchListReducer, initialPatchListState);
  const derivedState = useMemo(() => deriveState(reducerState), [reducerState]);
  const reducerStateRef = useRef(reducerState);
  reducerStateRef.current = reducerState;

  const applyInFlightRef = useRef(false);
  const savedToastLastAckBatchIdRef = useRef<string | null>(null);

  const newId = useCallback(() => idFactory?.() ?? crypto.randomUUID(), [idFactory]);
  const nowMs = useCallback(() => now?.() ?? Date.now(), [now]);

  const stage = useCallback(
    (input: StagePatchInput): string => {
      const id = newId();
      const patch = { ...input, id, createdAt: nowMs() } as Patch;
      dispatch({ type: 'STAGE', patchId: id, patch });
      return id;
    },
    [newId, nowMs],
  );

  const discard = useCallback((id: string): void => {
    dispatch({ type: 'DISCARD', patchId: id });
  }, []);

  const editSummary = useCallback((id: string, summary: string): void => {
    dispatch({ type: 'EDIT_SUMMARY', patchId: id, summary });
  }, []);

  const apply = useCallback(
    async (patchIds?: readonly string[]): Promise<void> => {
      if (applyInFlightRef.current) return;
      const snapshot = deriveState(reducerStateRef.current);
      const patchIdFilter = patchIds ? new Set(patchIds) : null;
      const patchesToApply = patchIdFilter
        ? snapshot.staged.filter((patch) => patchIdFilter.has(patch.id))
        : snapshot.staged;
      if (patchesToApply.length === 0 || snapshot.isApplying) {
        return;
      }
      applyInFlightRef.current = true;
      dispatch({ type: 'APPLY_START' });
      const undoHandles: Array<() => Promise<void>> = [];
      const appliedMeta: Array<{ patchId: string; applied: unknown }> = [];
      try {
        for (const patch of patchesToApply) {
          switch (patch.kind) {
            case 'annotate': {
              const result = await appliers.annotate(patch);
              undoHandles.push(result.undo);
              appliedMeta.push({ patchId: patch.id, applied: result.applied });
              break;
            }
            case 'edit': {
              const result = await appliers.edit(patch);
              undoHandles.push(result.undo);
              appliedMeta.push({ patchId: patch.id, applied: result.applied });
              break;
            }
            case 'edge': {
              const result = await appliers.edge(patch);
              undoHandles.push(result.undo);
              appliedMeta.push({ patchId: patch.id, applied: result.applied });
              break;
            }
            case 'drill-down': {
              const result = await appliers.drillDown(patch);
              undoHandles.push(result.undo);
              appliedMeta.push({ patchId: patch.id, applied: result.applied });
              break;
            }
            default: {
              const _exhaustive: never = patch;
              throw new Error(
                `patch-list-host: no applier for patch kind ${String((_exhaustive as Patch).kind)}`,
              );
            }
          }
        }
        const batchId = newId();
        const undoAll = async () => {
          for (const undo of [...undoHandles].reverse()) {
            await undo();
          }
        };
        dispatch({
          type: 'APPLY_SUCCESS',
          batchId,
          patchIds: patchesToApply.map((patch) => patch.id),
          undoHandle: undoAll,
          appliedMeta,
        });
      } catch {
        for (const undo of [...undoHandles].reverse()) {
          try {
            await undo();
          } catch {
            // Best-effort rollback; keep the UI in failure state for retry/discard.
          }
        }
        dispatch({ type: 'APPLY_FAILURE' });
      } finally {
        applyInFlightRef.current = false;
      }
    },
    [appliers, newId],
  );

  const undo = useCallback(async (): Promise<boolean> => {
    const pending = getPendingUndoHandle(reducerStateRef.current);
    if (!pending) {
      return false;
    }
    try {
      await pending.undo();
      dispatch({ type: 'UNDO_SUCCESS', batchId: pending.batchId });
      return true;
    } catch {
      // Best-effort undo. Surface failures as toasts in a later iteration.
      return false;
    }
  }, []);

  const actions = useMemo<PatchListActions>(
    () => ({ stage, discard, editSummary, apply, undo }),
    [stage, discard, editSummary, apply, undo],
  );

  const value = useMemo<PatchListContextValue>(
    () => ({ actions, state: derivedState, savedToastLastAckBatchIdRef }),
    [actions, derivedState],
  );

  return <PatchListContext.Provider value={value}>{children}</PatchListContext.Provider>;
}

// ---- Hooks ----

export function usePatchList(): PatchListActions | null {
  const ctx = useContext(PatchListContext);
  return ctx ? ctx.actions : null;
}

/** Stable across PatchListOverlay mount cycles; avoids duplicate "Change saved" toasts on route churn. */
export function usePatchListSavedToastLastAckBatchIdRef(): { current: string | null } {
  const ctx = useContext(PatchListContext);
  const fallback = useRef<string | null>(null);
  return ctx?.savedToastLastAckBatchIdRef ?? fallback;
}

export interface PatchListState {
  staged: readonly Patch[];
  count: number;
  canUndo: boolean;
  isApplying: boolean;
  lastBatchId: string | null;
  lastBatchPatches: readonly Patch[];
}

export function usePatchListState(): PatchListState {
  const ctx = useContext(PatchListContext);
  if (!ctx) {
    return {
      staged: [],
      count: 0,
      canUndo: false,
      isApplying: false,
      lastBatchId: null,
      lastBatchPatches: [],
    };
  }
  return {
    staged: ctx.state.staged,
    count: ctx.state.count,
    canUndo: ctx.state.canUndo,
    isApplying: ctx.state.isApplying,
    lastBatchId: ctx.state.lastBatchId,
    lastBatchPatches: ctx.state.lastBatchPatches,
  };
}

export interface StagedPatchesFilter {
  anchor?: Pick<PatchAnchor, 'kind' | 'itemId'>;
  kind?: Patch['kind'];
}

export function useLastBatchAppliedMeta(): readonly { patchId: string; applied: unknown }[] {
  const ctx = useContext(PatchListContext);
  if (!ctx) return [];
  return ctx.state.lastBatchAppliedMeta;
}

export function useStagedPatches(filter?: StagedPatchesFilter): readonly Patch[] {
  const ctx = useContext(PatchListContext);
  const anchorKind = filter?.anchor?.kind;
  const anchorItemId = filter?.anchor?.itemId;
  const filterKind = filter?.kind;
  return useMemo(() => {
    if (!ctx) return [];
    let staged = ctx.state.staged;
    if (anchorKind !== undefined && anchorItemId !== undefined) {
      staged = staged.filter(
        (patch) => patch.anchor.kind === anchorKind && patch.anchor.itemId === anchorItemId,
      );
    }
    if (filterKind !== undefined) {
      staged = staged.filter((patch) => patch.kind === filterKind);
    }
    return staged;
  }, [ctx, anchorKind, anchorItemId, filterKind]);
}

/**
 * Per-chat view of the patch list scoped to one secondary chat. Returns the
 * filtered staged slice (only patches whose `producerChatId === chatId`) plus
 * scoped actions: `apply()` automatically targets the chat's patch ids,
 * `discard`/`editSummary` reject ids that don't belong to the chat (they
 * wouldn't surface in `staged` anyway, but the guard keeps the public seam
 * tight). Sharing one provider keeps the apply pipeline + undo handles in
 * one place; the partition lives at this selector layer.
 */
export interface PatchListForChat {
  staged: readonly Patch[];
  count: number;
  isApplying: boolean;
  canUndo: boolean;
  stage: (input: StagePatchInput) => string;
  discard: (id: string) => void;
  editSummary: (id: string, summary: string) => void;
  apply: () => Promise<void>;
  undo: () => Promise<boolean>;
}

export function usePatchListForChat(chatId: number): PatchListForChat | null {
  const ctx = useContext(PatchListContext);
  return useMemo<PatchListForChat | null>(() => {
    if (!ctx) return null;
    const staged = ctx.state.staged.filter((patch) => patch.producerChatId === chatId);
    const stagedIds = new Set(staged.map((patch) => patch.id));
    const lastBatchTouchesChat = ctx.state.lastBatchPatches.some((patch) => patch.producerChatId === chatId);
    return {
      staged,
      count: staged.length,
      isApplying: ctx.state.isApplying,
      canUndo: ctx.state.canUndo && lastBatchTouchesChat,
      stage: ctx.actions.stage,
      discard: (id: string) => {
        if (stagedIds.has(id)) ctx.actions.discard(id);
      },
      editSummary: (id: string, summary: string) => {
        if (stagedIds.has(id)) ctx.actions.editSummary(id, summary);
      },
      apply: () => ctx.actions.apply(staged.map((patch) => patch.id)),
      undo: () => ctx.actions.undo(),
    };
  }, [ctx, chatId]);
}
