// @vitest-environment happy-dom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { EntitiesData } from '@/shared/api-types.js';

import { EntitySidebar } from './EntitySidebar.js';

afterEach(() => {
  cleanup();
});

function createEntityState(overrides: Partial<EntitiesData> = {}): EntitiesData {
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
    ...overrides,
  };
}

describe('EntitySidebar', () => {
  it('renders server-owned reference codes for requirements without review badges', () => {
    render(
      <EntitySidebar
        entityState={createEntityState({
          requirements: [
            {
              id: 3,
              project_id: 1,
              kind: 'requirement',
              subtype: null,
              content: 'Export the reviewed spec',
              rationale: null,
              referenceCode: 'R1',
            },
            {
              id: 4,
              project_id: 1,
              kind: 'requirement',
              subtype: null,
              content: 'Support exporting the spec as a PDF',
              rationale: null,
              referenceCode: 'R2',
            },
            {
              id: 5,
              project_id: 1,
              kind: 'requirement',
              subtype: null,
              content: 'Resume the interview from SQLite after restart',
              rationale: null,
              referenceCode: 'R3',
            },
          ],
        })}
      />,
    );

    expect(screen.getByText('R1')).toBeTruthy();
    expect(screen.getByText('R2')).toBeTruthy();
    expect(screen.getByText('R3')).toBeTruthy();
    expect(screen.getByText('Export the reviewed spec')).toBeTruthy();
    expect(screen.getByText('Support exporting the spec as a PDF')).toBeTruthy();
    expect(screen.getByText('Resume the interview from SQLite after restart')).toBeTruthy();
    expect(screen.queryByText('Approved')).toBeNull();
    expect(screen.queryByText('Rejected')).toBeNull();
    expect(screen.queryByText('Pending')).toBeNull();
  });

  it('renders all visible knowledge groups, hides terms, and reports visible totals only', () => {
    render(
      <EntitySidebar
        entityState={createEntityState({
          goals: [
            {
              id: 1,
              project_id: 1,
              kind: 'goal',
              subtype: null,
              content: 'Ship a faithful active-path export',
              rationale: null,
              referenceCode: 'GOAL1',
            },
          ],
          terms: [
            {
              id: 2,
              project_id: 1,
              kind: 'term',
              subtype: null,
              content: 'Invisible term',
              rationale: null,
              referenceCode: 'TERM1',
            },
          ],
          contexts: [
            {
              id: 3,
              project_id: 1,
              kind: 'context',
              subtype: null,
              content: 'Current flow is chat-first',
              rationale: null,
              referenceCode: 'CTX1',
            },
          ],
          requirements: [
            {
              id: 4,
              project_id: 1,
              kind: 'requirement',
              subtype: null,
              content: 'Export must be markdown',
              rationale: null,
              referenceCode: 'R1',
            },
          ],
          criteria: [
            {
              id: 5,
              project_id: 1,
              kind: 'criterion',
              subtype: null,
              content: 'Export reflects approved items only',
              rationale: null,
              referenceCode: 'CRIT1',
            },
          ],
          decisions: [
            {
              id: 6,
              project_id: 1,
              content: 'Use the active-path entity projection for routed state',
              rationale: 'Keeps routed state aligned with export',
              referenceCode: 'D1',
            },
          ],
          assumptions: [
            {
              id: 7,
              project_id: 1,
              content: 'Users only trust the current branch state',
              referenceCode: 'A1',
            },
          ],
        })}
      />,
    );

    expect(screen.getByText('Knowledge Graph')).toBeTruthy();
    expect(screen.getByText('Goals & Context')).toBeTruthy();
    expect(screen.getByText('Assumptions & Decisions')).toBeTruthy();
    expect(screen.getByText('Requirements')).toBeTruthy();
    expect(screen.getByText('Acceptance Criteria')).toBeTruthy();
    expect(screen.queryByText('Invisible term')).toBeNull();
    expect(screen.getByText('Ship a faithful active-path export')).toBeTruthy();
    expect(screen.getByText('Use the active-path entity projection for routed state')).toBeTruthy();
    expect(screen.getByText('Users only trust the current branch state')).toBeTruthy();
    expect(screen.getByText('Export must be markdown')).toBeTruthy();
    expect(screen.getByText('Export reflects approved items only')).toBeTruthy();
    const header = screen.getByText('Knowledge Graph').parentElement?.textContent ?? '';
    expect(header).toContain('6 Items');
    expect(header).toContain('0 Connections');
  });

  it('groups goals, contexts, and constraints together under Goals & Context', () => {
    render(
      <EntitySidebar
        entityState={createEntityState({
          goals: [
            {
              id: 1,
              project_id: 1,
              kind: 'goal',
              subtype: null,
              content: 'Ship something useful',
              rationale: null,
              referenceCode: 'GOAL1',
            },
          ],
          contexts: [
            {
              id: 2,
              project_id: 1,
              kind: 'context',
              subtype: null,
              content: 'Users already work in docs',
              rationale: null,
              referenceCode: 'CTX1',
            },
          ],
          constraints: [
            {
              id: 3,
              project_id: 1,
              kind: 'constraint',
              subtype: null,
              content: 'Keep first run local-first',
              rationale: null,
              referenceCode: 'CST1',
            },
          ],
        })}
      />,
    );

    const goalsAndContextSection = screen.getByText('Goals & Context').closest('section');
    expect(goalsAndContextSection?.textContent).toContain('Ship something useful');
    expect(goalsAndContextSection?.textContent).toContain('Users already work in docs');
    expect(goalsAndContextSection?.textContent).toContain('Keep first run local-first');
  });

  it('shows outgoing edge previews with directionally honest labels and target reference codes', () => {
    render(
      <EntitySidebar
        entityState={createEntityState({
          goals: [
            {
              id: 1,
              project_id: 1,
              kind: 'goal',
              subtype: null,
              content: 'Ship a useful first version',
              rationale: null,
              referenceCode: 'GOAL1',
            },
          ],
          contexts: [
            {
              id: 2,
              project_id: 1,
              kind: 'context',
              subtype: null,
              content: 'The team currently works from a spreadsheet',
              rationale: null,
              referenceCode: 'CTX1',
            },
          ],
          relationships: [
            {
              type: 'derived_from',
              source: { collection: 'knowledge_item', kind: 'goal', id: 1 },
              target: { collection: 'knowledge_item', kind: 'context', id: 2 },
            },
          ],
        })}
      />,
    );

    expect(screen.getByText('Links to:')).toBeTruthy();
    expect(screen.getAllByText('CTX1')).toHaveLength(2);
    const header = screen.getByText('Knowledge Graph').parentElement?.textContent ?? '';
    expect(header).toContain('1 Connections');
  });

  it('does not show edge preview content for items without relationships', () => {
    render(
      <EntitySidebar
        entityState={createEntityState({
          goals: [
            {
              id: 1,
              project_id: 1,
              kind: 'goal',
              subtype: null,
              content: 'Ship a useful first version',
              rationale: null,
              referenceCode: 'GOAL1',
            },
          ],
        })}
      />,
    );

    expect(screen.queryByText('Links to:')).toBeNull();
  });
});
