import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { formatTurnResponseText } from '@/shared/chat.js';

import { loadActivePathWithOptions } from '../core.js';
import { createDb, type DB } from '../db.js';
import { deserializeAssistantParts } from '../parts.js';
import { formatProjectedTurnResponse, projectTurnResponse } from '../turn-response.js';
import { buildManifestScenarioCatalog, seedFromManifest, type ManifestScenario } from './manifest.js';

let db: DB;

beforeEach(() => {
  db = createDb();
});

afterEach(() => {
  db.$client.close();
});

describe('seedFromManifest', () => {
  it('persists selected option ids and explicit reviewAction in user_parts so seeded turns rehydrate with semantic intent', () => {
    const scenario: ManifestScenario = {
      turns: [
        {
          phase: 'requirements',
          question: 'Please review the current requirement set.',
          why: 'The fixture should preserve the selected option text after reload.',
          impact: 'high',
          answer: 'Ship this set',
          options: [
            { content: 'Ship this set', is_recommended: true },
            { content: 'Revise this set', is_recommended: false },
          ],
          selectedOptionPositions: [0],
          reviewAction: 'accept',
        },
      ],
      knowledgeItems: [],
      edges: [],
    };

    const projectId = seedFromManifest(db, scenario, 'Manifest Seed');
    const turn = loadActivePathWithOptions(db, projectId)[0]!;
    const projectedResponse = projectTurnResponse(turn);

    expect(projectedResponse).toEqual({
      selectedOptionIds: [turn.options![0]!.id],
      selectedOptionContents: ['Ship this set'],
      reviewAction: 'accept',
      freeText: undefined,
    });
    expect(formatProjectedTurnResponse(projectedResponse!)).toContain('Chosen options: Ship this set');
    expect(turn.answer).toBe(
      formatTurnResponseText({
        selectedOptionContents: ['Ship this set'],
      }),
    );
  });
  it('patches assistant parts to match the live persisted contracts for questions and phase proposals', () => {
    const scenario: ManifestScenario = {
      turns: [
        {
          phase: 'scope',
          question: 'Which launch surface should we prioritize?',
          answer: 'Start with the web workspace.',
          options: [
            { content: 'CLI-first workflow', is_recommended: false },
            { content: 'Web workspace', is_recommended: true },
          ],
          selectedOptionPositions: [1],
        },
        {
          phase: 'scope',
          question: '',
          answer: 'We have enough scope context to move into design.',
          isProposal: true,
        },
        {
          phase: 'scope',
          question: '',
          answer: 'Confirm grounding closure',
          isConfirmation: true,
        },
      ],
      knowledgeItems: [
        {
          kind: 'goal',
          content: 'Launch the first version in the web workspace',
          capturedAtTurn: 0,
        },
      ],
      edges: [],
    };

    const projectId = seedFromManifest(db, scenario, 'Manifest Runtime Shape');
    const turns = loadActivePathWithOptions(db, projectId);
    expect(turns).toHaveLength(3);

    const questionTurn = turns[0]!;
    const proposalTurn = turns[1]!;

    const questionParts = deserializeAssistantParts(questionTurn.assistant_parts ?? '[]');
    expect(questionParts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'tool-ask_question',
          output: {
            ok: true,
            turnId: questionTurn.id,
            optionCount: 2,
          },
        }),
        expect.objectContaining({
          type: 'data-observer-result',
          data: expect.objectContaining({
            entityIds: expect.objectContaining({
              goals: expect.arrayContaining([expect.any(Number)]),
            }),
          }),
        }),
      ]),
    );

    const proposalParts = deserializeAssistantParts(proposalTurn.assistant_parts ?? '[]');
    expect(proposalParts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'tool-propose_phase_closure',
          output: {
            ok: true,
            turnId: proposalTurn.id,
            phase: 'scope',
          },
        }),
        {
          type: 'data-phase-summary',
          data: {
            turnId: proposalTurn.id,
            phase: 'scope',
            summary: 'We have enough scope context to move into design.',
          },
        },
      ]),
    );
  });

  it('fails fast when a turn selects an option position that does not exist', () => {
    const scenario: ManifestScenario = {
      turns: [
        {
          phase: 'scope',
          question: 'Which launch surface should we prioritize?',
          answer: 'Start with the web workspace.',
          options: [{ content: 'Web workspace', is_recommended: true }],
          selectedOptionPositions: [1],
        },
      ],
      knowledgeItems: [],
      edges: [],
    };

    expect(() => seedFromManifest(db, scenario, 'Broken Manifest Seed')).toThrow(
      /selected option position 1 is out of range/i,
    );
  });

  it('persists explicit frontier turn kinds and unanswered question frontiers', () => {
    const scenario: ManifestScenario = {
      turns: [
        {
          phase: 'scope',
          turnKind: 'kickoff',
          question: '',
          answer: null,
        },
        {
          phase: 'scope',
          question: 'Which launch surface should we prioritize?',
          why: 'The fixture should preserve an unresolved question frontier.',
          impact: 'high',
          answer: null,
          options: [
            { content: 'CLI-first workflow', is_recommended: false },
            { content: 'Web workspace', is_recommended: true },
          ],
        },
      ],
      knowledgeItems: [],
      edges: [],
    };

    const projectId = seedFromManifest(db, scenario, 'Frontier Seed');
    const turns = loadActivePathWithOptions(db, projectId);

    expect(turns[0]).toMatchObject({ turn_kind: 'kickoff', answer: null, question: '' });
    expect(turns[1]).toMatchObject({ turn_kind: 'question', answer: null });
    expect(turns[1]?.options).toHaveLength(2);
    expect(projectTurnResponse(turns[1]!)).toBeNull();
  });

  it('fails fast when a confirmation turn has no matching proposal for its phase', () => {
    const scenario: ManifestScenario = {
      turns: [
        {
          phase: 'scope',
          question: 'Which launch surface should we prioritize?',
          answer: 'Start with the web workspace.',
          options: [{ content: 'Web workspace', is_recommended: true }],
        },
        {
          phase: 'design',
          question: '',
          answer: 'Confirm elicitation closure',
          isConfirmation: true,
        },
      ],
      knowledgeItems: [],
      edges: [],
    };

    expect(() => seedFromManifest(db, scenario, 'Broken Confirmation Seed')).toThrow(
      /no preceding proposal turn/i,
    );
  });

  it('fails fast while loading a manifest catalog when scenarios contain dangling turn references', () => {
    expect(() =>
      buildManifestScenarioCatalog('broken', {
        name: 'Broken Catalog',
        description: 'Fixture used to verify fail-fast manifest compilation.',
        scenarios: {
          broken: {
            turns: [
              {
                phase: 'scope',
                question: 'Which launch surface should we prioritize?',
                answer: 'Start with the web workspace.',
                options: [{ content: 'Web workspace', is_recommended: true }],
              },
            ],
            knowledgeItems: [
              {
                kind: 'goal',
                content: 'Launch the first version in the web workspace',
                capturedAtTurn: 1,
              },
            ],
            edges: [],
          },
        },
      }),
    ).toThrow(/capturedAtTurn 1/i);
  });
});
