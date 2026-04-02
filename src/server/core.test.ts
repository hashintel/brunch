import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { DB } from './db.js';

// Mock the Anthropic SDK
const { mockStream, mockCreate } = vi.hoisted(() => ({
  mockStream: vi.fn(),
  mockCreate: vi.fn(),
}));
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = {
        stream: mockStream,
        create: mockCreate,
      };
    },
  };
});

const { conductTurn, extractPrompt } = await import('./core.js');
const { buildInterviewerContext } = await import('./context.js');
const { createDb, getOrCreateProject, getActivePath, getTurn } = await import('./db.js');

let db: DB;

/** Create a mock MessageStream that emits raw events */
function makeMockMessageStream(rawEvents: Record<string, unknown>[]) {
  const asyncIter = (async function* () {
    for (const event of rawEvents) {
      yield event;
    }
  })();

  return {
    [Symbol.asyncIterator]: () => asyncIter[Symbol.asyncIterator](),
    on: vi.fn().mockReturnThis(),
    finalMessage: vi.fn().mockResolvedValue({
      id: 'msg-1',
      content: [],
      stop_reason: 'end_turn',
      usage: { input_tokens: 100, output_tokens: 50 },
    }),
  };
}

/** Mock a successful observer response */
function mockObserverDefaults() {
  mockCreate.mockResolvedValue({
    id: 'msg-obs-1',
    content: [{ type: 'text', text: JSON.stringify({ decisions: [], assumptions: [] }) }],
    stop_reason: 'end_turn',
    usage: { input_tokens: 100, output_tokens: 50 },
  });
}

beforeEach(() => {
  mockStream.mockReset();
  mockCreate.mockReset();
  // Default: interviewer returns empty stream, observer returns empty result
  mockStream.mockReturnValue(
    makeMockMessageStream([{ type: 'message_start', message: { id: 'msg-1' } }, { type: 'message_stop' }]),
  );
  mockObserverDefaults();
  db = createDb();
});

afterEach(() => {
  db.$client.close();
});

describe('extractPrompt', () => {
  it('extracts content string from legacy format', () => {
    expect(extractPrompt([{ role: 'user', content: 'hello' }])).toBe('hello');
  });

  it('extracts text from parts array', () => {
    const msg = { role: 'user', parts: [{ type: 'text', text: 'world' }] };
    expect(extractPrompt([msg])).toBe('world');
  });

  it('returns empty string for empty array', () => {
    expect(extractPrompt([])).toBe('');
  });
});

describe('buildInterviewerContext', () => {
  it('returns prompt as-is when no turns', () => {
    expect(buildInterviewerContext([], 'hello')).toBe('hello');
  });

  it('formats turns into conversation history', () => {
    const turns = [{ answer: 'Hi', question: 'Hello back' }] as any[];
    const result = buildInterviewerContext(turns, 'next');
    expect(result).toContain('Answer: Hi');
    expect(result).toContain('Question: Hello back');
    expect(result).toContain('User: next');
  });
});

describe('conductTurn', () => {
  it('yields turn-created as first event', async () => {
    const project = getOrCreateProject(db);
    const events: any[] = [];
    for await (const event of conductTurn(db, project.id, 'hello')) {
      events.push(event);
    }

    expect(events[0].type).toBe('turn-created');
    expect(events[0].turn.answer).toBe('hello');
    expect(events[0].turn.phase).toBe('scope');
  });

  it('yields stream-start with message ID', async () => {
    mockStream.mockReturnValueOnce(
      makeMockMessageStream([{ type: 'message_start', message: { id: 'msg-42' } }, { type: 'message_stop' }]),
    );

    const project = getOrCreateProject(db);
    const events: any[] = [];
    for await (const event of conductTurn(db, project.id, 'test')) {
      events.push(event);
    }

    const streamStart = events.find((e) => e.type === 'stream-start');
    expect(streamStart).toBeDefined();
    expect(streamStart.messageId).toBe('msg-42');
  });

  it('yields thinking events for thinking_delta', async () => {
    mockStream.mockReturnValueOnce(
      makeMockMessageStream([
        { type: 'message_start', message: { id: 'msg-1' } },
        {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'thinking_delta', thinking: 'Let me think...' },
        },
        { type: 'message_stop' },
      ]),
    );

    const project = getOrCreateProject(db);
    const events: any[] = [];
    for await (const event of conductTurn(db, project.id, 'test')) {
      events.push(event);
    }

    const thinking = events.find((e) => e.type === 'thinking');
    expect(thinking).toBeDefined();
    expect(thinking.delta).toBe('Let me think...');
  });

  it('yields text-delta events and persists assistant text', async () => {
    mockStream.mockReturnValueOnce(
      makeMockMessageStream([
        { type: 'message_start', message: { id: 'msg-1' } },
        {
          type: 'content_block_delta',
          index: 1,
          delta: { type: 'text_delta', text: 'Hello!' },
        },
        { type: 'message_stop' },
      ]),
    );

    const project = getOrCreateProject(db);
    const events: any[] = [];
    for await (const event of conductTurn(db, project.id, 'test')) {
      events.push(event);
    }

    const textDelta = events.find((e) => e.type === 'text-delta');
    expect(textDelta).toBeDefined();
    expect(textDelta.delta).toBe('Hello!');

    const turns = getActivePath(db, project.id);
    expect(turns).toHaveLength(1);
    expect(turns[0].question).toBe('Hello!');
    expect(turns[0].answer).toBe('test');
  });

  it('yields stream-end and advances HEAD', async () => {
    const project = getOrCreateProject(db);
    const events: any[] = [];
    for await (const event of conductTurn(db, project.id, 'hello')) {
      events.push(event);
    }

    const streamEnd = events.find((e) => e.type === 'stream-end');
    expect(streamEnd).toBeDefined();

    const updated = getOrCreateProject(db);
    expect(updated.active_turn_id).not.toBeNull();
  });

  it('yields error event on SDK failure', async () => {
    const failStream = {
      [Symbol.asyncIterator]: () =>
        (async function* () {
          throw new Error('API rate limit');
        })()[Symbol.asyncIterator](),
      on: vi.fn().mockReturnThis(),
      finalMessage: vi.fn().mockRejectedValue(new Error('API rate limit')),
    };
    mockStream.mockReturnValueOnce(failStream);

    const project = getOrCreateProject(db);
    const events: any[] = [];
    for await (const event of conductTurn(db, project.id, 'test')) {
      events.push(event);
    }

    const error = events.find((e) => e.type === 'error');
    expect(error).toBeDefined();
    expect(error.message).toBe('API rate limit');
  });

  it('yields tool-call-start for tool_use content blocks', async () => {
    mockStream.mockReturnValueOnce(
      makeMockMessageStream([
        { type: 'message_start', message: { id: 'msg-1' } },
        {
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'tool_use', name: 'get_weather', id: 'toolu_01' },
        },
        { type: 'content_block_stop', index: 0 },
        { type: 'message_stop' },
      ]),
    );

    const project = getOrCreateProject(db);
    const events: any[] = [];
    for await (const event of conductTurn(db, project.id, 'weather?')) {
      events.push(event);
    }

    const toolStart = events.find((e) => e.type === 'tool-call-start');
    expect(toolStart).toBeDefined();
    expect(toolStart.toolName).toBe('get_weather');
    expect(toolStart.toolCallId).toBe('toolu_01');
  });

  it('yields tool-call-delta for input_json_delta', async () => {
    mockStream.mockReturnValueOnce(
      makeMockMessageStream([
        { type: 'message_start', message: { id: 'msg-1' } },
        {
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'tool_use', name: 'get_weather', id: 'toolu_01' },
        },
        {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'input_json_delta', partial_json: '{"city":"NYC"}' },
        },
        { type: 'content_block_stop', index: 0 },
        { type: 'message_stop' },
      ]),
    );

    const project = getOrCreateProject(db);
    const events: any[] = [];
    for await (const event of conductTurn(db, project.id, 'weather?')) {
      events.push(event);
    }

    const toolDelta = events.find((e) => e.type === 'tool-call-delta');
    expect(toolDelta).toBeDefined();
    expect(toolDelta.toolCallId).toBe('toolu_01');
    expect(toolDelta.delta).toBe('{"city":"NYC"}');
  });

  it('yields tool-call-end with toolCallId and toolName', async () => {
    mockStream.mockReturnValueOnce(
      makeMockMessageStream([
        { type: 'message_start', message: { id: 'msg-1' } },
        {
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'tool_use', name: 'get_weather', id: 'toolu_01' },
        },
        {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'input_json_delta', partial_json: '{"city":"NYC"}' },
        },
        { type: 'content_block_stop', index: 0 },
        { type: 'message_stop' },
      ]),
    );

    const project = getOrCreateProject(db);
    const events: any[] = [];
    for await (const event of conductTurn(db, project.id, 'weather?')) {
      events.push(event);
    }

    const toolEnd = events.find((e) => e.type === 'tool-call-end');
    expect(toolEnd).toBeDefined();
    expect(toolEnd.toolCallId).toBe('toolu_01');
    expect(toolEnd.toolName).toBe('get_weather');
  });

  it('chains turns with parent pointers', async () => {
    const project = getOrCreateProject(db);
    for await (const _ of conductTurn(db, project.id, 'first')) {
      /* consume */
    }

    mockStream.mockReturnValueOnce(
      makeMockMessageStream([{ type: 'message_start', message: { id: 'msg-2' } }, { type: 'message_stop' }]),
    );

    for await (const _ of conductTurn(db, project.id, 'second')) {
      /* consume */
    }

    const turns = getActivePath(db, project.id);
    expect(turns).toHaveLength(2);
    expect(turns[1].parent_turn_id).toBe(turns[0].id);
  });

  it('persists assistant_parts after stream finish', async () => {
    mockStream.mockReturnValueOnce(
      makeMockMessageStream([
        { type: 'message_start', message: { id: 'msg-1' } },
        {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'thinking_delta', thinking: 'Let me think...' },
        },
        {
          type: 'content_block_delta',
          index: 1,
          delta: { type: 'text_delta', text: 'My answer.' },
        },
        { type: 'message_stop' },
      ]),
    );

    const project = getOrCreateProject(db);
    const events: any[] = [];
    for await (const event of conductTurn(db, project.id, 'test')) {
      events.push(event);
    }

    const turnCreated = events.find((e) => e.type === 'turn-created');
    const savedTurn = getTurn(db, turnCreated.turn.id);
    expect(savedTurn?.assistant_parts).not.toBeNull();

    const parts = JSON.parse(savedTurn!.assistant_parts!);
    expect(parts.some((p: any) => p.type === 'reasoning')).toBe(true);
    expect(parts.some((p: any) => p.type === 'text')).toBe(true);
  });
});
