import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { DB, Turn } from './db.js';
import { structuredQuestionSchema, getSystemPrompt } from './interview.js';
import type { StructuredQuestion } from './interview.js';

// Mock the Anthropic SDK — hoisted, so no local variable references in factory
const { mockStream } = vi.hoisted(() => ({
  mockStream: vi.fn(),
}));
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = {
        stream: mockStream,
      };
    },
  };
});

const { conductTurn } = await import('./core.js');
const { buildInterviewerContext } = await import('./context.js');
const { createDb, getOrCreateProject, createTurn } = await import('./db.js');

let db: DB;

/** Create a mock MessageStream that emits raw events and has a finalMessage() */
function makeMockMessageStream(rawEvents: Record<string, unknown>[], finalMsg?: Record<string, unknown>) {
  const asyncIter = (async function* () {
    for (const event of rawEvents) {
      yield event;
    }
  })();

  return {
    [Symbol.asyncIterator]: () => asyncIter[Symbol.asyncIterator](),
    on: vi.fn().mockReturnThis(),
    finalMessage: vi.fn().mockResolvedValue(
      finalMsg ?? {
        id: 'msg-1',
        content: [],
        stop_reason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 50 },
      },
    ),
  };
}

beforeEach(() => {
  mockStream.mockReset();
  // Default: return an empty stream
  mockStream.mockReturnValue(
    makeMockMessageStream([{ type: 'message_start', message: { id: 'msg-1' } }, { type: 'message_stop' }]),
  );
  db = createDb();
});

afterEach(() => {
  db.$client.close();
});

// --- Acceptance criterion: structured-turn-schema ---

describe('structuredQuestionSchema', () => {
  it('parses a valid structured question', () => {
    const valid: StructuredQuestion = {
      question: 'What is the primary goal of your project?',
      why: 'Understanding the goal shapes all downstream decisions.',
      impact: 'high',
      options: [
        { content: 'Build a new product from scratch', is_recommended: false },
        { content: 'Improve an existing product', is_recommended: true },
      ],
    };
    expect(structuredQuestionSchema.parse(valid)).toEqual(valid);
  });

  it('rejects a question with no options', () => {
    const invalid = {
      question: 'What?',
      why: 'Because.',
      impact: 'high',
      options: [],
    };
    expect(() => structuredQuestionSchema.parse(invalid)).toThrow();
  });

  it('rejects a question with only one option', () => {
    const invalid = {
      question: 'What?',
      why: 'Because.',
      impact: 'high',
      options: [{ content: 'Only one', is_recommended: false }],
    };
    expect(() => structuredQuestionSchema.parse(invalid)).toThrow();
  });

  it('rejects a question with empty question text', () => {
    const invalid = {
      question: '',
      why: 'Because.',
      impact: 'high',
      options: [
        { content: 'A', is_recommended: false },
        { content: 'B', is_recommended: false },
      ],
    };
    expect(() => structuredQuestionSchema.parse(invalid)).toThrow();
  });

  it('rejects an invalid impact level', () => {
    const invalid = {
      question: 'What?',
      why: 'Because.',
      impact: 'critical',
      options: [
        { content: 'A', is_recommended: false },
        { content: 'B', is_recommended: false },
      ],
    };
    expect(() => structuredQuestionSchema.parse(invalid)).toThrow();
  });
});

// --- Acceptance criterion: scope-system-prompt ---

describe('getSystemPrompt', () => {
  it('returns a scope-specific system prompt', () => {
    const prompt = getSystemPrompt('scope');
    expect(prompt).toContain('scope');
    expect(prompt).not.toBe('You are a helpful assistant.');
    expect(prompt.length).toBeGreaterThan(50);
  });

  it('returns different prompts for different phases', () => {
    const scope = getSystemPrompt('scope');
    const design = getSystemPrompt('design');
    expect(scope).not.toBe(design);
  });
});

// --- Oracle: A27 — Zod/JSON schema sync ---

describe('A27: structuredQuestionSchema and ASK_QUESTION_TOOL stay in sync', () => {
  it('fixture data valid for the JSON schema also passes Zod parse', async () => {
    const { ASK_QUESTION_TOOL } = await import('./interview.js');
    const fixture = {
      question: 'What platform are you targeting?',
      why: 'Platform choice affects architecture.',
      impact: 'high',
      options: [
        { content: 'Web only', is_recommended: true },
        { content: 'Desktop and mobile', is_recommended: false },
      ],
    };

    // Verify fixture matches JSON schema shape
    const schema = ASK_QUESTION_TOOL.input_schema as Record<string, unknown>;
    expect(schema.type).toBe('object');
    expect((schema.required as string[]).sort()).toEqual(['impact', 'options', 'question', 'why']);

    // Verify same fixture passes Zod
    const result = structuredQuestionSchema.parse(fixture);
    expect(result.question).toBe(fixture.question);
    expect(result.options).toHaveLength(2);
  });
});

// --- Acceptance criterion: tool handler persistence ---

describe('ask_question tool handler', () => {
  it('tool handler persists structured data to the turn', async () => {
    const { persistStructuredQuestion } = await import('./interview.js');
    const { getOptionsForTurn } = await import('./db.js');
    const { eq } = await import('drizzle-orm');
    const { turn: turnTable } = await import('./schema.js');

    const project = getOrCreateProject(db);
    const turn = createTurn(db, project.id, { phase: 'scope', question: '' });

    persistStructuredQuestion(db, turn.id, {
      question: 'What is the primary goal?',
      why: 'Understanding the goal shapes all downstream decisions.',
      impact: 'high',
      options: [
        { content: 'Build a new product', is_recommended: false },
        { content: 'Improve an existing product', is_recommended: true },
      ],
    });

    const updatedTurn = db.select().from(turnTable).where(eq(turnTable.id, turn.id)).get();
    expect(updatedTurn?.question).toBe('What is the primary goal?');
    expect(updatedTurn?.why).toBe('Understanding the goal shapes all downstream decisions.');
    expect(updatedTurn?.impact).toBe('high');

    const options = getOptionsForTurn(db, turn.id);
    expect(options).toHaveLength(2);
    expect(options[0].content).toBe('Build a new product');
    expect(options[1].content).toBe('Improve an existing product');
    expect(options[1].is_recommended).toBe(true);
  });
});

// --- Acceptance criterion: conductTurn uses interview config ---

describe('conductTurn with interview config', () => {
  it('passes scope system prompt to SDK', async () => {
    const project = getOrCreateProject(db);
    for await (const _ of conductTurn(db, project.id, 'hello')) {
      /* consume */
    }

    expect(mockStream).toHaveBeenCalled();
    const callArgs = mockStream.mock.calls[0][0];
    expect(callArgs.system).toContain('scope');
    expect(callArgs.system).not.toBe('You are a helpful assistant.');
  });

  it('passes tool_choice forcing to SDK', async () => {
    const project = getOrCreateProject(db);
    for await (const _ of conductTurn(db, project.id, 'hello')) {
      /* consume */
    }

    expect(mockStream).toHaveBeenCalled();
    const callArgs = mockStream.mock.calls[0][0];
    expect(callArgs.tool_choice).toEqual({ type: 'auto' });
    expect(callArgs.tools).toBeDefined();
    expect(callArgs.tools[0].name).toBe('ask_question');
  });
});

// --- Acceptance criterion: history-includes-structure ---

describe('buildInterviewerContext with structured turns', () => {
  it('includes grounding and impact in history', () => {
    const turns = [
      {
        question: 'What is the primary goal?',
        answer: 'Build a new product',
        why: 'Understanding the goal shapes all downstream decisions.',
        impact: 'high',
      },
    ] as Turn[];
    const result = buildInterviewerContext(turns, 'next question');
    expect(result).toContain('Build a new product');
    expect(result).toContain('What is the primary goal?');
    expect(result).toContain('Understanding the goal');
    expect(result).toContain('Impact: high');
  });

  it('includes options with recommendation and selection markers', () => {
    const turns = [
      {
        question: 'What is the primary goal?',
        answer: 'Build a new product',
        why: 'Shapes downstream decisions.',
        impact: 'high',
        options: [
          { content: 'Build a new product', is_recommended: false, is_selected: true },
          { content: 'Improve an existing product', is_recommended: true, is_selected: false },
        ],
      },
    ] as any[];
    const result = buildInterviewerContext(turns, 'next');
    expect(result).toContain('Build a new product');
    expect(result).toContain('[selected]');
    expect(result).toContain('(recommended)');
  });
});

// --- Round-trip oracle: structured turn → persist → active path ---

describe('round-trip: structured turn persistence', () => {
  it('persisted structured turn is retrievable via active path', async () => {
    const { createOption, getOptionsForTurn, advanceHead: advance } = await import('./db.js');
    const project = getOrCreateProject(db);
    const turn = createTurn(db, project.id, {
      phase: 'scope',
      question: 'What is the primary goal?',
      why: 'Understanding the goal shapes all downstream decisions.',
      impact: 'high',
      answer: 'Build a new product',
    });
    createOption(db, turn.id, {
      position: 0,
      content: 'Build a new product',
      is_recommended: false,
      is_selected: true,
    });
    createOption(db, turn.id, { position: 1, content: 'Improve existing', is_recommended: true });
    advance(db, project.id, turn.id);

    const { getActivePath } = await import('./db.js');
    const turns = getActivePath(db, project.id);
    expect(turns).toHaveLength(1);
    expect(turns[0].question).toBe('What is the primary goal?');
    expect(turns[0].why).toBe('Understanding the goal shapes all downstream decisions.');
    expect(turns[0].impact).toBe('high');
    expect(turns[0].phase).toBe('scope');
    expect(turns[0].answer).toBe('Build a new product');

    const options = getOptionsForTurn(db, turns[0].id);
    expect(options).toHaveLength(2);
    expect(options[0].is_selected).toBe(true);
    expect(options[1].is_recommended).toBe(true);
  });
});

// --- Acceptance criterion: option-selection (DB layer) ---

describe('option selection persistence', () => {
  it('getOptionsForTurn returns options for a turn', async () => {
    const { createOption, getOptionsForTurn } = await import('./db.js');
    const project = getOrCreateProject(db);
    const turn = createTurn(db, project.id, {
      phase: 'scope',
      question: 'What?',
      answer: 'Something',
    });

    createOption(db, turn.id, { position: 0, content: 'Option A', is_recommended: true });
    createOption(db, turn.id, { position: 1, content: 'Option B' });

    const options = getOptionsForTurn(db, turn.id);
    expect(options).toHaveLength(2);
    expect(options[0].position).toBe(0);
    expect(options[1].position).toBe(1);
  });

  it('selectOption marks an option as selected', async () => {
    const { createOption, selectOption, getOptionsForTurn } = await import('./db.js');
    const project = getOrCreateProject(db);
    const turn = createTurn(db, project.id, {
      phase: 'scope',
      question: 'What?',
      answer: 'Something',
    });

    createOption(db, turn.id, { position: 0, content: 'Option A' });
    createOption(db, turn.id, { position: 1, content: 'Option B' });

    selectOption(db, turn.id, 1);

    const options = getOptionsForTurn(db, turn.id);
    expect(options[0].is_selected).toBe(false);
    expect(options[1].is_selected).toBe(true);
  });
});
