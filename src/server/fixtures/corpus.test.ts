import { beforeEach, describe, expect, it, vi } from 'vitest';

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

const {
  buildExpectedObserverOutputForTurn,
  curatedGoldenCorpus,
  observeTurnWithRunObserver,
  probeObserverScenario,
} = await import('./corpus.js');

beforeEach(() => {
  mockGenerateText.mockReset();
});

describe('curatedGoldenCorpus', () => {
  it('keeps every corpus entry on a direct TypeScript seed function', () => {
    for (const entry of Object.values(curatedGoldenCorpus.entries)) {
      expect(entry.scenario.seedProject).toBeTypeOf('function');
    }
  });
});

describe('probeObserverScenario', () => {
  it('runs curated corpus probes through the real observer seam without manual SQL fixtures', async () => {
    for (const entry of Object.values(curatedGoldenCorpus.entries)) {
      const result = await probeObserverScenario(entry.scenario, async (input) => {
        mockGenerateText.mockResolvedValueOnce({
          output: await buildExpectedObserverOutputForTurn(
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
    const entry = curatedGoldenCorpus.entries['issue-tracker-grounding'];
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
          phase: 'grounding',
        }),
      ]),
    );
  });
});
