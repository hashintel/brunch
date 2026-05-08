// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PatchListProvider,
  usePatchList,
  usePatchListState,
  type PatchAppliers,
} from '../patch-list-host.js';
import { PatchListOverlayBridgeProvider } from '../patch-list-overlay-bridge.js';
import { PatchListOverlay } from '../patch-list-overlay.js';

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

function makeAppliers(overrides: Partial<PatchAppliers> = {}): PatchAppliers {
  const noop = vi.fn(() => Promise.resolve({ undo: () => Promise.resolve() }));
  return {
    annotate: (overrides.annotate ?? noop) as PatchAppliers['annotate'],
    edit: (overrides.edit ?? noop) as PatchAppliers['edit'],
    edge: (overrides.edge ?? noop) as PatchAppliers['edge'],
    drillDown: (overrides.drillDown ?? noop) as PatchAppliers['drillDown'],
  };
}

function StageEditPatchButton() {
  const patchList = usePatchList();
  return (
    <button
      type="button"
      onClick={() =>
        patchList?.stage({
          kind: 'edit',
          anchor: { kind: 'goal', itemId: 1 },
          summary: 'Edit: rephrase',
          newContent: 'rephrased content',
        })
      }
    >
      stage-edit
    </button>
  );
}

function UndoButton() {
  const patchList = usePatchList();
  return (
    <button type="button" onClick={() => void patchList?.undo()}>
      undo-outside-overlay
    </button>
  );
}

describe('PatchListOverlay', () => {
  it('renders nothing when there are no staged patches and no transient message', () => {
    const appliers = makeAppliers();
    const { container } = render(
      <PatchListProvider appliers={appliers}>
        <PatchListOverlay />
      </PatchListProvider>,
    );
    expect(container.querySelector('[role="region"]')).toBeNull();
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it('renders the staged-changes region with N pending changes when patches are staged', () => {
    const appliers = makeAppliers();
    render(
      <PatchListProvider appliers={appliers}>
        <PatchListOverlay />
        <StageEditPatchButton />
      </PatchListProvider>,
    );
    fireEvent.click(screen.getByText('stage-edit'));
    const region = screen.getByRole('region', { name: /staged changes/i });
    expect(region.getAttribute('data-staged-count')).toBe('1');
    expect(region.textContent).toMatch(/1 pending change/i);
    expect(screen.getByRole('button', { name: /apply/i })).toBeTruthy();
  });

  it('disables overlay Apply when the bridge has no scoped patches while others are staged', () => {
    const applyScoped = vi.fn();
    render(
      <PatchListProvider appliers={makeAppliers()}>
        <PatchListOverlayBridgeProvider value={{ applyScoped, scopedPatchIds: [] }}>
          <PatchListOverlay />
          <StageEditPatchButton />
        </PatchListOverlayBridgeProvider>
      </PatchListProvider>,
    );
    fireEvent.click(screen.getByText('stage-edit'));
    const applyBtn = screen.getByRole('button', { name: /apply/i }) as HTMLButtonElement;
    expect(applyBtn.disabled).toBe(true);
    expect(applyScoped).not.toHaveBeenCalled();
  });

  it('invokes bridge applyScoped instead of applying all patches when a bridge is present', async () => {
    const applyScoped = vi.fn();
    const editApplier = vi.fn(() =>
      Promise.resolve({
        undo: () => Promise.resolve(),
        applied: { impact: 'soft', previousContent: 'old' },
      }),
    );
    const appliers = makeAppliers({ edit: editApplier as unknown as PatchAppliers['edit'] });
    render(
      <PatchListProvider appliers={appliers}>
        <PatchListOverlayBridgeProvider value={{ applyScoped, scopedPatchIds: ['scoped'] }}>
          <PatchListOverlay />
          <StageEditPatchButton />
        </PatchListOverlayBridgeProvider>
      </PatchListProvider>,
    );
    fireEvent.click(screen.getByText('stage-edit'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /apply/i }));
    });
    expect(applyScoped).toHaveBeenCalledTimes(1);
    expect(editApplier).not.toHaveBeenCalled();
  });

  it('clicking Apply on the overlay invokes the patch-list applier', async () => {
    const editApplier = vi.fn(() =>
      Promise.resolve({
        undo: () => Promise.resolve(),
        applied: { impact: 'soft', previousContent: 'old' },
      }),
    );
    const appliers = makeAppliers({ edit: editApplier as unknown as PatchAppliers['edit'] });
    render(
      <PatchListProvider appliers={appliers}>
        <PatchListOverlay />
        <StageEditPatchButton />
      </PatchListProvider>,
    );
    fireEvent.click(screen.getByText('stage-edit'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /apply/i }));
    });
    expect(editApplier).toHaveBeenCalledTimes(1);
  });

  it('shows the deferred banner with the message after a hard-impact deferred apply', async () => {
    const editApplier = vi.fn(() =>
      Promise.resolve({
        undo: () => Promise.resolve(),
        applied: {
          deferred: true,
          impact: 'hard',
          message: 'Hard impact — coming in V3 cascade preview',
        },
      }),
    );
    const appliers = makeAppliers({ edit: editApplier as unknown as PatchAppliers['edit'] });
    render(
      <PatchListProvider appliers={appliers}>
        <PatchListOverlay />
        <StageEditPatchButton />
      </PatchListProvider>,
    );
    fireEvent.click(screen.getByText('stage-edit'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /apply/i }));
    });
    const banner = await screen.findByRole('status', { name: /hard impact deferred to v3/i });
    expect(banner.textContent).toContain('Hard impact — coming in V3 cascade preview');
    expect(screen.getByRole('button', { name: /dismiss/i })).toBeTruthy();
    // Saved-toast should NOT show in the overlay for a deferred-only batch
    expect(screen.queryByRole('status', { name: /change saved/i })).toBeNull();
  });

  it('clicking Dismiss hides the deferred banner', async () => {
    const editApplier = vi.fn(() =>
      Promise.resolve({
        undo: () => Promise.resolve(),
        applied: { deferred: true, impact: 'hard', message: 'Hard impact — coming in V3 cascade preview' },
      }),
    );
    const appliers = makeAppliers({ edit: editApplier as unknown as PatchAppliers['edit'] });
    render(
      <PatchListProvider appliers={appliers}>
        <PatchListOverlay />
        <StageEditPatchButton />
      </PatchListProvider>,
    );
    fireEvent.click(screen.getByText('stage-edit'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /apply/i }));
    });
    await screen.findByRole('status', { name: /hard impact deferred to v3/i });
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(screen.queryByRole('status', { name: /hard impact deferred to v3/i })).toBeNull();
  });

  it('hides the deferred banner when the applied batch is undone before the timeout', async () => {
    const editApplier = vi.fn(() =>
      Promise.resolve({
        undo: () => Promise.resolve(),
        applied: { deferred: true, impact: 'hard', message: 'Hard impact — coming in V3 cascade preview' },
      }),
    );
    const appliers = makeAppliers({ edit: editApplier as unknown as PatchAppliers['edit'] });
    render(
      <PatchListProvider appliers={appliers}>
        <PatchListOverlay />
        <StageEditPatchButton />
        <UndoButton />
      </PatchListProvider>,
    );
    fireEvent.click(screen.getByText('stage-edit'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /apply/i }));
    });
    await screen.findByRole('status', { name: /hard impact deferred to v3/i });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /undo-outside-overlay/i }));
    });

    expect(screen.queryByRole('status', { name: /hard impact deferred to v3/i })).toBeNull();
  });

  it('shows the saved-toast in the overlay after a non-deferred apply', async () => {
    const editApplier = vi.fn(() =>
      Promise.resolve({
        undo: () => Promise.resolve(),
        applied: { impact: 'soft', previousContent: 'old' },
      }),
    );
    const appliers = makeAppliers({ edit: editApplier as unknown as PatchAppliers['edit'] });
    render(
      <PatchListProvider appliers={appliers}>
        <PatchListOverlay />
        <StageEditPatchButton />
      </PatchListProvider>,
    );
    fireEvent.click(screen.getByText('stage-edit'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /apply/i }));
    });
    expect(screen.getByRole('status', { name: /change saved/i })).toBeTruthy();
  });

  it('auto-hides the deferred banner after the timeout even when staging activity churns mid-window', async () => {
    const editApplier = vi.fn(() =>
      Promise.resolve({
        undo: () => Promise.resolve(),
        applied: { deferred: true, impact: 'hard', message: 'Hard impact — coming in V3 cascade preview' },
      }),
    );
    const appliers = makeAppliers({ edit: editApplier as unknown as PatchAppliers['edit'] });

    function DiscardAllStaged() {
      const patchList = usePatchList();
      const state = usePatchListState();
      return (
        <button
          type="button"
          onClick={() => {
            for (const patch of state.staged) {
              patchList?.discard(patch.id);
            }
          }}
        >
          discard-all
        </button>
      );
    }

    render(
      <PatchListProvider appliers={appliers}>
        <PatchListOverlay />
        <StageEditPatchButton />
        <DiscardAllStaged />
      </PatchListProvider>,
    );

    fireEvent.click(screen.getByText('stage-edit'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /apply/i }));
    });
    await screen.findByRole('status', { name: /hard impact deferred to v3/i });

    fireEvent.click(screen.getByText('stage-edit'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    fireEvent.click(screen.getByText('discard-all'));

    expect(screen.queryByRole('status', { name: /hard impact deferred to v3/i })).toBeNull();
  });

  it('replaces a deferred banner with the saved-toast after a later non-deferred apply', async () => {
    const editApplier = vi
      .fn()
      .mockResolvedValueOnce({
        undo: () => Promise.resolve(),
        applied: { deferred: true, impact: 'hard', message: 'Hard impact — coming in V3 cascade preview' },
      })
      .mockResolvedValueOnce({
        undo: () => Promise.resolve(),
        applied: { impact: 'soft', previousContent: 'old' },
      });
    const appliers = makeAppliers({ edit: editApplier as unknown as PatchAppliers['edit'] });
    render(
      <PatchListProvider appliers={appliers}>
        <PatchListOverlay />
        <StageEditPatchButton />
      </PatchListProvider>,
    );

    fireEvent.click(screen.getByText('stage-edit'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /apply/i }));
    });
    await screen.findByRole('status', { name: /hard impact deferred to v3/i });

    fireEvent.click(screen.getByText('stage-edit'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /apply/i }));
    });

    expect(screen.queryByRole('status', { name: /hard impact deferred to v3/i })).toBeNull();
    expect(screen.getByRole('status', { name: /change saved/i })).toBeTruthy();
  });
});
