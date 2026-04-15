// @vitest-environment happy-dom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { EntitySidebar } from './EntitySidebar.js';

afterEach(() => {
  cleanup();
});

describe('EntitySidebar', () => {
  it('renders explicit approved, rejected, and pending badges for requirements', () => {
    render(
      <EntitySidebar
        entityState={{
          goals: [],
          terms: [],
          contexts: [],
          constraints: [],
          requirements: [
            {
              id: 3,
              project_id: 1,
              kind: 'requirement',
              subtype: null,
              content: 'Export the reviewed spec',
              rationale: null,
              reviewStatus: 'approved',
              referenceCode: 'R1',
            },
            {
              id: 4,
              project_id: 1,
              kind: 'requirement',
              subtype: null,
              content: 'Support exporting the spec as a PDF',
              rationale: null,
              reviewStatus: 'rejected',
              referenceCode: 'R2',
            },
            {
              id: 5,
              project_id: 1,
              kind: 'requirement',
              subtype: null,
              content: 'Resume the interview from SQLite after restart',
              rationale: null,
              reviewStatus: 'pending',
              referenceCode: 'R3',
            },
          ],
          criteria: [],
          decisions: [],
          assumptions: [],
          relationships: [],
        }}
      />,
    );

    // KnowledgeDetailCard renders itemLabel(kind, id) — R3, R4, R5
    expect(screen.getByText('R3')).toBeTruthy();
    expect(screen.getByText('R4')).toBeTruthy();
    expect(screen.getByText('R5')).toBeTruthy();
    expect(screen.getByText('Export the reviewed spec')).toBeTruthy();
    expect(screen.getByText('Support exporting the spec as a PDF')).toBeTruthy();
    expect(screen.getByText('Resume the interview from SQLite after restart')).toBeTruthy();
  });

  it('renders all knowledge groups in a single scrollable list', () => {
    render(
      <EntitySidebar
        entityState={{
          goals: [
            {
              id: 8,
              project_id: 1,
              kind: 'goal',
              subtype: null,
              content: 'Ship a faithful active-path export',
              rationale: null,
            },
          ],
          terms: [],
          contexts: [],
          constraints: [],
          requirements: [],
          criteria: [],
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
          relationships: [],
        }}
      />,
    );

    // All groups visible without tab switching — labels are itemLabel(kind, id)
    expect(screen.getByText('Ship a faithful active-path export')).toBeTruthy();
    expect(screen.getByText('D6')).toBeTruthy();
    expect(screen.getByText('Use the active-path entity projection for routed state')).toBeTruthy();
    expect(screen.getByText('A7')).toBeTruthy();
    expect(screen.getByText('Users only trust the current branch state')).toBeTruthy();

    // Header shows totals
    expect(screen.getByText('Knowledge Graph')).toBeTruthy();
  });
});
