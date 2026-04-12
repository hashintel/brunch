import { describe, expect, it } from 'vitest';

import type { EntitiesData } from '../shared/api-types.js';
import type { WorkflowState } from './db.js';
import { renderExportMarkdown } from './export.js';

function createClosedPhase(basis: string = 'interviewer_recommended') {
  return {
    status: 'closed' as const,
    closeability: true,
    readiness: 'high' as const,
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
      design: createClosedPhase('user_forced'),
    });

    const md = renderExportMarkdown('Test', emptyEntities, workflow);

    expect(md).toContain('design');
    expect(md).toContain('user-forced');
  });

  it('includes review status for requirements and criteria', () => {
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
      ],
    };

    const md = renderExportMarkdown('Test', entities, createAllClosedWorkflow());

    expect(md).toMatch(/Export spec.*approved/i);
    expect(md).toMatch(/PDF export.*rejected/i);
  });
});
