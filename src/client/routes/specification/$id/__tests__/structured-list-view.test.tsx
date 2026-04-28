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
    expect(screen.queryByText(/outgoing/i)).toBeNull();
    expect(screen.queryByText(/incoming/i)).toBeNull();
  });

  it('renders the empty placeholder gracefully when there are no knowledge items', () => {
    const { container } = render(<StructuredListView entityState={emptySpec()} />);
    expect(container.querySelector('[data-graph-structured-list]')).toBeTruthy();
    expect(container.querySelectorAll('[data-graph-row]')).toHaveLength(0);
  });

  it('groups items by knowledge display group and renders each section header', () => {
    render(<StructuredListView entityState={crossPhaseDecisionLink()} />);

    expect(screen.getByText('Goals & Context')).toBeTruthy();
    expect(screen.getByText('Assumptions & Decisions')).toBeTruthy();
    expect(screen.getByText('Requirements')).toBeTruthy();
  });

  it('renders Outgoing and Incoming subsections in the relations footer when an item has edges', () => {
    const { container } = render(<StructuredListView entityState={crossPhaseDecisionLink()} />);

    const decisionRow = container.querySelector('[data-graph-row-ref="D1"]');
    expect(decisionRow).toBeTruthy();
    if (!decisionRow) return;

    expect(within(decisionRow as HTMLElement).getByText('Outgoing')).toBeTruthy();
    expect(within(decisionRow as HTMLElement).getByText('Incoming')).toBeTruthy();
  });

  it('shows relation chips with the target reference code and content snippet', () => {
    const { container } = render(<StructuredListView entityState={crossPhaseDecisionLink()} />);

    const decisionRow = container.querySelector('[data-graph-row-ref="D1"]');
    expect(decisionRow).toBeTruthy();
    if (!decisionRow) return;

    const decisionScope = within(decisionRow as HTMLElement);

    // Outgoing edge: decision refines goal G1
    expect(decisionScope.getByText('refines')).toBeTruthy();
    expect(decisionScope.getByText('G1')).toBeTruthy();
    expect(decisionScope.getByText(/Reduce signup drop-off/)).toBeTruthy();

    // Incoming edge: requirement R1 derives_from this decision
    expect(decisionScope.getByText('derived_from')).toBeTruthy();
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

  it('renders an outgoing relation chip per edge for a densely connected anchor (no soft-truncate yet)', () => {
    const { container } = render(<StructuredListView entityState={denseGoalAnchor()} />);

    const goalRow = container.querySelector('[data-graph-row-ref="G1"]');
    expect(goalRow).toBeTruthy();
    if (!goalRow) return;

    const goalScope = within(goalRow as HTMLElement);
    // Goal is the target of 15 incoming `refines` edges
    expect(goalScope.getByText('Incoming')).toBeTruthy();
    const chips = goalScope.queryAllByTestId('relation-chip');
    expect(chips.length).toBe(15);
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
