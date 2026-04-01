import request from 'supertest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { DB } from './db.js';

// Mock the Claude Agent SDK
const mockQuery = vi.fn();
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: mockQuery,
}));

// Import app factory after mocking
const { createApp } = await import('./app.js');

let app: ReturnType<typeof createApp>['app'];
let db: DB;

beforeEach(() => {
  mockQuery.mockReset();
  const result = createApp();
  app = result.app;
  db = result.db;
});

afterEach(() => {
  db.$client.close();
});

/** Helper: collect full SSE body as string */
function collectSSE(res: request.Response): string {
  return res.text;
}

/** Helper: parse SSE lines into data payloads */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseSSELines(body: string): any[] {
  return body
    .split('\n\n')
    .filter(Boolean)
    .map((chunk: string) => {
      const line = chunk.replace(/^data: /, '');
      if (line === '[DONE]') return '[DONE]';
      return JSON.parse(line);
    });
}

/** Create a mock async generator of SDK messages */
async function* makeMockStream(messages: Record<string, unknown>[]) {
  for (const msg of messages) {
    yield msg;
  }
}

/** Standard mock stream that produces a text response */
function mockTextStream(text = 'Hi') {
  return makeMockStream([
    {
      type: 'stream_event',
      event: { type: 'message_start', message: { id: 'msg-1', role: 'assistant', content: [] } },
    },
    {
      type: 'stream_event',
      event: { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    },
    {
      type: 'stream_event',
      event: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } },
    },
    {
      type: 'stream_event',
      event: { type: 'content_block_stop', index: 0 },
    },
    {
      type: 'stream_event',
      event: { type: 'message_stop' },
    },
  ]);
}

/** Helper: create a project and return its ID */
async function createTestProject(name = 'Test Project'): Promise<number> {
  const res = await request(app).post('/api/projects').send({ name });
  return res.body.id;
}

describe('GET /api/projects', () => {
  it('returns empty array when no projects exist', async () => {
    const res = await request(app).get('/api/projects').expect(200);

    expect(res.body).toEqual([]);
  });

  it('returns project list after creation', async () => {
    await createTestProject('Alpha');
    await createTestProject('Beta');

    const res = await request(app).get('/api/projects').expect(200);

    expect(res.body).toHaveLength(2);
    expect(res.body[0].name).toBeDefined();
    expect(res.body[1].name).toBeDefined();
  });
});

describe('POST /api/projects', () => {
  it('creates a new project and returns it', async () => {
    const res = await request(app).post('/api/projects').send({ name: 'My Spec' }).expect(201);

    expect(res.body.name).toBe('My Spec');
    expect(res.body.id).toBeDefined();
  });

  it('returns 400 when name is missing', async () => {
    await request(app).post('/api/projects').send({}).expect(400);
  });
});

describe('GET /api/projects/:id', () => {
  it('returns a project with empty turns when no history exists', async () => {
    const projectId = await createTestProject('Test');

    const res = await request(app).get(`/api/projects/${projectId}`).expect(200);

    expect(res.body.project).toMatchObject({ name: 'Test' });
    expect(res.body.turns).toEqual([]);
  });

  it('returns 404 for non-existent project', async () => {
    await request(app).get('/api/projects/9999').expect(404);
  });

  it('returns turns on active path after a chat exchange', async () => {
    const projectId = await createTestProject('Chat Test');
    mockQuery.mockReturnValue(mockTextStream('Hi'));

    await request(app)
      .post(`/api/projects/${projectId}/chat`)
      .send({ messages: [{ role: 'user', content: 'hello' }] });

    const res = await request(app).get(`/api/projects/${projectId}`).expect(200);

    expect(res.body.turns).toHaveLength(1);
    expect(res.body.turns[0].answer).toBe('hello');
    expect(res.body.turns[0].question).toContain('Hi');
  });
});

describe('POST /api/projects/:id/chat', () => {
  it('returns Content-Type text/event-stream', async () => {
    const projectId = await createTestProject();
    mockQuery.mockReturnValue(mockTextStream());

    const res = await request(app)
      .post(`/api/projects/${projectId}/chat`)
      .send({ messages: [{ role: 'user', content: 'hello' }] })
      .expect('Content-Type', /text\/event-stream/);

    expect(res.status).toBe(200);
  });

  it('produces well-formed SSE lines with data: prefix and double newline delimiters', async () => {
    const projectId = await createTestProject();
    mockQuery.mockReturnValue(
      makeMockStream([
        {
          type: 'stream_event',
          event: {
            type: 'message_start',
            message: { id: 'msg-1', role: 'assistant', content: [] },
          },
        },
        {
          type: 'stream_event',
          event: {
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'text_delta', text: 'Hi' },
          },
        },
        {
          type: 'stream_event',
          event: { type: 'message_stop' },
        },
      ]),
    );

    const res = await request(app)
      .post(`/api/projects/${projectId}/chat`)
      .send({ messages: [{ role: 'user', content: 'hello' }] });

    const body = collectSSE(res);
    const lines = body.split('\n\n').filter(Boolean);
    for (const line of lines) {
      expect(line).toMatch(/^data: /);
    }
  });

  it('contains at least one text-delta event with non-empty text', async () => {
    const projectId = await createTestProject();
    mockQuery.mockReturnValue(mockTextStream('Hello!'));

    const res = await request(app)
      .post(`/api/projects/${projectId}/chat`)
      .send({ messages: [{ role: 'user', content: 'hello' }] });

    const events = parseSSELines(collectSSE(res));
    const textDeltas = events.filter((e: any) => e.type === 'text-delta');
    expect(textDeltas.length).toBeGreaterThanOrEqual(1);
    expect(textDeltas[0].delta).toBe('Hello!');
  });

  it('ends with finish event and [DONE]', async () => {
    const projectId = await createTestProject();
    mockQuery.mockReturnValue(mockTextStream());

    const res = await request(app)
      .post(`/api/projects/${projectId}/chat`)
      .send({ messages: [{ role: 'user', content: 'hello' }] });

    const events = parseSSELines(collectSSE(res));
    const last = events[events.length - 1];
    const secondToLast = events[events.length - 2];
    expect(last).toBe('[DONE]');
    expect(secondToLast.type).toBe('finish');
  });

  it('emits reasoning-delta events for thinking content', async () => {
    const projectId = await createTestProject();
    mockQuery.mockReturnValue(
      makeMockStream([
        {
          type: 'stream_event',
          event: {
            type: 'message_start',
            message: { id: 'msg-1', role: 'assistant', content: [] },
          },
        },
        {
          type: 'stream_event',
          event: {
            type: 'content_block_start',
            index: 0,
            content_block: { type: 'thinking', thinking: '' },
          },
        },
        {
          type: 'stream_event',
          event: {
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'thinking_delta', thinking: 'Hmm...' },
          },
        },
        {
          type: 'stream_event',
          event: { type: 'content_block_stop', index: 0 },
        },
        {
          type: 'stream_event',
          event: {
            type: 'content_block_start',
            index: 1,
            content_block: { type: 'text', text: '' },
          },
        },
        {
          type: 'stream_event',
          event: {
            type: 'content_block_delta',
            index: 1,
            delta: { type: 'text_delta', text: 'Answer' },
          },
        },
        {
          type: 'stream_event',
          event: { type: 'content_block_stop', index: 1 },
        },
        {
          type: 'stream_event',
          event: { type: 'message_stop' },
        },
      ]),
    );

    const res = await request(app)
      .post(`/api/projects/${projectId}/chat`)
      .send({ messages: [{ role: 'user', content: 'hello' }] });

    const events = parseSSELines(collectSSE(res));

    const reasoningStart = events.find((e: any) => e.type === 'reasoning-start');
    const reasoningDelta = events.find((e: any) => e.type === 'reasoning-delta');
    const reasoningEnd = events.find((e: any) => e.type === 'reasoning-end');
    expect(reasoningStart).toBeDefined();
    expect(reasoningDelta).toBeDefined();
    expect(reasoningDelta.delta).toBe('Hmm...');
    expect(reasoningEnd).toBeDefined();

    const textDelta = events.find((e: any) => e.type === 'text-delta');
    expect(textDelta).toBeDefined();
    expect(textDelta.delta).toBe('Answer');
  });
});

describe('POST /api/projects/:id/chat — tool calls', () => {
  it('emits tool-call SSE events for tool-using mock stream', async () => {
    const projectId = await createTestProject();
    mockQuery.mockReturnValue(
      makeMockStream([
        {
          type: 'stream_event',
          event: {
            type: 'message_start',
            message: { id: 'msg-1', role: 'assistant', content: [] },
          },
        },
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
        {
          type: 'stream_event',
          event: { type: 'content_block_stop', index: 0 },
        },
        {
          type: 'stream_event',
          event: {
            type: 'content_block_start',
            index: 1,
            content_block: { type: 'text', text: '' },
          },
        },
        {
          type: 'stream_event',
          event: {
            type: 'content_block_delta',
            index: 1,
            delta: { type: 'text_delta', text: 'Weather result' },
          },
        },
        {
          type: 'stream_event',
          event: { type: 'content_block_stop', index: 1 },
        },
        {
          type: 'stream_event',
          event: { type: 'message_stop' },
        },
      ]),
    );

    const res = await request(app)
      .post(`/api/projects/${projectId}/chat`)
      .send({ messages: [{ role: 'user', content: 'weather?' }] });

    const events = parseSSELines(collectSSE(res));

    const toolStart = events.find((e: any) => e.type === 'tool-call-streaming-start');
    expect(toolStart).toBeDefined();
    expect(toolStart.toolName).toBe('get_weather');

    const toolDelta = events.find((e: any) => e.type === 'tool-call-delta');
    expect(toolDelta).toBeDefined();
    expect(toolDelta.delta).toBe('{"city":"NYC"}');

    const toolCall = events.find((e: any) => e.type === 'tool-call');
    expect(toolCall).toBeDefined();
    expect(toolCall.args).toBe('{"city":"NYC"}');

    const textDelta = events.find((e: any) => e.type === 'text-delta');
    expect(textDelta).toBeDefined();
    expect(textDelta.delta).toBe('Weather result');
  });
});

describe('POST /api/projects/:id/chat — turn persistence', () => {
  it('creates a turn with user answer and advances HEAD', async () => {
    const projectId = await createTestProject();
    mockQuery.mockReturnValue(mockTextStream('Hi there'));

    await request(app)
      .post(`/api/projects/${projectId}/chat`)
      .send({ messages: [{ role: 'user', content: 'hello' }] });

    const { getProject, getActivePath } = await import('./db.js');
    const project = getProject(db, projectId);
    expect(project).toBeDefined();
    expect(project!.active_turn_id).not.toBeNull();
    const turns = getActivePath(db, projectId);
    expect(turns).toHaveLength(1);
    expect(turns[0].answer).toBe('hello');
    expect(turns[0].question).toContain('Hi there');
    expect(turns[0].phase).toBe('scope');
  });

  it('chains turns with parent pointers across exchanges', async () => {
    const projectId = await createTestProject();
    mockQuery.mockReturnValue(mockTextStream('First response'));
    await request(app)
      .post(`/api/projects/${projectId}/chat`)
      .send({ messages: [{ role: 'user', content: 'first' }] });

    mockQuery.mockReturnValue(mockTextStream('Second response'));
    await request(app)
      .post(`/api/projects/${projectId}/chat`)
      .send({ messages: [{ role: 'user', content: 'second' }] });

    const { getActivePath } = await import('./db.js');
    const turns = getActivePath(db, projectId);
    expect(turns).toHaveLength(2);
    expect(turns[0].answer).toBe('first');
    expect(turns[1].answer).toBe('second');
    expect(turns[1].parent_turn_id).toBe(turns[0].id);
  });
});
