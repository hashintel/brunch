import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { loadActivePathWithOptions } from '../core.js';
import { createDb, type DB } from '../db.js';
import { formatProjectedTurnResponse, projectTurnResponse } from '../turn-response.js';
import { seedFromManifest, type ManifestScenario } from './manifest.js';

let db: DB;

beforeEach(() => {
  db = createDb();
});

afterEach(() => {
  db.$client.close();
});

describe('seedFromManifest', () => {
  it('persists selected option ids in user_parts so seeded turns rehydrate with option text', () => {
    const scenario: ManifestScenario = {
      turns: [
        {
          phase: 'scope',
          question: 'Which launch surface should we prioritize?',
          why: 'The fixture should preserve the selected option text after reload.',
          impact: 'high',
          answer: 'Start with the web workspace.',
          options: [
            { content: 'CLI-first workflow', is_recommended: false },
            { content: 'Web workspace', is_recommended: true },
          ],
          selectedOptionPositions: [1],
        },
      ],
      knowledgeItems: [],
      edges: [],
    };

    const projectId = seedFromManifest(db, scenario, 'Manifest Seed');
    const turn = loadActivePathWithOptions(db, projectId)[0]!;
    const projectedResponse = projectTurnResponse(turn);

    expect(projectedResponse).toEqual({
      selectedOptionIds: [turn.options![1]!.id],
      selectedOptionContents: ['Web workspace'],
      freeText: undefined,
    });
    expect(formatProjectedTurnResponse(projectedResponse!)).toContain('Chosen options: Web workspace');
    expect(formatProjectedTurnResponse(projectedResponse!)).not.toContain('Chosen options: 1');
  });
});
