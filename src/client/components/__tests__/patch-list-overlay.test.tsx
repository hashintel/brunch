// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PatchListProvider, usePatchList, type PatchAppliers } from '../patch-list-host.js';
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
});
