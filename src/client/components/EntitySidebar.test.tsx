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
});
