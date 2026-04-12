import { describe, expect, it } from 'vitest';

import {
  entitiesDataSchema,
  exportLoaderDataSchema,
  mutationErrorResponseSchema,
  projectListItemSchema,
  projectStateSchema,
  submitTurnResponseRequestSchema,
  submitTurnResponseResponseSchema,
} from './api-types.js';

describe('api transport contracts', () => {
  it('validates the current project-list payload shape', () => {
    expect(
      projectListItemSchema.parse({
        id: 1,
        name: 'Project 1',
        mode: 'greenfield',
        cwd: null,
        active_turn_id: 4,
        created_at: '2026-04-12 10:00:00',
        updated_at: '2026-04-12 10:00:00',
        workflowSummary: {
          scope: 'closed',
          design: 'in_progress',
          requirements: 'unstarted',
          criteria: 'unstarted',
        },
      }),
    ).toMatchObject({
      id: 1,
      name: 'Project 1',
      workflowSummary: {
        scope: 'closed',
        design: 'in_progress',
      },
    });
  });

  it('validates the current project-state payload shape', () => {
    expect(
      projectStateSchema.parse({
        project: {
          id: 1,
          name: 'Project 1',
          mode: 'greenfield',
          cwd: null,
          active_turn_id: 4,
          created_at: '2026-04-12 10:00:00',
          updated_at: '2026-04-12 10:00:00',
        },
        workflow: {
          phases: {
            scope: {
              status: 'closed',
              closeability: true,
              readiness: 'high',
              closureBasis: 'interviewer_recommended',
              proposalPending: false,
              turnId: 3,
              summary: 'Scope is sufficiently captured.',
            },
            design: {
              status: 'in_progress',
              closeability: false,
              readiness: 'medium',
              closureBasis: null,
              proposalPending: false,
              turnId: null,
              summary: null,
            },
            requirements: {
              status: 'unstarted',
              closeability: false,
              readiness: 'low',
              closureBasis: null,
              proposalPending: false,
              turnId: null,
              summary: null,
            },
            criteria: {
              status: 'unstarted',
              closeability: false,
              readiness: 'low',
              closureBasis: null,
              proposalPending: false,
              turnId: null,
              summary: null,
            },
          },
        },
        turns: [
          {
            id: 4,
            project_id: 1,
            parent_turn_id: 3,
            phase: 'design',
            question: 'Which platform should we target?',
            why: 'Platform affects the first release shape.',
            impact: 'high',
            answer: 'Web',
            is_resolution: false,
            user_parts: '[{"type":"text","text":"Web"}]',
            assistant_parts: '[{"type":"text","text":"Which platform should we target?"}]',
            created_at: '2026-04-12 10:00:00',
            options: [
              {
                id: 11,
                position: 0,
                content: 'Web',
                is_recommended: true,
                is_selected: false,
              },
            ],
          },
        ],
      }),
    ).toMatchObject({
      project: { id: 1, name: 'Project 1' },
      workflow: {
        phases: {
          scope: { status: 'closed' },
          design: { status: 'in_progress' },
        },
      },
    });
  });

  it('validates the current entities payload shape', () => {
    expect(
      entitiesDataSchema.parse({
        goals: [
          {
            id: 1,
            project_id: 1,
            kind: 'goal',
            subtype: null,
            content: 'Ship a useful first version',
            rationale: 'The product needs a crisp first release.',
          },
        ],
        terms: [],
        contexts: [],
        constraints: [],
        requirements: [
          {
            id: 2,
            project_id: 1,
            kind: 'requirement',
            subtype: null,
            content: 'Resume interviews after reload',
            rationale: 'Users leave mid-flow',
            reviewStatus: 'approved',
          },
        ],
        criteria: [
          {
            id: 3,
            project_id: 1,
            kind: 'criterion',
            subtype: 'acceptance',
            content: 'Reload restores the active path',
            rationale: 'This proves persistence works',
            reviewStatus: 'pending',
          },
        ],
        decisions: [
          {
            id: 4,
            project_id: 1,
            content: 'Use SQLite for local storage',
            rationale: 'Zero-config first-run matters',
          },
        ],
        assumptions: [
          {
            id: 5,
            project_id: 1,
            content: 'Users can work in a browser',
          },
        ],
        relationships: [
          {
            type: 'depends_on',
            source: { collection: 'decision', kind: 'decision', id: 4 },
            target: { collection: 'assumption', kind: 'assumption', id: 5 },
          },
        ],
      }),
    ).toMatchObject({
      requirements: [{ reviewStatus: 'approved' }],
      criteria: [{ reviewStatus: 'pending' }],
    });
  });

  it('validates the current export and mutation payload shapes', () => {
    expect(exportLoaderDataSchema.parse({ ready: false })).toEqual({ ready: false });
    expect(exportLoaderDataSchema.parse({ ready: true, markdown: '# Reviewed Spec' })).toEqual({
      ready: true,
      markdown: '# Reviewed Spec',
    });
    expect(mutationErrorResponseSchema.parse({ error: 'Failed to save response' })).toEqual({
      error: 'Failed to save response',
    });
    expect(submitTurnResponseResponseSchema.parse({ ok: true })).toEqual({ ok: true });
  });

  it('models turn responses through explicit request modes', () => {
    expect(
      submitTurnResponseRequestSchema.parse({
        kind: 'select-options',
        positions: [0, 2],
        freeText: 'Covers both launch paths',
      }),
    ).toEqual({
      kind: 'select-options',
      positions: [0, 2],
      freeText: 'Covers both launch paths',
    });
    expect(
      submitTurnResponseRequestSchema.parse({
        kind: 'free-text',
        freeText: 'None of these fit',
      }),
    ).toEqual({
      kind: 'free-text',
      freeText: 'None of these fit',
    });
    expect(() => submitTurnResponseRequestSchema.parse({ positions: [0, 2] })).toThrow();
    expect(() => submitTurnResponseRequestSchema.parse({ kind: 'free-text' })).toThrow();
  });
});
