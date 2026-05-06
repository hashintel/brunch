// Patch-list module's public surface (D132). Mirrors `SideChatHost`:
// `<PatchListProvider>` + `useFoo()` hooks. Internal state is an event log
// (`patch-list-reducer.ts`); the React layer is glue.

import { createContext, useCallback, useContext, useMemo, useReducer, useRef, type ReactNode } from 'react';

import {
  deriveState,
  getPendingUndoHandle,
  initialPatchListState,
  patchListReducer,
  type AnnotatePatch,
  type DerivedPatchListState,
  type Patch,
  type PatchAnchor,
  type StagePatchInput,
} from './patch-list-reducer.js';

export type {
  AnnotatePatch,
  Patch,
  PatchAnchor,
  PatchSelectionRange,
  StagePatchInput,
} from './patch-list-reducer.js';

// ---- Appliers (kind → server fan-out) ----

export type ApplyPatchFn<P extends Patch> = (patch: P) => Promise<{ undo: () => Promise<void> }>;

export interface PatchAppliers {
  annotate: ApplyPatchFn<AnnotatePatch>;
  // V2: edit, edge, drillDown — closed shape forces typecheck failure at provider mount until supplied.
}

// ---- Public action surface ----

export interface PatchListActions {
  stage: (input: StagePatchInput) => string;
  discard: (id: string) => void;
  editSummary: (id: string, summary: string) => void;
  apply: () => Promise<void>;
  undo: () => Promise<void>;
}

// ---- Context ----

interface PatchListContextValue {
  actions: PatchListActions;
  state: DerivedPatchListState;
}

const PatchListContext = createContext<PatchListContextValue | null>(null);

// ---- Provider ----

export interface PatchListProviderProps {
  specificationId: number;
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

  const apply = useCallback(async (): Promise<void> => {
    if (applyInFlightRef.current) return;
    const snapshot = deriveState(reducerStateRef.current);
    if (snapshot.staged.length === 0 || snapshot.isApplying) {
      return;
    }
    applyInFlightRef.current = true;
    dispatch({ type: 'APPLY_START' });
    const undoHandles: Array<() => Promise<void>> = [];
    try {
      for (const patch of snapshot.staged) {
        switch (patch.kind) {
          case 'annotate': {
            const result = await appliers.annotate(patch);
            undoHandles.push(result.undo);
            break;
          }
          default: {
            const _exhaustive: never = patch.kind;
            throw new Error(`patch-list-host: no applier for patch kind ${String(_exhaustive)}`);
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
        patchIds: snapshot.staged.map((patch) => patch.id),
        undoHandle: undoAll,
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
  }, [appliers, newId]);

  const undo = useCallback(async (): Promise<void> => {
    const pending = getPendingUndoHandle(reducerStateRef.current);
    if (!pending) {
      return;
    }
    try {
      await pending.undo();
      dispatch({ type: 'UNDO_SUCCESS', batchId: pending.batchId });
    } catch {
      // Best-effort undo per D132. Surface failures as toasts in a later card.
    }
  }, []);

  const actions = useMemo<PatchListActions>(
    () => ({ stage, discard, editSummary, apply, undo }),
    [stage, discard, editSummary, apply, undo],
  );

  const value = useMemo<PatchListContextValue>(
    () => ({ actions, state: derivedState }),
    [actions, derivedState],
  );

  return <PatchListContext.Provider value={value}>{children}</PatchListContext.Provider>;
}

// ---- Hooks ----

export function usePatchList(): PatchListActions | null {
  const ctx = useContext(PatchListContext);
  return ctx ? ctx.actions : null;
}

export interface PatchListState {
  staged: readonly Patch[];
  count: number;
  canUndo: boolean;
  isApplying: boolean;
  lastBatchId: string | null;
}

export function usePatchListState(): PatchListState {
  const ctx = useContext(PatchListContext);
  if (!ctx) {
    return { staged: [], count: 0, canUndo: false, isApplying: false, lastBatchId: null };
  }
  return {
    staged: ctx.state.staged,
    count: ctx.state.count,
    canUndo: ctx.state.canUndo,
    isApplying: ctx.state.isApplying,
    lastBatchId: ctx.state.lastBatchId,
  };
}

export interface StagedPatchesFilter {
  anchor?: Pick<PatchAnchor, 'kind' | 'itemId'>;
  kind?: Patch['kind'];
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
