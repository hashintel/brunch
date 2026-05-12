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
vi.mock('@/client/lib/edit-api.js', () => ({
  resolveReconciliationNeedRequest: mockResolveReconciliationNeedRequest,
}));

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  cleanup();
  setMockOpenNeeds([]);
  mockResolveReconciliationNeedRequest.mockClear();
  mockResolveReconciliationNeedRequest.mockImplementation(() => Promise.resolve({ resolved: true as const }));
  mockInvalidateOpenReconciliationNeeds.mockClear();
  vi.useRealTimers();
});

describe('PendingReviewSection', () => {
  it('renders nothing when there are zero open needs', () => {
    setMockOpenNeeds([]);
    const { container } = render(<PendingReviewSection />);
    expect(container.querySelector('[role="region"]')).toBeNull();
  });

  it('lists open needs with kind chip and source/target references', () => {
    setMockOpenNeeds([
      makeNeed({ id: 1, source_item_id: 10, target_item_id: 20, kind: 'needs_confirmation' }),
      makeNeed({ id: 2, source_item_id: 10, target_item_id: 21, kind: 'supersedes' }),
    ]);
    render(<PendingReviewSection />);
    const region = screen.getByRole('region', { name: /pending review/i });
    expect(region.getAttribute('data-open-needs-count')).toBe('2');
    expect(region.textContent).toContain('2 pending reviews');
    expect(region.querySelector('[data-need-id="1"]')?.textContent).toContain('source #10');
    expect(region.querySelector('[data-need-id="1"]')?.textContent).toContain('target #20');
    expect(region.querySelector('[data-need-id="1"][data-need-kind="needs_confirmation"]')).toBeTruthy();
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
});
