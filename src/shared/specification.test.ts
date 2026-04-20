import { describe, expect, it } from 'vitest';

import {
  createProjectRequestSchema,
  createProjectResponseSchema,
  projectListItemSchema,
} from './api-types.js';
import {
  createSpecificationRequestSchema,
  createSpecificationResponseSchema,
  specificationListItemSchema,
  specificationSchema,
  specificationStateSchema,
  specificationTurnSchema,
} from './specification.js';

describe('specification boundary aliases', () => {
  it('keeps create/list schemas aligned with the legacy project contracts where no project-shaped fields leak', () => {
    expect(createSpecificationRequestSchema).toBe(createProjectRequestSchema);
    expect(createSpecificationResponseSchema).toBe(createProjectResponseSchema);
    expect(specificationListItemSchema).toBe(projectListItemSchema);
  });

  it('normalizes existing project-shaped state payloads into canonical specification-shaped output', () => {
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
            grounding: {
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
      specification: { name: 'Specification Alpha' },
      workflow: { phases: { design: { status: 'in_progress' } } },
      turns: [
        {
          specification_id: 1,
          parent_turn_id: 2,
          phase: 'design',
        },
      ],
    });
  });

  it('accepts canonical specification-shaped turn payloads directly', () => {
    expect(
      specificationTurnSchema.parse({
        id: 3,
        specification_id: 1,
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
      }),
    ).toMatchObject({
      specification_id: 1,
      phase: 'design',
    });
  });
});
