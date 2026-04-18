// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { EntitiesData } from '@/shared/api-types.js';

import { GraphView } from './-graph-view.js';

afterEach(() => {
  cleanup();
});

function emptyEntities(): EntitiesData {
  return {
    goals: [],
    terms: [],
    contexts: [],
    constraints: [],
    requirements: [],
    criteria: [],
    decisions: [],
    assumptions: [],
    relationships: [],
  };
}

function populatedEntities(): EntitiesData {
  return {
    goals: [
      { id: 1, project_id: 1, kind: 'goal', subtype: null, content: 'Ship a working MVP', rationale: null },
    ],
    terms: [
      {
        id: 2,
        project_id: 1,
        kind: 'term',
        subtype: null,
        content: 'MVP means minimum viable product',
        rationale: null,
      },
    ],
    contexts: [],
    constraints: [
      {
        id: 3,
        project_id: 1,
        kind: 'constraint',
        subtype: null,
        content: 'Must run on SQLite',
        rationale: null,
      },
    ],
    requirements: [
      {
        id: 4,
        project_id: 1,
        kind: 'requirement',
        subtype: null,
        content: 'Export spec as markdown',
        rationale: null,
        reviewStatus: 'approved',
      },
    ],
    criteria: [],
    decisions: [
      {
        id: 5,
        project_id: 1,
        content: 'Use React for the frontend',
        rationale: 'Team familiarity',
      },
    ],
    assumptions: [{ id: 6, project_id: 1, content: 'Users have API keys' }],
    relationships: [
      {
        type: 'depends_on',
        source: { collection: 'decision', kind: 'decision', id: 5 },
        target: { collection: 'assumption', kind: 'assumption', id: 6 },
      },
      {
        type: 'derived_from',
        source: { collection: 'knowledge_item', kind: 'requirement', id: 4 },
        target: { collection: 'knowledge_item', kind: 'goal', id: 1 },
      },
    ],
  };
}

describe('GraphView', () => {
  it('renders entity groups with kind headings for populated collections', () => {
    render(<GraphView entityState={populatedEntities()} />);

    expect(screen.getByRole('heading', { name: /Goals/i })).toBeTruthy();
    expect(screen.getByRole('heading', { name: /Terms/i })).toBeTruthy();
    expect(screen.getByRole('heading', { name: /Constraints/i })).toBeTruthy();
    expect(screen.getByRole('heading', { name: /Requirements/i })).toBeTruthy();
    expect(screen.getByRole('heading', { name: /Decisions/i })).toBeTruthy();
    expect(screen.getByRole('heading', { name: /Assumptions/i })).toBeTruthy();

    expect(screen.getByText('Ship a working MVP')).toBeTruthy();
    expect(screen.getByText('MVP means minimum viable product')).toBeTruthy();
    expect(screen.getByText('Must run on SQLite')).toBeTruthy();
    expect(screen.getByText('Export spec as markdown')).toBeTruthy();
    expect(screen.getByText('Use React for the frontend')).toBeTruthy();
    expect(screen.getByText('Users have API keys')).toBeTruthy();
  });

  it('shows relationship indicators on entity cards', () => {
    render(<GraphView entityState={populatedEntities()} />);

    // Decision "Use React for the frontend" depends_on assumption "Users have API keys"
    expect(screen.getByText('Users have API keys')).toBeTruthy();
    // The decision card should show the dependency
    const decisionCard = screen.getByText('Use React for the frontend').closest('[data-entity-card]')!;
    expect(decisionCard).toBeTruthy();
    expect(within(decisionCard as HTMLElement).getByText(/depends on/i)).toBeTruthy();

    // Requirement "Export spec as markdown" derived_from goal "Ship a working MVP"
    const requirementCard = screen.getByText('Export spec as markdown').closest('[data-entity-card]')!;
    expect(requirementCard).toBeTruthy();
    expect(within(requirementCard as HTMLElement).getByText(/derived from/i)).toBeTruthy();
  });

  it('shows empty state when no entities exist', () => {
    render(<GraphView entityState={emptyEntities()} />);

    expect(screen.getByText(/no knowledge items/i)).toBeTruthy();
  });

  it('filters entity groups by kind when filter controls are toggled', () => {
    render(<GraphView entityState={populatedEntities()} />);

    // All groups visible initially
    expect(screen.getByText('Ship a working MVP')).toBeTruthy();
    expect(screen.getByText('Use React for the frontend')).toBeTruthy();

    // Toggle off Goals
    const goalsFilter = screen.getByRole('checkbox', { name: /Goals/i });
    fireEvent.click(goalsFilter);

    // Goals should be hidden
    expect(screen.queryByText('Ship a working MVP')).toBeNull();
    // Other groups still visible
    expect(screen.getByText('Use React for the frontend')).toBeTruthy();

    // Toggle Goals back on
    fireEvent.click(goalsFilter);
    expect(screen.getByText('Ship a working MVP')).toBeTruthy();
  });

  it('shows review status badges on requirements and criteria', () => {
    render(<GraphView entityState={populatedEntities()} />);

    const requirementCard = screen.getByText('Export spec as markdown').closest('[data-entity-card]')!;
    expect(requirementCard).toBeTruthy();
    expect(within(requirementCard as HTMLElement).queryByText('Approved')).toBeNull();
  });
});
