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
const { createDb, createProject, createTurn, createDecision, createAssumption, getEntitiesForProject } =
  await import('./db.js');

let db: DB;

beforeEach(() => {
  mockGenerateText.mockReset();
  db = createDb();
});

afterEach(() => {
  db.$client.close();
});

describe('runObserver', () => {
  it('persists scope-mode framing and constraint items with turn provenance and returns their ids', async () => {
    mockGenerateText.mockResolvedValue({
      output: {
        framing: [
          {
            content: 'The project starts from an ambiguous brief',
            rationale: 'The user is still clarifying the problem space',
          },
        ],
        constraints: [
          {
            content: 'Keep setup instant',
            rationale: 'The launcher should stay lightweight',
            subtype: 'non-goal',
          },
        ],
        requirements: [],
        criteria: [],
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
    expect(entityIds.constraints).toHaveLength(1);
    expect(entityIds.requirements).toEqual([]);
    expect(entityIds.criteria).toEqual([]);
    expect(entityIds.decisions).toEqual([]);
    expect(entityIds.assumptions).toEqual([]);
    expect(entities.framing[0]).toMatchObject({
      kind: 'framing',
      content: 'The project starts from an ambiguous brief',
      rationale: 'The user is still clarifying the problem space',
    });
    expect(entities.constraints[0]).toMatchObject({
      kind: 'constraint',
      subtype: 'non-goal',
      content: 'Keep setup instant',
      rationale: 'The launcher should stay lightweight',
    });
    expect(provenanceRows).toEqual([
      {
        turn_id: turn.id,
        item_id: entityIds.framing[0],
        relation: 'captured',
      },
      {
        turn_id: turn.id,
        item_id: entityIds.constraints[0],
        relation: 'captured',
      },
    ]);
  });

  it('calls generateText with a scope-biased framing/constraint prompt and existing generic context', async () => {
    mockGenerateText.mockResolvedValue({
      output: {
        framing: [],
        constraints: [],
        requirements: [],
        criteria: [],
        decisions: [],
        assumptions: [],
      },
    });

    const { createKnowledgeItem } = await import('./db.js');
    const project = createProject(db, 'Spec');
    createKnowledgeItem(db, project.id, 'framing', 'The project starts as a fuzzy brief');
    createKnowledgeItem(db, project.id, 'constraint', 'Avoid heavyweight setup', {
      subtype: 'non-goal',
      rationale: 'Onboarding should stay instant',
    });
    const turn = createTurn(db, project.id, {
      phase: 'scope',
      question: 'What should we avoid?',
      answer: 'We should avoid any heavyweight setup flow.',
    });

    await runObserver(db, turn, project.id);

    expect(mockAnthropic).toHaveBeenCalled();
    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('constraint'),
        output: expect.objectContaining({
          name: 'object',
          parseCompleteOutput: expect.any(Function),
          parsePartialOutput: expect.any(Function),
        }),
        prompt: expect.stringContaining('Avoid heavyweight setup'),
      }),
    );
  });

  it('persists design-mode decisions and assumptions with legacy edges while allowing framing/constraint spillover', async () => {
    mockGenerateText.mockResolvedValue({
      output: {
        framing: [
          {
            content: 'The first release still targets solo builders',
            rationale: 'The turn restated who the tool is for',
          },
        ],
        constraints: [
          {
            content: 'Do not add a plugin system yet',
            rationale: 'That would widen the first release too early',
            subtype: 'non-goal',
          },
        ],
        requirements: [],
        criteria: [],
        decisions: [
          {
            content: 'Start with the web app',
            rationale: 'It is the fastest path to user feedback',
            parentDecisionIds: [1],
            parentAssumptionIds: [1],
          },
        ],
        assumptions: [
          {
            content: 'Users already have browsers available',
            parentAssumptionIds: [1],
          },
        ],
      },
    });

    const project = createProject(db, 'Spec');
    createDecision(db, project.id, 'Keep the first release browser-based');
    createAssumption(db, project.id, 'Users can work in a browser');
    const turn = createTurn(db, project.id, {
      phase: 'design',
      question: 'Which delivery surface should we commit to first?',
      answer: 'Start with the web app and skip plugins for now.',
    });

    const entityIds = await runObserver(db, turn, project.id);
    const entities = getEntitiesForProject(db, project.id);

    expect(entityIds).toEqual({
      framing: [1],
      constraints: [2],
      requirements: [],
      criteria: [],
      decisions: [2],
      assumptions: [2],
    });
    expect(entities.framing).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          content: 'The first release still targets solo builders',
        }),
      ]),
    );
    expect(entities.constraints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          content: 'Do not add a plugin system yet',
          subtype: 'non-goal',
        }),
      ]),
    );
    expect(entities.decisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 2,
          content: 'Start with the web app',
          rationale: 'It is the fastest path to user feedback',
        }),
      ]),
    );
    expect(entities.assumptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 2,
          content: 'Users already have browsers available',
        }),
      ]),
    );
    expect(entities.relationships).toEqual(
      expect.arrayContaining([
        {
          type: 'depends_on',
          source: { collection: 'decision', kind: 'decision', id: 2 },
          target: { collection: 'decision', kind: 'decision', id: 1 },
        },
        {
          type: 'depends_on',
          source: { collection: 'decision', kind: 'decision', id: 2 },
          target: { collection: 'assumption', kind: 'assumption', id: 1 },
        },
        {
          type: 'depends_on',
          source: { collection: 'assumption', kind: 'assumption', id: 2 },
          target: { collection: 'assumption', kind: 'assumption', id: 1 },
        },
      ]),
    );
  });

  it('calls generateText with a design-biased prompt that prioritizes decisions/assumptions and allows framing/constraint spillover', async () => {
    mockGenerateText.mockResolvedValue({
      output: {
        framing: [],
        constraints: [],
        requirements: [],
        criteria: [],
        decisions: [],
        assumptions: [],
      },
    });

    const project = createProject(db, 'Spec');
    createDecision(db, project.id, 'Start with the web app');
    createAssumption(db, project.id, 'Users can work in a browser');
    const turn = createTurn(db, project.id, {
      phase: 'design',
      question: 'Which delivery surface should we commit to first?',
      answer: 'Start with the web app and skip plugins for now.',
    });

    await runObserver(db, turn, project.id);

    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('design-mode'),
        prompt: expect.stringContaining('Start with the web app'),
      }),
    );
    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('framing corrections'),
      }),
    );
    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('constraint spillover'),
      }),
    );
  });

  it('persists requirements-mode requirement items with turn provenance and returns their ids', async () => {
    mockGenerateText.mockResolvedValue({
      output: {
        framing: [],
        constraints: [],
        requirements: [
          {
            content: 'The app must resume an interview from SQLite after a browser restart',
            rationale: 'Users will leave and come back mid-session',
          },
        ],
        criteria: [],
        decisions: [],
        assumptions: [],
      },
    });

    const project = createProject(db, 'Spec');
    const turn = createTurn(db, project.id, {
      phase: 'requirements',
      question: 'What must the product do before we can call it complete?',
      answer: 'It must resume an interview from SQLite after a browser restart.',
    });

    const entityIds = await runObserver(db, turn, project.id);
    const entities = getEntitiesForProject(db, project.id);
    const provenanceRows = db.$client
      .prepare('SELECT turn_id, item_id, relation FROM turn_knowledge_item ORDER BY item_id ASC')
      .all() as Array<{ turn_id: number; item_id: number; relation: string }>;

    expect(entityIds).toEqual({
      framing: [],
      constraints: [],
      requirements: [1],
      criteria: [],
      decisions: [],
      assumptions: [],
    });
    expect(entities.requirements[0]).toMatchObject({
      kind: 'requirement',
      content: 'The app must resume an interview from SQLite after a browser restart',
      rationale: 'Users will leave and come back mid-session',
    });
    expect(provenanceRows).toEqual([
      {
        turn_id: turn.id,
        item_id: entityIds.requirements[0],
        relation: 'captured',
      },
    ]);
  });

  it('calls generateText with a requirements-biased prompt that prioritizes requirements and defers criteria extraction', async () => {
    mockGenerateText.mockResolvedValue({
      output: {
        framing: [],
        constraints: [],
        requirements: [],
        criteria: [],
        decisions: [],
        assumptions: [],
      },
    });

    const { createKnowledgeItem } = await import('./db.js');
    const project = createProject(db, 'Spec');
    createKnowledgeItem(db, project.id, 'requirement', 'Resume interviews from SQLite', {
      rationale: 'Users will return later',
    });
    const turn = createTurn(db, project.id, {
      phase: 'requirements',
      question: 'Which requirements are still missing?',
      answer: 'We still need to preserve the active path after a restart.',
    });

    await runObserver(db, turn, project.id);

    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('requirements-mode'),
        prompt: expect.stringContaining('Resume interviews from SQLite'),
      }),
    );
    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('prioritize **requirement** items'),
      }),
    );
    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('defer **criterion** extraction'),
      }),
    );
  });

  it('persists criteria-mode criterion items with turn provenance and returns their ids', async () => {
    mockGenerateText.mockResolvedValue({
      output: {
        framing: [],
        constraints: [],
        requirements: [],
        criteria: [
          {
            content: 'Resuming restores the active path without data loss',
            rationale: 'This proves persistence worked for the branch the user was on',
          },
        ],
        decisions: [],
        assumptions: [],
      },
    });

    const project = createProject(db, 'Spec');
    const turn = createTurn(db, project.id, {
      phase: 'criteria',
      question: 'How will we know resume is working well enough?',
      answer: 'Resuming should restore the active path without losing any work.',
    });

    const entityIds = (await runObserver(db, turn, project.id)) as never as {
      framing: number[];
      constraints: number[];
      requirements: number[];
      criteria: number[];
      decisions: number[];
      assumptions: number[];
    };
    const entities = getEntitiesForProject(db, project.id);
    const provenanceRows = db.$client
      .prepare('SELECT turn_id, item_id, relation FROM turn_knowledge_item ORDER BY item_id ASC')
      .all() as Array<{ turn_id: number; item_id: number; relation: string }>;

    expect(entityIds).toEqual({
      framing: [],
      constraints: [],
      requirements: [],
      criteria: [1],
      decisions: [],
      assumptions: [],
    });
    expect(entities.criteria[0]).toMatchObject({
      kind: 'criterion',
      content: 'Resuming restores the active path without data loss',
      rationale: 'This proves persistence worked for the branch the user was on',
    });
    expect(provenanceRows).toEqual([
      {
        turn_id: turn.id,
        item_id: entityIds.criteria[0],
        relation: 'captured',
      },
    ]);
  });

  it('calls generateText with a criteria-biased prompt that prioritizes criteria and distinguishes them from requirements', async () => {
    mockGenerateText.mockResolvedValue({
      output: {
        framing: [],
        constraints: [],
        requirements: [],
        criteria: [],
        decisions: [],
        assumptions: [],
      },
    });

    const { createKnowledgeItem } = await import('./db.js');
    const project = createProject(db, 'Spec');
    createKnowledgeItem(db, project.id, 'requirement', 'Resume interviews from SQLite', {
      rationale: 'Users return later',
    });
    createKnowledgeItem(db, project.id, 'criterion', 'Resuming restores the active path', {
      rationale: 'Protect the persistence seam',
    });
    const turn = createTurn(db, project.id, {
      phase: 'criteria',
      question: 'Which criteria prove the resume requirement is satisfied?',
      answer: 'We should prove the active path restores cleanly after a restart.',
    });

    await runObserver(db, turn, project.id);

    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('criteria-mode'),
        prompt: expect.stringContaining('Resume interviews from SQLite'),
      }),
    );
    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining('Resuming restores the active path'),
      }),
    );
    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('prioritize **criterion** items'),
      }),
    );
    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('Distinguish criteria from requirements'),
      }),
    );
  });
});
