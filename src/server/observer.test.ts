import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DB } from './db.js';

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

const { runObserver } = await import('./observer.js');
const { createDb, createProject, createTurn, getEntitiesForProject } = await import('./db.js');

let db: DB;

beforeEach(() => {
  mockGenerateText.mockReset();
  db = createDb();
});

afterEach(() => {
  db.$client.close();
});

describe('runObserver', () => {
  it('persists extracted decisions and assumptions and returns their ids', async () => {
    mockGenerateText.mockResolvedValue({
      output: {
        decisions: [
          {
            content: 'Use SQLite',
            rationale: 'Simple and local',
            parentDecisionIds: [],
            parentAssumptionIds: [],
          },
        ],
        assumptions: [{ content: 'Single-user tool', parentAssumptionIds: [] }],
      },
    });

    const project = createProject(db, 'Spec');
    const turn = createTurn(db, project.id, { phase: 'scope', question: 'Q', answer: 'A' });

    const entityIds = await runObserver(db, turn, project.id);
    const entities = getEntitiesForProject(db, project.id);

    expect(entityIds.decisions).toHaveLength(1);
    expect(entityIds.assumptions).toHaveLength(1);
    expect(entities.decisions[0].content).toBe('Use SQLite');
    expect(entities.assumptions[0].content).toBe('Single-user tool');
  });

  it('calls generateText with structured output and turn context', async () => {
    mockGenerateText.mockResolvedValue({
      output: {
        decisions: [],
        assumptions: [],
      },
    });

    const project = createProject(db, 'Spec');
    const turn = createTurn(db, project.id, {
      phase: 'scope',
      question: 'What database?',
      answer: 'SQLite',
    });

    await runObserver(db, turn, project.id);

    expect(mockAnthropic).toHaveBeenCalled();
    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        output: expect.objectContaining({
          name: 'object',
          parseCompleteOutput: expect.any(Function),
          parsePartialOutput: expect.any(Function),
        }),
        prompt: expect.stringContaining('What database?'),
      }),
    );
  });
});
