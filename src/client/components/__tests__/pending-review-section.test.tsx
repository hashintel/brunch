// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
const mockRefetchOpenReconciliationNeedsData = vi.hoisted(() =>
  vi.fn(async (): Promise<ReconciliationNeedRecord[]> => {
    await mockInvalidateOpenReconciliationNeeds();
    return mockOpenNeeds;
  }),
);
vi.mock('@/client/routes/specification/$id/-specification-data.js', () => ({
  useSpecificationOpenReconciliationNeeds: () => mockOpenNeeds,
  invalidateOpenReconciliationNeeds: mockInvalidateOpenReconciliationNeeds,
  refetchOpenReconciliationNeedsData: mockRefetchOpenReconciliationNeedsData,
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
const mockRunReconciliationAgentRequest = vi.hoisted(() =>
  vi.fn(() =>
    Promise.resolve({ specId: 1, ranAt: '2026-05-11T00:00:00Z', classifiedCount: 0, failedCount: 0 }),
  ),
);
const mockResetReconciliationNeedAgentRequest = vi.hoisted(() =>
  vi.fn(() =>
    Promise.resolve({
      specId: 1,
      needId: 1,
      ranAt: '2026-05-11T00:00:00Z',
      agentStatus: 'classified' as const,
      agentClassification: 'auto-confirm' as const,
      agentProposal: null,
    }),
  ),
);
vi.mock('@/client/lib/edit-api.js', () => ({
  resolveReconciliationNeedRequest: mockResolveReconciliationNeedRequest,
  editKnowledgeItemRequest: mockEditKnowledgeItemRequest,
  runReconciliationAgentRequest: mockRunReconciliationAgentRequest,
  resetReconciliationNeedAgentRequest: mockResetReconciliationNeedAgentRequest,
}));

const mockSecondaryChatCreate = vi.hoisted(() => vi.fn());
interface SecondaryChatTriggerStub {
  canCreate: boolean;
  isPending: boolean;
  create: typeof mockSecondaryChatCreate;
}
let secondaryChatTriggerValue: SecondaryChatTriggerStub | null = {
  canCreate: true,
  isPending: false,
  create: mockSecondaryChatCreate,
};
function setSecondaryChatTrigger(value: SecondaryChatTriggerStub | null): void {
  secondaryChatTriggerValue = value;
}
vi.mock('../secondary-chat-trigger.js', () => ({
  useSecondaryChatTrigger: () => secondaryChatTriggerValue,
}));

const mockNavigate = vi.hoisted(() => vi.fn(() => Promise.resolve()));
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
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
  mockRefetchOpenReconciliationNeedsData.mockClear();
  mockRefetchOpenReconciliationNeedsData.mockImplementation(async () => {
    await mockInvalidateOpenReconciliationNeeds();
    return mockOpenNeeds;
  });
  mockRunReconciliationAgentRequest.mockClear();
  mockRunReconciliationAgentRequest.mockImplementation(() =>
    Promise.resolve({ specId: 1, ranAt: '2026-05-11T00:00:00Z', classifiedCount: 0, failedCount: 0 }),
  );
  mockResetReconciliationNeedAgentRequest.mockClear();
  mockResetReconciliationNeedAgentRequest.mockImplementation(() =>
    Promise.resolve({
      specId: 1,
      needId: 1,
      ranAt: '2026-05-11T00:00:00Z',
      agentStatus: 'classified' as const,
      agentClassification: 'auto-confirm' as const,
      agentProposal: null,
    }),
  );
  mockSecondaryChatCreate.mockClear();
  mockSecondaryChatCreate.mockImplementation(() => Promise.resolve(null));
  setSecondaryChatTrigger({ canCreate: true, isPending: false, create: mockSecondaryChatCreate });
  mockNavigate.mockClear();
  mockNavigate.mockImplementation(() => Promise.resolve());
  vi.useRealTimers();
});

function renderPendingReview() {
  const result = render(<PendingReviewSection />);
  const toggle = result.queryByTestId('pending-review-minimize-toggle');
  if (toggle) {
    fireEvent.click(toggle);
  }
  return result;
}

describe('PendingReviewSection', () => {
  it('renders nothing when there are zero open needs', () => {
    setMockOpenNeeds([]);
    const { container } = render(<PendingReviewSection />);
    expect(container.querySelector('[role="region"]')).toBeNull();
  });

  it('defaults to minimized so opening a tab does not expand the per-row list', () => {
    setMockOpenNeeds([
      makeNeed({
        id: 1,
        source_item_id: 10,
        target_item_id: 20,
        target_item_kind: 'requirement',
        target_current_content: 'Initial requirement',
      }),
    ]);
    render(<PendingReviewSection />);
    const toggle = screen.getByTestId('pending-review-minimize-toggle');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByTestId('pending-review-pulse')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^resolve$/i })).toBeNull();
  });

  it('hides the pulse once the user expands the section', () => {
    setMockOpenNeeds([
      makeNeed({
        id: 1,
        source_item_id: 10,
        target_item_id: 20,
        target_item_kind: 'requirement',
        target_current_content: 'Initial requirement',
      }),
    ]);
    render(<PendingReviewSection />);
    fireEvent.click(screen.getByTestId('pending-review-minimize-toggle'));
    expect(screen.queryByTestId('pending-review-pulse')).toBeNull();
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
    renderPendingReview();
    const region = screen.getByRole('region', { name: /pending review/i });
    expect(region.getAttribute('data-open-needs-count')).toBe('2');
    expect(region.textContent).toContain('2 pending reviews');
    const row1 = region.querySelector('[data-need-id="1"]');
    expect(row1?.textContent).toContain('#20');
    expect(row1?.querySelector('[data-kind-chip="needs_confirmation"]')).toBeTruthy();
    expect(region.querySelector('[data-need-id="2"][data-need-kind="supersedes"]')).toBeTruthy();
  });

  it('clicking the row meta navigates the workspace via hash to the target reference code', () => {
    setMockOpenNeeds([
      makeNeed({
        id: 7,
        specification_id: 42,
        target_item_id: 20,
        target_reference_code: 'G3',
      }),
    ]);
    renderPendingReview();
    const targetButton = screen.getByTestId('pending-review-row-target-7');
    expect(targetButton.getAttribute('data-target-reference-code')).toBe('G3');
    fireEvent.click(targetButton);
    expect(mockNavigate).toHaveBeenCalledWith({ to: '.', hash: 'G3' });
  });

  it('disables row-meta navigation when the target has no reference code', () => {
    setMockOpenNeeds([
      makeNeed({
        id: 8,
        target_item_id: 20,
        target_reference_code: null,
      }),
    ]);
    mockNavigate.mockClear();
    renderPendingReview();
    const targetButton = screen.getByTestId('pending-review-row-target-8');
    expect(targetButton).toHaveProperty('disabled', true);
    fireEvent.click(targetButton);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('renders a Resolve button per open need', () => {
    setMockOpenNeeds([
      makeNeed({ id: 1, source_item_id: 10, target_item_id: 20, kind: 'needs_confirmation' }),
      makeNeed({ id: 2, source_item_id: 10, target_item_id: 21, kind: 'supersedes' }),
    ]);
    renderPendingReview();
    const buttons = screen.getAllByRole('button', { name: /resolve/i });
    expect(buttons).toHaveLength(2);
  });

  it('clicking Resolve calls resolveReconciliationNeedRequest with the need id and spec id', async () => {
    setMockOpenNeeds([makeNeed({ id: 7, specification_id: 42 })]);
    renderPendingReview();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^resolve$/i }));
    });
    expect(mockResolveReconciliationNeedRequest).toHaveBeenCalledTimes(1);
    expect(mockResolveReconciliationNeedRequest).toHaveBeenCalledWith(42, 7);
    expect(mockInvalidateOpenReconciliationNeeds).toHaveBeenCalledTimes(1);
    expect(mockInvalidateOpenReconciliationNeeds).toHaveBeenCalledWith(42);
  });

  it('rapid double-click on Resolve does not double-fire the request', () => {
    let resolveMutation: () => void = () => {};
    mockResolveReconciliationNeedRequest.mockImplementationOnce(
      () =>
        new Promise<{ resolved: true }>((resolve) => {
          resolveMutation = () => resolve({ resolved: true });
        }),
    );
    setMockOpenNeeds([makeNeed({ id: 9, specification_id: 1 })]);
    renderPendingReview();
    fireEvent.click(screen.getByRole('button', { name: /^resolve$/i }));
    fireEvent.click(screen.getByRole('button', { name: /resolving/i }));
    fireEvent.click(screen.getByRole('button', { name: /resolving/i }));
    expect(mockResolveReconciliationNeedRequest).toHaveBeenCalledTimes(1);
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
    renderPendingReview();
    fireEvent.click(screen.getByRole('button', { name: /^resolve$/i }));
    const button = screen.getByRole('button', { name: /resolving/i });
    expect(button).toHaveProperty('disabled', true);
    await act(async () => {
      resolveMutation();
    });
  });

  it('hides the section when the last need is resolved (mock-driven)', () => {
    setMockOpenNeeds([makeNeed({ id: 11 })]);
    const { rerender } = renderPendingReview();
    expect(screen.getByRole('region', { name: /pending review/i })).toBeTruthy();
    setMockOpenNeeds([]);
    rerender(<PendingReviewSection />);
    expect(screen.queryByRole('region', { name: /pending review/i })).toBeNull();
  });

  describe('source diff popover', () => {
    it('renders a "view source diff" chip when both snapshots are present and differ', () => {
      setMockOpenNeeds([
        makeNeed({
          id: 1,
          source_previous_content: 'Reduce signup drop-off',
          source_current_content: 'Cut signup drop-off by 30%',
        }),
      ]);
      renderPendingReview();
      const row = screen.getByRole('region').querySelector('[data-need-id="1"]');
      expect(row?.querySelector('[data-view-source-diff-chip]')).toBeTruthy();
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
      renderPendingReview();
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
      renderPendingReview();
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
      renderPendingReview();
      const region = screen.getByRole('region');
      expect(region.querySelectorAll('[data-view-source-diff-chip]')).toHaveLength(0);
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
      renderPendingReview();
      const row = screen.getByRole('region').querySelector('[data-need-id="1"]');
      expect(row?.querySelector('[data-view-source-diff-chip]')).toBeNull();
    });
  });

  describe('Edit-target inline form', () => {
    it('renders an Edit target button per row when target_current_content is present', () => {
      setMockOpenNeeds([
        makeNeed({ id: 1, target_current_content: 'A' }),
        makeNeed({ id: 2, target_current_content: 'B' }),
      ]);
      renderPendingReview();
      expect(screen.getAllByRole('button', { name: /edit target for need/i })).toHaveLength(2);
    });

    it('expands an inline textarea pre-filled with target_current_content', () => {
      setMockOpenNeeds([
        makeNeed({
          id: 1,
          target_current_content: 'Validate email format on form submit',
        }),
      ]);
      renderPendingReview();
      expect(screen.queryByRole('textbox')).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: /edit target for need 1/i }));
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.value).toBe('Validate email format on form submit');
    });

    it('Cancel collapses the form without calling any request', () => {
      setMockOpenNeeds([makeNeed({ id: 1, target_current_content: 'Old target' })]);
      renderPendingReview();
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
      renderPendingReview();
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
      renderPendingReview();
      fireEvent.click(screen.getByRole('button', { name: /edit target for need 1/i }));
      fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
      expect(screen.getByRole('button', { name: /saving/i })).toHaveProperty('disabled', true);
      expect(screen.getByRole('button', { name: /^resolve$/i })).toHaveProperty('disabled', true);
      await act(async () => {
        resolveEdit();
      });
    });

    it('Edit target button does not appear when target_current_content is null', () => {
      setMockOpenNeeds([makeNeed({ id: 1, target_current_content: null })]);
      renderPendingReview();
      expect(screen.queryByRole('button', { name: /edit target for need 1/i })).toBeNull();
      expect(screen.getByRole('button', { name: /^resolve$/i })).toBeTruthy();
    });

    it('Save button shows a Loader2 spinner during in-flight save', async () => {
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
      const { container } = renderPendingReview();
      fireEvent.click(screen.getByRole('button', { name: /edit target for need 1/i }));
      fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
      expect(container.querySelector('.lucide-loader-circle')).not.toBeNull();
      await act(async () => {
        resolveEdit();
      });
    });
  });

  describe('agent client UI', () => {
    it('renders the Run agent button when at least one open need has agent_status=null', () => {
      setMockOpenNeeds([makeNeed({ id: 1, agent_status: null })]);
      const { container } = renderPendingReview();
      expect(container.querySelector('[data-run-agent-button]')).not.toBeNull();
    });

    it('hides the Run agent button when every open need is already classified', () => {
      setMockOpenNeeds([
        makeNeed({ id: 1, agent_status: 'classified', agent_classification: 'auto-confirm' }),
        makeNeed({ id: 2, agent_status: 'classified', agent_classification: 'substantive' }),
      ]);
      const { container } = renderPendingReview();
      expect(container.querySelector('[data-run-agent-button]')).toBeNull();
    });

    it('triggers POST .../run-agent exactly once on Run agent click', async () => {
      setMockOpenNeeds([makeNeed({ id: 1, specification_id: 7, agent_status: null })]);
      renderPendingReview();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /reconcile pending reviews/i }));
      });
      expect(mockRunReconciliationAgentRequest).toHaveBeenCalledTimes(1);
      expect(mockRunReconciliationAgentRequest).toHaveBeenCalledWith(7);
      expect(mockInvalidateOpenReconciliationNeeds).toHaveBeenCalledWith(7);
    });

    it('disables the Run agent button while any need is queued or classifying', () => {
      setMockOpenNeeds([
        makeNeed({ id: 1, agent_status: 'queued' }),
        makeNeed({ id: 2, agent_status: null }),
      ]);
      renderPendingReview();
      const button = screen.getByRole('button', { name: /reconcile pending reviews/i });
      expect(button).toHaveProperty('disabled', true);
    });

    it('renders the progress strip while any need is in flight', () => {
      setMockOpenNeeds([
        makeNeed({ id: 1, agent_status: 'classifying' }),
        makeNeed({ id: 2, agent_status: 'classified', agent_classification: 'auto-confirm' }),
        makeNeed({ id: 3, agent_status: null }),
      ]);
      const { container } = renderPendingReview();
      const strip = container.querySelector('[data-agent-progress-strip]');
      expect(strip).not.toBeNull();
      expect(strip?.textContent).toContain('Agent: 1 of 3 classified');
    });

    it('progress strip separates failed rows from the classified count', () => {
      setMockOpenNeeds([
        makeNeed({ id: 1, agent_status: 'classifying' }),
        makeNeed({ id: 2, agent_status: 'classified', agent_classification: 'auto-confirm' }),
        makeNeed({ id: 3, agent_status: 'classified', agent_classification: 'auto-confirm' }),
        makeNeed({ id: 4, agent_status: 'failed', agent_proposal: 'LLM down' }),
      ]);
      const { container } = renderPendingReview();
      const strip = container.querySelector('[data-agent-progress-strip]');
      expect(strip?.textContent).toContain('2 classified');
      expect(strip?.textContent).toContain('1 failed');
      expect(strip?.textContent).toContain('(3/4)');
      expect(strip?.textContent).not.toContain('3 of 4 classified');
    });

    it('hides the progress strip when nothing is in flight', () => {
      setMockOpenNeeds([
        makeNeed({ id: 1, agent_status: 'classified', agent_classification: 'auto-confirm' }),
      ]);
      const { container } = renderPendingReview();
      expect(container.querySelector('[data-agent-progress-strip]')).toBeNull();
    });

    it('renders a ClassificationChip per row matching agent_status / agent_classification', () => {
      setMockOpenNeeds([
        makeNeed({ id: 1, agent_status: 'classified', agent_classification: 'auto-confirm' }),
        makeNeed({ id: 2, agent_status: 'classified', agent_classification: 'auto-edit' }),
        makeNeed({ id: 3, agent_status: 'classified', agent_classification: 'substantive' }),
        makeNeed({ id: 4, agent_status: 'classifying' }),
        makeNeed({ id: 5, agent_status: 'queued' }),
        makeNeed({ id: 6, agent_status: 'failed', agent_proposal: 'LLM down' }),
        makeNeed({ id: 7, agent_status: null }),
      ]);
      const { container } = renderPendingReview();
      expect(
        container.querySelector('[data-need-id="1"] [data-classification-chip="auto-confirm"]'),
      ).not.toBeNull();
      expect(
        container.querySelector('[data-need-id="2"] [data-classification-chip="auto-edit"]'),
      ).not.toBeNull();
      expect(
        container.querySelector('[data-need-id="3"] [data-classification-chip="substantive"]'),
      ).not.toBeNull();
      expect(
        container.querySelector('[data-need-id="4"] [data-classification-chip="classifying"]'),
      ).not.toBeNull();
      expect(
        container.querySelector('[data-need-id="5"] [data-classification-chip="queued"]'),
      ).not.toBeNull();
      expect(
        container.querySelector('[data-need-id="6"] [data-classification-chip="failed"]'),
      ).not.toBeNull();
      expect(container.querySelector('[data-need-id="7"] [data-classification-chip]')).toBeNull();
    });

    it('shows the per-row Re-run button only on classified or failed rows', () => {
      setMockOpenNeeds([
        makeNeed({ id: 1, agent_status: null }),
        makeNeed({ id: 2, agent_status: 'queued' }),
        makeNeed({ id: 3, agent_status: 'classifying' }),
        makeNeed({ id: 4, agent_status: 'classified', agent_classification: 'auto-confirm' }),
        makeNeed({ id: 5, agent_status: 'failed', agent_proposal: 'err' }),
      ]);
      const { container } = renderPendingReview();
      expect(container.querySelector('[data-rerun-agent-button="1"]')).toBeNull();
      expect(container.querySelector('[data-rerun-agent-button="2"]')).toBeNull();
      expect(container.querySelector('[data-rerun-agent-button="3"]')).toBeNull();
      expect(container.querySelector('[data-rerun-agent-button="4"]')).not.toBeNull();
      expect(container.querySelector('[data-rerun-agent-button="5"]')).not.toBeNull();
    });

    it('triggers POST .../:needId/reset-agent on Re-run click and invalidates the query', async () => {
      setMockOpenNeeds([
        makeNeed({
          id: 42,
          specification_id: 7,
          agent_status: 'classified',
          agent_classification: 'substantive',
        }),
      ]);
      renderPendingReview();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /reconcile pending review 42/i }));
      });
      expect(mockResetReconciliationNeedAgentRequest).toHaveBeenCalledTimes(1);
      expect(mockResetReconciliationNeedAgentRequest).toHaveBeenCalledWith(7, 42);
      expect(mockInvalidateOpenReconciliationNeeds).toHaveBeenCalledWith(7);
    });

    it('disables Resolve while Re-run is in flight on the same row', async () => {
      setMockOpenNeeds([
        makeNeed({
          id: 1,
          agent_status: 'classified',
          agent_classification: 'auto-confirm',
        }),
      ]);
      let resolveReset: () => void;
      mockResetReconciliationNeedAgentRequest.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveReset = () => {
              resolve({
                specId: 1,
                needId: 1,
                ranAt: '2026-05-11T00:00:00Z',
                agentStatus: 'classified' as const,
                agentClassification: 'auto-confirm' as const,
                agentProposal: null,
              });
            };
          }),
      );
      renderPendingReview();
      fireEvent.click(screen.getByRole('button', { name: /reconcile pending review 1/i }));
      const resolveButton = screen.getByRole('button', { name: /^resolve$/i });
      expect(resolveButton).toHaveProperty('disabled', true);
      await act(async () => {
        resolveReset();
      });
    });
  });

  describe('per-class actions + bulk', () => {
    it('auto-confirm row renders Confirm button that calls resolve once', async () => {
      setMockOpenNeeds([
        makeNeed({
          id: 1,
          specification_id: 7,
          agent_status: 'classified',
          agent_classification: 'auto-confirm',
          target_current_content: 'target',
        }),
      ]);
      renderPendingReview();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /confirm need 1/i }));
      });
      expect(mockResolveReconciliationNeedRequest).toHaveBeenCalledTimes(1);
      expect(mockResolveReconciliationNeedRequest).toHaveBeenCalledWith(7, 1);
    });

    it('auto-edit row renders Apply / Skip / View buttons; Apply calls edit then resolve', async () => {
      setMockOpenNeeds([
        makeNeed({
          id: 1,
          specification_id: 7,
          target_item_id: 33,
          agent_status: 'classified',
          agent_classification: 'auto-edit',
          agent_proposal: 'new content',
          target_current_content: 'old content',
        }),
      ]);
      const { container } = renderPendingReview();
      expect(container.querySelector('[data-view-proposal-button="1"]')).not.toBeNull();
      expect(container.querySelector('[data-apply-button="1"]')).not.toBeNull();
      expect(container.querySelector('[data-skip-button="1"]')).not.toBeNull();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /apply proposal for need 1/i }));
      });
      expect(mockEditKnowledgeItemRequest).toHaveBeenCalledTimes(1);
      expect(mockEditKnowledgeItemRequest).toHaveBeenCalledWith(7, 33, { content: 'new content' });
      expect(mockResolveReconciliationNeedRequest).toHaveBeenCalledTimes(1);
      expect(mockResolveReconciliationNeedRequest).toHaveBeenCalledWith(7, 1);
    });

    it('auto-edit View opens the proposed edit popover', () => {
      setMockOpenNeeds([
        makeNeed({
          id: 1,
          target_item_id: 33,
          agent_status: 'classified',
          agent_classification: 'auto-edit',
          agent_proposal: 'new content',
          target_current_content: 'old content',
        }),
      ]);
      renderPendingReview();
      fireEvent.click(screen.getByRole('button', { name: /view proposal for need 1/i }));
      const popover = document.querySelector('[data-diff-popover]');
      expect(popover).not.toBeNull();
      expect(popover?.textContent).toContain('Proposed edit · #33');
      expect(popover!.querySelector('[data-diff-kind="removed"]')).toBeTruthy();
      expect(popover!.querySelector('[data-diff-kind="added"]')).toBeTruthy();
    });

    it('auto-edit Skip calls resolve only (no edit)', async () => {
      setMockOpenNeeds([
        makeNeed({
          id: 1,
          specification_id: 7,
          agent_status: 'classified',
          agent_classification: 'auto-edit',
          agent_proposal: 'new content',
          target_current_content: 'old content',
        }),
      ]);
      renderPendingReview();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /skip proposal for need 1/i }));
      });
      expect(mockEditKnowledgeItemRequest).not.toHaveBeenCalled();
      expect(mockResolveReconciliationNeedRequest).toHaveBeenCalledTimes(1);
    });

    it('auto-edit row with null target content shows Skip only (no View / Apply)', () => {
      setMockOpenNeeds([
        makeNeed({
          id: 1,
          agent_status: 'classified',
          agent_classification: 'auto-edit',
          agent_proposal: 'orphan proposal',
          target_current_content: null,
        }),
      ]);
      const { container } = renderPendingReview();
      expect(container.querySelector('[data-view-proposal-button="1"]')).toBeNull();
      expect(container.querySelector('[data-apply-button="1"]')).toBeNull();
      expect(container.querySelector('[data-skip-button="1"]')).not.toBeNull();
    });

    it('substantive row renders Open side-chat button that invokes the secondary-chat trigger', async () => {
      setMockOpenNeeds([
        makeNeed({
          id: 1,
          specification_id: 7,
          target_item_id: 99,
          agent_status: 'classified',
          agent_classification: 'substantive',
          target_item_kind: 'requirement',
          target_reference_code: 'R3',
          target_current_content: 'substantive content',
        }),
      ]);
      renderPendingReview();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /open side-chat for need 1/i }));
      });
      expect(mockSecondaryChatCreate).toHaveBeenCalledTimes(1);
      expect(mockSecondaryChatCreate).toHaveBeenCalledWith({
        kind: 'requirement',
        id: 99,
        reconciliationNeedId: 1,
      });
    });

    it('substantive row hides Open side-chat when the secondary-chat trigger is unavailable', () => {
      setSecondaryChatTrigger(null);
      setMockOpenNeeds([
        makeNeed({
          id: 1,
          agent_status: 'classified',
          agent_classification: 'substantive',
          target_item_kind: 'requirement',
          target_reference_code: 'R3',
          target_current_content: 'substantive',
        }),
      ]);
      const { container } = renderPendingReview();
      expect(container.querySelector('[data-open-side-chat-button]')).toBeNull();
    });

    it('substantive row hides Open side-chat when the trigger reports it cannot create yet', () => {
      setSecondaryChatTrigger({ canCreate: false, isPending: false, create: mockSecondaryChatCreate });
      setMockOpenNeeds([
        makeNeed({
          id: 1,
          agent_status: 'classified',
          agent_classification: 'substantive',
          target_item_kind: 'requirement',
          target_reference_code: 'R3',
          target_current_content: 'substantive',
        }),
      ]);
      const { container } = renderPendingReview();
      expect(container.querySelector('[data-open-side-chat-button]')).toBeNull();
    });

    it('header exposes "Confirm all (N)" only when auto-confirm rows exist', () => {
      setMockOpenNeeds([
        makeNeed({ id: 1, agent_status: 'classified', agent_classification: 'auto-confirm' }),
        makeNeed({ id: 2, agent_status: 'classified', agent_classification: 'auto-confirm' }),
        makeNeed({ id: 3, agent_status: 'classified', agent_classification: 'substantive' }),
      ]);
      const { container } = renderPendingReview();
      const button = container.querySelector('[data-bulk-confirm-button]');
      expect(button).not.toBeNull();
      expect(button?.textContent).toContain('Confirm all (2)');
    });

    it('Confirm all serially resolves every auto-confirm row', async () => {
      const need1 = makeNeed({
        id: 1,
        specification_id: 7,
        agent_status: 'classified',
        agent_classification: 'auto-confirm',
      });
      const need2 = makeNeed({
        id: 2,
        specification_id: 7,
        agent_status: 'classified',
        agent_classification: 'auto-confirm',
      });
      const need3 = makeNeed({
        id: 3,
        specification_id: 7,
        agent_status: 'classified',
        agent_classification: 'substantive',
      });
      setMockOpenNeeds([need1, need2, need3]);
      let refetchWave = 0;
      mockRefetchOpenReconciliationNeedsData.mockImplementation(async () => {
        await mockInvalidateOpenReconciliationNeeds();
        refetchWave += 1;
        if (refetchWave === 1) return [need1, need2, need3];
        if (refetchWave === 2) return [need2, need3];
        return [need3];
      });
      renderPendingReview();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /confirm all 2 auto-confirm rows/i }));
      });
      expect(mockResolveReconciliationNeedRequest).toHaveBeenCalledTimes(2);
      expect(mockResolveReconciliationNeedRequest).toHaveBeenCalledWith(7, 1);
      expect(mockResolveReconciliationNeedRequest).toHaveBeenCalledWith(7, 2);
    });

    it('spins only the Confirm all bulk button while confirm is in flight (Apply all keeps its icon)', async () => {
      let releaseFirst: (() => void) | undefined;
      const firstHang = new Promise<{ resolved: true }>((resolve) => {
        releaseFirst = () => resolve({ resolved: true as const });
      });
      let callCount = 0;
      mockResolveReconciliationNeedRequest.mockImplementation(() => {
        callCount += 1;
        if (callCount === 1) return firstHang;
        return Promise.resolve({ resolved: true as const });
      });

      setMockOpenNeeds([
        makeNeed({
          id: 1,
          specification_id: 7,
          agent_status: 'classified',
          agent_classification: 'auto-confirm',
        }),
        makeNeed({
          id: 2,
          specification_id: 7,
          agent_status: 'classified',
          agent_classification: 'auto-confirm',
        }),
        makeNeed({
          id: 3,
          specification_id: 7,
          target_item_id: 50,
          agent_status: 'classified',
          agent_classification: 'auto-edit',
          agent_proposal: 'p',
          target_current_content: 'c',
        }),
      ]);
      const { container } = renderPendingReview();
      fireEvent.click(screen.getByRole('button', { name: /confirm all 2 auto-confirm rows/i }));

      await waitFor(() => {
        const confirmBtn = container.querySelector('[data-bulk-confirm-button]');
        const applyBtn = container.querySelector('[data-bulk-apply-button]');
        expect(confirmBtn?.querySelector('.lucide-loader-circle')).not.toBeNull();
        expect(applyBtn?.querySelector('.lucide-wand-sparkles')).not.toBeNull();
        expect(applyBtn?.querySelector('.lucide-loader-circle')).toBeNull();
      });

      releaseFirst?.();
      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
      });
    });

    it('disables per-row actions while bulk confirm awaits the first resolve', async () => {
      let releaseFirst: (() => void) | undefined;
      const firstHang = new Promise<{ resolved: true }>((resolve) => {
        releaseFirst = () => resolve({ resolved: true as const });
      });
      let callCount = 0;
      mockResolveReconciliationNeedRequest.mockImplementation(() => {
        callCount += 1;
        if (callCount === 1) return firstHang;
        return Promise.resolve({ resolved: true as const });
      });

      setMockOpenNeeds([
        makeNeed({
          id: 1,
          specification_id: 7,
          agent_status: 'classified',
          agent_classification: 'auto-confirm',
        }),
        makeNeed({
          id: 2,
          specification_id: 7,
          agent_status: 'classified',
          agent_classification: 'auto-confirm',
        }),
      ]);
      renderPendingReview();
      fireEvent.click(screen.getByRole('button', { name: /confirm all 2 auto-confirm rows/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /confirm need 1/i })).toHaveProperty('disabled', true);
        expect(screen.getByRole('button', { name: /confirm need 2/i })).toHaveProperty('disabled', true);
      });

      releaseFirst?.();
      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
      });
    });

    it('header exposes "Apply all suggested (N)" only when auto-edit rows with non-null proposals exist', () => {
      setMockOpenNeeds([
        makeNeed({
          id: 1,
          agent_status: 'classified',
          agent_classification: 'auto-edit',
          agent_proposal: 'p1',
          target_current_content: 'current',
        }),
        makeNeed({
          id: 2,
          agent_status: 'classified',
          agent_classification: 'auto-edit',
          agent_proposal: null,
        }),
      ]);
      const { container } = renderPendingReview();
      const button = container.querySelector('[data-bulk-apply-button]');
      expect(button).not.toBeNull();
      expect(button?.textContent).toContain('Apply all suggested (1)');
    });

    it('Confirm all skips a need whose resolve fails and continues with the next eligible row', async () => {
      const failing = makeNeed({
        id: 1,
        specification_id: 7,
        agent_status: 'classified',
        agent_classification: 'auto-confirm',
      });
      const healthy = makeNeed({
        id: 2,
        specification_id: 7,
        agent_status: 'classified',
        agent_classification: 'auto-confirm',
      });
      setMockOpenNeeds([failing, healthy]);
      let refetchCalls = 0;
      mockRefetchOpenReconciliationNeedsData.mockImplementation(async () => {
        await mockInvalidateOpenReconciliationNeeds();
        refetchCalls += 1;
        if (refetchCalls <= 2) return [failing, healthy];
        return [failing];
      });
      let resolveCalls = 0;
      mockResolveReconciliationNeedRequest.mockImplementation(() => {
        resolveCalls += 1;
        if (resolveCalls === 1) return Promise.reject(new Error('500 transient'));
        return Promise.resolve({ resolved: true as const });
      });
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      renderPendingReview();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /confirm all 2 auto-confirm rows/i }));
      });
      expect(mockResolveReconciliationNeedRequest).toHaveBeenCalledTimes(2);
      expect(mockResolveReconciliationNeedRequest).toHaveBeenCalledWith(7, 1);
      expect(mockResolveReconciliationNeedRequest).toHaveBeenCalledWith(7, 2);
      expect(mockRefetchOpenReconciliationNeedsData).toHaveBeenCalledTimes(3);
      consoleError.mockRestore();
    });

    it('Apply all skips a need whose edit fails and continues with the next eligible row', async () => {
      const failing = makeNeed({
        id: 1,
        specification_id: 7,
        target_item_id: 100,
        agent_status: 'classified',
        agent_classification: 'auto-edit',
        agent_proposal: 'proposal A',
        target_current_content: 'old A',
      });
      const healthy = makeNeed({
        id: 2,
        specification_id: 7,
        target_item_id: 101,
        agent_status: 'classified',
        agent_classification: 'auto-edit',
        agent_proposal: 'proposal B',
        target_current_content: 'old B',
      });
      setMockOpenNeeds([failing, healthy]);
      let refetchCalls = 0;
      mockRefetchOpenReconciliationNeedsData.mockImplementation(async () => {
        await mockInvalidateOpenReconciliationNeeds();
        refetchCalls += 1;
        if (refetchCalls <= 2) return [failing, healthy];
        return [failing];
      });
      let editCalls = 0;
      mockEditKnowledgeItemRequest.mockImplementation(() => {
        editCalls += 1;
        if (editCalls === 1) return Promise.reject(new Error('500 transient'));
        return Promise.resolve({
          impact: 'soft' as const,
          affectedItems: [],
          updated: true as const,
          previousContent: 'old',
          previousRationale: null,
        });
      });
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      renderPendingReview();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /apply all 2 suggested edits/i }));
      });
      expect(mockEditKnowledgeItemRequest).toHaveBeenCalledTimes(2);
      expect(mockEditKnowledgeItemRequest).toHaveBeenCalledWith(7, 100, { content: 'proposal A' });
      expect(mockEditKnowledgeItemRequest).toHaveBeenCalledWith(7, 101, { content: 'proposal B' });
      expect(mockResolveReconciliationNeedRequest).toHaveBeenCalledTimes(1);
      expect(mockResolveReconciliationNeedRequest).toHaveBeenCalledWith(7, 2);
      expect(mockRefetchOpenReconciliationNeedsData).toHaveBeenCalledTimes(3);
      consoleError.mockRestore();
    });

    it('Apply all suggested serially applies each auto-edit proposal then resolves', async () => {
      const n1 = makeNeed({
        id: 1,
        specification_id: 7,
        target_item_id: 100,
        agent_status: 'classified',
        agent_classification: 'auto-edit',
        agent_proposal: 'proposal A',
        target_current_content: 'old A',
      });
      const n2 = makeNeed({
        id: 2,
        specification_id: 7,
        target_item_id: 101,
        agent_status: 'classified',
        agent_classification: 'auto-edit',
        agent_proposal: 'proposal B',
        target_current_content: 'old B',
      });
      setMockOpenNeeds([n1, n2]);
      let refetchWave = 0;
      mockRefetchOpenReconciliationNeedsData.mockImplementation(async () => {
        await mockInvalidateOpenReconciliationNeeds();
        refetchWave += 1;
        if (refetchWave === 1) return [n1, n2];
        if (refetchWave === 2) return [n2];
        return [];
      });
      renderPendingReview();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /apply all 2 suggested edits/i }));
      });
      expect(mockEditKnowledgeItemRequest).toHaveBeenCalledTimes(2);
      expect(mockEditKnowledgeItemRequest).toHaveBeenCalledWith(7, 100, { content: 'proposal A' });
      expect(mockEditKnowledgeItemRequest).toHaveBeenCalledWith(7, 101, { content: 'proposal B' });
      expect(mockResolveReconciliationNeedRequest).toHaveBeenCalledTimes(2);
    });
  });
});
