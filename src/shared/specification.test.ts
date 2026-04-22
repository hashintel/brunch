import { describe, expect, it } from 'vitest';

import {
  createSpecificationRequestSchema,
  createSpecificationResponseSchema,
  specificationListItemSchema,
} from './api-types.js';
import {
  getSpecificationRecord,
  specificationSchema,
  specificationStateSchema,
  specificationTurnSchema,
} from './specification.js';

describe('specification boundaries', () => {
  it('exposes the canonical create/list schemas', () => {
    expect(
      createSpecificationRequestSchema.parse({ name: 'Specification Alpha', mode: 'greenfield' }),
    ).toEqual({
      name: 'Specification Alpha',
      mode: 'greenfield',
    });
    expect(createSpecificationResponseSchema).toBe(specificationSchema);
    expect(specificationListItemSchema.shape.workflowSummary).toBeDefined();
  });

  it('accepts canonical specification-shaped state payloads', () => {
    const parsed = specificationStateSchema.parse({
      specification: {
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
        },
      ],
    });

    expect(getSpecificationRecord(parsed).name).toBe('Specification Alpha');
    expect(parsed.turns[0]).toMatchObject({
      specification_id: 1,
      parent_turn_id: 2,
      phase: 'design',
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
