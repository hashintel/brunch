import { describe, expect, it } from 'vitest';

import {
  deriveState,
  getPendingUndoHandle,
  initialPatchListState,
  patchListReducer,
  type AnnotatePatch,
  type PatchListReducerState,
  type StagePatchInput,
} from './patch-list-reducer.js';

function makeAnnotatePatch(id: string, overrides: Partial<AnnotatePatch> = {}): AnnotatePatch {
  return {
    kind: 'annotate',
    id,
    anchor: { kind: 'decision', itemId: 1 },
    summary: `summary-${id}`,
    body: `body-${id}`,
    createdAt: 0,
    ...overrides,
  };
}

function noopUndo(): Promise<void> {
  return Promise.resolve();
}

describe('patchListReducer — STAGE / DISCARD / EDIT_SUMMARY', () => {
  it('STAGE appends a PatchStaged event', () => {
    const patch = makeAnnotatePatch('p1');
    const next = patchListReducer(initialPatchListState, { type: 'STAGE', patchId: 'p1', patch });

    expect(next.events).toEqual([{ type: 'PatchStaged', patchId: 'p1', patch }]);
    expect(next.isApplying).toBe(false);
  });

  it('DISCARD appends a PatchDiscarded event', () => {
    const patch = makeAnnotatePatch('p1');
    const after = patchListReducer(
      patchListReducer(initialPatchListState, { type: 'STAGE', patchId: 'p1', patch }),
      { type: 'DISCARD', patchId: 'p1' },
    );

    expect(after.events).toEqual([
      { type: 'PatchStaged', patchId: 'p1', patch },
      { type: 'PatchDiscarded', patchId: 'p1' },
    ]);
  });

  it('EDIT_SUMMARY appends a PatchSummaryEdited event', () => {
    const patch = makeAnnotatePatch('p1');
    const after = patchListReducer(
      patchListReducer(initialPatchListState, { type: 'STAGE', patchId: 'p1', patch }),
      { type: 'EDIT_SUMMARY', patchId: 'p1', summary: 'new summary' },
    );

    expect(after.events.at(-1)).toEqual({
      type: 'PatchSummaryEdited',
      patchId: 'p1',
      summary: 'new summary',
    });
  });
});

describe('patchListReducer — APPLY lifecycle', () => {
  it('APPLY_START sets isApplying without appending an event', () => {
    const next = patchListReducer(initialPatchListState, { type: 'APPLY_START' });
    expect(next.isApplying).toBe(true);
    expect(next.events).toEqual([]);
  });

  it('APPLY_SUCCESS appends BatchApplied, registers undo handle, clears isApplying', () => {
    const undo = noopUndo;
    const after = patchListReducer(
      { ...initialPatchListState, isApplying: true },
      { type: 'APPLY_SUCCESS', batchId: 'b1', patchIds: ['p1', 'p2'], undoHandle: undo },
    );

    expect(after.isApplying).toBe(false);
    expect(after.events).toEqual([{ type: 'BatchApplied', batchId: 'b1', patchIds: ['p1', 'p2'] }]);
    expect(after.pendingUndos.get('b1')).toBe(undo);
  });

  it('APPLY_FAILURE clears isApplying and preserves staged events', () => {
    const patch = makeAnnotatePatch('p1');
    const stagedThenStarted = patchListReducer(
      patchListReducer(initialPatchListState, { type: 'STAGE', patchId: 'p1', patch }),
      { type: 'APPLY_START' },
    );
    const failed = patchListReducer(stagedThenStarted, { type: 'APPLY_FAILURE' });

    expect(failed.isApplying).toBe(false);
    expect(failed.events).toEqual([{ type: 'PatchStaged', patchId: 'p1', patch }]);
  });

  it('UNDO_SUCCESS appends BatchUndone and removes the undo handle', () => {
    const undo = noopUndo;
    const startState: PatchListReducerState = {
      events: [{ type: 'BatchApplied', batchId: 'b1', patchIds: ['p1'] }],
      isApplying: false,
      pendingUndos: new Map([['b1', undo]]),
    };
    const after = patchListReducer(startState, { type: 'UNDO_SUCCESS', batchId: 'b1' });

    expect(after.events.at(-1)).toEqual({ type: 'BatchUndone', batchId: 'b1' });
    expect(after.pendingUndos.has('b1')).toBe(false);
  });
});

describe('deriveState — staged + count', () => {
  it('returns empty staged + zero count for the initial state', () => {
    expect(deriveState(initialPatchListState)).toMatchObject({ staged: [], count: 0, canUndo: false });
  });

  it('reflects a single staged patch', () => {
    const patch = makeAnnotatePatch('p1', { summary: 'note one' });
    const state = patchListReducer(initialPatchListState, { type: 'STAGE', patchId: 'p1', patch });

    const derived = deriveState(state);
    expect(derived.count).toBe(1);
    expect(derived.staged[0]?.summary).toBe('note one');
  });

  it('discarded patches drop out of staged', () => {
    const patch = makeAnnotatePatch('p1');
    const state = patchListReducer(
      patchListReducer(initialPatchListState, { type: 'STAGE', patchId: 'p1', patch }),
      { type: 'DISCARD', patchId: 'p1' },
    );

    expect(deriveState(state).staged).toEqual([]);
  });

  it('edit-summary updates the visible summary', () => {
    const patch = makeAnnotatePatch('p1', { summary: 'orig' });
    const state = patchListReducer(
      patchListReducer(initialPatchListState, { type: 'STAGE', patchId: 'p1', patch }),
      { type: 'EDIT_SUMMARY', patchId: 'p1', summary: 'updated' },
    );

    expect(deriveState(state).staged[0]?.summary).toBe('updated');
  });

  it('preserves stage order across multiple stages', () => {
    let state = initialPatchListState;
    state = patchListReducer(state, { type: 'STAGE', patchId: 'a', patch: makeAnnotatePatch('a') });
    state = patchListReducer(state, { type: 'STAGE', patchId: 'b', patch: makeAnnotatePatch('b') });
    state = patchListReducer(state, { type: 'STAGE', patchId: 'c', patch: makeAnnotatePatch('c') });

    expect(deriveState(state).staged.map((patch) => patch.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('deriveState — apply / undo lifecycle', () => {
  it('after a successful apply, staged is empty and canUndo is true', () => {
    let state = initialPatchListState;
    state = patchListReducer(state, { type: 'STAGE', patchId: 'p1', patch: makeAnnotatePatch('p1') });
    state = patchListReducer(state, { type: 'APPLY_START' });
    state = patchListReducer(state, {
      type: 'APPLY_SUCCESS',
      batchId: 'b1',
      patchIds: ['p1'],
      undoHandle: noopUndo,
    });

    const derived = deriveState(state);
    expect(derived.staged).toEqual([]);
    expect(derived.count).toBe(0);
    expect(derived.canUndo).toBe(true);
    expect(derived.lastBatchId).toBe('b1');
  });

  it('after undo, staged stays empty (terminal undo) and canUndo flips false', () => {
    let state = initialPatchListState;
    state = patchListReducer(state, { type: 'STAGE', patchId: 'a', patch: makeAnnotatePatch('a') });
    state = patchListReducer(state, { type: 'STAGE', patchId: 'b', patch: makeAnnotatePatch('b') });
    state = patchListReducer(state, { type: 'APPLY_START' });
    state = patchListReducer(state, {
      type: 'APPLY_SUCCESS',
      batchId: 'b1',
      patchIds: ['a', 'b'],
      undoHandle: noopUndo,
    });
    state = patchListReducer(state, { type: 'UNDO_SUCCESS', batchId: 'b1' });

    const derived = deriveState(state);
    expect(derived.staged).toEqual([]);
    expect(derived.canUndo).toBe(false);
  });

  it('after a failed apply, staged remains and canUndo stays false', () => {
    let state = initialPatchListState;
    state = patchListReducer(state, { type: 'STAGE', patchId: 'p1', patch: makeAnnotatePatch('p1') });
    state = patchListReducer(state, { type: 'APPLY_START' });
    state = patchListReducer(state, { type: 'APPLY_FAILURE' });

    const derived = deriveState(state);
    expect(derived.count).toBe(1);
    expect(derived.canUndo).toBe(false);
    expect(derived.isApplying).toBe(false);
  });

  it('canUndo is false when the apply succeeded but the handle has been removed (undone)', () => {
    let state = initialPatchListState;
    state = patchListReducer(state, { type: 'STAGE', patchId: 'p1', patch: makeAnnotatePatch('p1') });
    state = patchListReducer(state, {
      type: 'APPLY_SUCCESS',
      batchId: 'b1',
      patchIds: ['p1'],
      undoHandle: noopUndo,
    });
    state = patchListReducer(state, { type: 'UNDO_SUCCESS', batchId: 'b1' });

    expect(deriveState(state).canUndo).toBe(false);
  });
});

describe('getPendingUndoHandle', () => {
  it('returns null when no batch is applied', () => {
    expect(getPendingUndoHandle(initialPatchListState)).toBeNull();
  });

  it('returns the handle for the most recent un-undone batch', () => {
    const undo1 = noopUndo;
    const undo2 = noopUndo;
    let state = initialPatchListState;
    state = patchListReducer(state, {
      type: 'APPLY_SUCCESS',
      batchId: 'b1',
      patchIds: [],
      undoHandle: undo1,
    });
    state = patchListReducer(state, {
      type: 'APPLY_SUCCESS',
      batchId: 'b2',
      patchIds: [],
      undoHandle: undo2,
    });

    expect(getPendingUndoHandle(state)?.batchId).toBe('b2');
  });

  it('returns the previous batch when the most recent has been undone', () => {
    let state = initialPatchListState;
    state = patchListReducer(state, {
      type: 'APPLY_SUCCESS',
      batchId: 'b1',
      patchIds: [],
      undoHandle: noopUndo,
    });
    state = patchListReducer(state, {
      type: 'APPLY_SUCCESS',
      batchId: 'b2',
      patchIds: [],
      undoHandle: noopUndo,
    });
    state = patchListReducer(state, { type: 'UNDO_SUCCESS', batchId: 'b2' });

    expect(getPendingUndoHandle(state)?.batchId).toBe('b1');
  });
});

describe('full sequence round-trip', () => {
  it('stage → edit → stage → apply → undo: applied patches end terminal (undone), staged empty', () => {
    let state = initialPatchListState;

    // Stage two
    state = patchListReducer(state, {
      type: 'STAGE',
      patchId: 'a',
      patch: makeAnnotatePatch('a', { summary: 'a-orig' }),
    });
    state = patchListReducer(state, {
      type: 'STAGE',
      patchId: 'b',
      patch: makeAnnotatePatch('b'),
    });

    // Edit one
    state = patchListReducer(state, { type: 'EDIT_SUMMARY', patchId: 'a', summary: 'a-edited' });

    // Apply
    state = patchListReducer(state, { type: 'APPLY_START' });
    state = patchListReducer(state, {
      type: 'APPLY_SUCCESS',
      batchId: 'B',
      patchIds: ['a', 'b'],
      undoHandle: noopUndo,
    });

    expect(deriveState(state).count).toBe(0);

    // Undo (terminal — patches don't re-stage)
    state = patchListReducer(state, { type: 'UNDO_SUCCESS', batchId: 'B' });

    const derived = deriveState(state);
    expect(derived.staged).toEqual([]);
    expect(derived.canUndo).toBe(false);
  });
});

// Test helper assertion: StagePatchInput is the right shape for callers
const _stageInputCheck: StagePatchInput = {
  kind: 'annotate',
  anchor: { kind: 'decision', itemId: 1 },
  summary: 's',
  body: 'b',
};
void _stageInputCheck;
