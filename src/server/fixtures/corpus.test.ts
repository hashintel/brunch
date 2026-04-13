import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DB } from '../db.js';
import type { ManifestScenario } from './manifest.js';

const { mockGenerateText, mockAnthropic } = vi.hoisted(() => ({
  mockGenerateText: vi.fn(),
  mockAnthropic: vi.fn(() => 'mock-model'),
}));

vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: mockAnthropic,
}));

vi.mock('ai', async () => {
  const actual = await vi.importActual<typeof import('ai')>('ai');
  return {
    ...actual,
    generateText: mockGenerateText,
  };
});

const { createDb } = await import('../db.js');
const { seedFromManifest } = await import('./manifest.js');
const {
  buildExpectedObserverOutputForTurn,
  captureProjectToManifestScenario,
  curatedGoldenCorpus,
  observeTurnWithRunObserver,
  probeObserverScenario,
} = await import('./corpus.js');

let db: DB;

beforeEach(() => {
  mockGenerateText.mockReset();
  db = createDb();
});

afterEach(() => {
  db.$client.close();
});

describe('captureProjectToManifestScenario', () => {
  it('normalizes a trusted runtime-shaped project back into a manifest scenario', () => {
    const scenario: ManifestScenario = {
      turns: [
        {
          phase: 'scope',
          question: 'What should this tool optimize for first?',
          why: 'The first optimization usually shapes the rest of v1.',
          impact: 'high',
          answer:
            'Fast onboarding with a clear guided flow — We can add more knobs later once the interview flow feels right.',
          options: [
            {
              content: 'Fast onboarding with a clear guided flow',
              is_recommended: true,
            },
            {
              content: 'Maximum configurability from day one',
              is_recommended: false,
            },
          ],
          selectedOptionPositions: [0],
          freeText: 'We can add more knobs later once the interview flow feels right.',
        },
        {
          phase: 'scope',
          question: '',
          answer: 'Scope context is sufficient for a first design pass.',
          isProposal: true,
        },
        {
          phase: 'scope',
          question: '',
          answer: 'Confirm scope closure',
          isConfirmation: true,
        },
        {
          phase: 'requirements',
          question: 'Does this requirement capture the core persistence need?',
          why: 'We need one reviewed requirement to prove the review seam survives capture.',
          impact: 'medium',
          answer: 'Approve this requirement',
          options: [
            {
              content: 'Approve this requirement',
              is_recommended: true,
            },
            {
              content: 'Reject this requirement',
              is_recommended: false,
            },
          ],
          selectedOptionPositions: [0],
          freeText: null,
        },
      ],
      knowledgeItems: [
        {
          kind: 'goal',
          content: 'Keep onboarding fast for the first-time spec author',
          rationale: 'The first session should feel lightweight.',
          capturedAtTurn: 0,
        },
        {
          kind: 'requirement',
          content: 'Persist the active interview path so the user can resume later',
          rationale: 'Users will leave mid-session and need to return safely.',
          capturedAtTurn: 3,
          reviewAction: 'reviewed',
          reviewedAtTurn: 3,
        },
      ],
      edges: [],
    };

    const projectId = seedFromManifest(db, scenario, 'Capture Round Trip');

    expect(captureProjectToManifestScenario(db, projectId)).toEqual(scenario);
  });
});

describe('probeObserverScenario', () => {
  it('runs curated corpus probes through the real observer seam without manual SQL fixtures', async () => {
    for (const entry of Object.values(curatedGoldenCorpus.entries)) {
      const result = await probeObserverScenario(entry.scenario, async (input) => {
        mockGenerateText.mockResolvedValueOnce({
          output: buildExpectedObserverOutputForTurn(
            entry.scenario,
            input.turnIndex,
            input.db,
            input.projectId,
          ),
        });

        return observeTurnWithRunObserver(input);
      });

      expect(result.mismatches).toEqual([]);
      expect(result.probedTurns).toBeGreaterThan(0);
    }
  });

  it('reports mismatches when an observer probe diverges from the curated corpus', async () => {
    const entry = curatedGoldenCorpus.entries['issue-tracker-scope'];
    const result = await probeObserverScenario(entry.scenario, async () => ({
      goals: [],
      terms: [],
      contexts: [],
      constraints: [],
      requirements: [],
      criteria: [],
      decisions: [],
      assumptions: [],
      dependencies: [],
    }));

    expect(result.mismatches.length).toBeGreaterThan(0);
    expect(result.mismatches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          turnIndex: 0,
          phase: 'scope',
        }),
      ]),
    );
  });
});
