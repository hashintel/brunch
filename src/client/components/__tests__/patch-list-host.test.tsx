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
  type StagePatchInput,
} from '../patch-list-host.js';

afterEach(() => {
  cleanup();
});

interface ProbeRefs {
  current: {
    actions: ReturnType<typeof usePatchList>;
    state: ReturnType<typeof usePatchListState>;
    filtered: readonly AnnotatePatch[];
  };
}

function Probe({ refs, filter }: { refs: ProbeRefs; filter?: Parameters<typeof useStagedPatches>[0] }) {
  const actions = usePatchList();
  const state = usePatchListState();
  const filtered = useStagedPatches(filter) as readonly AnnotatePatch[];
  refs.current = { actions, state, filtered };
  return null;
}

function makeProbeRefs(): ProbeRefs {
  return {
    current: {
      actions: null,
      state: { staged: [], count: 0, canUndo: false, isApplying: false, lastBatchId: null },
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
    appliers: { annotate: annotateMock as unknown as PatchAppliers['annotate'] },
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
    });
  });
});

describe('PatchListProvider — basic mount', () => {
  it('mounts and renders children', () => {
    const { appliers } = makeAppliers();
    render(
      <PatchListProvider specificationId={1} appliers={appliers} idFactory={makeIdFactory()}>
        <div data-testid="child">child-rendered</div>
      </PatchListProvider>,
    );
    expect(screen.getByTestId('child').textContent).toBe('child-rendered');
  });

  it('usePatchList returns non-null actions inside the provider', () => {
    const refs = makeProbeRefs();
    const { appliers } = makeAppliers();
    render(
      <PatchListProvider specificationId={1} appliers={appliers} idFactory={makeIdFactory()}>
        <Probe refs={refs} />
      </PatchListProvider>,
    );
    expect(refs.current.actions).not.toBeNull();
    expect(typeof refs.current.actions?.stage).toBe('function');
    expect(typeof refs.current.actions?.apply).toBe('function');
    expect(typeof refs.current.actions?.undo).toBe('function');
  });
});

describe('stage / discard / editSummary', () => {
  it('stage(input) increments count and surfaces the patch via state.staged', () => {
    const refs = makeProbeRefs();
    const { appliers } = makeAppliers();
    render(
      <PatchListProvider specificationId={1} appliers={appliers} idFactory={makeIdFactory()}>
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
      <PatchListProvider specificationId={1} appliers={appliers} idFactory={makeIdFactory()}>
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
      <PatchListProvider specificationId={1} appliers={appliers} idFactory={makeIdFactory()}>
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
      <PatchListProvider specificationId={1} appliers={appliers} idFactory={makeIdFactory()}>
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

  it('exposes lastBatchId and changes it on each apply (mutation signal for downstream effects)', async () => {
    const refs = makeProbeRefs();
    const { appliers } = makeAppliers();
    render(
      <PatchListProvider specificationId={1} appliers={appliers} idFactory={makeIdFactory()}>
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

  it('apply on an empty list is a no-op (no applier calls, state unchanged)', async () => {
    const refs = makeProbeRefs();
    const { appliers, annotateMock } = makeAppliers();
    render(
      <PatchListProvider specificationId={1} appliers={appliers} idFactory={makeIdFactory()}>
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
    };
    render(
      <PatchListProvider specificationId={1} appliers={appliers} idFactory={makeIdFactory()}>
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
    };

    render(
      <PatchListProvider specificationId={1} appliers={appliers} idFactory={makeIdFactory()}>
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
      <PatchListProvider specificationId={1} appliers={appliers} idFactory={makeIdFactory()}>
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
      <PatchListProvider specificationId={1} appliers={appliers} idFactory={makeIdFactory()}>
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
      <PatchListProvider specificationId={1} appliers={appliers} idFactory={makeIdFactory()}>
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
      <PatchListProvider specificationId={1} appliers={appliers} idFactory={makeIdFactory()}>
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
