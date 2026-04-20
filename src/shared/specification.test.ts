import { describe, expect, it } from 'vitest';

import {
  createProjectRequestSchema,
  createProjectResponseSchema,
  projectListItemSchema,
  projectStateSchema,
} from './api-types.js';
import {
  createSpecificationRequestSchema,
  createSpecificationResponseSchema,
  specificationListItemSchema,
  specificationSchema,
  specificationStateSchema,
} from './specification.js';

describe('specification boundary aliases', () => {
  it('keeps specification-facing schemas as aliases of the legacy project contracts', () => {
    expect(createSpecificationRequestSchema).toBe(createProjectRequestSchema);
    expect(createSpecificationResponseSchema).toBe(createProjectResponseSchema);
    expect(specificationListItemSchema).toBe(projectListItemSchema);
    expect(specificationStateSchema).toBe(projectStateSchema);
  });

  it('parses existing project-shaped transport payloads through the specification boundary', () => {
    expect(
      specificationSchema.parse({
        id: 1,
        name: 'Specification Alpha',
        mode: 'greenfield',
        active_turn_id: 3,
        created_at: '2026-04-20 10:00:00',
        updated_at: '2026-04-20 10:05:00',
      }),
    ).toMatchObject({
      id: 1,
      name: 'Specification Alpha',
    });

    expect(
      specificationStateSchema.parse({
        project: {
          id: 1,
          name: 'Specification Alpha',
          mode: 'greenfield',
          active_turn_id: 3,
          created_at: '2026-04-20 10:00:00',
          updated_at: '2026-04-20 10:05:00',
        },
        workflow: {
          phases: {
            scope: {
              status: 'closed',
              closeability: true,
              readiness: 'high',
              closureBasis: 'interviewer_recommended',
              proposalPending: false,
              turnId: 2,
              summary: 'Grounding complete.',
            },
            design: {
              status: 'in_progress',
              closeability: false,
              readiness: 'medium',
              closureBasis: null,
              proposalPending: false,
              turnId: 3,
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
        landing: { kind: 'frontier-turn', phase: 'design', turnId: 3 },
        turns: [
          {
            id: 3,
            project_id: 1,
            parent_turn_id: 2,
            phase: 'design',
            question: 'What architecture should we choose?',
            why: 'This determines implementation shape.',
            impact: 'high',
            answer: null,
            is_resolution: false,
            user_parts: null,
            assistant_parts: null,
            created_at: '2026-04-20 10:05:00',
          },
        ],
      }),
    ).toMatchObject({
      project: { name: 'Specification Alpha' },
      workflow: { phases: { design: { status: 'in_progress' } } },
    });
  });
});
