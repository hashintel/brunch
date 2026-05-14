// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ReconciliationNeedRecord } from '@/shared/reconciliation-need.js';

import { PatchListProvider, usePatchList, type PatchAppliers } from '../patch-list-host.js';
import { PatchListOverlay } from '../patch-list-overlay.js';
import { makeNeed } from './reconciliation-need-fixtures.js';

let mockOpenNeeds: ReconciliationNeedRecord[] = [];
function setMockOpenNeeds(needs: ReconciliationNeedRecord[]): void {
  mockOpenNeeds = needs;
}

vi.mock('@/client/routes/specification/$id/-specification-data.js', () => ({
  useSpecificationOpenReconciliationNeeds: () => mockOpenNeeds,
  specificationQueryKeys: {
    bundle: (id: string) => ['specification', id, 'bundle'] as const,
    entities: (id: string) => ['specification', id, 'entities'] as const,
    entitiesProjectWide: (id: string) => ['specification', id, 'entities', 'project-wide'] as const,
    reconciliationNeeds: (id: string) => ['specification', id, 'reconciliation-needs'] as const,
  },
  invalidateOpenReconciliationNeeds: vi.fn(),
}));

vi.mock('@/client/lib/edit-api.js', () => ({
  resolveReconciliationNeedRequest: vi.fn(() => Promise.resolve({ resolved: true as const })),
}));

afterEach(() => {
  cleanup();
  setMockOpenNeeds([]);
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

function StageEditPatchWithDiffButton() {
  const patchList = usePatchList();
  return (
    <button
      type="button"
      onClick={() =>
        patchList?.stage({
          kind: 'edit',
          anchor: { kind: 'goal', itemId: 1 },
          anchorReferenceCode: 'G1',
          summary: 'Edit: swap database',
          currentContent: 'Use SQLite for the local store.',
          newContent: 'Use Postgres for the local store.',
          impact: 'soft',
        })
      }
    >
      stage-edit-with-diff
    </button>
  );
}

function StageAnnotatePatchButton() {
  const patchList = usePatchList();
  return (
    <button
      type="button"
      onClick={() =>
        patchList?.stage({
          kind: 'annotate',
          anchor: { kind: 'goal', itemId: 2 },
          summary: 'Note: clarify exclusion',
          body: 'The exclusion clause should be moved up.',
        })
      }
    >
      stage-annotate
    </button>
  );
}

function StageHardEditButton() {
  const patchList = usePatchList();
  return (
    <button
      type="button"
      onClick={() =>
        patchList?.stage({
          kind: 'edit',
          anchor: { kind: 'goal', itemId: 3 },
          summary: 'Hard: restructure',
          currentContent: 'before',
          newContent: 'after',
          impact: 'hard',
        })
      }
    >
      stage-hard-edit
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

  // Skipped: PatchListOverlayBridgeProvider was removed with the SideChatPopover
  // retirement (FE-710 slice 10). The bridge was a popover-specific scoping mechanism.
  it.skip('disables overlay Apply when the bridge has no scoped patches while others are staged', () => {});

  it.skip('invokes bridge applyScoped instead of applying all patches when a bridge is present', () => {});

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

  it('renders staged-changes but no longer composes Pending review (moved into structured-list view, Card 4 follow-up)', () => {
    setMockOpenNeeds([makeNeed({ id: 7 })]);
    const appliers = makeAppliers();
    render(
      <PatchListProvider appliers={appliers}>
        <PatchListOverlay />
        <StageEditPatchButton />
      </PatchListProvider>,
    );
    fireEvent.click(screen.getByText('stage-edit'));
    expect(screen.getByRole('region', { name: /staged changes/i })).toBeTruthy();
    expect(screen.queryByRole('region', { name: /pending review/i })).toBeNull();
  });

  it('does not surface any "Hard impact — coming in V3" banner copy', async () => {
    const editApplier = vi.fn(() =>
      Promise.resolve({
        undo: () => Promise.resolve(),
        applied: {
          impact: 'hard',
          noUndo: true,
          previousContent: 'old',
          previousRationale: null,
          openedNeedIds: [101],
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
    expect(screen.queryByText(/coming in V3/i)).toBeNull();
    expect(screen.queryByText(/cascade pending review/i)).toBeNull();
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

  it('does not re-show saved toast when overlay remounts with the same lastBatchId', async () => {
    const editApplier = vi.fn(() =>
      Promise.resolve({
        undo: () => Promise.resolve(),
        applied: { impact: 'soft', previousContent: 'old' },
      }),
    );
    const appliers = makeAppliers({ edit: editApplier as unknown as PatchAppliers['edit'] });
    function ToggleOverlay() {
      const [show, setShow] = useState(true);
      return (
        <>
          <button type="button" onClick={() => setShow((s) => !s)}>
            toggle-overlay
          </button>
          {show ? <PatchListOverlay /> : null}
          <StageEditPatchButton />
        </>
      );
    }
    render(
      <PatchListProvider appliers={appliers}>
        <ToggleOverlay />
      </PatchListProvider>,
    );
    fireEvent.click(screen.getByText('stage-edit'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /apply/i }));
    });
    expect(screen.getByRole('status', { name: /change saved/i })).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByText('toggle-overlay'));
    });
    expect(screen.queryByRole('status', { name: /change saved/i })).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByText('toggle-overlay'));
    });
    expect(screen.queryByRole('status', { name: /change saved/i })).toBeNull();
  });

  it('shows the saved-toast after a hard-impact apply (no deferred banner blocking)', async () => {
    const editApplier = vi.fn(() =>
      Promise.resolve({
        undo: () => Promise.resolve(),
        applied: {
          impact: 'hard',
          noUndo: true,
          previousContent: 'old',
          previousRationale: null,
          openedNeedIds: [101],
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

    expect(screen.getByRole('status', { name: /change saved/i })).toBeTruthy();
  });

  it('hides the Undo button after a hard-impact-only apply (V3.0 polish — noUndo)', async () => {
    const editApplier = vi.fn(() =>
      Promise.resolve({
        undo: () => Promise.resolve(),
        applied: {
          impact: 'hard',
          noUndo: true,
          previousContent: 'old',
          previousRationale: null,
          openedNeedIds: [101],
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

    const toast = screen.getByRole('status', { name: /change saved/i });
    expect(toast).toBeTruthy();
    expect(toast.querySelector('button')).toBeNull();
  });

  it('still shows the Undo button after a soft-impact apply', async () => {
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

    const toast = screen.getByRole('status', { name: /change saved/i });
    expect(toast.querySelector('button')).not.toBeNull();
  });

  it('shows the saved toast after a hard apply that immediately follows a soft apply', async () => {
    let calls = 0;
    const editApplier = vi.fn(() => {
      calls += 1;
      if (calls === 1) {
        return Promise.resolve({
          undo: () => Promise.resolve(),
          applied: { impact: 'soft', previousContent: 'old' },
        });
      }
      return Promise.resolve({
        undo: () => Promise.resolve(),
        applied: {
          impact: 'hard',
          noUndo: true,
          previousContent: 'old',
          previousRationale: null,
          openedNeedIds: [101],
        },
      });
    });
    const appliers = makeAppliers({ edit: editApplier as unknown as PatchAppliers['edit'] });
    render(
      <PatchListProvider appliers={appliers}>
        <PatchListOverlay />
        <StageEditPatchWithDiffButton />
        <StageHardEditButton />
      </PatchListProvider>,
    );

    fireEvent.click(screen.getByText('stage-edit-with-diff'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /apply/i }));
    });
    expect(screen.getByRole('status', { name: /change saved/i })).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });
    expect(screen.queryByRole('status', { name: /change saved/i })).toBeNull();

    fireEvent.click(screen.getByText('stage-hard-edit'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /apply/i }));
    });
    expect(screen.getByRole('status', { name: /change saved/i })).toBeTruthy();
  });
});

describe('PatchListOverlay — expand-to-detail (FE-665 follow-up)', () => {
  it('renders the N pending changes label as a toggle button', () => {
    const appliers = makeAppliers();
    render(
      <PatchListProvider appliers={appliers}>
        <PatchListOverlay />
        <StageEditPatchWithDiffButton />
      </PatchListProvider>,
    );
    fireEvent.click(screen.getByText('stage-edit-with-diff'));
    const toggle = screen.getByRole('button', { name: /1 pending change/i });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('does not render the per-patch list by default (collapsed)', () => {
    const appliers = makeAppliers();
    render(
      <PatchListProvider appliers={appliers}>
        <PatchListOverlay />
        <StageEditPatchWithDiffButton />
      </PatchListProvider>,
    );
    fireEvent.click(screen.getByText('stage-edit-with-diff'));
    expect(screen.queryByRole('list', { name: /staged patch detail/i })).toBeNull();
  });

  it('clicking the toggle expands the per-patch list and flips aria-expanded', () => {
    const appliers = makeAppliers();
    render(
      <PatchListProvider appliers={appliers}>
        <PatchListOverlay />
        <StageEditPatchWithDiffButton />
      </PatchListProvider>,
    );
    fireEvent.click(screen.getByText('stage-edit-with-diff'));
    const toggle = screen.getByRole('button', { name: /1 pending change/i });
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('list', { name: /staged patch detail/i })).toBeTruthy();
  });

  it('expanded list renders ContentDiff for an edit patch with currentContent + newContent', () => {
    const appliers = makeAppliers();
    render(
      <PatchListProvider appliers={appliers}>
        <PatchListOverlay />
        <StageEditPatchWithDiffButton />
      </PatchListProvider>,
    );
    fireEvent.click(screen.getByText('stage-edit-with-diff'));
    fireEvent.click(screen.getByRole('button', { name: /1 pending change/i }));
    const removed = document.querySelectorAll('[data-diff-kind="removed"]');
    const added = document.querySelectorAll('[data-diff-kind="added"]');
    expect(removed.length).toBeGreaterThan(0);
    expect(added.length).toBeGreaterThan(0);
    expect(Array.from(removed).some((node) => node.textContent?.includes('SQLite'))).toBe(true);
    expect(Array.from(added).some((node) => node.textContent?.includes('Postgres'))).toBe(true);
  });

  it('expanded list falls back to summary-only when an edit patch lacks currentContent', () => {
    const appliers = makeAppliers();
    render(
      <PatchListProvider appliers={appliers}>
        <PatchListOverlay />
        <StageEditPatchButton />
      </PatchListProvider>,
    );
    fireEvent.click(screen.getByText('stage-edit'));
    fireEvent.click(screen.getByRole('button', { name: /1 pending change/i }));
    const list = screen.getByRole('list', { name: /staged patch detail/i });
    expect(list.textContent).toContain('Edit: rephrase');
    expect(document.querySelectorAll('[data-diff-kind]').length).toBe(0);
  });

  it('expanded list renders summary-only for non-edit patches', () => {
    const appliers = makeAppliers();
    render(
      <PatchListProvider appliers={appliers}>
        <PatchListOverlay />
        <StageAnnotatePatchButton />
      </PatchListProvider>,
    );
    fireEvent.click(screen.getByText('stage-annotate'));
    fireEvent.click(screen.getByRole('button', { name: /1 pending change/i }));
    const list = screen.getByRole('list', { name: /staged patch detail/i });
    expect(list.textContent).toContain('Note: clarify exclusion');
    expect(document.querySelectorAll('[data-diff-kind]').length).toBe(0);
  });

  it('clicking the toggle a second time collapses the list', () => {
    const appliers = makeAppliers();
    render(
      <PatchListProvider appliers={appliers}>
        <PatchListOverlay />
        <StageEditPatchWithDiffButton />
      </PatchListProvider>,
    );
    fireEvent.click(screen.getByText('stage-edit-with-diff'));
    const toggle = screen.getByRole('button', { name: /1 pending change/i });
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('list', { name: /staged patch detail/i })).toBeNull();
  });

  it('expanded list shows multiple staged patches at once', () => {
    const appliers = makeAppliers();
    render(
      <PatchListProvider appliers={appliers}>
        <PatchListOverlay />
        <StageEditPatchWithDiffButton />
        <StageAnnotatePatchButton />
      </PatchListProvider>,
    );
    fireEvent.click(screen.getByText('stage-edit-with-diff'));
    fireEvent.click(screen.getByText('stage-annotate'));
    fireEvent.click(screen.getByRole('button', { name: /2 pending changes/i }));
    const list = screen.getByRole('list', { name: /staged patch detail/i });
    expect(list.textContent).toContain('Edit: swap database');
    expect(list.textContent).toContain('Note: clarify exclusion');
  });

  it('renders the kind-tinted reference badge for patches that carry anchorReferenceCode', () => {
    const appliers = makeAppliers();
    render(
      <PatchListProvider appliers={appliers}>
        <PatchListOverlay />
        <StageEditPatchWithDiffButton />
      </PatchListProvider>,
    );
    fireEvent.click(screen.getByText('stage-edit-with-diff'));
    fireEvent.click(screen.getByRole('button', { name: /1 pending change/i }));
    const badge = document.querySelector('[data-staged-patch-anchor="G1"]');
    expect(badge).not.toBeNull();
    expect(badge!.textContent).toBe('G1');
  });

  it('renders the impact chip for an edit patch with impact tier', () => {
    const appliers = makeAppliers();
    render(
      <PatchListProvider appliers={appliers}>
        <PatchListOverlay />
        <StageEditPatchWithDiffButton />
      </PatchListProvider>,
    );
    fireEvent.click(screen.getByText('stage-edit-with-diff'));
    fireEvent.click(screen.getByRole('button', { name: /1 pending change/i }));
    const chip = screen.getByLabelText(/soft impact/i);
    expect(chip.getAttribute('data-impact')).toBe('soft');
  });
});
