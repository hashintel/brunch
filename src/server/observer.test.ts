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
  it('persists scope-mode framing items with turn provenance and returns their ids', async () => {
    mockGenerateText.mockResolvedValue({
      output: {
        framing: [
          {
            content: 'The project starts from an ambiguous brief',
            rationale: 'The user is still clarifying the problem space',
          },
        ],
        decisions: [],
        assumptions: [],
      },
    });

    const project = createProject(db, 'Spec');
    const turn = createTurn(db, project.id, { phase: 'scope', question: 'Q', answer: 'A' });

    const entityIds = await runObserver(db, turn, project.id);
    const entities = getEntitiesForProject(db, project.id);
    const provenanceRows = db.$client
      .prepare('SELECT turn_id, item_id, relation FROM turn_knowledge_item ORDER BY item_id ASC')
      .all() as Array<{ turn_id: number; item_id: number; relation: string }>;

    expect(entityIds.framing).toHaveLength(1);
    expect(entityIds.decisions).toEqual([]);
    expect(entityIds.assumptions).toEqual([]);
    expect(entities.framing[0]).toMatchObject({
      kind: 'framing',
      content: 'The project starts from an ambiguous brief',
      rationale: 'The user is still clarifying the problem space',
    });
    expect(provenanceRows).toEqual([
      {
        turn_id: turn.id,
        item_id: entityIds.framing[0],
        relation: 'captured',
      },
    ]);
  });

  it('calls generateText with a scope-biased framing prompt and existing framing context', async () => {
    mockGenerateText.mockResolvedValue({
      output: {
        framing: [],
        decisions: [],
        assumptions: [],
      },
    });

    const { createKnowledgeItem } = await import('./db.js');
    const project = createProject(db, 'Spec');
    createKnowledgeItem(db, project.id, 'framing', 'The project starts as a fuzzy brief');
    const turn = createTurn(db, project.id, {
      phase: 'scope',
      question: 'What problem are we solving?',
      answer: 'We need to clarify the project before choosing a design.',
    });

    await runObserver(db, turn, project.id);

    expect(mockAnthropic).toHaveBeenCalled();
    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('framing'),
        output: expect.objectContaining({
          name: 'object',
          parseCompleteOutput: expect.any(Function),
          parsePartialOutput: expect.any(Function),
        }),
        prompt: expect.stringContaining('The project starts as a fuzzy brief'),
      }),
    );
  });
});
