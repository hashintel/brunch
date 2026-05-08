// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ReconciliationNeedRecord } from '@/shared/reconciliation-need.js';

import {
  PatchListProvider,
  usePatchList,
  usePatchListState,
  type PatchAppliers,
} from '../patch-list-host.js';
import { PatchListOverlayBridgeProvider } from '../patch-list-overlay-bridge.js';
import { PatchListOverlay } from '../patch-list-overlay.js';

const mockResolveReconciliationNeedRequest = vi.hoisted(() =>
  vi.fn(() => Promise.resolve({ resolved: true as const })),
);
vi.mock('@/client/lib/edit-api.js', () => ({
  resolveReconciliationNeedRequest: mockResolveReconciliationNeedRequest,
}));

// Inject a controllable stub for the open-needs hook so the overlay can be
// tested without TanStack Router / QueryClientProvider scaffolding. Default
// returns []; individual tests override via setMockOpenNeeds.
let mockOpenNeeds: ReconciliationNeedRecord[] = [];
function setMockOpenNeeds(needs: ReconciliationNeedRecord[]): void {
  mockOpenNeeds = needs;
}

vi.mock('@/client/routes/specification/$id/-specification-data.js', () => ({
  useSpecificationOpenReconciliationNeeds: () => mockOpenNeeds,
  // Stub the rest so accidental imports don't blow up.
  specificationQueryKeys: {
    bundle: (id: string) => ['specification', id, 'bundle'] as const,
    entities: (id: string) => ['specification', id, 'entities'] as const,
    entitiesProjectWide: (id: string) => ['specification', id, 'entities', 'project-wide'] as const,
    reconciliationNeeds: (id: string) => ['specification', id, 'reconciliation-needs'] as const,
  },
  invalidateOpenReconciliationNeeds: vi.fn(),
}));

function makeNeed(overrides: Partial<ReconciliationNeedRecord> = {}): ReconciliationNeedRecord {
  return {
    id: overrides.id ?? 1,
    specification_id: overrides.specification_id ?? 1,
    source_item_id: overrides.source_item_id ?? 10,
    target_item_id: overrides.target_item_id ?? 20,
    kind: overrides.kind ?? 'needs_confirmation',
    status: overrides.status ?? 'open',
    reason: overrides.reason ?? null,
    caused_by_turn_id: overrides.caused_by_turn_id ?? null,
    caused_by_patch_id: overrides.caused_by_patch_id ?? null,
    created_at: overrides.created_at ?? '2026-05-08T00:00:00Z',
    resolved_at: overrides.resolved_at ?? null,
  };
}

afterEach(() => {
  cleanup();
  setMockOpenNeeds([]);
  mockResolveReconciliationNeedRequest.mockClear();
  mockResolveReconciliationNeedRequest.mockImplementation(() => Promise.resolve({ resolved: true as const }));
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

  it('renders the Pending review section listing open reconciliation needs (V3.0 card 2)', () => {
    setMockOpenNeeds([
      makeNeed({ id: 1, source_item_id: 10, target_item_id: 20, kind: 'needs_confirmation' }),
      makeNeed({ id: 2, source_item_id: 10, target_item_id: 21, kind: 'supersedes' }),
    ]);
    const appliers = makeAppliers();
    render(
      <PatchListProvider appliers={appliers}>
        <PatchListOverlay />
      </PatchListProvider>,
    );
    const section = screen.getByRole('region', { name: /pending review/i });
    expect(section.getAttribute('data-open-needs-count')).toBe('2');
    expect(section.textContent).toContain('2 pending reviews');
    // Each need rendered with its kind chip and source→target reference
    expect(section.querySelector('[data-need-id="1"]')?.textContent).toContain('source #10');
    expect(section.querySelector('[data-need-id="1"]')?.textContent).toContain('target #20');
    expect(section.querySelector('[data-need-id="1"][data-need-kind="needs_confirmation"]')).toBeTruthy();
    expect(section.querySelector('[data-need-id="2"][data-need-kind="supersedes"]')).toBeTruthy();
  });

  it('hides the Pending review section when there are zero open needs', () => {
    setMockOpenNeeds([]);
    const appliers = makeAppliers();
    render(
      <PatchListProvider appliers={appliers}>
        <PatchListOverlay />
      </PatchListProvider>,
    );
    expect(screen.queryByRole('region', { name: /pending review/i })).toBeNull();
  });

  it('renders both staged-changes and Pending review when both exist', () => {
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
    expect(screen.getByRole('region', { name: /pending review/i })).toBeTruthy();
  });

  it('renders a Resolve button per open need (V3.0 card 3)', () => {
    setMockOpenNeeds([
      makeNeed({ id: 1, source_item_id: 10, target_item_id: 20, kind: 'needs_confirmation' }),
      makeNeed({ id: 2, source_item_id: 10, target_item_id: 21, kind: 'supersedes' }),
    ]);
    const appliers = makeAppliers();
    render(
      <PatchListProvider appliers={appliers}>
        <PatchListOverlay />
      </PatchListProvider>,
    );
    const buttons = screen.getAllByRole('button', { name: /resolve/i });
    expect(buttons).toHaveLength(2);
  });

  it('clicking Resolve calls resolveReconciliationNeedRequest with the need id and spec id', async () => {
    setMockOpenNeeds([makeNeed({ id: 7, specification_id: 42 })]);
    const appliers = makeAppliers();
    render(
      <PatchListProvider appliers={appliers}>
        <PatchListOverlay />
      </PatchListProvider>,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^resolve$/i }));
    });
    expect(mockResolveReconciliationNeedRequest).toHaveBeenCalledTimes(1);
    expect(mockResolveReconciliationNeedRequest).toHaveBeenCalledWith(42, 7);
  });

  it('disables the Resolve button while the mutation is pending', async () => {
    let resolveMutation: () => void = () => {};
    mockResolveReconciliationNeedRequest.mockImplementationOnce(
      () =>
        new Promise<{ resolved: true }>((resolve) => {
          resolveMutation = () => resolve({ resolved: true });
        }),
    );
    setMockOpenNeeds([makeNeed({ id: 9, specification_id: 1 })]);
    const appliers = makeAppliers();
    render(
      <PatchListProvider appliers={appliers}>
        <PatchListOverlay />
      </PatchListProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /^resolve$/i }));
    // Mid-flight: button shows "Resolving…" and is disabled
    const button = screen.getByRole('button', { name: /resolving/i });
    expect(button).toHaveProperty('disabled', true);
    // Settle the mutation so the test cleanup doesn't leak.
    await act(async () => {
      resolveMutation();
    });
  });

  it('hides the Pending review section when the last need is resolved (mock-driven)', async () => {
    setMockOpenNeeds([makeNeed({ id: 11 })]);
    const appliers = makeAppliers();
    const { rerender } = render(
      <PatchListProvider appliers={appliers}>
        <PatchListOverlay />
      </PatchListProvider>,
    );
    expect(screen.getByRole('region', { name: /pending review/i })).toBeTruthy();
    // Simulate the queue refresh after resolve: the hook now returns [].
    setMockOpenNeeds([]);
    rerender(
      <PatchListProvider appliers={appliers}>
        <PatchListOverlay />
      </PatchListProvider>,
    );
    expect(screen.queryByRole('region', { name: /pending review/i })).toBeNull();
  });

  it('does not surface any "Hard impact — coming in V3" banner copy', async () => {
    const editApplier = vi.fn(() =>
      Promise.resolve({
        undo: () => Promise.resolve(),
        applied: {
          impact: 'hard',
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

  it('shows the saved-toast after a hard-impact apply (V3.0 card 2 — no deferred banner blocking)', async () => {
    const editApplier = vi.fn(() =>
      Promise.resolve({
        undo: () => Promise.resolve(),
        applied: {
          impact: 'hard',
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
