import { describe, expect, it } from 'vitest';

import {
  createProjectRequestSchema,
  criterionEntitySchema,
  entitiesDataSchema,
  exportLoaderDataSchema,
  mutationErrorResponseSchema,
  projectListItemSchema,
  projectStateSchema,
  requirementEntitySchema,
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
            turn_kind: 'question',
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

  it('accepts the full persisted edge relation vocabulary in entity payloads', () => {
    expect(
      entitiesDataSchema.parse({
        goals: [
          {
            id: 1,
            project_id: 1,
            kind: 'goal',
            subtype: null,
            content: 'Ship a useful first version',
            rationale: null,
          },
        ],
        terms: [
          {
            id: 2,
            project_id: 1,
            kind: 'term',
            subtype: null,
            content: 'ticket',
            rationale: null,
          },
        ],
        contexts: [
          {
            id: 3,
            project_id: 1,
            kind: 'context',
            subtype: null,
            content: 'The team currently works from a spreadsheet',
            rationale: null,
          },
        ],
        constraints: [
          {
            id: 4,
            project_id: 1,
            kind: 'constraint',
            subtype: null,
            content: 'Keep the first release simpler than Jira',
            rationale: null,
          },
        ],
        requirements: [],
        criteria: [
          {
            id: 5,
            project_id: 1,
            kind: 'criterion',
            subtype: null,
            content: 'Export reflects the trusted graph state',
            rationale: null,
            reviewStatus: 'pending',
          },
        ],
        decisions: [],
        assumptions: [],
        relationships: [
          {
            type: 'depends_on',
            source: { collection: 'knowledge_item', kind: 'term', id: 2 },
            target: { collection: 'knowledge_item', kind: 'context', id: 3 },
          },
          {
            type: 'derived_from',
            source: { collection: 'knowledge_item', kind: 'context', id: 3 },
            target: { collection: 'knowledge_item', kind: 'goal', id: 1 },
          },
          {
            type: 'constrains',
            source: { collection: 'knowledge_item', kind: 'constraint', id: 4 },
            target: { collection: 'knowledge_item', kind: 'goal', id: 1 },
          },
          {
            type: 'verifies',
            source: { collection: 'knowledge_item', kind: 'criterion', id: 5 },
            target: { collection: 'knowledge_item', kind: 'goal', id: 1 },
          },
          {
            type: 'refines',
            source: { collection: 'knowledge_item', kind: 'criterion', id: 5 },
            target: { collection: 'knowledge_item', kind: 'term', id: 2 },
          },
        ],
      }),
    ).toBeTruthy();
  });

  it('validates the current export and mutation payload shapes', () => {
    expect(exportLoaderDataSchema.parse({ ready: false })).toEqual({ ready: false });
    expect(exportLoaderDataSchema.parse({ ready: true, markdown: '# Reviewed Spec' })).toEqual({
      ready: true,
      markdown: '# Reviewed Spec',
    });
    expect(() => exportLoaderDataSchema.parse({ ready: true })).toThrow();
    expect(mutationErrorResponseSchema.parse({ error: 'Failed to save response' })).toEqual({
      error: 'Failed to save response',
    });
    expect(submitTurnResponseResponseSchema.parse({ ok: true })).toEqual({ ok: true });
    expect(submitTurnResponseResponseSchema.parse({ ok: true, advancedToPhase: 'criteria' })).toEqual({
      ok: true,
      advancedToPhase: 'criteria',
    });
    expect(submitTurnResponseResponseSchema.parse({ ok: true, workflowCompleted: true })).toEqual({
      ok: true,
      workflowCompleted: true,
    });
  });

  it('rejects mismatched requirement and criterion kinds', () => {
    expect(() =>
      requirementEntitySchema.parse({
        id: 2,
        project_id: 1,
        kind: 'goal',
        subtype: null,
        content: 'This should not be a requirement',
        rationale: null,
      }),
    ).toThrow();

    expect(() =>
      criterionEntitySchema.parse({
        id: 3,
        project_id: 1,
        kind: 'constraint',
        subtype: null,
        content: 'This should not be a criterion',
        rationale: null,
      }),
    ).toThrow();
  });

  it('keeps create-project transport limited to client-authorable fields', () => {
    expect(createProjectRequestSchema.parse({ name: 'Brunch', mode: 'brownfield' })).toEqual({
      name: 'Brunch',
      mode: 'brownfield',
    });
    expect(() =>
      createProjectRequestSchema.parse({ name: 'Brunch', mode: 'brownfield', cwd: '/tmp/repo' }),
    ).toThrow();
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
        kind: 'select-options',
        positions: [0],
        reviewAction: 'accept',
      }),
    ).toEqual({
      kind: 'select-options',
      positions: [0],
      reviewAction: 'accept',
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
