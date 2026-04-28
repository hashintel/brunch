// @vitest-environment happy-dom

import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  activePathDivergence,
  crossPhaseDecisionLink,
  denseGoalAnchor,
  emptySpec,
  singleItemNoEdges,
} from '@/client/__fixtures__/graph-view.js';

import { StructuredListView } from '../-structured-list-view.js';

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
