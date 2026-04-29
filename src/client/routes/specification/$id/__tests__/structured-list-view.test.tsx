// @vitest-environment happy-dom

import { act, cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  activePathDivergence,
  crossPhaseDecisionLink,
  denseGoalAnchor,
  emptySpec,
  singleItemNoEdges,
} from '@/client/__fixtures__/graph-view.js';

const mockNavigate = vi.fn();
let mockHash = '';

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ hash: mockHash, pathname: '/specification/1/graph', search: '' }),
}));

import { RelationChipPreview } from '../-relation-chip.js';
import { StructuredListView } from '../-structured-list-view.js';

beforeEach(() => {
  mockNavigate.mockClear();
  mockHash = '';
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
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
        header={<div data-testid="test-header">Header content</div>}
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
        header={<div data-testid="test-header">Header content</div>}
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

  it('groups items by knowledge display group and renders each section header', () => {
    const { container } = render(<StructuredListView entityState={crossPhaseDecisionLink()} />);

    const sections = container.querySelectorAll('[data-graph-section]');
    const sectionLabels = Array.from(sections).map((s) => s.getAttribute('data-graph-section'));
    expect(sectionLabels).toContain('Goals & Context');
    expect(sectionLabels).toContain('Assumptions & Decisions');
    expect(sectionLabels).toContain('Requirements');
  });

  it('renders Links to and Linked from subsections in the relations footer when an item has edges', () => {
    const { container } = render(<StructuredListView entityState={crossPhaseDecisionLink()} />);

    const decisionRow = container.querySelector('[data-graph-row-ref="D1"]');
    expect(decisionRow).toBeTruthy();
    if (!decisionRow) return;

    expect(within(decisionRow as HTMLElement).getByText('Links to')).toBeTruthy();
    expect(within(decisionRow as HTMLElement).getByText('Linked from')).toBeTruthy();
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
    // Goal is the target of 15 incoming `refines` edges, surfaced under "Linked from"
    expect(goalScope.getByText('Linked from')).toBeTruthy();
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
    const scrollSpy = vi.fn();
    Element.prototype.scrollIntoView = scrollSpy;

    const { container } = render(<StructuredListView entityState={crossPhaseDecisionLink()} />);

    const goalRow = container.querySelector('[data-graph-row-ref="G1"]');
    expect(goalRow).toBeTruthy();
    expect(scrollSpy).toHaveBeenCalled();
  });

  it('does not scroll when there is no hash', () => {
    mockHash = '';
    const scrollSpy = vi.fn();
    Element.prototype.scrollIntoView = scrollSpy;

    render(<StructuredListView entityState={crossPhaseDecisionLink()} />);

    expect(scrollSpy).not.toHaveBeenCalled();
  });

  it('does not scroll or highlight when the hash matches no rendered row', () => {
    mockHash = '#NOPE99';
    const scrollSpy = vi.fn();
    Element.prototype.scrollIntoView = scrollSpy;

    const { container } = render(<StructuredListView entityState={crossPhaseDecisionLink()} />);

    expect(scrollSpy).not.toHaveBeenCalled();
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

  it('renders an action rail with a disabled chat-with placeholder on every item row', () => {
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
      expect(chatButton.getAttribute('title')?.toLowerCase()).toContain('coming soon');
      expect(chatButton.getAttribute('aria-label')?.toLowerCase()).toMatch(/chat/);
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
    const decisionSection = container.querySelector('[data-graph-section="Assumptions & Decisions"]');
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
