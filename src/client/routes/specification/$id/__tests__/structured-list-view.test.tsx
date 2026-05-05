// @vitest-environment happy-dom

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const readSrc = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');

describe('structured-list-view kind anchors', () => {
  it('marks the first row of each kind with data-graph-kind-anchor', () => {
    const src = readSrc('src/client/routes/specification/$id/-structured-list-view.tsx');
    expect(src).toContain('data-graph-kind-anchor');
  });
});

describe('structured-list-view hash anchor resolution', () => {
  it('reads the hash prefix used for kind anchors', () => {
    const src = readSrc('src/client/routes/specification/$id/-structured-list-view.tsx');
    expect(src).toMatch(/data-graph-kind-anchor=.*CSS\.escape/s);
    expect(src).toContain("'kind-'");
  });
});

import {
  activePathDivergence,
  crossPhaseDecisionLink,
  denseGoalAnchor,
  emptySpec,
  singleItemNoEdges,
} from '@/client/__fixtures__/graph-view.js';
import { PatchListProvider, type PatchAppliers } from '@/client/components/patch-list-host.js';
import { SideChatHost, useSideChat, type SideChatPinnableItem } from '@/client/components/side-chat-host.js';
import type { SideChatStreamEvent } from '@/client/lib/side-chat-stream.js';

const mockNavigate = vi.fn();
let mockHash = '';
const { mockStreamSideChatResponse } = vi.hoisted(() => ({
  mockStreamSideChatResponse: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ hash: mockHash, pathname: '/specification/1/graph', search: '' }),
}));

vi.mock('@/client/lib/side-chat-stream.js', () => ({
  streamSideChatResponse: mockStreamSideChatResponse,
}));

import { RelationChipPreview } from '../-relation-chip.js';
import { StructuredListView } from '../-structured-list-view.js';

beforeEach(() => {
  mockNavigate.mockClear();
  mockStreamSideChatResponse.mockReset();
  mockHash = '';
  vi.spyOn(Element.prototype, 'scrollTo').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('StructuredListView', () => {
  it('renders no relations footer when an item has zero edges', () => {
    render(<StructuredListView entityState={singleItemNoEdges()} />);

    expect(screen.getByText('Reduce signup drop-off')).toBeTruthy();
    expect(screen.queryByText(/no relationships/i)).toBeNull();
    expect(screen.queryByText(/links to/i)).toBeNull();
    expect(screen.queryByText(/linked from/i)).toBeNull();
  });

  it('renders the empty-state orientation card when there are no knowledge items', () => {
    const { container } = render(<StructuredListView entityState={emptySpec()} />);
    expect(container.querySelector('[data-graph-empty-state]')).toBeTruthy();
    expect(container.querySelectorAll('[data-graph-row]')).toHaveLength(0);
  });

  it('the empty-state card mentions that knowledge appears as the interview progresses', () => {
    render(<StructuredListView entityState={emptySpec()} />);
    expect(screen.getByText(/knowledge.*interview progresses/i)).toBeTruthy();
  });

  it('renders the supplied emptyStateAction inside the empty-state card', () => {
    render(
      <StructuredListView
        entityState={emptySpec()}
        emptyStateAction={<a href="/test-action">Go somewhere</a>}
      />,
    );
    const link = screen.getByRole('link', { name: 'Go somewhere' });
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('/test-action');
  });

  it('renders the supplied header above the structured list', () => {
    const { container } = render(
      <StructuredListView
        entityState={singleItemNoEdges()}
        headerLeft={<div data-testid="test-header">Header content</div>}
      />,
    );

    const header = screen.getByTestId('test-header');
    const list = container.querySelector('[data-graph-structured-list]');
    expect(header).toBeTruthy();
    expect(list).toBeTruthy();
    if (!list) return;
    // Header should appear before the first row in DOM order
    const firstRow = list.querySelector('[data-graph-row]');
    expect(firstRow).toBeTruthy();
    if (!firstRow) return;
    expect(header.compareDocumentPosition(firstRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('does not render a header element when no header prop is supplied', () => {
    const { container } = render(<StructuredListView entityState={singleItemNoEdges()} />);
    expect(container.querySelector('[data-graph-header]')).toBeNull();
  });

  it('renders the supplied header even when the empty-state card is shown', () => {
    render(
      <StructuredListView
        entityState={emptySpec()}
        headerLeft={<div data-testid="test-header">Header content</div>}
      />,
    );
    expect(screen.getByTestId('test-header')).toBeTruthy();
    // Empty-state still rendered too
    expect(screen.getByText(/no knowledge captured yet/i)).toBeTruthy();
  });

  it('does not render the empty-state card when items exist', () => {
    const { container } = render(
      <StructuredListView
        entityState={singleItemNoEdges()}
        emptyStateAction={<a href="/test">Should not render</a>}
      />,
    );
    expect(container.querySelector('[data-graph-empty-state]')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Should not render' })).toBeNull();
  });

  it('groups items into per-kind sections in the full-screen view', () => {
    const { container } = render(<StructuredListView entityState={crossPhaseDecisionLink()} />);

    const sections = container.querySelectorAll('[data-graph-section]');
    const sectionLabels = Array.from(sections).map((s) => s.getAttribute('data-graph-section'));
    expect(sectionLabels).toContain('Goals');
    expect(sectionLabels).toContain('Constraints');
    expect(sectionLabels).toContain('Decisions');
    expect(sectionLabels).toContain('Requirements');
    // Combined sidebar bundles ("Goals & Context", "Assumptions & Decisions") do not appear here.
    expect(sectionLabels).not.toContain('Goals & Context');
    expect(sectionLabels).not.toContain('Assumptions & Decisions');
  });

  it('renders one subsection per relation type in the relations footer', () => {
    const { container } = render(<StructuredListView entityState={crossPhaseDecisionLink()} />);

    const decisionRow = container.querySelector('[data-graph-row-ref="D1"]');
    expect(decisionRow).toBeTruthy();
    if (!decisionRow) return;

    const decisionScope = within(decisionRow as HTMLElement);
    expect(decisionScope.getByText('Refines')).toBeTruthy();
    expect(decisionScope.getByText('Derived from')).toBeTruthy();
    expect(decisionScope.getByText('Constrains')).toBeTruthy();
    expect(decisionScope.queryByText('Links to')).toBeNull();
    expect(decisionScope.queryByText('Linked from')).toBeNull();
  });

  it('shows relation chips with the target reference code and content snippet', () => {
    const { container } = render(<StructuredListView entityState={crossPhaseDecisionLink()} />);

    const decisionRow = container.querySelector('[data-graph-row-ref="D1"]');
    expect(decisionRow).toBeTruthy();
    if (!decisionRow) return;

    const decisionScope = within(decisionRow as HTMLElement);

    // Outgoing edge: decision refines goal G1
    expect(decisionScope.getByText('Refines')).toBeTruthy();
    expect(decisionScope.getByText('G1')).toBeTruthy();
    expect(decisionScope.getByText(/Reduce signup drop-off/)).toBeTruthy();

    // Incoming edge: requirement R1 derives_from this decision
    expect(decisionScope.getByText('Derived from')).toBeTruthy();
    expect(decisionScope.getByText('R1')).toBeTruthy();
    expect(decisionScope.getByText(/Email verification on first login/)).toBeTruthy();
  });

  it('renders a row per knowledge item without filtering for active-path membership in slice 1', () => {
    const { container } = render(<StructuredListView entityState={activePathDivergence()} />);

    const rows = container.querySelectorAll('[data-graph-row]');
    expect(rows).toHaveLength(3);
    expect(container.querySelector('[data-graph-row-ref="G1"]')?.textContent).toContain('On-path goal');
    expect(container.querySelector('[data-graph-row-ref="G2"]')?.textContent).toContain('Off-path goal');
    expect(container.querySelector('[data-graph-row-ref="D1"]')?.textContent).toContain('On-path decision');
  });

  it('soft-truncates dense relation lists at 6 with a +N more expander', () => {
    const { container } = render(<StructuredListView entityState={denseGoalAnchor()} />);

    const goalRow = container.querySelector('[data-graph-row-ref="G1"]');
    expect(goalRow).toBeTruthy();
    if (!goalRow) return;

    const goalScope = within(goalRow as HTMLElement);
    expect(goalScope.getByText('Refines')).toBeTruthy();
    const visibleChips = goalScope.queryAllByTestId('relation-chip');
    expect(visibleChips.length).toBe(6);
    expect(goalScope.getByRole('button', { name: '+9 more' })).toBeTruthy();
  });

  it('expanding the +N more button reveals all chips for that relation type and hides the button', () => {
    const { container } = render(<StructuredListView entityState={denseGoalAnchor()} />);

    const goalRow = container.querySelector('[data-graph-row-ref="G1"]');
    expect(goalRow).toBeTruthy();
    if (!goalRow) return;

    const goalScope = within(goalRow as HTMLElement);
    const moreButton = goalScope.getByRole('button', { name: '+9 more' });

    act(() => {
      (moreButton as HTMLButtonElement).click();
    });

    expect(goalScope.queryAllByTestId('relation-chip').length).toBe(15);
    expect(goalScope.queryByRole('button', { name: /more/ })).toBeNull();
  });

  it('does not truncate when an item has 6 or fewer chips of a relation type', () => {
    const { container } = render(<StructuredListView entityState={crossPhaseDecisionLink()} />);

    const decisionRow = container.querySelector('[data-graph-row-ref="D1"]');
    expect(decisionRow).toBeTruthy();
    if (!decisionRow) return;

    const decisionScope = within(decisionRow as HTMLElement);
    // Decision has 1 outgoing refines + 1 incoming constrains + 1 incoming derived_from = 3 chips total, all under the limit
    expect(decisionScope.queryByRole('button', { name: /more/ })).toBeNull();
    expect(decisionScope.queryAllByTestId('relation-chip').length).toBe(3);
  });

  it('truncates per relation type independently within the same direction', () => {
    // Build a fixture with one item having 8 outgoing refines + 8 outgoing derived_from edges
    const entityState = denseGoalAnchor();
    // Add 8 more decisions with derived_from edges to the same goal
    const goalId = 100;
    const startId = 300;
    const extras = Array.from({ length: 8 }, (_, index) => ({
      id: startId + index,
      specification_id: 1,
      content: `Extra decision ${index + 1}`,
      rationale: null,
      referenceCode: `D${index + 100}`,
    }));
    entityState.decisions = [...entityState.decisions, ...extras];
    entityState.relationships = [
      ...entityState.relationships,
      ...extras.map((d) => ({
        type: 'derived_from' as const,
        source: { kind: 'decision' as const, collection: 'knowledge_item' as const, id: d.id },
        target: { kind: 'goal' as const, collection: 'knowledge_item' as const, id: goalId },
      })),
    ];

    const { container } = render(<StructuredListView entityState={entityState} />);

    const goalRow = container.querySelector('[data-graph-row-ref="G1"]');
    expect(goalRow).toBeTruthy();
    if (!goalRow) return;

    const goalScope = within(goalRow as HTMLElement);
    // Two distinct +N more buttons should appear (one per relation type)
    expect(goalScope.queryAllByRole('button', { name: /more/ }).length).toBe(2);
  });

  it('expand state is row-local (expanding one row does not expand another)', () => {
    const entityState = denseGoalAnchor();
    // Add a second goal with 10 incoming refines edges so two rows have +N buttons
    const secondGoalId = 999;
    entityState.goals = [
      ...entityState.goals,
      {
        id: secondGoalId,
        specification_id: 1,
        kind: 'goal',
        subtype: null,
        content: 'Second goal',
        rationale: null,
        referenceCode: 'G2',
      },
    ];
    const secondAnchorDecisions = Array.from({ length: 10 }, (_, index) => ({
      id: 500 + index,
      specification_id: 1,
      content: `Second-anchor decision ${index + 1}`,
      rationale: null,
      referenceCode: `D${200 + index}`,
    }));
    entityState.decisions = [...entityState.decisions, ...secondAnchorDecisions];
    entityState.relationships = [
      ...entityState.relationships,
      ...secondAnchorDecisions.map((d) => ({
        type: 'refines' as const,
        source: { kind: 'decision' as const, collection: 'knowledge_item' as const, id: d.id },
        target: { kind: 'goal' as const, collection: 'knowledge_item' as const, id: secondGoalId },
      })),
    ];

    const { container } = render(<StructuredListView entityState={entityState} />);

    const firstGoal = container.querySelector('[data-graph-row-ref="G1"]') as HTMLElement | null;
    const secondGoal = container.querySelector('[data-graph-row-ref="G2"]') as HTMLElement | null;
    expect(firstGoal).toBeTruthy();
    expect(secondGoal).toBeTruthy();
    if (!firstGoal || !secondGoal) return;

    // Initial state: both rows have 6 chips visible
    expect(within(firstGoal).queryAllByTestId('relation-chip').length).toBe(6);
    expect(within(secondGoal).queryAllByTestId('relation-chip').length).toBe(6);

    // Expand first row only
    const firstMoreButton = within(firstGoal).getByRole('button', { name: '+9 more' });
    act(() => {
      (firstMoreButton as HTMLButtonElement).click();
    });

    // First row expanded; second row still truncated
    expect(within(firstGoal).queryAllByTestId('relation-chip').length).toBe(15);
    expect(within(secondGoal).queryAllByTestId('relation-chip').length).toBe(6);
    expect(within(secondGoal).getByRole('button', { name: '+4 more' })).toBeTruthy();
  });

  it('renders each relation chip as a keyboard-focusable button', () => {
    const { container } = render(<StructuredListView entityState={crossPhaseDecisionLink()} />);

    const chips = container.querySelectorAll('[data-testid="relation-chip"]');
    expect(chips.length).toBeGreaterThan(0);
    for (const chip of chips) {
      expect(chip.tagName).toBe('BUTTON');
      // Native button is focusable; type should be 'button' to avoid form submission
      expect(chip.getAttribute('type')).toBe('button');
    }
  });

  it('clicking a relation chip navigates to the target reference code as a hash anchor', () => {
    const { container } = render(<StructuredListView entityState={crossPhaseDecisionLink()} />);

    // Decision row has an outgoing chip targeting goal G1
    const decisionRow = container.querySelector('[data-graph-row-ref="D1"]');
    expect(decisionRow).toBeTruthy();
    if (!decisionRow) return;

    const chips = within(decisionRow as HTMLElement).getAllByTestId('relation-chip');
    expect(chips.length).toBeGreaterThan(0);

    (chips[0] as HTMLButtonElement).click();

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith(expect.objectContaining({ hash: expect.any(String) }));
  });

  it('mounting with a hash matching a row scrolls that row into view', () => {
    mockHash = '#G1';

    const { container } = render(<StructuredListView entityState={crossPhaseDecisionLink()} />);

    const goalRow = container.querySelector('[data-graph-row-ref="G1"]');
    expect(goalRow).toBeTruthy();
    expect(Element.prototype.scrollTo).toHaveBeenCalled();
  });

  it('mounting with a kind-{kind} hash scrolls the first row of that kind into view', () => {
    mockHash = '#kind-goal';

    const { container } = render(<StructuredListView entityState={crossPhaseDecisionLink()} />);

    const kindAnchor = container.querySelector('[data-graph-kind-anchor="goal"]');
    expect(kindAnchor).toBeTruthy();
    expect(Element.prototype.scrollTo).toHaveBeenCalled();
  });

  it('does not scroll when there is no hash', () => {
    mockHash = '';

    render(<StructuredListView entityState={crossPhaseDecisionLink()} />);

    expect(Element.prototype.scrollTo).not.toHaveBeenCalled();
  });

  it('does not scroll or highlight when the hash matches no rendered row', () => {
    mockHash = '#NOPE99';

    const { container } = render(<StructuredListView entityState={crossPhaseDecisionLink()} />);

    expect(Element.prototype.scrollTo).not.toHaveBeenCalled();
    // No row should carry the arrival highlight attribute
    expect(container.querySelectorAll('[data-graph-row-anchored]')).toHaveLength(0);
  });

  it('applies a transient hash-anchor highlight on the matched row, then clears it after 1.5s', async () => {
    vi.useFakeTimers();
    try {
      mockHash = '#G1';

      const { container } = render(<StructuredListView entityState={crossPhaseDecisionLink()} />);

      const goalRow = container.querySelector('[data-graph-row-ref="G1"]');
      expect(goalRow).toBeTruthy();
      expect(goalRow?.getAttribute('data-graph-row-anchored')).toBe('true');

      await act(async () => {
        vi.advanceTimersByTime(1500);
      });

      expect(goalRow?.getAttribute('data-graph-row-anchored')).not.toBe('true');
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps the chat-with button as a disabled placeholder when rendered without a SideChatHost ancestor', () => {
    const { container } = render(<StructuredListView entityState={crossPhaseDecisionLink()} />);

    const rows = container.querySelectorAll('[data-graph-row]');
    expect(rows.length).toBeGreaterThan(0);

    for (const row of rows) {
      const rail = row.querySelector('[data-graph-action-rail]');
      expect(rail).toBeTruthy();
      const chatButton = row.querySelector(
        'button[data-graph-action="chat-with"]',
      ) as HTMLButtonElement | null;
      expect(chatButton).toBeTruthy();
      if (!chatButton) continue;
      expect(chatButton.disabled).toBe(true);
      expect(chatButton.getAttribute('aria-label')?.toLowerCase()).toMatch(/chat/);
    }
  });

  it('activates the chat-with button on every item row when wrapped in a SideChatHost', () => {
    const { container } = render(
      <SideChatHost specificationId={42}>
        <StructuredListView entityState={crossPhaseDecisionLink()} />
      </SideChatHost>,
    );

    const buttons = container.querySelectorAll(
      'button[data-graph-action="chat-with"]',
    ) as NodeListOf<HTMLButtonElement>;
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      expect(button.disabled).toBe(false);
    }
  });

  it('positions the action rail to the right of the item content', () => {
    const { container } = render(<StructuredListView entityState={singleItemNoEdges()} />);

    const row = container.querySelector('[data-graph-row]');
    expect(row).toBeTruthy();
    if (!row) return;

    // The action rail sits inside a justify-between flex header. Walk up from
    // the action rail until we find the ancestor carrying justify-between
    // (decoupled from how many wrappers sit between rail and header).
    const actionRail = row.querySelector('[data-graph-action-rail]');
    expect(actionRail).toBeTruthy();
    let cursor: HTMLElement | null = actionRail as HTMLElement | null;
    while (cursor && cursor !== row && !cursor.className.includes('justify-between')) {
      cursor = cursor.parentElement;
    }
    expect(cursor?.className).toContain('justify-between');
  });

  it('renders a kind-filter toggler row when items exist', () => {
    const { container } = render(<StructuredListView entityState={crossPhaseDecisionLink()} />);

    const toggler = container.querySelector('[data-graph-kind-filter]');
    expect(toggler).toBeTruthy();
    if (!toggler) return;

    // crossPhaseDecisionLink has goals + constraints + decisions + requirements populated
    const buttons = toggler.querySelectorAll('button[data-graph-kind-toggle]');
    expect(buttons.length).toBe(4);
  });

  it('does not render the kind-filter toggler when there are no items', () => {
    const { container } = render(<StructuredListView entityState={emptySpec()} />);
    expect(container.querySelector('[data-graph-kind-filter]')).toBeNull();
  });

  it('clicking a kind toggle hides items of that kind from rendering', () => {
    const { container } = render(<StructuredListView entityState={crossPhaseDecisionLink()} />);

    const decisionToggle = container.querySelector(
      '[data-graph-kind-toggle="decision"]',
    ) as HTMLButtonElement | null;
    expect(decisionToggle).toBeTruthy();
    if (!decisionToggle) return;

    expect(container.querySelector('[data-graph-row-ref="D1"]')).toBeTruthy();

    act(() => {
      decisionToggle.click();
    });

    expect(container.querySelector('[data-graph-row-ref="D1"]')).toBeNull();
    expect(decisionToggle.getAttribute('aria-pressed')).toBe('false');
  });

  it('clicking a kind toggle twice restores items', () => {
    const { container } = render(<StructuredListView entityState={crossPhaseDecisionLink()} />);

    const decisionToggle = container.querySelector(
      '[data-graph-kind-toggle="decision"]',
    ) as HTMLButtonElement | null;
    expect(decisionToggle).toBeTruthy();
    if (!decisionToggle) return;

    act(() => decisionToggle.click());
    expect(container.querySelector('[data-graph-row-ref="D1"]')).toBeNull();

    act(() => decisionToggle.click());
    expect(container.querySelector('[data-graph-row-ref="D1"]')).toBeTruthy();
    expect(decisionToggle.getAttribute('aria-pressed')).toBe('true');
  });

  it('renders items sorted by referenceCode within their kind grouping', () => {
    const entityState = denseGoalAnchor();

    const { container } = render(<StructuredListView entityState={entityState} />);

    // The 15 decisions should appear in D1, D2, ..., D15 reference order in the rendered DOM
    const decisionSection = container.querySelector('[data-graph-section="Decisions"]');
    expect(decisionSection).toBeTruthy();
    if (!decisionSection) return;

    const renderedReferenceCodes = Array.from(
      decisionSection.querySelectorAll('[data-graph-row] [data-graph-row-reference]'),
    ).map((node) => node.textContent);

    expect(renderedReferenceCodes).toEqual([
      'D1',
      'D2',
      'D3',
      'D4',
      'D5',
      'D6',
      'D7',
      'D8',
      'D9',
      'D10',
      'D11',
      'D12',
      'D13',
      'D14',
      'D15',
    ]);
  });

  it('clicking a visible chip body navigates to its kind anchor', async () => {
    const { container } = render(<StructuredListView entityState={crossPhaseDecisionLink()} />);

    const goalChipBody = container.querySelector('[data-graph-kind-body="goal"]') as HTMLButtonElement | null;
    expect(goalChipBody).toBeTruthy();
    if (!goalChipBody) return;

    await userEvent.click(goalChipBody);

    expect(mockNavigate).toHaveBeenCalledWith(expect.objectContaining({ hash: 'kind-goal' }));
  });

  it('clicking the toggle hides the kind without navigating, and Show all restores it', async () => {
    const { container } = render(<StructuredListView entityState={crossPhaseDecisionLink()} />);

    // Initially the goal anchor is rendered
    expect(container.querySelector('[data-graph-kind-anchor="goal"]')).toBeTruthy();

    // Click the goal toggle to hide it
    const goalToggle = container.querySelector('[data-graph-kind-toggle="goal"]') as HTMLButtonElement | null;
    expect(goalToggle).toBeTruthy();
    if (!goalToggle) return;
    await userEvent.click(goalToggle);

    // After hide: no navigate, and the anchor is no longer in the DOM (kind hidden)
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(container.querySelector('[data-graph-kind-anchor="goal"]')).toBeNull();

    // The Show all button should now appear
    const showAll = container.querySelector('[data-graph-kind-show-all]') as HTMLButtonElement | null;
    expect(showAll).toBeTruthy();
    if (!showAll) return;
    await userEvent.click(showAll);

    // After Show all: anchor is back, still no navigate
    expect(container.querySelector('[data-graph-kind-anchor="goal"]')).toBeTruthy();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('clicking the body of a hidden chip unhides synchronously and then navigates', async () => {
    const { container } = render(<StructuredListView entityState={crossPhaseDecisionLink()} />);

    // Hide the goal kind first
    const goalToggle = container.querySelector('[data-graph-kind-toggle="goal"]') as HTMLButtonElement | null;
    if (!goalToggle) throw new Error('goal toggle not found');
    await userEvent.click(goalToggle);
    expect(container.querySelector('[data-graph-kind-anchor="goal"]')).toBeNull();

    // Click the body of the now-hidden goal chip
    const goalBody = container.querySelector('[data-graph-kind-body="goal"]') as HTMLButtonElement | null;
    if (!goalBody) throw new Error('goal body not found');
    await userEvent.click(goalBody);

    // After flushSync + navigate: the anchor must be in the DOM AND mockNavigate was called with kind-goal
    expect(container.querySelector('[data-graph-kind-anchor="goal"]')).toBeTruthy();
    expect(mockNavigate).toHaveBeenCalledWith(expect.objectContaining({ hash: 'kind-goal' }));
  });

  describe('side-chat session', () => {
    function makeManualStream() {
      let onChunk: ((event: SideChatStreamEvent) => void) | undefined;
      let resolveStream: () => void = () => {};
      const promise = new Promise<void>((resolve) => {
        resolveStream = resolve;
      });
      mockStreamSideChatResponse.mockImplementation(
        (_request: unknown, chunkCallback: (event: SideChatStreamEvent) => void): Promise<void> => {
          onChunk = chunkCallback;
          return promise;
        },
      );
      return {
        emit(event: SideChatStreamEvent) {
          act(() => {
            onChunk?.(event);
          });
        },
        finish() {
          resolveStream();
          return promise;
        },
      };
    }

    function renderInsideHost(entityState: ReturnType<typeof singleItemNoEdges>, specificationId = 42) {
      return render(
        <SideChatHost specificationId={specificationId}>
          <StructuredListView entityState={entityState} />
        </SideChatHost>,
      );
    }

    it('does not re-render side-chat context consumers while streaming text deltas', () => {
      const stream = makeManualStream();
      let renderCount = 0;
      let openFor: ((item: SideChatPinnableItem) => void) | null = null;

      function ContextConsumerProbe() {
        renderCount += 1;
        openFor = useSideChat()?.openFor ?? null;
        return null;
      }

      render(
        <SideChatHost specificationId={42}>
          <ContextConsumerProbe />
        </SideChatHost>,
      );

      expect(openFor).toBeTruthy();
      act(() => {
        openFor?.({
          kind: 'goal',
          id: 1,
          referenceCode: 'G1',
          content: 'Reduce signup drop-off',
        });
      });
      const renderCountAfterOpen = renderCount;

      fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Why?' } });
      fireEvent.click(screen.getByRole('button', { name: /send/i }));
      stream.emit({ type: 'text-delta', delta: 'It ' });
      stream.emit({ type: 'text-delta', delta: 'depends.' });

      expect(renderCount).toBe(renderCountAfterOpen);
    });

    it('does not mount a side-chat popover before the user clicks chat-with', () => {
      renderInsideHost(singleItemNoEdges());
      expect(screen.queryByRole('dialog', { name: /side[- ]chat/i })).toBeNull();
    });

    it('mounts a SideChatPopover pinned to the row when the chat-with button is clicked', () => {
      const { container } = renderInsideHost(singleItemNoEdges());

      const chatButton = container.querySelector(
        'button[data-graph-action="chat-with"]',
      ) as HTMLButtonElement;
      fireEvent.click(chatButton);

      const dialog = screen.getByRole('dialog', { name: /side[- ]chat/i });
      expect(within(dialog).getByText('Reduce signup drop-off')).toBeTruthy();
      expect(within(dialog).getByText('G1')).toBeTruthy();
    });

    it('only mounts one popover at a time and swaps the pinned item when chat-with is clicked on a different row', () => {
      const { container } = renderInsideHost(crossPhaseDecisionLink());

      const chatButtons = container.querySelectorAll(
        'button[data-graph-action="chat-with"]',
      ) as NodeListOf<HTMLButtonElement>;
      expect(chatButtons.length).toBeGreaterThanOrEqual(2);

      fireEvent.click(chatButtons[0]);
      const firstDialog = screen.getByRole('dialog', { name: /side[- ]chat/i });
      const firstPinnedRef = within(firstDialog).getByText(/^[A-Z]+\d+$/).textContent;
      expect(firstPinnedRef).toBeTruthy();

      fireEvent.click(chatButtons[1]);
      const dialogs = screen.getAllByRole('dialog', { name: /side[- ]chat/i });
      expect(dialogs).toHaveLength(1);
      const secondPinnedRef = within(dialogs[0]).getByText(/^[A-Z]+\d+$/).textContent;
      expect(secondPinnedRef).not.toBe(firstPinnedRef);
    });

    it('clears the unsent draft when switching the pinned side-chat item', () => {
      const { container } = renderInsideHost(crossPhaseDecisionLink());

      const chatButtons = container.querySelectorAll(
        'button[data-graph-action="chat-with"]',
      ) as NodeListOf<HTMLButtonElement>;
      expect(chatButtons.length).toBeGreaterThanOrEqual(2);

      fireEvent.click(chatButtons[0]);
      fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Draft for first item' } });
      expect((screen.getByLabelText('Message') as HTMLTextAreaElement).value).toBe('Draft for first item');

      fireEvent.click(chatButtons[1]);

      expect((screen.getByLabelText('Message') as HTMLTextAreaElement).value).toBe('');
    });

    it('calls streamSideChatResponse with the row context and submitted message on send', () => {
      makeManualStream();
      const { container } = renderInsideHost(singleItemNoEdges());

      fireEvent.click(container.querySelector('button[data-graph-action="chat-with"]') as HTMLButtonElement);
      fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Why?' } });
      fireEvent.click(screen.getByRole('button', { name: /send/i }));

      expect(mockStreamSideChatResponse).toHaveBeenCalledTimes(1);
      const [requestArg] = mockStreamSideChatResponse.mock.calls[0];
      expect(requestArg).toMatchObject({
        specificationId: 42,
        itemKind: 'goal',
        itemId: 1,
        message: 'Why?',
      });
    });

    it('renders streamed text-delta chunks incrementally as a pending assistant message', async () => {
      const stream = makeManualStream();
      const { container } = renderInsideHost(singleItemNoEdges());

      fireEvent.click(container.querySelector('button[data-graph-action="chat-with"]') as HTMLButtonElement);
      fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Why?' } });
      fireEvent.click(screen.getByRole('button', { name: /send/i }));

      stream.emit({ type: 'text-delta', delta: 'It ' });
      stream.emit({ type: 'text-delta', delta: 'depends.' });

      const dialog = screen.getByRole('dialog', { name: /side[- ]chat/i });
      const log = within(dialog).getByRole('log', { name: /side[- ]chat messages/i });
      // The assistant bubble uses a typewriter reveal; wait for it to catch up.
      await waitFor(() => {
        const messages = log.querySelectorAll('[data-message-role]');
        expect(messages).toHaveLength(2);
        expect(messages[1].textContent).toContain('It depends.');
      });
      const messages = log.querySelectorAll('[data-message-role]');
      expect(messages[0].getAttribute('data-message-role')).toBe('user');
      expect(messages[0].textContent).toContain('Why?');
      expect(messages[1].getAttribute('data-message-role')).toBe('assistant');
    });

    it('renders an error message and re-enables sending when the stream rejects', async () => {
      mockStreamSideChatResponse.mockRejectedValue(new Error('Side-chat request failed'));
      const { container } = renderInsideHost(singleItemNoEdges());

      fireEvent.click(container.querySelector('button[data-graph-action="chat-with"]') as HTMLButtonElement);
      fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Why?' } });
      fireEvent.click(screen.getByRole('button', { name: /send/i }));

      await act(async () => {
        await Promise.resolve();
      });

      const dialog = screen.getByRole('dialog', { name: /side[- ]chat/i });
      const log = within(dialog).getByRole('log', { name: /side[- ]chat messages/i });
      const messages = log.querySelectorAll('[data-message-role]');
      expect(messages).toHaveLength(2);
      expect(messages[1].getAttribute('data-message-role')).toBe('assistant');
      expect(messages[1].getAttribute('data-message-error')).toBe('true');
      expect(messages[1].getAttribute('data-message-pending')).not.toBe('true');

      // Send re-enables for retry.
      fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Try again' } });
      const send = screen.getByRole('button', { name: /send/i }) as HTMLButtonElement;
      expect(send.disabled).toBe(false);
    });

    it('sends prior finalized turns as history on the second send', async () => {
      const stream = makeManualStream();
      const { container } = renderInsideHost(singleItemNoEdges());

      // First turn
      fireEvent.click(container.querySelector('button[data-graph-action="chat-with"]') as HTMLButtonElement);
      fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Why?' } });
      fireEvent.click(screen.getByRole('button', { name: /send/i }));

      stream.emit({ type: 'text-delta', delta: 'Because reasons.' });
      stream.emit({ type: 'done' });
      await act(async () => {
        await stream.finish();
      });

      // Second turn
      const stream2 = makeManualStream();
      fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Tell me more.' } });
      fireEvent.click(screen.getByRole('button', { name: /send/i }));

      expect(mockStreamSideChatResponse).toHaveBeenCalledTimes(2);
      const [secondRequest] = mockStreamSideChatResponse.mock.calls[1];
      expect(secondRequest).toMatchObject({
        message: 'Tell me more.',
        history: [
          { role: 'user', text: 'Why?' },
          { role: 'assistant', text: 'Because reasons.' },
        ],
      });

      // Drain the second stream so its dangling promise doesn't leak between tests.
      stream2.emit({ type: 'done' });
      await act(async () => {
        await stream2.finish();
      });
    });

    it('does not include errored turns in history on retry', async () => {
      mockStreamSideChatResponse.mockRejectedValueOnce(new Error('boom'));
      const { container } = renderInsideHost(singleItemNoEdges());

      fireEvent.click(container.querySelector('button[data-graph-action="chat-with"]') as HTMLButtonElement);
      fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Why?' } });
      fireEvent.click(screen.getByRole('button', { name: /send/i }));
      await act(async () => {
        await Promise.resolve();
      });

      const stream2 = makeManualStream();
      fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Try again' } });
      fireEvent.click(screen.getByRole('button', { name: /send/i }));

      const [secondRequest] = mockStreamSideChatResponse.mock.calls[1];
      expect(secondRequest.history).toEqual([]);

      stream2.emit({ type: 'done' });
      await act(async () => {
        await stream2.finish();
      });
    });

    it('keeps successful history while dropping a failed exchange on retry', async () => {
      const stream = makeManualStream();
      const { container } = renderInsideHost(singleItemNoEdges());

      // First turn succeeds.
      fireEvent.click(container.querySelector('button[data-graph-action="chat-with"]') as HTMLButtonElement);
      fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Why?' } });
      fireEvent.click(screen.getByRole('button', { name: /send/i }));
      stream.emit({ type: 'text-delta', delta: 'Because reasons.' });
      stream.emit({ type: 'done' });
      await act(async () => {
        await stream.finish();
      });

      // Second turn fails.
      mockStreamSideChatResponse.mockRejectedValueOnce(new Error('boom'));
      fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'What about backups?' } });
      fireEvent.click(screen.getByRole('button', { name: /send/i }));
      await act(async () => {
        await Promise.resolve();
      });

      // Retry should keep only the successful first exchange in history.
      const stream3 = makeManualStream();
      fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Try again' } });
      fireEvent.click(screen.getByRole('button', { name: /send/i }));

      const [thirdRequest] = mockStreamSideChatResponse.mock.calls[2];
      expect(thirdRequest).toMatchObject({
        message: 'Try again',
        history: [
          { role: 'user', text: 'Why?' },
          { role: 'assistant', text: 'Because reasons.' },
        ],
      });

      stream3.emit({ type: 'done' });
      await act(async () => {
        await stream3.finish();
      });
    });

    it('finalizes the assistant message and re-enables sending after the stream finishes', async () => {
      const stream = makeManualStream();
      const { container } = renderInsideHost(singleItemNoEdges());

      fireEvent.click(container.querySelector('button[data-graph-action="chat-with"]') as HTMLButtonElement);
      fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Why?' } });
      fireEvent.click(screen.getByRole('button', { name: /send/i }));

      stream.emit({ type: 'text-delta', delta: 'Done.' });
      stream.emit({ type: 'done' });
      await act(async () => {
        await stream.finish();
      });

      const dialog = screen.getByRole('dialog', { name: /side[- ]chat/i });
      const log = within(dialog).getByRole('log', { name: /side[- ]chat messages/i });
      const messages = log.querySelectorAll('[data-message-role]');
      expect(messages).toHaveLength(2);
      expect(messages[1].getAttribute('data-message-pending')).not.toBe('true');
      expect(messages[1].textContent).toContain('Done.');

      // Ready to send the next message once the input is non-empty.
      fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Again?' } });
      const send = screen.getByRole('button', { name: /send/i }) as HTMLButtonElement;
      expect(send.disabled).toBe(false);
    });
  });
});

describe('structured-list-view unhideAndNavigate helper', () => {
  it('uses flushSync to commit the unhide before navigate fires', () => {
    const src = readSrc('src/client/routes/specification/$id/-structured-list-view.tsx');
    expect(src).toContain("import { flushSync } from 'react-dom'");
    expect(src).toMatch(/flushSync\(\(\) => \{[\s\S]*?setHiddenKinds/);
  });
});

describe('RelationChipPreview', () => {
  it('shows the target reference code, content, rationale, and edge counts', () => {
    render(
      <RelationChipPreview
        target={{
          kind: 'goal',
          id: 1,
          referenceCode: 'G1',
          content: 'Reduce signup drop-off',
          rationale: 'Conversion telemetry shows 38% abandonment.',
          outgoingCount: 2,
          incomingCount: 5,
        }}
      />,
    );

    expect(screen.getByText('G1')).toBeTruthy();
    expect(screen.getByText('Reduce signup drop-off')).toBeTruthy();
    expect(screen.getByText(/Conversion telemetry/)).toBeTruthy();
    expect(screen.getByText(/2.*outgoing/i)).toBeTruthy();
    expect(screen.getByText(/5.*incoming/i)).toBeTruthy();
  });

  it('omits rationale when none is present', () => {
    const { container } = render(
      <RelationChipPreview
        target={{
          kind: 'decision',
          id: 1,
          referenceCode: 'D1',
          content: 'Some decision',
          rationale: null,
          outgoingCount: 0,
          incomingCount: 0,
        }}
      />,
    );

    expect(screen.getByText('D1')).toBeTruthy();
    expect(screen.getByText('Some decision')).toBeTruthy();
    // No rationale text should appear; preview still renders
    expect(container.textContent).not.toMatch(/rationale/i);
  });

  it('expresses zero edge counts honestly rather than hiding them', () => {
    render(
      <RelationChipPreview
        target={{
          kind: 'term',
          id: 1,
          referenceCode: 'T1',
          content: 'A term with no relationships',
          rationale: null,
          outgoingCount: 0,
          incomingCount: 0,
        }}
      />,
    );

    expect(screen.getByText(/0.*outgoing/i)).toBeTruthy();
    expect(screen.getByText(/0.*incoming/i)).toBeTruthy();
  });
});

describe('KindFilterToggler integration', () => {
  it('renders KindToggleChip for each populated kind', () => {
    const src = readSrc('src/client/routes/specification/$id/-structured-list-view.tsx');
    expect(src).toContain("import { KindToggleChip } from './-kind-toggle-chip.js'");
    expect(src).toContain('<KindToggleChip');
    expect(src).toContain('onNavigate={onNavigate}');
  });
});

describe('"Show all" bulk control', () => {
  it('renders Show all button keyed off hiddenKinds.size, and resets on click', () => {
    const src = readSrc('src/client/routes/specification/$id/-structured-list-view.tsx');
    expect(src).toMatch(/hiddenKinds\.size (?:===|>) /);
    expect(src).toContain('Show all');
    expect(src).toContain('data-graph-kind-show-all');
    expect(src).toMatch(/setHiddenKinds\(new Set\(\)\)/);
  });
});

describe('structured-list-view annotatable attributes', () => {
  it('exposes data-annotatable on item content with item-kind and item-id on the row', () => {
    const { container } = render(
      <PatchListProvider specificationId={1} appliers={{ annotate: vi.fn() as never }}>
        <SideChatHost specificationId={1}>
          <StructuredListView entityState={singleItemNoEdges()} />
        </SideChatHost>
      </PatchListProvider>,
    );
    const annotatable = container.querySelector('[data-annotatable]');
    expect(annotatable).not.toBeNull();
    const row = annotatable!.closest('[data-graph-row]') as HTMLElement;
    expect(row).not.toBeNull();
    expect(row.getAttribute('data-graph-row-ref')).toBeTruthy();
    expect(row.getAttribute('data-item-kind')).toBeTruthy();
    expect(row.getAttribute('data-item-id')).toBeTruthy();
  });
});

describe('structured-list-view selection menu', () => {
  it('clicking Annotate after a selection stages a patch with selectionRange', async () => {
    const annotateMock = vi.fn((_patch: Parameters<PatchAppliers['annotate']>[0]) =>
      Promise.resolve({
        undo: () => Promise.resolve(),
        applied: { id: 1, summary: '', body: '' },
      }),
    );
    const appliers = { annotate: annotateMock as unknown as PatchAppliers['annotate'] };

    const { container } = render(
      <PatchListProvider specificationId={1} appliers={appliers}>
        <SideChatHost specificationId={1}>
          <StructuredListView entityState={singleItemNoEdges()} />
        </SideChatHost>
      </PatchListProvider>,
    );

    const annotatable = container.querySelector('[data-annotatable]') as HTMLElement;
    expect(annotatable).not.toBeNull();
    const textNode = annotatable.firstChild!;
    const text = textNode.textContent ?? '';
    const length = Math.min(5, text.length);
    const phrase = text.slice(0, length);

    act(() => {
      const range = document.createRange();
      range.setStart(textNode, 0);
      range.setEnd(textNode, length);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      document.dispatchEvent(new Event('selectionchange'));
    });

    const annotateButton = await screen.findByRole('button', { name: /annotate/i });
    await act(async () => {
      fireEvent.click(annotateButton);
    });

    await vi.waitFor(() => expect(annotateMock).toHaveBeenCalled());
    const patchArg = annotateMock.mock.calls[0]![0];
    expect(patchArg.kind).toBe('annotate');
    expect(patchArg.summary).toBe(phrase);
    expect(patchArg.selectionRange).toEqual({ start: 0, end: length });
  });
});
