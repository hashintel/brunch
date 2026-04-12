// @vitest-environment happy-dom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { vi } from 'vitest';

import type { EntitiesData } from '../../shared/api-types.js';
import type { KnowledgeWorkspaceLoaderData } from '../workspace/workspace-loader.js';
import { KnowledgeWorkspace, KnowledgeWorkspaceView } from './KnowledgeWorkspace.js';

let currentLoaderData: KnowledgeWorkspaceLoaderData;

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to?: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useLoaderData: () => currentLoaderData,
  useParams: () => ({ id: '1' }),
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

describe('KnowledgeWorkspaceView', () => {
  it('renders kind-grouped sections in registry order with labels and counts', () => {
    const entities: EntitiesData = {
      ...emptyEntities,
      goals: [{ id: 1, project_id: 1, kind: 'goal', subtype: null, content: 'Ship MVP', rationale: null }],
      terms: [
        { id: 2, project_id: 1, kind: 'term', subtype: null, content: 'Brunch', rationale: null },
        { id: 3, project_id: 1, kind: 'term', subtype: null, content: 'Observer', rationale: null },
      ],
    };

    render(<KnowledgeWorkspaceView entities={entities} />);

    expect(screen.getByText('Goals')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('Ship MVP')).toBeTruthy();

    expect(screen.getByText('Terms')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('Brunch')).toBeTruthy();
    expect(screen.getByText('Observer')).toBeTruthy();
  });

  it('shows empty-state copy for kinds with no items', () => {
    render(<KnowledgeWorkspaceView entities={emptyEntities} />);

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

    render(<KnowledgeWorkspaceView entities={entities} />);

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

    render(<KnowledgeWorkspaceView entities={entities} />);

    expect(screen.getByText('Use SQLite')).toBeTruthy();
    expect(screen.getByText('Depends on')).toBeTruthy();
    // "Single-user only" appears in both the assumptions section and the dependency list
    expect(screen.getAllByText('Single-user only').length).toBeGreaterThanOrEqual(2);
  });
});

describe('KnowledgeWorkspace', () => {
  it('renders route-level heading, navigation, and loader-backed content', () => {
    currentLoaderData = {
      entitySnapshot: {
        ...emptyEntities,
        goals: [{ id: 1, project_id: 1, kind: 'goal', subtype: null, content: 'Ship MVP', rationale: null }],
      },
    };

    render(<KnowledgeWorkspace />);

    expect(screen.getByRole('heading', { name: 'Knowledge' })).toBeTruthy();
    expect(screen.getByRole('link', { name: '← Back to interview' })).toBeTruthy();
    expect(screen.getByText('Review captured knowledge items and relationships.')).toBeTruthy();
    expect(screen.getByText('Ship MVP')).toBeTruthy();
  });
});
