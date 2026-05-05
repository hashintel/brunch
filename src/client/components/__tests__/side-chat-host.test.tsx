// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';

import { streamSideChatResponse } from '@/client/lib/side-chat-stream.js';

import { PatchListProvider, type PatchAppliers } from '../patch-list-host.js';
import { SideChatHost, useSideChat, type SideChatPinnableItem } from '../side-chat-host.js';

vi.mock('@/client/lib/side-chat-stream.js', () => ({
  streamSideChatResponse: vi.fn(() => Promise.resolve()),
}));

afterEach(() => {
  cleanup();
});

const samplePinnable: SideChatPinnableItem = {
  kind: 'decision',
  id: 7,
  referenceCode: 'D7',
  content: 'Use SQLite for local storage.',
};

function OpenSideChatButton({ item }: { item: SideChatPinnableItem }) {
  const sideChat = useSideChat();
  return (
    <button type="button" onClick={() => sideChat?.openFor(item)}>
      open-side-chat
    </button>
  );
}

interface AppliersHandle {
  appliers: PatchAppliers;
  annotateMock: MockInstance;
  undoMock: MockInstance;
}

function makeAppliers(): AppliersHandle {
  const undoMock = vi.fn(() => Promise.resolve());
  const annotateMock = vi.fn(() => Promise.resolve({ undo: undoMock, applied: undefined }));
  return {
    annotateMock,
    undoMock,
    appliers: { annotate: annotateMock as unknown as PatchAppliers['annotate'] },
  };
}

let consoleErrorSpy: MockInstance;

beforeEach(() => {
  // Suppress expected error logging for promise-rejection tests below.
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
});

describe('SideChatHost annotate flow', () => {
  it('clicking Annotate switches the popover into composer mode', () => {
    const { appliers } = makeAppliers();
    render(
      <PatchListProvider appliers={appliers}>
        <SideChatHost specificationId={1}>
          <OpenSideChatButton item={samplePinnable} />
        </SideChatHost>
      </PatchListProvider>,
    );

    fireEvent.click(screen.getByText('open-side-chat'));
    fireEvent.click(screen.getByRole('button', { name: /annotate item/i }));

    expect(screen.getByLabelText('Annotation summary')).toBeTruthy();
    expect(screen.getByLabelText('Annotation body')).toBeTruthy();
  });

  it('staging an annotation auto-applies it (per the D131 user-driven carve-out) and surfaces Undo', async () => {
    const { appliers, annotateMock } = makeAppliers();
    render(
      <PatchListProvider appliers={appliers}>
        <SideChatHost specificationId={1}>
          <OpenSideChatButton item={samplePinnable} />
        </SideChatHost>
      </PatchListProvider>,
    );

    fireEvent.click(screen.getByText('open-side-chat'));
    fireEvent.click(screen.getByRole('button', { name: /annotate item/i }));
    fireEvent.change(screen.getByLabelText('Annotation summary'), {
      target: { value: 'Tighten phrasing' },
    });
    fireEvent.change(screen.getByLabelText('Annotation body'), {
      target: { value: 'The current wording is ambiguous.' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    });
    await screen.findByRole('button', { name: /^undo$/i });

    expect(screen.queryByLabelText('Annotation summary')).toBeNull();
    expect(screen.queryByText('1 staged annotation')).toBeNull();
    expect(annotateMock).toHaveBeenCalledTimes(1);
  });

  it('passes the trimmed summary + body through to the annotate applier on auto-apply', async () => {
    const { appliers, annotateMock } = makeAppliers();
    render(
      <PatchListProvider appliers={appliers}>
        <SideChatHost specificationId={1}>
          <OpenSideChatButton item={samplePinnable} />
        </SideChatHost>
      </PatchListProvider>,
    );

    fireEvent.click(screen.getByText('open-side-chat'));
    fireEvent.click(screen.getByRole('button', { name: /annotate item/i }));
    fireEvent.change(screen.getByLabelText('Annotation summary'), { target: { value: 'sum' } });
    fireEvent.change(screen.getByLabelText('Annotation body'), { target: { value: 'body' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    });
    await screen.findByRole('button', { name: /^undo$/i });

    expect(annotateMock).toHaveBeenCalledTimes(1);
    const stagedPatch = annotateMock.mock.calls[0]?.[0] as { kind: string; summary: string; body: string };
    expect(stagedPatch.kind).toBe('annotate');
    expect(stagedPatch.summary).toBe('sum');
    expect(stagedPatch.body).toBe('body');
  });

  it('Undo after auto-apply invokes the returned undo handle and flips canUndo off', async () => {
    const { appliers, undoMock } = makeAppliers();
    render(
      <PatchListProvider appliers={appliers}>
        <SideChatHost specificationId={1}>
          <OpenSideChatButton item={samplePinnable} />
        </SideChatHost>
      </PatchListProvider>,
    );

    fireEvent.click(screen.getByText('open-side-chat'));
    fireEvent.click(screen.getByRole('button', { name: /annotate item/i }));
    fireEvent.change(screen.getByLabelText('Annotation summary'), { target: { value: 'sum' } });
    fireEvent.change(screen.getByLabelText('Annotation body'), { target: { value: 'body' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    });
    await screen.findByRole('button', { name: /^undo$/i });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^undo$/i }));
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(undoMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/annotation saved/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /^undo$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^retry$/i })).toBeNull();
  });

  it('Apply failure preserves the staged patch and leaves canUndo false', async () => {
    const failingAnnotate = vi.fn(() => Promise.reject(new Error('boom')));
    const appliers: PatchAppliers = {
      annotate: failingAnnotate as unknown as PatchAppliers['annotate'],
    };

    render(
      <PatchListProvider appliers={appliers}>
        <SideChatHost specificationId={1}>
          <OpenSideChatButton item={samplePinnable} />
        </SideChatHost>
      </PatchListProvider>,
    );

    fireEvent.click(screen.getByText('open-side-chat'));
    fireEvent.click(screen.getByRole('button', { name: /annotate item/i }));
    fireEvent.change(screen.getByLabelText('Annotation summary'), { target: { value: 'sum' } });
    fireEvent.change(screen.getByLabelText('Annotation body'), { target: { value: 'body' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(failingAnnotate).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/1 pending annotation/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^undo$/i })).toBeNull();
    expect(screen.getByRole('button', { name: /^retry$/i })).toBeTruthy();
  });

  it('Discard removes a stuck-staged patch (failed auto-apply) from the inline list', async () => {
    const failingAnnotate = vi.fn(() => Promise.reject(new Error('boom')));
    const appliers: PatchAppliers = {
      annotate: failingAnnotate as unknown as PatchAppliers['annotate'],
    };

    render(
      <PatchListProvider appliers={appliers}>
        <SideChatHost specificationId={1}>
          <OpenSideChatButton item={samplePinnable} />
        </SideChatHost>
      </PatchListProvider>,
    );

    fireEvent.click(screen.getByText('open-side-chat'));
    fireEvent.click(screen.getByRole('button', { name: /annotate item/i }));
    fireEvent.change(screen.getByLabelText('Annotation summary'), { target: { value: 'sum' } });
    fireEvent.change(screen.getByLabelText('Annotation body'), { target: { value: 'body' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screen.getByText(/1 pending annotation/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /discard staged annotation/i }));

    expect(screen.queryByText(/1 pending annotation/i)).toBeNull();
  });

  it('inline patch list filters stuck-staged patches to the currently pinned item', async () => {
    const failingAnnotate = vi.fn(() => Promise.reject(new Error('boom')));
    const appliers: PatchAppliers = {
      annotate: failingAnnotate as unknown as PatchAppliers['annotate'],
    };
    const otherItem: SideChatPinnableItem = {
      kind: 'goal',
      id: 11,
      referenceCode: 'G11',
      content: 'Ship V1.2',
    };

    function OpenButtons() {
      const sideChat = useSideChat();
      return (
        <>
          <button type="button" onClick={() => sideChat?.openFor(samplePinnable)}>
            open-decision
          </button>
          <button type="button" onClick={() => sideChat?.openFor(otherItem)}>
            open-goal
          </button>
        </>
      );
    }

    render(
      <PatchListProvider appliers={appliers}>
        <SideChatHost specificationId={1}>
          <OpenButtons />
        </SideChatHost>
      </PatchListProvider>,
    );

    // Stage on D7 (auto-apply fails, patch sits in staged on D7's anchor)
    fireEvent.click(screen.getByText('open-decision'));
    fireEvent.click(screen.getByRole('button', { name: /annotate item/i }));
    fireEvent.change(screen.getByLabelText('Annotation summary'), { target: { value: 'd-sum' } });
    fireEvent.change(screen.getByLabelText('Annotation body'), { target: { value: 'd-body' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screen.getByText('d-sum')).toBeTruthy();

    // Switch to G11 (different anchor); inline list should show no rows for G11.
    fireEvent.click(screen.getByText('open-goal'));
    expect(screen.queryByText('d-sum')).toBeNull();
    expect(screen.queryByText(/1 pending annotation/i)).toBeNull();

    // Switch back to D7; the staged patch reappears.
    fireEvent.click(screen.getByText('open-decision'));
    expect(screen.getByText('d-sum')).toBeTruthy();
  });

  it('does not leak the saved confirmation to another pinned item', async () => {
    const { appliers } = makeAppliers();
    const otherItem: SideChatPinnableItem = {
      kind: 'goal',
      id: 11,
      referenceCode: 'G11',
      content: 'Ship V1.2',
    };

    function OpenButtons() {
      const sideChat = useSideChat();
      return (
        <>
          <button type="button" onClick={() => sideChat?.openFor(samplePinnable)}>
            open-decision
          </button>
          <button type="button" onClick={() => sideChat?.openFor(otherItem)}>
            open-goal
          </button>
        </>
      );
    }

    render(
      <PatchListProvider appliers={appliers}>
        <SideChatHost specificationId={1}>
          <OpenButtons />
        </SideChatHost>
      </PatchListProvider>,
    );

    fireEvent.click(screen.getByText('open-decision'));
    fireEvent.click(screen.getByRole('button', { name: /annotate item/i }));
    fireEvent.change(screen.getByLabelText('Annotation summary'), { target: { value: 'd-sum' } });
    fireEvent.change(screen.getByLabelText('Annotation body'), { target: { value: 'd-body' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    });
    await screen.findByRole('status', { name: /annotation saved/i });

    fireEvent.click(screen.getByText('open-goal'));

    expect(screen.queryByRole('status', { name: /annotation saved/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^undo$/i })).toBeNull();
  });

  it('omits the Annotate button when no PatchListProvider is in scope (host degrades gracefully)', () => {
    render(
      <SideChatHost specificationId={1}>
        <OpenSideChatButton item={samplePinnable} />
      </SideChatHost>,
    );

    fireEvent.click(screen.getByText('open-side-chat'));
    expect(screen.queryByRole('button', { name: /annotate item/i })).toBeNull();
  });
});

describe('SideChatHost active cards', () => {
  it('exposes activeCardIds and dismissCard via context; pushes ids on apply', async () => {
    const { appliers, annotateMock } = makeAppliers();
    annotateMock.mockImplementation(() =>
      Promise.resolve({
        undo: () => Promise.resolve(),
        applied: { id: 101 },
      }),
    );

    function Probe() {
      const sideChat = useSideChat();
      return (
        <div>
          <span data-testid="ids">{sideChat?.activeCardIds.join(',') ?? ''}</span>
          <button type="button" onClick={() => sideChat?.dismissCard(101)}>
            dismiss
          </button>
        </div>
      );
    }

    render(
      <PatchListProvider specificationId={1} appliers={appliers}>
        <SideChatHost specificationId={1}>
          <OpenSideChatButton item={samplePinnable} />
          <Probe />
        </SideChatHost>
      </PatchListProvider>,
    );

    fireEvent.click(screen.getByText('open-side-chat'));
    fireEvent.click(screen.getByRole('button', { name: /annotate item/i }));
    fireEvent.change(screen.getByLabelText('Annotation summary'), {
      target: { value: 's' },
    });
    fireEvent.change(screen.getByLabelText('Annotation body'), {
      target: { value: 'b' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    });

    await screen.findByText('101', { selector: '[data-testid="ids"]' });

    fireEvent.click(screen.getByRole('button', { name: /^dismiss$/i }));
    await screen.findByText('', { selector: '[data-testid="ids"]' });
  });
});

describe('SideChatHost thread interleaving', () => {
  it('renders an active card chronologically interleaved with messages', async () => {
    const { appliers, annotateMock } = makeAppliers();
    annotateMock.mockImplementation(() =>
      Promise.resolve({ undo: () => Promise.resolve(), applied: { id: 7, summary: 'phrase', body: 'note' } }),
    );

    render(
      <PatchListProvider specificationId={1} appliers={appliers}>
        <SideChatHost specificationId={1}>
          <OpenSideChatButton item={samplePinnable} />
        </SideChatHost>
      </PatchListProvider>,
    );

    fireEvent.click(screen.getByText('open-side-chat'));
    fireEvent.click(screen.getByRole('button', { name: /annotate item/i }));
    fireEvent.change(screen.getByLabelText('Annotation summary'), {
      target: { value: 'phrase' },
    });
    fireEvent.change(screen.getByLabelText('Annotation body'), { target: { value: 'note' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    });

    // The card should land in the thread with data-thread-item="card" and contain "phrase"
    await screen.findByText('«phrase»', { selector: '[data-thread-item="card"] *' });
  });
});

describe('SideChatHost dismiss/reopen state isolation', () => {
  it('clears active cards when the side-chat is dismissed and reopened for the same item', async () => {
    const { appliers, annotateMock } = makeAppliers();
    annotateMock.mockImplementation(() =>
      Promise.resolve({
        undo: () => Promise.resolve(),
        applied: { id: 201, summary: 's', body: 'b' },
      }),
    );

    function Probe() {
      const sideChat = useSideChat();
      return (
        <div>
          <span data-testid="ids">{sideChat?.activeCardIds.join(',') ?? ''}</span>
          <button type="button" onClick={() => sideChat?.openFor(samplePinnable)}>
            open
          </button>
        </div>
      );
    }

    render(
      <PatchListProvider specificationId={1} appliers={appliers}>
        <SideChatHost specificationId={1}>
          <Probe />
        </SideChatHost>
      </PatchListProvider>,
    );

    fireEvent.click(screen.getByText('open'));
    fireEvent.click(screen.getByRole('button', { name: /annotate item/i }));
    fireEvent.change(screen.getByLabelText('Annotation summary'), { target: { value: 's' } });
    fireEvent.change(screen.getByLabelText('Annotation body'), { target: { value: 'b' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    });

    await screen.findByText('201', { selector: '[data-testid="ids"]' });

    // Dismiss via the popover's close affordance.
    fireEvent.click(screen.getByRole('button', { name: /close side-chat/i }));
    await screen.findByText('', { selector: '[data-testid="ids"]' });

    // Reopen for the same item; cards should remain cleared.
    fireEvent.click(screen.getByText('open'));
    expect(screen.getByTestId('ids').textContent).toBe('');
  });

  it('clears active cards when switching the side-chat to a different item', async () => {
    const { appliers, annotateMock } = makeAppliers();
    annotateMock.mockImplementation((patch) =>
      Promise.resolve({
        undo: () => Promise.resolve(),
        applied: { id: 301, summary: patch.summary, body: patch.body },
      }),
    );

    const otherItem: SideChatPinnableItem = {
      kind: 'goal',
      id: 22,
      referenceCode: 'G22',
      content: 'Other item content',
    };

    function Probe() {
      const sideChat = useSideChat();
      return (
        <div>
          <span data-testid="ids">{sideChat?.activeCardIds.join(',') ?? ''}</span>
          <button type="button" onClick={() => sideChat?.openFor(samplePinnable)}>
            open-A
          </button>
          <button type="button" onClick={() => sideChat?.openFor(otherItem)}>
            open-B
          </button>
        </div>
      );
    }

    render(
      <PatchListProvider specificationId={1} appliers={appliers}>
        <SideChatHost specificationId={1}>
          <Probe />
        </SideChatHost>
      </PatchListProvider>,
    );

    fireEvent.click(screen.getByText('open-A'));
    fireEvent.click(screen.getByRole('button', { name: /annotate item/i }));
    fireEvent.change(screen.getByLabelText('Annotation summary'), { target: { value: 'a-sum' } });
    fireEvent.change(screen.getByLabelText('Annotation body'), { target: { value: 'a-body' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    });

    await screen.findByText('301', { selector: '[data-testid="ids"]' });

    // Switch to item B; cards from A must not leak.
    fireEvent.click(screen.getByText('open-B'));
    expect(screen.getByTestId('ids').textContent).toBe('');
  });
});

describe('SideChatHost span hints', () => {
  it('forwards openWithSpanHint and includes spanHint in the next stream request', async () => {
    const streamMock = vi.mocked(streamSideChatResponse);
    streamMock.mockClear();

    const { appliers } = makeAppliers();

    function Probe() {
      const sideChat = useSideChat();
      return (
        <button
          type="button"
          onClick={() => sideChat?.openWithSpanHint(samplePinnable, 'highlighted phrase')}
        >
          open-with-hint
        </button>
      );
    }

    render(
      <PatchListProvider specificationId={1} appliers={appliers}>
        <SideChatHost specificationId={1}>
          <Probe />
        </SideChatHost>
      </PatchListProvider>,
    );

    fireEvent.click(screen.getByText('open-with-hint'));
    const textarea = await screen.findByLabelText(/^message$/i);
    fireEvent.change(textarea, { target: { value: 'tell me more' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });

    await vi.waitFor(() => {
      expect(streamMock).toHaveBeenCalled();
    });
    const [requestArg] = streamMock.mock.calls[0];
    expect(requestArg).toMatchObject({ spanHint: 'highlighted phrase' });
  });

  it('clears spanHint after the first message is sent', async () => {
    const streamMock = vi.mocked(streamSideChatResponse);
    streamMock.mockClear();

    const { appliers } = makeAppliers();

    function Probe() {
      const sideChat = useSideChat();
      return (
        <button type="button" onClick={() => sideChat?.openWithSpanHint(samplePinnable, 'first hint')}>
          open-with-hint
        </button>
      );
    }

    render(
      <PatchListProvider specificationId={1} appliers={appliers}>
        <SideChatHost specificationId={1}>
          <Probe />
        </SideChatHost>
      </PatchListProvider>,
    );

    fireEvent.click(screen.getByText('open-with-hint'));
    const textarea = await screen.findByLabelText(/^message$/i);
    fireEvent.change(textarea, { target: { value: 'first' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });

    await vi.waitFor(() => expect(streamMock).toHaveBeenCalledTimes(1));

    fireEvent.change(textarea, { target: { value: 'second' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });

    await vi.waitFor(() => expect(streamMock).toHaveBeenCalledTimes(2));
    const [secondRequest] = streamMock.mock.calls[1];
    expect(secondRequest).not.toHaveProperty('spanHint');
  });
});

describe('SideChatHost active annotations payload', () => {
  it('sends only the 8 most-recent active annotations in the stream payload, with older ones marked not in context', async () => {
    const streamMock = vi.mocked(streamSideChatResponse);
    streamMock.mockClear();

    const { appliers, annotateMock } = makeAppliers();
    let nextId = 1;
    annotateMock.mockImplementation((patch) =>
      Promise.resolve({
        undo: () => Promise.resolve(),
        applied: { id: nextId++, summary: patch.summary, body: patch.body },
      }),
    );

    function PromoteAll() {
      const sideChat = useSideChat();
      const ids = sideChat?.activeCardIds ?? [];
      return <span data-testid="card-count">{ids.length}</span>;
    }

    render(
      <PatchListProvider specificationId={1} appliers={appliers}>
        <SideChatHost specificationId={1}>
          <OpenSideChatButton item={samplePinnable} />
          <PromoteAll />
        </SideChatHost>
      </PatchListProvider>,
    );

    fireEvent.click(screen.getByText('open-side-chat'));

    // Stage 10 annotations sequentially via the form
    for (let i = 0; i < 10; i++) {
      fireEvent.click(screen.getByRole('button', { name: /annotate item/i }));
      fireEvent.change(screen.getByLabelText('Annotation summary'), {
        target: { value: `phrase ${i + 1}` },
      });
      fireEvent.change(screen.getByLabelText('Annotation body'), {
        target: { value: `body ${i + 1}` },
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
      });
    }

    await screen.findByText('10', { selector: '[data-testid="card-count"]' });

    // Send a chat message — the request should include exactly 8 activeAnnotations.
    const textarea = screen.getByLabelText(/^message$/i);
    fireEvent.change(textarea, { target: { value: 'go' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });

    await vi.waitFor(() => expect(streamMock).toHaveBeenCalled());
    const [requestArg] = streamMock.mock.calls.at(-1)!;
    expect(requestArg.activeAnnotations).toHaveLength(8);
    // Most recent 8 means phrases 3..10 (oldest 1, 2 dropped).
    expect(requestArg.activeAnnotations![0].snapshot).toBe('phrase 3');
    expect(requestArg.activeAnnotations![7].snapshot).toBe('phrase 10');
  });
});

describe('SideChatHost span-hint chip', () => {
  it('renders a span-hint chip in the panel when openWithSpanHint is called', async () => {
    const { appliers } = makeAppliers();

    function Probe() {
      const sideChat = useSideChat();
      return (
        <button type="button" onClick={() => sideChat?.openWithSpanHint(samplePinnable, 'household income')}>
          open-with-hint
        </button>
      );
    }

    render(
      <PatchListProvider specificationId={1} appliers={appliers}>
        <SideChatHost specificationId={1}>
          <Probe />
        </SideChatHost>
      </PatchListProvider>,
    );

    fireEvent.click(screen.getByText('open-with-hint'));
    const chip = await screen.findByText(/household income/);
    expect(chip.closest('[data-span-hint-chip]')).not.toBeNull();
  });

  it('clearing the chip removes pendingSpanHint and the next message has no spanHint in payload', async () => {
    const streamMock = vi.mocked(streamSideChatResponse);
    streamMock.mockClear();

    const { appliers } = makeAppliers();

    function Probe() {
      const sideChat = useSideChat();
      return (
        <button type="button" onClick={() => sideChat?.openWithSpanHint(samplePinnable, 'phrase')}>
          open-with-hint
        </button>
      );
    }

    render(
      <PatchListProvider specificationId={1} appliers={appliers}>
        <SideChatHost specificationId={1}>
          <Probe />
        </SideChatHost>
      </PatchListProvider>,
    );

    fireEvent.click(screen.getByText('open-with-hint'));
    await screen.findByText(/phrase/);

    // Click the dismiss button on the chip
    fireEvent.click(screen.getByRole('button', { name: /clear span hint/i }));

    // Chip should disappear
    expect(screen.queryByText(/«phrase»/)).toBeNull();

    // Next message should not include spanHint
    const textarea = await screen.findByLabelText(/^message$/i);
    fireEvent.change(textarea, { target: { value: 'go' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });

    await vi.waitFor(() => expect(streamMock).toHaveBeenCalled());
    const [requestArg] = streamMock.mock.calls.at(-1)!;
    expect(requestArg).not.toHaveProperty('spanHint');
  });
});
