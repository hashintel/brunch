// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';

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
  const annotateMock = vi.fn(() => Promise.resolve({ undo: undoMock }));
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
      <PatchListProvider specificationId={1} appliers={appliers}>
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
      <PatchListProvider specificationId={1} appliers={appliers}>
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
      <PatchListProvider specificationId={1} appliers={appliers}>
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
      <PatchListProvider specificationId={1} appliers={appliers}>
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
      <PatchListProvider specificationId={1} appliers={appliers}>
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
      <PatchListProvider specificationId={1} appliers={appliers}>
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
      <PatchListProvider specificationId={1} appliers={appliers}>
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
