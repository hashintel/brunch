// @vitest-environment happy-dom

import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  PatchListProvider,
  useStagedPatches,
  usePatchList,
  usePatchListState,
  type AnnotatePatch,
  type PatchAppliers,
  type Patch,
  type StagePatchInput,
} from '../patch-list-host.js';

afterEach(() => {
  cleanup();
});

interface ProbeRefs {
  current: {
    actions: ReturnType<typeof usePatchList>;
    state: ReturnType<typeof usePatchListState>;
    filtered: readonly Patch[];
  };
}

function Probe({ refs, filter }: { refs: ProbeRefs; filter?: Parameters<typeof useStagedPatches>[0] }) {
  const actions = usePatchList();
  const state = usePatchListState();
  const filtered = useStagedPatches(filter);
  refs.current = { actions, state, filtered };
  return null;
}

function makeProbeRefs(): ProbeRefs {
  return {
    current: {
      actions: null,
      state: {
        staged: [],
        count: 0,
        canUndo: false,
        isApplying: false,
        lastBatchId: null,
        lastBatchPatches: [],
      },
      filtered: [],
    },
  };
}

function makeAnnotateInput(overrides: Partial<StagePatchInput> = {}): StagePatchInput {
  return {
    kind: 'annotate',
    anchor: { kind: 'decision', itemId: 1 },
    summary: 'note',
    body: 'note body',
    ...overrides,
  } as StagePatchInput;
}

function makeNoopApplier() {
  return vi.fn(() => Promise.resolve({ undo: () => Promise.resolve() }));
}

function makeAppliers(): {
  appliers: PatchAppliers;
  annotateMock: ReturnType<typeof vi.fn>;
  undoMock: ReturnType<typeof vi.fn>;
} {
  const undoMock = vi.fn(() => Promise.resolve());
  const annotateMock = vi.fn(() => Promise.resolve({ undo: undoMock }));
  return {
    annotateMock,
    undoMock,
    appliers: {
      annotate: annotateMock as unknown as PatchAppliers['annotate'],
      edit: makeNoopApplier() as unknown as PatchAppliers['edit'],
      edge: makeNoopApplier() as unknown as PatchAppliers['edge'],
      drillDown: makeNoopApplier() as unknown as PatchAppliers['drillDown'],
    },
  };
}

let idCounter = 0;
function makeIdFactory() {
  idCounter = 0;
  return () => `id-${++idCounter}`;
}

describe('usePatchList outside the provider', () => {
  it('returns null and the default state', () => {
    const refs = makeProbeRefs();
    render(<Probe refs={refs} />);
    expect(refs.current.actions).toBeNull();
    expect(refs.current.state).toEqual({
      staged: [],
      count: 0,
      canUndo: false,
      isApplying: false,
      lastBatchId: null,
      lastBatchPatches: [],
    });
  });
});

describe('PatchListProvider — basic mount', () => {
  it('mounts and renders children', () => {
    const { appliers } = makeAppliers();
    render(
      <PatchListProvider appliers={appliers} idFactory={makeIdFactory()}>
        <div data-testid="child">child-rendered</div>
      </PatchListProvider>,
    );
    expect(screen.getByTestId('child').textContent).toBe('child-rendered');
  });

  it('usePatchList returns non-null actions inside the provider', () => {
    const refs = makeProbeRefs();
    const { appliers } = makeAppliers();
    render(
      <PatchListProvider appliers={appliers} idFactory={makeIdFactory()}>
        <Probe refs={refs} />
      </PatchListProvider>,
    );
    expect(refs.current.actions).not.toBeNull();
    expect(typeof refs.current.actions?.stage).toBe('function');
    expect(typeof refs.current.actions?.apply).toBe('function');
    expect(typeof refs.current.actions?.undo).toBe('function');
  });

  it('keeps action identities stable across reducer dispatches while reading latest state', async () => {
    const refs = makeProbeRefs();
    const { appliers, annotateMock, undoMock } = makeAppliers();
    render(
      <PatchListProvider appliers={appliers} idFactory={makeIdFactory()}>
        <Probe refs={refs} />
      </PatchListProvider>,
    );

    const initialActions = refs.current.actions;

    act(() => {
      refs.current.actions?.stage(makeAnnotateInput({ summary: 'latest staged patch' }));
    });
    expect(refs.current.actions).toBe(initialActions);

    await act(async () => {
      await refs.current.actions?.apply();
    });
    expect(annotateMock.mock.calls[0]?.[0].summary).toBe('latest staged patch');
    expect(refs.current.actions).toBe(initialActions);

    await act(async () => {
      await refs.current.actions?.undo();
    });
    expect(undoMock).toHaveBeenCalledTimes(1);
    expect(refs.current.actions).toBe(initialActions);
  });
});

describe('stage / discard / editSummary', () => {
  it('stage(input) increments count and surfaces the patch via state.staged', () => {
    const refs = makeProbeRefs();
    const { appliers } = makeAppliers();
    render(
      <PatchListProvider appliers={appliers} idFactory={makeIdFactory()}>
        <Probe refs={refs} />
      </PatchListProvider>,
    );

    act(() => {
      refs.current.actions?.stage(makeAnnotateInput({ summary: 'first' }));
    });

    expect(refs.current.state.count).toBe(1);
    expect(refs.current.state.staged[0]?.summary).toBe('first');
  });

  it('discard(id) removes the patch', () => {
    const refs = makeProbeRefs();
    const { appliers } = makeAppliers();
    render(
      <PatchListProvider appliers={appliers} idFactory={makeIdFactory()}>
        <Probe refs={refs} />
      </PatchListProvider>,
    );

    let id = '';
    act(() => {
      id = refs.current.actions?.stage(makeAnnotateInput()) ?? '';
    });
    act(() => {
      refs.current.actions?.discard(id);
    });

    expect(refs.current.state.count).toBe(0);
  });

  it('editSummary(id, text) updates the staged summary', () => {
    const refs = makeProbeRefs();
    const { appliers } = makeAppliers();
    render(
      <PatchListProvider appliers={appliers} idFactory={makeIdFactory()}>
        <Probe refs={refs} />
      </PatchListProvider>,
    );

    let id = '';
    act(() => {
      id = refs.current.actions?.stage(makeAnnotateInput({ summary: 'orig' })) ?? '';
    });
    act(() => {
      refs.current.actions?.editSummary(id, 'updated');
    });

    expect(refs.current.state.staged[0]?.summary).toBe('updated');
  });
});

describe('apply', () => {
  it('invokes the annotate applier for each staged patch and clears staged on success', async () => {
    const refs = makeProbeRefs();
    const { appliers, annotateMock } = makeAppliers();
    render(
      <PatchListProvider appliers={appliers} idFactory={makeIdFactory()}>
        <Probe refs={refs} />
      </PatchListProvider>,
    );

    act(() => {
      refs.current.actions?.stage(makeAnnotateInput({ summary: 'a' }));
      refs.current.actions?.stage(makeAnnotateInput({ summary: 'b' }));
    });

    await act(async () => {
      await refs.current.actions?.apply();
    });

    expect(annotateMock).toHaveBeenCalledTimes(2);
    expect(annotateMock.mock.calls[0]?.[0].summary).toBe('a');
    expect(annotateMock.mock.calls[1]?.[0].summary).toBe('b');
    expect(refs.current.state.count).toBe(0);
    expect(refs.current.state.canUndo).toBe(true);
    expect(refs.current.state.isApplying).toBe(false);
  });

  it('can apply only the requested staged patch ids and leave the rest staged', async () => {
    const refs = makeProbeRefs();
    const { appliers, annotateMock } = makeAppliers();
    render(
      <PatchListProvider appliers={appliers} idFactory={makeIdFactory()}>
        <Probe refs={refs} />
      </PatchListProvider>,
    );

    let firstId = '';
    let secondId = '';
    act(() => {
      firstId = refs.current.actions?.stage(makeAnnotateInput({ summary: 'first' })) ?? '';
      secondId = refs.current.actions?.stage(makeAnnotateInput({ summary: 'second' })) ?? '';
    });

    await act(async () => {
      await refs.current.actions?.apply([firstId]);
    });

    expect(annotateMock).toHaveBeenCalledTimes(1);
    expect(annotateMock.mock.calls[0]?.[0].summary).toBe('first');
    expect(refs.current.state.staged.map((patch) => patch.id)).toEqual([secondId]);
    expect(refs.current.state.lastBatchPatches.map((patch) => patch.id)).toEqual([firstId]);
    expect(refs.current.state.canUndo).toBe(true);
  });

  it('exposes lastBatchId and changes it on each apply (mutation signal for downstream effects)', async () => {
    const refs = makeProbeRefs();
    const { appliers } = makeAppliers();
    render(
      <PatchListProvider appliers={appliers} idFactory={makeIdFactory()}>
        <Probe refs={refs} />
      </PatchListProvider>,
    );

    expect(refs.current.state.lastBatchId).toBeNull();

    act(() => {
      refs.current.actions?.stage(makeAnnotateInput({ summary: 'a' }));
    });
    await act(async () => {
      await refs.current.actions?.apply();
    });
    const firstBatchId = refs.current.state.lastBatchId;
    expect(firstBatchId).not.toBeNull();

    act(() => {
      refs.current.actions?.stage(makeAnnotateInput({ summary: 'b' }));
    });
    await act(async () => {
      await refs.current.actions?.apply();
    });
    const secondBatchId = refs.current.state.lastBatchId;
    expect(secondBatchId).not.toBeNull();
    expect(refs.current.state.canUndo).toBe(true);
    expect(secondBatchId).not.toBe(firstBatchId);
  });

  it('exposes the patches from the latest undoable batch', async () => {
    const refs = makeProbeRefs();
    const { appliers } = makeAppliers();
    render(
      <PatchListProvider appliers={appliers} idFactory={makeIdFactory()}>
        <Probe refs={refs} />
      </PatchListProvider>,
    );

    act(() => {
      refs.current.actions?.stage(makeAnnotateInput({ summary: 'a' }));
    });
    await act(async () => {
      await refs.current.actions?.apply();
    });

    expect(refs.current.state.lastBatchPatches).toHaveLength(1);
    expect(refs.current.state.lastBatchPatches[0]?.summary).toBe('a');
  });

  it('apply on an empty list is a no-op (no applier calls, state unchanged)', async () => {
    const refs = makeProbeRefs();
    const { appliers, annotateMock } = makeAppliers();
    render(
      <PatchListProvider appliers={appliers} idFactory={makeIdFactory()}>
        <Probe refs={refs} />
      </PatchListProvider>,
    );

    await act(async () => {
      await refs.current.actions?.apply();
    });

    expect(annotateMock).not.toHaveBeenCalled();
    expect(refs.current.state.canUndo).toBe(false);
  });

  it('apply failure preserves staged patches, clears isApplying, leaves canUndo false', async () => {
    const refs = makeProbeRefs();
    const failingAnnotate = vi.fn(() => Promise.reject(new Error('boom')));
    const appliers: PatchAppliers = {
      annotate: failingAnnotate as unknown as PatchAppliers['annotate'],
      edit: makeNoopApplier() as unknown as PatchAppliers['edit'],
      edge: makeNoopApplier() as unknown as PatchAppliers['edge'],
      drillDown: makeNoopApplier() as unknown as PatchAppliers['drillDown'],
    };
    render(
      <PatchListProvider appliers={appliers} idFactory={makeIdFactory()}>
        <Probe refs={refs} />
      </PatchListProvider>,
    );

    act(() => {
      refs.current.actions?.stage(makeAnnotateInput());
    });
    await act(async () => {
      await refs.current.actions?.apply();
    });

    expect(failingAnnotate).toHaveBeenCalledTimes(1);
    expect(refs.current.state.count).toBe(1);
    expect(refs.current.state.canUndo).toBe(false);
    expect(refs.current.state.isApplying).toBe(false);
  });

  it('rolls back patches already applied when a later patch fails', async () => {
    const refs = makeProbeRefs();
    const undoFirst = vi.fn(() => Promise.resolve());
    const annotate = vi
      .fn()
      .mockResolvedValueOnce({ undo: undoFirst })
      .mockRejectedValueOnce(new Error('second patch failed'));
    const appliers: PatchAppliers = {
      annotate: annotate as unknown as PatchAppliers['annotate'],
      edit: makeNoopApplier() as unknown as PatchAppliers['edit'],
      edge: makeNoopApplier() as unknown as PatchAppliers['edge'],
      drillDown: makeNoopApplier() as unknown as PatchAppliers['drillDown'],
    };
    render(
      <PatchListProvider appliers={appliers} idFactory={makeIdFactory()}>
        <Probe refs={refs} />
      </PatchListProvider>,
    );

    act(() => {
      refs.current.actions?.stage(makeAnnotateInput({ summary: 'first' }));
      refs.current.actions?.stage(makeAnnotateInput({ summary: 'second' }));
    });
    await act(async () => {
      await refs.current.actions?.apply();
    });

    expect(annotate).toHaveBeenCalledTimes(2);
    expect(undoFirst).toHaveBeenCalledTimes(1);
    expect(refs.current.state.count).toBe(2);
    expect(refs.current.state.canUndo).toBe(false);
    expect(refs.current.state.isApplying).toBe(false);
  });
});

describe('undo', () => {
  it('invokes the per-patch undo handles in reverse order and flips canUndo false', async () => {
    const refs = makeProbeRefs();
    const undoCalls: string[] = [];
    const annotate = vi.fn((patch: AnnotatePatch) =>
      Promise.resolve({
        undo: () => {
          undoCalls.push(patch.id);
          return Promise.resolve();
        },
      }),
    );
    const appliers: PatchAppliers = {
      annotate: annotate as unknown as PatchAppliers['annotate'],
      edit: makeNoopApplier() as unknown as PatchAppliers['edit'],
      edge: makeNoopApplier() as unknown as PatchAppliers['edge'],
      drillDown: makeNoopApplier() as unknown as PatchAppliers['drillDown'],
    };

    render(
      <PatchListProvider appliers={appliers} idFactory={makeIdFactory()}>
        <Probe refs={refs} />
      </PatchListProvider>,
    );

    act(() => {
      refs.current.actions?.stage(makeAnnotateInput({ summary: 'first' }));
      refs.current.actions?.stage(makeAnnotateInput({ summary: 'second' }));
    });

    await act(async () => {
      await refs.current.actions?.apply();
    });

    expect(refs.current.state.canUndo).toBe(true);

    await act(async () => {
      await refs.current.actions?.undo();
    });

    // Reverse order: second-staged undoes first.
    expect(undoCalls).toEqual(['id-2', 'id-1']);
    expect(refs.current.state.canUndo).toBe(false);
    expect(refs.current.state.count).toBe(0);
  });

  it('undo when canUndo=false is a no-op', async () => {
    const refs = makeProbeRefs();
    const { appliers, undoMock } = makeAppliers();
    render(
      <PatchListProvider appliers={appliers} idFactory={makeIdFactory()}>
        <Probe refs={refs} />
      </PatchListProvider>,
    );

    await act(async () => {
      await refs.current.actions?.undo();
    });

    expect(undoMock).not.toHaveBeenCalled();
  });
});

describe('useStagedPatches filter', () => {
  it('filters by anchor (kind + itemId)', () => {
    const refs = makeProbeRefs();
    const { appliers } = makeAppliers();
    render(
      <PatchListProvider appliers={appliers} idFactory={makeIdFactory()}>
        <Probe refs={refs} filter={{ anchor: { kind: 'decision', itemId: 7 } }} />
      </PatchListProvider>,
    );

    act(() => {
      refs.current.actions?.stage(
        makeAnnotateInput({ anchor: { kind: 'decision', itemId: 7 }, summary: 'matches' }),
      );
      refs.current.actions?.stage(
        makeAnnotateInput({ anchor: { kind: 'decision', itemId: 8 }, summary: 'different item' }),
      );
      refs.current.actions?.stage(
        makeAnnotateInput({ anchor: { kind: 'goal', itemId: 7 }, summary: 'different kind' }),
      );
    });

    expect(refs.current.filtered.length).toBe(1);
    expect(refs.current.filtered[0]?.summary).toBe('matches');
  });

  it('filters by kind only when anchor is omitted', () => {
    const refs = makeProbeRefs();
    const { appliers } = makeAppliers();
    render(
      <PatchListProvider appliers={appliers} idFactory={makeIdFactory()}>
        <Probe refs={refs} filter={{ kind: 'annotate' }} />
      </PatchListProvider>,
    );

    act(() => {
      refs.current.actions?.stage(makeAnnotateInput({ summary: 'a' }));
      refs.current.actions?.stage(makeAnnotateInput({ summary: 'b' }));
    });

    expect(refs.current.filtered.map((patch) => patch.summary)).toEqual(['a', 'b']);
  });

  it('returns the full staged list when no filter is provided', () => {
    const refs = makeProbeRefs();
    const { appliers } = makeAppliers();
    render(
      <PatchListProvider appliers={appliers} idFactory={makeIdFactory()}>
        <Probe refs={refs} />
      </PatchListProvider>,
    );

    act(() => {
      refs.current.actions?.stage(makeAnnotateInput({ summary: 'one' }));
      refs.current.actions?.stage(makeAnnotateInput({ anchor: { kind: 'goal', itemId: 9 }, summary: 'two' }));
    });

    expect(refs.current.filtered.length).toBe(2);
  });
});

// ---- V2 patch kinds through the host ----

function makeEditInput(overrides: Partial<StagePatchInput> = {}): StagePatchInput {
  return {
    kind: 'edit',
    anchor: { kind: 'decision', itemId: 1 },
    summary: 'edit note',
    newContent: 'new content',
    ...overrides,
  } as StagePatchInput;
}

function makeEdgeInput(overrides: Partial<StagePatchInput> = {}): StagePatchInput {
  return {
    kind: 'edge',
    anchor: { kind: 'decision', itemId: 1 },
    summary: 'edge note',
    targetAnchor: { kind: 'goal', itemId: 2 },
    relation: 'supports',
    ...overrides,
  } as StagePatchInput;
}

function makeDrillDownInput(overrides: Partial<StagePatchInput> = {}): StagePatchInput {
  return {
    kind: 'drill-down',
    anchor: { kind: 'decision', itemId: 1 },
    summary: 'drill note',
    focusArea: 'performance',
    ...overrides,
  } as StagePatchInput;
}

describe('V2 patch kinds — stage / discard / apply through PatchListProvider', () => {
  it('stages and applies an EditPatch through the edit applier', async () => {
    const refs = makeProbeRefs();
    const editMock = vi.fn(() => Promise.resolve({ undo: () => Promise.resolve() }));
    const { appliers } = makeAppliers();
    appliers.edit = editMock as unknown as PatchAppliers['edit'];
    render(
      <PatchListProvider appliers={appliers} idFactory={makeIdFactory()}>
        <Probe refs={refs} />
      </PatchListProvider>,
    );

    act(() => {
      refs.current.actions?.stage(makeEditInput({ summary: 'edit-1' }));
    });
    expect(refs.current.state.staged[0]?.kind).toBe('edit');

    await act(async () => {
      await refs.current.actions?.apply();
    });
    expect(editMock).toHaveBeenCalledTimes(1);
    expect(refs.current.state.count).toBe(0);
  });

  it('stages and applies an EdgePatch through the edge applier', async () => {
    const refs = makeProbeRefs();
    const edgeMock = vi.fn(() => Promise.resolve({ undo: () => Promise.resolve() }));
    const { appliers } = makeAppliers();
    appliers.edge = edgeMock as unknown as PatchAppliers['edge'];
    render(
      <PatchListProvider appliers={appliers} idFactory={makeIdFactory()}>
        <Probe refs={refs} />
      </PatchListProvider>,
    );

    act(() => {
      refs.current.actions?.stage(makeEdgeInput({ summary: 'edge-1' }));
    });
    expect(refs.current.state.staged[0]?.kind).toBe('edge');

    await act(async () => {
      await refs.current.actions?.apply();
    });
    expect(edgeMock).toHaveBeenCalledTimes(1);
    expect(refs.current.state.count).toBe(0);
  });

  it('stages and applies a DrillDownPatch through the drillDown applier', async () => {
    const refs = makeProbeRefs();
    const drillMock = vi.fn(() => Promise.resolve({ undo: () => Promise.resolve() }));
    const { appliers } = makeAppliers();
    appliers.drillDown = drillMock as unknown as PatchAppliers['drillDown'];
    render(
      <PatchListProvider appliers={appliers} idFactory={makeIdFactory()}>
        <Probe refs={refs} />
      </PatchListProvider>,
    );

    act(() => {
      refs.current.actions?.stage(makeDrillDownInput({ summary: 'drill-1' }));
    });
    expect(refs.current.state.staged[0]?.kind).toBe('drill-down');

    await act(async () => {
      await refs.current.actions?.apply();
    });
    expect(drillMock).toHaveBeenCalledTimes(1);
    expect(refs.current.state.count).toBe(0);
  });

  it('discards a V2 patch from the host', () => {
    const refs = makeProbeRefs();
    const { appliers } = makeAppliers();
    render(
      <PatchListProvider appliers={appliers} idFactory={makeIdFactory()}>
        <Probe refs={refs} />
      </PatchListProvider>,
    );

    let id = '';
    act(() => {
      id = refs.current.actions?.stage(makeEditInput()) ?? '';
    });
    expect(refs.current.state.count).toBe(1);
    act(() => {
      refs.current.actions?.discard(id);
    });
    expect(refs.current.state.count).toBe(0);
  });

  it('applies a mixed batch of annotate + edit patches', async () => {
    const refs = makeProbeRefs();
    const editMock = vi.fn(() => Promise.resolve({ undo: () => Promise.resolve() }));
    const { appliers, annotateMock } = makeAppliers();
    appliers.edit = editMock as unknown as PatchAppliers['edit'];
    render(
      <PatchListProvider appliers={appliers} idFactory={makeIdFactory()}>
        <Probe refs={refs} />
      </PatchListProvider>,
    );

    act(() => {
      refs.current.actions?.stage(makeAnnotateInput({ summary: 'ann' }));
      refs.current.actions?.stage(makeEditInput({ summary: 'edt' }));
    });

    await act(async () => {
      await refs.current.actions?.apply();
    });
    expect(annotateMock).toHaveBeenCalledTimes(1);
    expect(editMock).toHaveBeenCalledTimes(1);
    expect(refs.current.state.count).toBe(0);
    expect(refs.current.state.canUndo).toBe(true);
  });
});
