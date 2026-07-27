/**
 * Contract for the graph focus reducer behind useSelection.
 *
 * Focus is a discriminated union (none | selected | editing) so "editing without a
 * selected node" is unrepresentable, and every transition — including the reset when
 * the focused node leaves the model — lives in one pure reducer.
 */

import { describe, expect, it } from 'vitest';

import { focusReducer, initialFocus, type FocusMode } from '@/client/components/graph/useSelection';

function selected(id: string): FocusMode {
  return { tag: 'selected', id };
}
function editing(id: string): FocusMode {
  return { tag: 'editing', id };
}

describe('focusReducer', () => {
  it('starts with nothing focused', () => {
    expect(initialFocus.tag).toBe('none');
  });

  it('selects a node, and toggling the same node clears it', () => {
    const sel = focusReducer(initialFocus, { type: 'toggle', id: 'a' });
    expect(sel).toEqual(selected('a'));
    expect(focusReducer(sel, { type: 'toggle', id: 'a' })).toEqual(initialFocus);
  });

  it('toggling a different node moves the selection', () => {
    expect(focusReducer(selected('a'), { type: 'toggle', id: 'b' })).toEqual(selected('b'));
  });

  it('edit enters editing on the node; cancel demotes to selected on the same node', () => {
    const ed = focusReducer(selected('a'), { type: 'edit', id: 'a' });
    expect(ed).toEqual(editing('a'));
    expect(focusReducer(ed, { type: 'cancelEdit' })).toEqual(selected('a'));
  });

  it('selecting, toggling away, or clearing always exits editing', () => {
    expect(focusReducer(editing('a'), { type: 'select', id: 'b' })).toEqual(selected('b'));
    expect(focusReducer(editing('a'), { type: 'toggle', id: 'a' })).toEqual(initialFocus);
    expect(focusReducer(editing('a'), { type: 'clear' })).toEqual(initialFocus);
  });

  it('resets when the focused node leaves the model, and keeps it otherwise', () => {
    expect(focusReducer(editing('a'), { type: 'modelChanged', nodeIds: new Set(['b']) })).toEqual(
      initialFocus,
    );
    const stillThere = focusReducer(selected('a'), {
      type: 'modelChanged',
      nodeIds: new Set(['a', 'b']),
    });
    expect(stillThere).toEqual(selected('a'));
  });

  it('returns the same reference when modelChanged changes nothing (no churn)', () => {
    const state = selected('a');
    expect(focusReducer(state, { type: 'modelChanged', nodeIds: new Set(['a']) })).toBe(state);
  });

  it('never produces an editing mode without an id (invariant is structural)', () => {
    const events: Parameters<typeof focusReducer>[1][] = [
      { type: 'toggle', id: 'a' },
      { type: 'edit', id: 'a' },
      { type: 'cancelEdit' },
      { type: 'select', id: 'b' },
      { type: 'edit', id: 'b' },
      { type: 'clear' },
      { type: 'modelChanged', nodeIds: new Set(['b']) },
    ];
    let state = initialFocus;
    for (const event of events) {
      state = focusReducer(state, event);
      if (state.tag === 'editing') expect(typeof state.id).toBe('string');
    }
  });
});
