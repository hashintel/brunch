// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ReconciliationNeedRecord } from '@/shared/reconciliation-need.js';

import { PendingReviewSection } from '../pending-review-section.js';
import { makeNeed } from './reconciliation-need-fixtures.js';

// Inject a controllable stub for the open-needs hook so the section can be
// tested without TanStack Router / QueryClientProvider scaffolding. Default
// returns []; individual tests override via setMockOpenNeeds.
let mockOpenNeeds: ReconciliationNeedRecord[] = [];
function setMockOpenNeeds(needs: ReconciliationNeedRecord[]): void {
  mockOpenNeeds = needs;
}

const mockInvalidateOpenReconciliationNeeds = vi.hoisted(() => vi.fn(() => Promise.resolve()));
vi.mock('@/client/routes/specification/$id/-specification-data.js', () => ({
  useSpecificationOpenReconciliationNeeds: () => mockOpenNeeds,
  invalidateOpenReconciliationNeeds: mockInvalidateOpenReconciliationNeeds,
}));

const mockResolveReconciliationNeedRequest = vi.hoisted(() =>
  vi.fn(() => Promise.resolve({ resolved: true as const })),
);
const mockEditKnowledgeItemRequest = vi.hoisted(() =>
  vi.fn(() =>
    Promise.resolve({
      impact: 'soft' as const,
      affectedItems: [],
      updated: true as const,
      previousContent: 'old',
      previousRationale: null,
    }),
  ),
);
vi.mock('@/client/lib/edit-api.js', () => ({
  resolveReconciliationNeedRequest: mockResolveReconciliationNeedRequest,
  editKnowledgeItemRequest: mockEditKnowledgeItemRequest,
}));

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  cleanup();
  setMockOpenNeeds([]);
  mockResolveReconciliationNeedRequest.mockClear();
  mockResolveReconciliationNeedRequest.mockImplementation(() => Promise.resolve({ resolved: true as const }));
  mockEditKnowledgeItemRequest.mockClear();
  mockEditKnowledgeItemRequest.mockImplementation(() =>
    Promise.resolve({
      impact: 'soft' as const,
      affectedItems: [],
      updated: true as const,
      previousContent: 'old',
      previousRationale: null,
    }),
  );
  mockInvalidateOpenReconciliationNeeds.mockClear();
  vi.useRealTimers();
});

describe('PendingReviewSection', () => {
  it('renders nothing when there are zero open needs', () => {
    setMockOpenNeeds([]);
    const { container } = render(<PendingReviewSection />);
    expect(container.querySelector('[role="region"]')).toBeNull();
  });

  it('lists open needs with kind chip and target reference', () => {
    setMockOpenNeeds([
      makeNeed({
        id: 1,
        source_item_id: 10,
        target_item_id: 20,
        kind: 'needs_confirmation',
        target_current_content: null,
      }),
      makeNeed({
        id: 2,
        source_item_id: 10,
        target_item_id: 21,
        kind: 'supersedes',
        target_current_content: null,
      }),
    ]);
    render(<PendingReviewSection />);
    const region = screen.getByRole('region', { name: /pending review/i });
    expect(region.getAttribute('data-open-needs-count')).toBe('2');
    expect(region.textContent).toContain('2 pending reviews');
    // Card 4: row title now leads with the target reference (#ID · excerpt|fallback).
    // The kind chip carries the supersedes/confirm label.
    const row1 = region.querySelector('[data-need-id="1"]');
    expect(row1?.textContent).toContain('#20');
    expect(row1?.querySelector('[data-kind-chip="needs_confirmation"]')).toBeTruthy();
    expect(region.querySelector('[data-need-id="2"][data-need-kind="supersedes"]')).toBeTruthy();
  });

  it('renders a Resolve button per open need', () => {
    setMockOpenNeeds([
      makeNeed({ id: 1, source_item_id: 10, target_item_id: 20, kind: 'needs_confirmation' }),
      makeNeed({ id: 2, source_item_id: 10, target_item_id: 21, kind: 'supersedes' }),
    ]);
    render(<PendingReviewSection />);
    const buttons = screen.getAllByRole('button', { name: /resolve/i });
    expect(buttons).toHaveLength(2);
  });

  it('clicking Resolve calls resolveReconciliationNeedRequest with the need id and spec id', async () => {
    setMockOpenNeeds([makeNeed({ id: 7, specification_id: 42 })]);
    render(<PendingReviewSection />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^resolve$/i }));
    });
    // F5: Resolve fires exactly one POST and one section refresh.
    expect(mockResolveReconciliationNeedRequest).toHaveBeenCalledTimes(1);
    expect(mockResolveReconciliationNeedRequest).toHaveBeenCalledWith(42, 7);
    expect(mockInvalidateOpenReconciliationNeeds).toHaveBeenCalledTimes(1);
    expect(mockInvalidateOpenReconciliationNeeds).toHaveBeenCalledWith(42);
  });

  it('rapid double-click on Resolve does not double-fire the request (F5 oracle)', () => {
    let resolveMutation: () => void = () => {};
    mockResolveReconciliationNeedRequest.mockImplementationOnce(
      () =>
        new Promise<{ resolved: true }>((resolve) => {
          resolveMutation = () => resolve({ resolved: true });
        }),
    );
    setMockOpenNeeds([makeNeed({ id: 9, specification_id: 1 })]);
    render(<PendingReviewSection />);
    // First click starts the mutation; the button re-renders disabled.
    fireEvent.click(screen.getByRole('button', { name: /^resolve$/i }));
    // Subsequent clicks on the now-disabled button are noops in the DOM, but
    // we explicitly assert no extra request fires regardless.
    fireEvent.click(screen.getByRole('button', { name: /resolving/i }));
    fireEvent.click(screen.getByRole('button', { name: /resolving/i }));
    expect(mockResolveReconciliationNeedRequest).toHaveBeenCalledTimes(1);
    // Settle the mutation so test cleanup doesn't leak.
    resolveMutation();
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
    render(<PendingReviewSection />);
    fireEvent.click(screen.getByRole('button', { name: /^resolve$/i }));
    const button = screen.getByRole('button', { name: /resolving/i });
    expect(button).toHaveProperty('disabled', true);
    await act(async () => {
      resolveMutation();
    });
  });

  it('hides the section when the last need is resolved (mock-driven)', () => {
    setMockOpenNeeds([makeNeed({ id: 11 })]);
    const { rerender } = render(<PendingReviewSection />);
    expect(screen.getByRole('region', { name: /pending review/i })).toBeTruthy();
    setMockOpenNeeds([]);
    rerender(<PendingReviewSection />);
    expect(screen.queryByRole('region', { name: /pending review/i })).toBeNull();
  });

  // Card 4 polish: the source diff is no longer rendered inline. Each row
  // exposes a "↗ view source diff" chip that opens a <DiffPopover> anchored
  // to the chip. The chip is gated on both snapshots being present and
  // differing — matching the prior inline-rendering condition.
  describe('source diff popover (card 4 polish)', () => {
    it('renders a "view source diff" chip when both snapshots are present and differ', () => {
      setMockOpenNeeds([
        makeNeed({
          id: 1,
          source_previous_content: 'Reduce signup drop-off',
          source_current_content: 'Cut signup drop-off by 30%',
        }),
      ]);
      render(<PendingReviewSection />);
      const row = screen.getByRole('region').querySelector('[data-need-id="1"]');
      expect(row?.querySelector('[data-view-source-diff-chip]')).toBeTruthy();
      // The inline ContentDiff block has been removed.
      expect(row?.querySelector('[data-content-diff]')).toBeNull();
    });

    it('clicking the chip opens the DiffPopover with removed/added spans', () => {
      setMockOpenNeeds([
        makeNeed({
          id: 1,
          source_previous_content: 'Use SQLite',
          source_current_content: 'Use Postgres',
        }),
      ]);
      render(<PendingReviewSection />);
      expect(document.querySelector('[data-diff-popover]')).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: /view source diff for need 1/i }));
      const popover = document.querySelector('[data-diff-popover]');
      expect(popover).not.toBeNull();
      expect(popover!.querySelector('[data-diff-kind="removed"]')).toBeTruthy();
      expect(popover!.querySelector('[data-diff-kind="added"]')).toBeTruthy();
    });

    it('renders a "from #ID was edited" sub-line alongside the chip', () => {
      setMockOpenNeeds([
        makeNeed({
          id: 1,
          source_item_id: 9,
          source_previous_content: 'Old',
          source_current_content: 'New',
        }),
      ]);
      render(<PendingReviewSection />);
      const row = screen.getByRole('region').querySelector('[data-need-id="1"]');
      expect(row?.textContent).toContain('from #9 was edited');
    });

    it('renders no chip when either snapshot is null (legacy rows)', () => {
      setMockOpenNeeds([
        makeNeed({
          id: 1,
          source_previous_content: null,
          source_current_content: 'New only',
        }),
        makeNeed({
          id: 2,
          source_previous_content: 'Old only',
          source_current_content: null,
        }),
        makeNeed({
          id: 3,
          source_previous_content: null,
          source_current_content: null,
        }),
      ]);
      render(<PendingReviewSection />);
      const region = screen.getByRole('region');
      expect(region.querySelectorAll('[data-view-source-diff-chip]')).toHaveLength(0);
      // Rows still render, Resolve button still works.
      expect(screen.getAllByRole('button', { name: /^resolve$/i })).toHaveLength(3);
    });

    it('renders no chip when before === after (no actual change)', () => {
      setMockOpenNeeds([
        makeNeed({
          id: 1,
          source_previous_content: 'Same content',
          source_current_content: 'Same content',
        }),
      ]);
      render(<PendingReviewSection />);
      const row = screen.getByRole('region').querySelector('[data-need-id="1"]');
      expect(row?.querySelector('[data-view-source-diff-chip]')).toBeNull();
    });
  });

  // Card 3 (V3.1 setup): Edit-target inline form per row. Saving runs the
  // standard edit pipeline (editKnowledgeItemRequest) then resolves the
  // need (resolveReconciliationNeedRequest) and refetches. The target's
  // current content is read from the row's target_current_content field
  // (live-joined by the listing endpoint).
  describe('Edit-target inline form (card 3)', () => {
    it('renders an Edit target button per row when target_current_content is present', () => {
      setMockOpenNeeds([
        makeNeed({ id: 1, target_current_content: 'A' }),
        makeNeed({ id: 2, target_current_content: 'B' }),
      ]);
      render(<PendingReviewSection />);
      expect(screen.getAllByRole('button', { name: /edit target for need/i })).toHaveLength(2);
    });

    it('expands an inline textarea pre-filled with target_current_content', () => {
      setMockOpenNeeds([
        makeNeed({
          id: 1,
          target_current_content: 'Validate email format on form submit',
        }),
      ]);
      render(<PendingReviewSection />);
      // No textarea visible until Edit target is clicked.
      expect(screen.queryByRole('textbox')).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: /edit target for need 1/i }));
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.value).toBe('Validate email format on form submit');
    });

    it('Cancel collapses the form without calling any request', () => {
      setMockOpenNeeds([makeNeed({ id: 1, target_current_content: 'Old target' })]);
      render(<PendingReviewSection />);
      fireEvent.click(screen.getByRole('button', { name: /edit target for need 1/i }));
      expect(screen.getByRole('textbox')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
      expect(screen.queryByRole('textbox')).toBeNull();
      expect(mockEditKnowledgeItemRequest).not.toHaveBeenCalled();
      expect(mockResolveReconciliationNeedRequest).not.toHaveBeenCalled();
    });

    it('Save calls editKnowledgeItemRequest then resolveReconciliationNeedRequest then invalidates', async () => {
      setMockOpenNeeds([
        makeNeed({
          id: 7,
          specification_id: 42,
          target_item_id: 99,
          target_current_content: 'Old target content',
        }),
      ]);
      render(<PendingReviewSection />);
      fireEvent.click(screen.getByRole('button', { name: /edit target for need 7/i }));
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: 'New target content' } });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
      });
      expect(mockEditKnowledgeItemRequest).toHaveBeenCalledTimes(1);
      expect(mockEditKnowledgeItemRequest).toHaveBeenCalledWith(42, 99, {
        content: 'New target content',
      });
      expect(mockResolveReconciliationNeedRequest).toHaveBeenCalledTimes(1);
      expect(mockResolveReconciliationNeedRequest).toHaveBeenCalledWith(42, 7);
      expect(mockInvalidateOpenReconciliationNeeds).toHaveBeenCalledWith(42);
    });

    it('disables Save and Resolve while the edit is in flight', async () => {
      let resolveEdit: () => void = () => {};
      mockEditKnowledgeItemRequest.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveEdit = () =>
              resolve({
                impact: 'soft' as const,
                affectedItems: [],
                updated: true as const,
                previousContent: 'old',
                previousRationale: null,
              });
          }),
      );
      setMockOpenNeeds([makeNeed({ id: 1, target_current_content: 'Old' })]);
      render(<PendingReviewSection />);
      fireEvent.click(screen.getByRole('button', { name: /edit target for need 1/i }));
      fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
      // Save morphs to a saving label and disables; Resolve also disables.
      expect(screen.getByRole('button', { name: /saving/i })).toHaveProperty('disabled', true);
      expect(screen.getByRole('button', { name: /^resolve$/i })).toHaveProperty('disabled', true);
      await act(async () => {
        resolveEdit();
      });
    });

    it('Edit target button does not appear when target_current_content is null', () => {
      setMockOpenNeeds([makeNeed({ id: 1, target_current_content: null })]);
      render(<PendingReviewSection />);
      // Without target content, there is nothing to pre-fill, so the affordance
      // is hidden — the user can still resolve via the existing Resolve button.
      expect(screen.queryByRole('button', { name: /edit target for need 1/i })).toBeNull();
      expect(screen.getByRole('button', { name: /^resolve$/i })).toBeTruthy();
    });

    it('Save button shows a Loader2 spinner during in-flight save (Card 4)', async () => {
      let resolveEdit: () => void = () => {};
      mockEditKnowledgeItemRequest.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveEdit = () =>
              resolve({
                impact: 'soft' as const,
                affectedItems: [],
                updated: true as const,
                previousContent: 'old',
                previousRationale: null,
              });
          }),
      );
      setMockOpenNeeds([makeNeed({ id: 1, target_current_content: 'Old' })]);
      const { container } = render(<PendingReviewSection />);
      fireEvent.click(screen.getByRole('button', { name: /edit target for need 1/i }));
      fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
      expect(container.querySelector('.lucide-loader-circle')).not.toBeNull();
      await act(async () => {
        resolveEdit();
      });
    });
  });
});
