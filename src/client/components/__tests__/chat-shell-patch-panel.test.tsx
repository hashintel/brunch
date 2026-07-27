// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChatShellPatchPanel } from '../chat-shell-patch-panel.js';
import {
  PatchListProvider,
  usePatchList,
  usePatchListState,
  type Patch,
  type PatchAppliers,
  type StagePatchInput,
} from '../patch-list-host.js';

afterEach(() => {
  cleanup();
});

function makeNoopApplier() {
  return vi.fn(() => Promise.resolve({ undo: () => Promise.resolve() }));
}

function makeAppliers(): {
  appliers: PatchAppliers;
  editMock: ReturnType<typeof vi.fn>;
  undoMock: ReturnType<typeof vi.fn>;
} {
  const undoMock = vi.fn(() => Promise.resolve());
  const editMock = vi.fn(() => Promise.resolve({ undo: undoMock }));
  return {
    editMock,
    undoMock,
    appliers: {
      annotate: makeNoopApplier() as unknown as PatchAppliers['annotate'],
      edit: editMock as unknown as PatchAppliers['edit'],
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

function makeEditInput(overrides: Partial<StagePatchInput> = {}): StagePatchInput {
  return {
    kind: 'edit',
    producerChatId: null,
    anchor: { kind: 'decision', itemId: 1 },
    summary: 'edit summary',
    newContent: 'new',
    currentContent: 'old',
    ...overrides,
  } as StagePatchInput;
}

function makeAnnotateInput(overrides: Partial<StagePatchInput> = {}): StagePatchInput {
  return {
    kind: 'annotate',
    producerChatId: null,
    anchor: { kind: 'decision', itemId: 1 },
    summary: 'note',
    body: 'note body',
    ...overrides,
  } as StagePatchInput;
}

interface StagerRef {
  current: {
    stage: ((input: StagePatchInput) => string) | null;
    discard: ((id: string) => void) | null;
    apply: (() => Promise<void>) | null;
    state: ReturnType<typeof usePatchListState> | null;
    staged: readonly Patch[];
  };
}

function Stager({ refs }: { refs: StagerRef }) {
  const actions = usePatchList();
  const state = usePatchListState();
  refs.current = {
    stage: actions ? (input) => actions.stage(input) : null,
    discard: actions ? (id) => actions.discard(id) : null,
    apply: actions ? () => actions.apply() : null,
    state,
    staged: state.staged,
  };
  return null;
}

function renderPanel(children: ReactNode, appliers: PatchAppliers, refs: StagerRef) {
  return render(
    <PatchListProvider appliers={appliers} idFactory={makeIdFactory()}>
      <Stager refs={refs} />
      {children}
    </PatchListProvider>,
  );
}

function makeRefs(): StagerRef {
  return {
    current: { stage: null, discard: null, apply: null, state: null, staged: [] },
  };
}

describe('ChatShellPatchPanel', () => {
  it('renders null when no patches are staged', () => {
    const refs = makeRefs();
    const { appliers } = makeAppliers();
    renderPanel(<ChatShellPatchPanel />, appliers, refs);
    expect(screen.queryByTestId('chat-shell-patch-panel')).toBeNull();
  });

  it('renders a kind-specific title ("1 note") when exactly one patch is staged', () => {
    // User feedback supersedes prior titles: simpler language. Single-change
    // panels surface as "1 <kind>" (e.g. "1 note") — dropping "ready to
    // apply" so the header reads as the kind word alone.
    const refs = makeRefs();
    const { appliers } = makeAppliers();
    renderPanel(<ChatShellPatchPanel />, appliers, refs);

    act(() => {
      refs.current.stage?.(makeAnnotateInput({ summary: 'first note' }));
    });

    const panel = screen.getByTestId('chat-shell-patch-panel');
    expect(panel).not.toBeNull();
    expect(panel.textContent).toContain('1 note');
    const rows = screen.getAllByTestId('chat-shell-patch-row');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.textContent).toContain('first note');
    expect(rows[0]!.textContent).toContain('annotate');
    expect(screen.getByTestId('chat-shell-patch-discard')).not.toBeNull();
  });

  it('renders "N pending changes" header and bulk Apply all; Undo is owned by the applied toast (not the panel) after apply', async () => {
    // User-feedback supersedes the previous in-panel Undo button: the apply
    // flow now hides the panel (count drops to 0 → panel renders null) and
    // delegates Undo to <ChatShellAppliedToast> mounted in the shell. The
    // reducer's canUndo flag still flips so the toast can pick it up.
    const refs = makeRefs();
    const { appliers, editMock } = makeAppliers();
    renderPanel(<ChatShellPatchPanel />, appliers, refs);

    act(() => {
      refs.current.stage?.(makeEditInput({ summary: 'a', newContent: 'a1' }));
      refs.current.stage?.(makeEditInput({ summary: 'b', newContent: 'b1' }));
      refs.current.stage?.(makeEditInput({ summary: 'c', newContent: 'c1' }));
    });

    const panel = screen.getByTestId('chat-shell-patch-panel');
    // Simpler header per user feedback: "N changes" instead of "N pending changes".
    expect(panel.textContent).toContain('3 changes');

    await act(async () => {
      fireEvent.click(screen.getByTestId('chat-shell-patch-apply-all'));
    });

    expect(editMock).toHaveBeenCalledTimes(3);
    expect(refs.current.state?.count).toBe(0);
    expect(refs.current.state?.canUndo).toBe(true);
    expect(screen.queryByTestId('chat-shell-patch-panel')).toBeNull();
  });

  it('Discard removes a single row but leaves siblings staged', () => {
    const refs = makeRefs();
    const { appliers } = makeAppliers();
    renderPanel(<ChatShellPatchPanel />, appliers, refs);

    act(() => {
      refs.current.stage?.(makeAnnotateInput({ summary: 'keep me' }));
      refs.current.stage?.(makeAnnotateInput({ summary: 'discard me' }));
    });

    expect(screen.getAllByTestId('chat-shell-patch-row')).toHaveLength(2);

    const discardButtons = screen.getAllByTestId('chat-shell-patch-discard');
    fireEvent.click(discardButtons[1]!);

    const remaining = screen.getAllByTestId('chat-shell-patch-row');
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.textContent).toContain('keep me');
  });

  it('renders a ContentDiff for edit patches with before/after content', () => {
    const refs = makeRefs();
    const { appliers } = makeAppliers();
    renderPanel(<ChatShellPatchPanel />, appliers, refs);

    act(() => {
      refs.current.stage?.(
        makeEditInput({ summary: 'edit', currentContent: 'hello world', newContent: 'hello there' }),
      );
    });

    expect(screen.getByTestId('chat-shell-patch-diff')).not.toBeNull();
  });

  it('omits the per-row diff slot when an edit patch has identical before/after content', () => {
    const refs = makeRefs();
    const { appliers } = makeAppliers();
    renderPanel(<ChatShellPatchPanel />, appliers, refs);

    act(() => {
      refs.current.stage?.(makeEditInput({ currentContent: 'same', newContent: 'same' }));
    });

    expect(screen.queryByTestId('chat-shell-patch-diff')).toBeNull();
  });
});
