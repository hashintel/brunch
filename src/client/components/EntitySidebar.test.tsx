// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
            },
            {
              id: 4,
              project_id: 1,
              kind: 'requirement',
              subtype: null,
              content: 'Support exporting the spec as a PDF',
              rationale: null,
              reviewStatus: 'rejected',
            },
            {
              id: 5,
              project_id: 1,
              kind: 'requirement',
              subtype: null,
              content: 'Resume the interview from SQLite after restart',
              rationale: null,
              reviewStatus: 'pending',
            },
          ],
          criteria: [],
          decisions: [],
          assumptions: [],
          relationships: [],
          isLoading: false,
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Requirements/i }));

    expect(screen.getByText('Export the reviewed spec')).toBeTruthy();
    expect(screen.getByText('Support exporting the spec as a PDF')).toBeTruthy();
    expect(screen.getByText('Resume the interview from SQLite after restart')).toBeTruthy();
    expect(screen.getByText('Approved')).toBeTruthy();
    expect(screen.getByText('Rejected')).toBeTruthy();
    expect(screen.getByText('Pending')).toBeTruthy();
  });

  it('keeps dependency summaries explicit when other relation kinds are present', () => {
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
            },
          ],
          assumptions: [{ id: 7, project_id: 1, content: 'Users only trust the current branch state' }],
          relationships: [
            {
              type: 'depends_on',
              source: { collection: 'decision', kind: 'decision', id: 6 },
              target: { collection: 'assumption', kind: 'assumption', id: 7 },
            },
            {
              type: 'refines',
              source: { collection: 'decision', kind: 'decision', id: 6 },
              target: { collection: 'knowledge_item', kind: 'goal', id: 8 },
            },
          ],
          isLoading: false,
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Decisions/i }));

    expect(screen.getByText('Depends on')).toBeTruthy();
    expect(screen.getByText('Users only trust the current branch state')).toBeTruthy();
    expect(screen.queryByText('Refines')).toBeNull();
    expect(screen.queryByText('Ship a faithful active-path export')).toBeNull();
  });
});
