import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DB } from './db.js';

const { mockGenerateObject, mockAnthropic } = vi.hoisted(() => ({
  mockGenerateObject: vi.fn(),
  mockAnthropic: vi.fn(() => 'mock-model'),
}));

vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: mockAnthropic,
}));

vi.mock('ai', async () => {
  const actual = await vi.importActual<typeof import('ai')>('ai');
  return {
    ...actual,
    generateObject: mockGenerateObject,
  };
});

const { runObserver, observerOutputSchema } = await import('./observer.js');
const { createDb, createProject, createTurn, getEntitiesForProject } = await import('./db.js');

let db: DB;

beforeEach(() => {
  mockGenerateObject.mockReset();
  db = createDb();
});

afterEach(() => {
  db.$client.close();
});

describe('runObserver', () => {
  it('persists extracted decisions and assumptions and returns their ids', async () => {
    mockGenerateObject.mockResolvedValue({
      object: {
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

  it('calls generateObject with the typed schema and turn context', async () => {
    mockGenerateObject.mockResolvedValue({
      object: {
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
    expect(mockGenerateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        schema: observerOutputSchema,
        prompt: expect.stringContaining('What database?'),
      }),
    );
  });
});
