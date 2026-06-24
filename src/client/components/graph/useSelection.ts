/**
 * Graph focus core: selection and editing as one discriminated union, so "editing
 * without a selected node" is unrepresentable and every transition — including the
 * reset when the focused node leaves the model — lives in one reducer. Hover and
 * kind-flash are orthogonal and live elsewhere.
 */

import { useCallback, useEffect, useMemo, useReducer } from 'react';

export type FocusMode = { tag: 'none' } | { tag: 'selected'; id: string } | { tag: 'editing'; id: string };

export type FocusEvent =
  | { type: 'toggle'; id: string }
  | { type: 'select'; id: string }
  | { type: 'clear' }
  | { type: 'edit'; id: string }
  | { type: 'cancelEdit' }
  | { type: 'modelChanged'; nodeIds: ReadonlySet<string> };

export const initialFocus: FocusMode = { tag: 'none' };

export function focusReducer(mode: FocusMode, event: FocusEvent): FocusMode {
  switch (event.type) {
    case 'toggle':
      return mode.tag !== 'none' && mode.id === event.id
        ? { tag: 'none' }
        : { tag: 'selected', id: event.id };
    case 'select':
      return { tag: 'selected', id: event.id };
    case 'clear':
      return { tag: 'none' };
    case 'edit':
      return { tag: 'editing', id: event.id };
    case 'cancelEdit':
      return mode.tag === 'editing' ? { tag: 'selected', id: mode.id } : mode;
    case 'modelChanged':
      return mode.tag !== 'none' && !event.nodeIds.has(mode.id) ? { tag: 'none' } : mode;
  }
}

export interface Selection {
  /** Focused node id, clamped to the live model (null if it no longer exists). */
  selectedId: string | null;
  /** Whether the focused node's editor is open. Implies selectedId !== null. */
  editing: boolean;
  /** Click a node: select it, or clear if it was already selected. */
  toggle: (id: string) => void;
  /** Select a node outright (e.g. a panel connection). */
  select: (id: string) => void;
  /** Clear selection. */
  clear: () => void;
  /** Select a node and open its editor (or open the editor on the current selection). */
  edit: (id: string) => void;
  /** Close the editor, keeping the node selected. */
  cancelEdit: () => void;
}

export function useSelection(nodeIds: ReadonlySet<string>): Selection {
  const [mode, dispatch] = useReducer(focusReducer, initialFocus);

  useEffect(() => {
    dispatch({ type: 'modelChanged', nodeIds });
  }, [nodeIds]);

  const selectedId = mode.tag !== 'none' && nodeIds.has(mode.id) ? mode.id : null;
  const editing = mode.tag === 'editing' && selectedId !== null;

  const toggle = useCallback((id: string) => dispatch({ type: 'toggle', id }), []);
  const select = useCallback((id: string) => dispatch({ type: 'select', id }), []);
  const clear = useCallback(() => dispatch({ type: 'clear' }), []);
  const edit = useCallback((id: string) => dispatch({ type: 'edit', id }), []);
  const cancelEdit = useCallback(() => dispatch({ type: 'cancelEdit' }), []);

  return useMemo(
    () => ({ selectedId, editing, toggle, select, clear, edit, cancelEdit }),
    [selectedId, editing, toggle, select, clear, edit, cancelEdit],
  );
}
