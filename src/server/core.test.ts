import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { DB } from './db.js';

// Mock the Claude Agent SDK
const mockQuery = vi.fn();
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: mockQuery,
  createSdkMcpServer: () => ({ name: 'interview', instance: {} }),
  tool: (name: string, desc: string, schema: any, handler: any) => ({
    name,
    description: desc,
    inputSchema: schema,
    handler,
  }),
}));

const { conductTurn, extractPrompt } = await import('./core.js');
const { buildInterviewerContext } = await import('./context.js');
const { createDb, getOrCreateProject, getActivePath, getTurn } = await import('./db.js');

let db: DB;

beforeEach(() => {
  mockQuery.mockReset();
  // Default: observer gets empty result for any call not covered by mockReturnValueOnce
  mockQuery.mockImplementation(() =>
    makeMockStream([
      {
        type: 'result',
        subtype: 'success',
        duration_ms: 500,
        duration_api_ms: 300,
        total_cost_usd: 0.0005,
        is_error: false,
        num_turns: 1,
        usage: { input_tokens: 100, output_tokens: 50 },
        result: '',
        structured_output: { decisions: [], assumptions: [] },
      },
    ]),
  );
  db = createDb();
});

afterEach(() => {
  db.$client.close();
});

/** Create a mock async generator of SDK messages */
async function* makeMockStream(messages: Record<string, unknown>[]) {
  for (const msg of messages) {
    yield msg;
  }
}

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
    mockQuery.mockReturnValueOnce(
      makeMockStream([
        { type: 'stream_event', event: { type: 'message_start', message: { id: 'msg-1' } } },
        { type: 'stream_event', event: { type: 'message_stop' } },
      ]),
    );

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
    mockQuery.mockReturnValueOnce(
      makeMockStream([
        { type: 'stream_event', event: { type: 'message_start', message: { id: 'msg-42' } } },
        { type: 'stream_event', event: { type: 'message_stop' } },
      ]),
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
    mockQuery.mockReturnValueOnce(
      makeMockStream([
        { type: 'stream_event', event: { type: 'message_start', message: { id: 'msg-1' } } },
        {
          type: 'stream_event',
          event: {
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'thinking_delta', thinking: 'Let me think...' },
          },
        },
        { type: 'stream_event', event: { type: 'message_stop' } },
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
    mockQuery.mockReturnValueOnce(
      makeMockStream([
        { type: 'stream_event', event: { type: 'message_start', message: { id: 'msg-1' } } },
        {
          type: 'stream_event',
          event: {
            type: 'content_block_delta',
            index: 1,
            delta: { type: 'text_delta', text: 'Hello!' },
          },
        },
        { type: 'stream_event', event: { type: 'message_stop' } },
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

    // Verify turn was persisted with assistant text
    const turns = getActivePath(db, project.id);
    expect(turns).toHaveLength(1);
    expect(turns[0].question).toBe('Hello!');
    expect(turns[0].answer).toBe('test');
  });

  it('yields stream-end and advances HEAD', async () => {
    mockQuery.mockReturnValueOnce(
      makeMockStream([
        { type: 'stream_event', event: { type: 'message_start', message: { id: 'msg-1' } } },
        {
          type: 'stream_event',
          event: {
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'text_delta', text: 'Hi' },
          },
        },
        { type: 'stream_event', event: { type: 'message_stop' } },
      ]),
    );

    const project = getOrCreateProject(db);
    const events: any[] = [];
    for await (const event of conductTurn(db, project.id, 'hello')) {
      events.push(event);
    }

    const streamEnd = events.find((e) => e.type === 'stream-end');
    expect(streamEnd).toBeDefined();

    // HEAD should be advanced
    const updated = getOrCreateProject(db);
    expect(updated.active_turn_id).not.toBeNull();
  });

  it('yields error event on SDK failure', async () => {
    mockQuery.mockReturnValueOnce(
      // oxlint-disable-next-line require-yield -- intentional: tests error before first yield
      (async function* () {
        throw new Error('API rate limit');
      })(),
    );

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
    mockQuery.mockReturnValueOnce(
      makeMockStream([
        { type: 'stream_event', event: { type: 'message_start', message: { id: 'msg-1' } } },
        {
          type: 'stream_event',
          event: {
            type: 'content_block_start',
            index: 0,
            content_block: { type: 'tool_use', name: 'get_weather', id: 'toolu_01' },
          },
        },
        { type: 'stream_event', event: { type: 'content_block_stop', index: 0 } },
        { type: 'stream_event', event: { type: 'message_stop' } },
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
    mockQuery.mockReturnValueOnce(
      makeMockStream([
        { type: 'stream_event', event: { type: 'message_start', message: { id: 'msg-1' } } },
        {
          type: 'stream_event',
          event: {
            type: 'content_block_start',
            index: 0,
            content_block: { type: 'tool_use', name: 'get_weather', id: 'toolu_01' },
          },
        },
        {
          type: 'stream_event',
          event: {
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'input_json_delta', partial_json: '{"city":"NYC"}' },
          },
        },
        { type: 'stream_event', event: { type: 'content_block_stop', index: 0 } },
        { type: 'stream_event', event: { type: 'message_stop' } },
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
    mockQuery.mockReturnValueOnce(
      makeMockStream([
        { type: 'stream_event', event: { type: 'message_start', message: { id: 'msg-1' } } },
        {
          type: 'stream_event',
          event: {
            type: 'content_block_start',
            index: 0,
            content_block: { type: 'tool_use', name: 'get_weather', id: 'toolu_01' },
          },
        },
        {
          type: 'stream_event',
          event: {
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'input_json_delta', partial_json: '{"city":"NYC"}' },
          },
        },
        { type: 'stream_event', event: { type: 'content_block_stop', index: 0 } },
        { type: 'stream_event', event: { type: 'message_stop' } },
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
    // First turn
    mockQuery.mockReturnValueOnce(
      makeMockStream([
        { type: 'stream_event', event: { type: 'message_start', message: { id: 'msg-1' } } },
        {
          type: 'stream_event',
          event: {
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'text_delta', text: 'First' },
          },
        },
        { type: 'stream_event', event: { type: 'message_stop' } },
      ]),
    );

    const project = getOrCreateProject(db);
    for await (const _ of conductTurn(db, project.id, 'first')) {
      /* consume */
    }

    // Second turn
    mockQuery.mockReturnValueOnce(
      makeMockStream([
        { type: 'stream_event', event: { type: 'message_start', message: { id: 'msg-2' } } },
        {
          type: 'stream_event',
          event: {
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'text_delta', text: 'Second' },
          },
        },
        { type: 'stream_event', event: { type: 'message_stop' } },
      ]),
    );

    for await (const _ of conductTurn(db, project.id, 'second')) {
      /* consume */
    }

    const turns = getActivePath(db, project.id);
    expect(turns).toHaveLength(2);
    expect(turns[1].parent_turn_id).toBe(turns[0].id);
  });

  it('persists assistant_parts after stream finish', async () => {
    mockQuery.mockReturnValueOnce(
      makeMockStream([
        { type: 'stream_event', event: { type: 'message_start', message: { id: 'msg-1' } } },
        {
          type: 'stream_event',
          event: {
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'thinking_delta', thinking: 'Let me think...' },
          },
        },
        {
          type: 'stream_event',
          event: {
            type: 'content_block_delta',
            index: 1,
            delta: { type: 'text_delta', text: 'My answer.' },
          },
        },
        { type: 'stream_event', event: { type: 'message_stop' } },
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
