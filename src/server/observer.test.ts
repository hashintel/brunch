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
const {
  createDb,
  createProject,
  createTurn,
  createDecision,
  createAssumption,
  createOption,
  getEntitiesForProject,
} = await import('./db.js');

let db: DB;

beforeEach(() => {
  mockGenerateText.mockReset();
  db = createDb();
});

afterEach(() => {
  db.$client.close();
});

describe('runObserver', () => {
  it('persists canonical scope kinds and constraints with turn provenance and returns their ids', async () => {
    mockGenerateText.mockResolvedValue({
      output: {
        goals: [
          {
            content: 'Produce a clean implementation brief',
            rationale: 'The user wants a trustworthy handoff into delivery work',
          },
        ],
        terms: [
          {
            content: 'implementation brief',
            rationale: 'The user named the artifact the interview is trying to produce',
          },
        ],
        contexts: [
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

    const observerResult = await runObserver(db, turn, project.id);
    const { entityIds, draftReviewItems } = observerResult;
    const entities = getEntitiesForProject(db, project.id);
    const provenanceRows = db.$client
      .prepare('SELECT turn_id, item_id, relation FROM turn_knowledge_item ORDER BY item_id ASC')
      .all() as Array<{ turn_id: number; item_id: number; relation: string }>;

    expect(entityIds.goals).toHaveLength(1);
    expect(entityIds.terms).toHaveLength(1);
    expect(entityIds.contexts).toHaveLength(1);
    expect(entityIds.constraints).toHaveLength(1);
    expect(entityIds.requirements).toEqual([]);
    expect(entityIds.criteria).toEqual([]);
    expect(entityIds.decisions).toEqual([]);
    expect(entityIds.assumptions).toEqual([]);
    expect(draftReviewItems).toEqual({ requirements: [], criteria: [] });
    expect(entities.goals[0]).toMatchObject({
      kind: 'goal',
      content: 'Produce a clean implementation brief',
      rationale: 'The user wants a trustworthy handoff into delivery work',
    });
    expect(entities.terms[0]).toMatchObject({
      kind: 'term',
      content: 'implementation brief',
      rationale: 'The user named the artifact the interview is trying to produce',
    });
    expect(entities.contexts[0]).toMatchObject({
      kind: 'context',
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
        item_id: entityIds.goals[0],
        relation: 'captured',
      },
      {
        turn_id: turn.id,
        item_id: entityIds.terms[0],
        relation: 'captured',
      },
      {
        turn_id: turn.id,
        item_id: entityIds.contexts[0],
        relation: 'captured',
      },
      {
        turn_id: turn.id,
        item_id: entityIds.constraints[0],
        relation: 'captured',
      },
    ]);
  });

  it('calls generateText with a scope-biased goal/term/context/constraint prompt and existing generic context', async () => {
    mockGenerateText.mockResolvedValue({
      output: {
        goals: [],
        terms: [],
        contexts: [],
        constraints: [],
        requirements: [],
        criteria: [],
        decisions: [],
        assumptions: [],
      },
    });

    const { createKnowledgeItem } = await import('./db.js');
    const project = createProject(db, 'Spec');
    createKnowledgeItem(db, project.id, 'context', 'The project starts as a fuzzy brief');
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
        system: expect.stringContaining('goal'),
        output: expect.objectContaining({
          name: 'object',
          parseCompleteOutput: expect.any(Function),
          parsePartialOutput: expect.any(Function),
        }),
        prompt: expect.stringContaining('Avoid heavyweight setup'),
      }),
    );
  });

  it('keeps brownfield project context in observer prompts without treating later scope turns as kickoff-only', async () => {
    mockGenerateText.mockResolvedValue({
      output: {
        goals: [],
        terms: [],
        contexts: [],
        constraints: [],
        requirements: [],
        criteria: [],
        decisions: [],
        assumptions: [],
      },
    });

    const project = createProject(db, 'Spec', { mode: 'brownfield', cwd: '/tmp/repo' });
    const turn = createTurn(db, project.id, {
      phase: 'scope',
      question: 'Which billing workflow should we focus on first?',
      answer: 'The invoice retry path.',
      why: 'The existing billing jobs and invoice retry worker make this seam the best next scope boundary.',
    });

    await runObserver(db, turn, project.id);

    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.not.stringContaining('brownfield kickoff'),
        prompt: expect.stringContaining('Project mode: brownfield'),
      }),
    );
    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining('The existing billing jobs and invoice retry worker'),
      }),
    );
  });

  it('persists design-mode decisions and assumptions through the generic seam while allowing scope-kind/constraint spillover', async () => {
    mockGenerateText.mockResolvedValue({
      output: {
        goals: [],
        terms: [],
        contexts: [
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
            parentAssumptionIds: [2],
          },
        ],
        assumptions: [
          {
            content: 'Users already have browsers available',
            parentAssumptionIds: [2],
          },
        ],
      },
    });

    const project = createProject(db, 'Spec');
    const existingDecision = createDecision(db, project.id, 'Keep the first release browser-based');
    const existingAssumption = createAssumption(db, project.id, 'Users can work in a browser');
    const turn = createTurn(db, project.id, {
      phase: 'design',
      question: 'Which delivery surface should we commit to first?',
      answer: 'Start with the web app and skip plugins for now.',
    });

    const observerResult = await runObserver(db, turn, project.id);
    const { entityIds, draftReviewItems } = observerResult;
    const entities = getEntitiesForProject(db, project.id);

    expect(entityIds.goals).toEqual([]);
    expect(entityIds.terms).toEqual([]);
    expect(entityIds.requirements).toEqual([]);
    expect(entityIds.criteria).toEqual([]);
    expect(entityIds.contexts).toHaveLength(1);
    expect(entityIds.constraints).toHaveLength(1);
    expect(entityIds.decisions).toHaveLength(1);
    expect(entityIds.assumptions).toHaveLength(1);
    expect(draftReviewItems).toEqual({ requirements: [], criteria: [] });

    const [newContextId] = entityIds.contexts;
    const [newConstraintId] = entityIds.constraints;
    const [newDecisionId] = entityIds.decisions;
    const [newAssumptionId] = entityIds.assumptions;
    expect(entities.contexts).toEqual(
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
          id: newDecisionId,
          content: 'Start with the web app',
          rationale: 'It is the fastest path to user feedback',
        }),
      ]),
    );
    expect(entities.assumptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: newAssumptionId,
          content: 'Users already have browsers available',
        }),
      ]),
    );
    expect(entities.relationships).toEqual(
      expect.arrayContaining([
        {
          type: 'depends_on',
          source: { collection: 'knowledge_item', kind: 'decision', id: newDecisionId },
          target: { collection: 'knowledge_item', kind: 'decision', id: existingDecision.id },
        },
        {
          type: 'depends_on',
          source: { collection: 'knowledge_item', kind: 'decision', id: newDecisionId },
          target: { collection: 'knowledge_item', kind: 'assumption', id: existingAssumption.id },
        },
        {
          type: 'depends_on',
          source: { collection: 'knowledge_item', kind: 'assumption', id: newAssumptionId },
          target: { collection: 'knowledge_item', kind: 'assumption', id: existingAssumption.id },
        },
      ]),
    );

    expect(entities.contexts).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: newContextId })]),
    );
    expect(entities.constraints).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: newConstraintId })]),
    );
  });

  it('calls generateText with a design-biased prompt that prioritizes decisions/assumptions and allows scope-kind/constraint spillover', async () => {
    mockGenerateText.mockResolvedValue({
      output: {
        goals: [],
        terms: [],
        contexts: [],
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
        system: expect.stringContaining('constraint** corrections'),
      }),
    );
    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('scope understanding'),
      }),
    );
  });

  it('keeps requirements-mode requirement items as turn-owned draft review inputs instead of durable entities', async () => {
    mockGenerateText.mockResolvedValue({
      output: {
        goals: [],
        terms: [],
        contexts: [],
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

    const observerResult = await runObserver(db, turn, project.id);
    const entities = getEntitiesForProject(db, project.id);
    const provenanceRows = db.$client
      .prepare('SELECT turn_id, item_id, relation FROM turn_knowledge_item ORDER BY item_id ASC')
      .all() as Array<{ turn_id: number; item_id: number; relation: string }>;

    expect(observerResult).toEqual({
      entityIds: {
        goals: [],
        terms: [],
        contexts: [],
        constraints: [],
        requirements: [],
        criteria: [],
        decisions: [],
        assumptions: [],
      },
      draftReviewItems: {
        requirements: [
          {
            content: 'The app must resume an interview from SQLite after a browser restart',
            rationale: 'Users will leave and come back mid-session',
          },
        ],
        criteria: [],
      },
    });
    expect(entities.requirements).toEqual([]);
    expect(provenanceRows).toEqual([]);
  });

  it('calls generateText with a requirements-biased prompt that prioritizes requirements and defers criteria extraction', async () => {
    mockGenerateText.mockResolvedValue({
      output: {
        goals: [],
        terms: [],
        contexts: [],
        constraints: [],
        requirements: [],
        criteria: [],
        decisions: [],
        assumptions: [],
      },
    });

    const { advanceHead, updateTurn } = await import('./db.js');
    const project = createProject(db, 'Spec');
    const priorTurn = createTurn(db, project.id, {
      phase: 'requirements',
      question: 'Which requirements are still missing?',
      answer: 'Resume interviews from SQLite',
    });
    updateTurn(db, priorTurn.id, {
      assistant_parts: JSON.stringify([
        {
          type: 'data-observer-result',
          data: {
            turnId: priorTurn.id,
            entityIds: {
              goals: [],
              terms: [],
              contexts: [],
              constraints: [],
              requirements: [],
              criteria: [],
              decisions: [],
              assumptions: [],
            },
            draftReviewItems: {
              requirements: [
                {
                  content: 'Resume interviews from SQLite',
                  rationale: 'Users will return later',
                },
              ],
              criteria: [],
            },
          },
        },
      ]),
    });
    const turn = createTurn(db, project.id, {
      phase: 'requirements',
      parent_turn_id: priorTurn.id,
      question: 'Which requirements are still missing?',
      answer: 'We still need to preserve the active path after a restart.',
    });
    advanceHead(db, project.id, turn.id);

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

  it('routes structured turn responses into the observer prompt through the shared response seam', async () => {
    mockGenerateText.mockResolvedValue({
      output: {
        goals: [],
        terms: [],
        contexts: [],
        constraints: [],
        requirements: [],
        criteria: [],
        decisions: [],
        assumptions: [],
      },
    });

    const project = createProject(db, 'Spec');
    const turn = createTurn(db, project.id, {
      phase: 'requirements',
      question: 'Which requirements are still missing?',
      answer: 'Web, Desktop — Covers both launch paths',
      user_parts: JSON.stringify([
        { type: 'text', text: 'Web, Desktop — Covers both launch paths' },
        {
          type: 'data-turn-response',
          data: {
            turnId: 1,
            selectedOptionIds: [1, 2],
            freeText: 'Covers both launch paths',
          },
        },
      ]),
    });
    createOption(db, turn.id, { position: 0, content: 'Web', is_selected: true });
    createOption(db, turn.id, { position: 1, content: 'Desktop', is_selected: true });

    await runObserver(db, turn, project.id);

    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining(
          'Turn response:\n  Chosen options: Web, Desktop\n  Free-text response: Covers both launch paths',
        ),
      }),
    );
    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.not.stringContaining('Answer: Web, Desktop — Covers both launch paths'),
      }),
    );
  });

  it('keeps criteria-mode criterion items as turn-owned draft review inputs instead of durable entities', async () => {
    mockGenerateText.mockResolvedValue({
      output: {
        goals: [],
        terms: [],
        contexts: [],
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

    const observerResult = await runObserver(db, turn, project.id);
    const entities = getEntitiesForProject(db, project.id);
    const provenanceRows = db.$client
      .prepare('SELECT turn_id, item_id, relation FROM turn_knowledge_item ORDER BY item_id ASC')
      .all() as Array<{ turn_id: number; item_id: number; relation: string }>;

    expect(observerResult).toEqual({
      entityIds: {
        goals: [],
        terms: [],
        contexts: [],
        constraints: [],
        requirements: [],
        criteria: [],
        decisions: [],
        assumptions: [],
      },
      draftReviewItems: {
        requirements: [],
        criteria: [
          {
            content: 'Resuming restores the active path without data loss',
            rationale: 'This proves persistence worked for the branch the user was on',
          },
        ],
      },
    });
    expect(entities.criteria).toEqual([]);
    expect(provenanceRows).toEqual([]);
  });

  it('calls generateText with a criteria-biased prompt that prioritizes criteria and distinguishes them from requirements', async () => {
    mockGenerateText.mockResolvedValue({
      output: {
        goals: [],
        terms: [],
        contexts: [],
        constraints: [],
        requirements: [],
        criteria: [],
        decisions: [],
        assumptions: [],
      },
    });

    const { advanceHead, createKnowledgeItem, updateTurn } = await import('./db.js');
    const project = createProject(db, 'Spec');
    createKnowledgeItem(db, project.id, 'requirement', 'Resume interviews from SQLite', {
      rationale: 'Users return later',
    });
    const priorTurn = createTurn(db, project.id, {
      phase: 'criteria',
      question: 'Which criteria prove the resume requirement is satisfied?',
      answer: 'Resuming restores the active path',
    });
    updateTurn(db, priorTurn.id, {
      assistant_parts: JSON.stringify([
        {
          type: 'data-observer-result',
          data: {
            turnId: priorTurn.id,
            entityIds: {
              goals: [],
              terms: [],
              contexts: [],
              constraints: [],
              requirements: [],
              criteria: [],
              decisions: [],
              assumptions: [],
            },
            draftReviewItems: {
              requirements: [],
              criteria: [
                {
                  content: 'Resuming restores the active path',
                  rationale: 'Protect the persistence seam',
                },
              ],
            },
          },
        },
      ]),
    });
    const turn = createTurn(db, project.id, {
      phase: 'criteria',
      parent_turn_id: priorTurn.id,
      question: 'Which criteria prove the resume requirement is satisfied?',
      answer: 'We should prove the active path restores cleanly after a restart.',
    });
    advanceHead(db, project.id, turn.id);

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
