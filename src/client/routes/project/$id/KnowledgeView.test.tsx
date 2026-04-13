// @vitest-environment happy-dom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { vi } from 'vitest';

import type { EntitiesData } from '@/shared/api-types.js';

import { KnowledgeView, KnowledgeViewContent } from './-knowledge-view.js';

let currentLoaderData: { entitySnapshot: EntitiesData };

function buildHref(to?: string, params?: Record<string, string>) {
  if (!to) {
    return undefined;
  }

  return Object.entries(params ?? {}).reduce((path, [key, value]) => path.replace(`$${key}`, value), to);
}

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    to?: string;
    params?: Record<string, string>;
  }) => (
    <a href={buildHref(to, params)} {...props}>
      {children}
    </a>
  ),
  getRouteApi: () => ({
    useLoaderData: () => currentLoaderData,
    useParams: () => ({ id: '1' }),
  }),
}));

afterEach(() => {
  cleanup();
});

const emptyEntities: EntitiesData = {
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

afterEach(() => {
  currentLoaderData = {
    entitySnapshot: emptyEntities,
  };
});

describe('KnowledgeViewContent', () => {
  it('renders kind-grouped sections in registry order with labels and counts', () => {
    const entities: EntitiesData = {
      ...emptyEntities,
      goals: [{ id: 1, project_id: 1, kind: 'goal', subtype: null, content: 'Ship MVP', rationale: null }],
      terms: [
        { id: 2, project_id: 1, kind: 'term', subtype: null, content: 'Brunch', rationale: null },
        { id: 3, project_id: 1, kind: 'term', subtype: null, content: 'Observer', rationale: null },
      ],
    };

    render(<KnowledgeViewContent entities={entities} />);

    expect(screen.getByText('Goals')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('Ship MVP')).toBeTruthy();

    expect(screen.getByText('Terms')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('Brunch')).toBeTruthy();
    expect(screen.getByText('Observer')).toBeTruthy();
  });

  it('shows empty-state copy for kinds with no items', () => {
    render(<KnowledgeViewContent entities={emptyEntities} />);

    expect(screen.getByText("No goals yet. They'll appear as the interview progresses.")).toBeTruthy();
    expect(screen.getByText("No terms yet. They'll appear as the interview progresses.")).toBeTruthy();
  });

  it('renders review-status badges for requirements and criteria', () => {
    const entities: EntitiesData = {
      ...emptyEntities,
      requirements: [
        {
          id: 1,
          project_id: 1,
          kind: 'requirement',
          subtype: null,
          content: 'Export spec as markdown',
          rationale: null,
          reviewStatus: 'approved',
        },
        {
          id: 2,
          project_id: 1,
          kind: 'requirement',
          subtype: null,
          content: 'PDF export',
          rationale: null,
          reviewStatus: 'rejected',
        },
        {
          id: 3,
          project_id: 1,
          kind: 'requirement',
          subtype: null,
          content: 'Resume from SQLite',
          rationale: null,
          reviewStatus: 'pending',
        },
      ],
    };

    render(<KnowledgeViewContent entities={entities} />);

    expect(screen.getByText('Approved')).toBeTruthy();
    expect(screen.getByText('Rejected')).toBeTruthy();
    expect(screen.getByText('Pending')).toBeTruthy();
  });

  it('renders relationship context for items with edges', () => {
    const entities: EntitiesData = {
      ...emptyEntities,
      decisions: [{ id: 1, project_id: 1, content: 'Use SQLite', rationale: null }],
      assumptions: [{ id: 2, project_id: 1, content: 'Single-user only' }],
      relationships: [
        {
          type: 'depends_on',
          source: { collection: 'decision', kind: 'decision', id: 1 },
          target: { collection: 'assumption', kind: 'assumption', id: 2 },
        },
      ],
    };

    render(<KnowledgeViewContent entities={entities} />);

    expect(screen.getAllByText('Use SQLite').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Depends on')).toBeTruthy();
    // "Single-user only" appears in both the assumptions section and the dependency list
    expect(screen.getAllByText('Single-user only').length).toBeGreaterThanOrEqual(2);
  });

  it('renders widened relation kinds with direction-aware labels for affected items', () => {
    const entities: EntitiesData = {
      ...emptyEntities,
      goals: [
        {
          id: 1,
          project_id: 1,
          kind: 'goal',
          subtype: null,
          content: 'Keep seeded route state faithful',
          rationale: null,
        },
      ],
      contexts: [
        {
          id: 2,
          project_id: 1,
          kind: 'context',
          subtype: null,
          content: 'The fixture graph is richer than the current sidebar summary',
          rationale: null,
        },
      ],
      constraints: [
        {
          id: 3,
          project_id: 1,
          kind: 'constraint',
          subtype: 'non-goal',
          content: 'Do not blur active-path and project-wide reads',
          rationale: null,
        },
      ],
      requirements: [
        {
          id: 4,
          project_id: 1,
          kind: 'requirement',
          subtype: null,
          content: 'Render knowledge edges without collapsing them to dependencies',
          rationale: null,
          reviewStatus: 'pending',
        },
      ],
      criteria: [
        {
          id: 5,
          project_id: 1,
          kind: 'criterion',
          subtype: 'acceptance',
          content: 'The knowledge workspace shows the full persisted edge vocabulary',
          rationale: null,
          reviewStatus: 'pending',
        },
      ],
      relationships: [
        {
          type: 'derived_from',
          source: { collection: 'knowledge_item', kind: 'context', id: 2 },
          target: { collection: 'knowledge_item', kind: 'goal', id: 1 },
        },
        {
          type: 'constrains',
          source: { collection: 'knowledge_item', kind: 'constraint', id: 3 },
          target: { collection: 'knowledge_item', kind: 'goal', id: 1 },
        },
        {
          type: 'refines',
          source: { collection: 'knowledge_item', kind: 'requirement', id: 4 },
          target: { collection: 'knowledge_item', kind: 'goal', id: 1 },
        },
        {
          type: 'verifies',
          source: { collection: 'knowledge_item', kind: 'criterion', id: 5 },
          target: { collection: 'knowledge_item', kind: 'requirement', id: 4 },
        },
      ],
    };

    render(<KnowledgeViewContent entities={entities} />);

    expect(screen.getByText('Constrained by')).toBeTruthy();
    expect(
      screen.getAllByText('Do not blur active-path and project-wide reads').length,
    ).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Basis for')).toBeTruthy();
    expect(
      screen.getAllByText('The fixture graph is richer than the current sidebar summary').length,
    ).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Refined by')).toBeTruthy();
    expect(
      screen.getAllByText('Render knowledge edges without collapsing them to dependencies').length,
    ).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Verified by')).toBeTruthy();
    expect(
      screen.getAllByText('The knowledge workspace shows the full persisted edge vocabulary').length,
    ).toBeGreaterThanOrEqual(2);
  });
});

describe('KnowledgeView', () => {
  it('renders route-level heading, navigation, and loader-backed content', () => {
    currentLoaderData = {
      entitySnapshot: {
        ...emptyEntities,
        goals: [{ id: 1, project_id: 1, kind: 'goal', subtype: null, content: 'Ship MVP', rationale: null }],
      },
    };

    render(<KnowledgeView />);

    expect(screen.getByRole('heading', { name: 'Knowledge' })).toBeTruthy();
    expect(screen.getByRole('link', { name: '← Back to interview' }).getAttribute('href')).toBe('/project/1');
    expect(screen.getByText('Review captured knowledge items and relationships.')).toBeTruthy();
    expect(screen.getByText('Ship MVP')).toBeTruthy();
  });
});
