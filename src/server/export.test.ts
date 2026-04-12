import { describe, expect, it } from 'vitest';

import type { EntitiesData } from '../shared/api-types.js';
import type { WorkflowState } from './db.js';
import { renderExportMarkdown } from './export.js';

function createClosedPhase({
  basis = 'interviewer_recommended',
  readiness = 'high',
}: {
  basis?: string;
  readiness?: 'low' | 'medium' | 'high';
} = {}) {
  return {
    status: 'closed' as const,
    closeability: true,
    readiness,
    closureBasis: basis,
    proposalPending: false,
    turnId: 1,
    summary: 'Phase completed.',
  };
}

function createAllClosedWorkflow(overrides?: Partial<Record<string, unknown>>): WorkflowState {
  return {
    phases: {
      scope: createClosedPhase(),
      design: createClosedPhase(),
      requirements: createClosedPhase(),
      criteria: createClosedPhase(),
      ...overrides,
    },
  } as WorkflowState;
}

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

describe('renderExportMarkdown', () => {
  it('renders kind-grouped sections from entities', () => {
    const entities: EntitiesData = {
      ...emptyEntities,
      goals: [{ id: 1, project_id: 1, kind: 'goal', subtype: null, content: 'Ship MVP', rationale: null }],
      requirements: [
        {
          id: 2,
          project_id: 1,
          kind: 'requirement',
          subtype: null,
          content: 'Resume from SQLite',
          rationale: null,
          reviewStatus: 'approved',
        },
      ],
      decisions: [{ id: 3, project_id: 1, content: 'Use SQLite', rationale: 'Zero config' }],
    };

    const md = renderExportMarkdown('Test Project', entities, createAllClosedWorkflow());

    expect(md).toContain('# Test Project');
    expect(md).toContain('## Goals');
    expect(md).toContain('Ship MVP');
    expect(md).toContain('## Requirements');
    expect(md).toContain('Resume from SQLite');
    expect(md).toContain('## Decisions');
    expect(md).toContain('Use SQLite');
  });

  it('omits empty kind sections', () => {
    const entities: EntitiesData = {
      ...emptyEntities,
      goals: [{ id: 1, project_id: 1, kind: 'goal', subtype: null, content: 'Ship MVP', rationale: null }],
    };

    const md = renderExportMarkdown('Test', entities, createAllClosedWorkflow());

    expect(md).toContain('## Goals');
    expect(md).not.toContain('## Terms');
    expect(md).not.toContain('## Requirements');
  });

  it('includes closure caveats for forced-close phases', () => {
    const workflow = createAllClosedWorkflow({
      design: createClosedPhase({ basis: 'user_forced' }),
    });

    const md = renderExportMarkdown('Test', emptyEntities, workflow);

    expect(md).toContain('design');
    expect(md).toContain('user-forced');
  });

  it('renders only approved reviewed items in the export body', () => {
    const entities: EntitiesData = {
      ...emptyEntities,
      requirements: [
        {
          id: 1,
          project_id: 1,
          kind: 'requirement',
          subtype: null,
          content: 'Export spec',
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
          content: 'CSV export',
          rationale: null,
          reviewStatus: 'pending',
        },
      ],
      criteria: [
        {
          id: 4,
          project_id: 1,
          kind: 'criterion',
          subtype: null,
          content: 'Reload shows the active interview state',
          rationale: null,
          reviewStatus: 'approved',
        },
        {
          id: 5,
          project_id: 1,
          kind: 'criterion',
          subtype: null,
          content: 'PDF download works offline',
          rationale: null,
          reviewStatus: 'rejected',
        },
      ],
    };

    const md = renderExportMarkdown('Test', entities, createAllClosedWorkflow());

    expect(md).toContain('Export spec');
    expect(md).toContain('Reload shows the active interview state');
    expect(md).not.toContain('PDF export');
    expect(md).not.toContain('CSV export');
    expect(md).not.toContain('PDF download works offline');
    expect(md).not.toMatch(/\bapproved\b/i);
    expect(md).not.toMatch(/\brejected\b/i);
  });

  it('includes closure caveats for low-readiness phases', () => {
    const workflow = createAllClosedWorkflow({
      design: createClosedPhase({ readiness: 'low' }),
    });

    const md = renderExportMarkdown('Test', emptyEntities, workflow);

    expect(md).toContain('design');
    expect(md).toContain('low readiness');
  });
});
