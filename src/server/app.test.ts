import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DB } from './db.js';

const { mockStreamInterviewer, mockRunObserver } = vi.hoisted(() => ({
  mockStreamInterviewer: vi.fn(),
  mockRunObserver: vi.fn(),
}));

vi.mock('./interview.js', async () => {
  const actual = await vi.importActual<typeof import('./interview.js')>('./interview.js');
  return {
    ...actual,
    streamInterviewer: mockStreamInterviewer,
  };
});

vi.mock('./observer.js', () => ({
  runObserver: mockRunObserver,
}));

const { createApp } = await import('./app.js');

let app: ReturnType<typeof createApp>['app'];
let db: DB;

const structuredQuestion = {
  question: 'What platform should we support first?',
  why: 'Platform choice determines the first UI and deployment constraints.',
  impact: 'high' as const,
  options: [
    { content: 'Web', is_recommended: true },
    { content: 'Desktop', is_recommended: false },
  ],
};

function makeUIChunkStream(chunks: Array<Record<string, unknown>>) {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });
}

function makeTextInterviewer(text = 'Hi') {
  return {
    toUIMessageStream: () =>
      makeUIChunkStream([
        { type: 'start', messageId: 'msg-1' },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: text },
        { type: 'text-end', id: 'text-1' },
      ]),
    finishReason: Promise.resolve('stop'),
  };
}

async function makeStructuredQuestionInterviewer(dbArg: DB, turnId: number) {
  const { updateTurn, createOption } = await import('./db.js');

  updateTurn(dbArg, turnId, {
    question: structuredQuestion.question,
    why: structuredQuestion.why,
    impact: structuredQuestion.impact,
  });

  structuredQuestion.options.forEach((option, index) => {
    createOption(dbArg, turnId, {
      position: index,
      content: option.content,
      is_recommended: option.is_recommended,
    });
  });

  return {
    toUIMessageStream: () =>
      makeUIChunkStream([
        { type: 'start', messageId: 'msg-structured' },
        { type: 'tool-input-start', toolCallId: 'tool-1', toolName: 'ask_question' },
        {
          type: 'tool-input-available',
          toolCallId: 'tool-1',
          toolName: 'ask_question',
          input: structuredQuestion,
        },
        {
          type: 'tool-output-available',
          toolCallId: 'tool-1',
          output: { ok: true, turnId, optionCount: structuredQuestion.options.length },
        },
      ]),
    finishReason: Promise.resolve('tool-calls'),
  };
}

function collectSSE(res: request.Response): string {
  return res.text;
}

function parseSSELines(body: string): Array<Record<string, unknown> | '[DONE]'> {
  return body
    .split('\n\n')
    .filter(Boolean)
    .map((chunk) => {
      const line = chunk.replace(/^data: /, '');
      if (line === '[DONE]') return '[DONE]';
      return JSON.parse(line) as Record<string, unknown>;
    });
}

async function createTestProject(name = 'Test Project'): Promise<number> {
  const res = await request(app).post('/api/projects').send({ name });
  return res.body.id;
}

beforeEach(() => {
  mockStreamInterviewer.mockReset();
  mockRunObserver.mockReset();
  mockStreamInterviewer.mockImplementation(async () => makeTextInterviewer('Hi'));
  mockRunObserver.mockResolvedValue({ decisions: [], assumptions: [] });

  const result = createApp();
  app = result.app;
  db = result.db;
});

afterEach(() => {
  db.$client.close();
});

describe('GET /api/projects', () => {
  it('returns an empty array when no projects exist', async () => {
    const res = await request(app).get('/api/projects').expect(200);
    expect(res.body).toEqual([]);
  });
});

describe('POST /api/projects/:id/chat', () => {
  it('requires typed UI messages', async () => {
    const projectId = await createTestProject();

    await request(app)
      .post(`/api/projects/${projectId}/chat`)
      .send({ messages: [{ role: 'user', content: 'hello' }] })
      .expect(400);
  });

  it('returns an AI SDK UI message stream and persists the turn', async () => {
    const projectId = await createTestProject();

    const res = await request(app)
      .post(`/api/projects/${projectId}/chat`)
      .send({
        messages: [{ id: 'u1', role: 'user', parts: [{ type: 'text', text: 'hello' }] }],
      })
      .expect('Content-Type', /text\/event-stream/)
      .expect(200);

    const events = parseSSELines(collectSSE(res));
    expect(events.some((event) => event !== '[DONE]' && event.type === 'text-delta')).toBe(true);
    expect(events.at(-1)).toBe('[DONE]');

    const { getActivePath } = await import('./db.js');
    const turns = getActivePath(db, projectId);
    expect(turns).toHaveLength(1);
    expect(turns[0].answer).toBe('hello');
    expect(turns[0].question).toBe('Hi');
    expect(turns[0].assistant_parts).not.toBeNull();
  });

  it('emits observer results as typed data parts', async () => {
    const projectId = await createTestProject();
    mockRunObserver.mockResolvedValue({ decisions: [1], assumptions: [2] });

    const res = await request(app)
      .post(`/api/projects/${projectId}/chat`)
      .send({
        messages: [{ id: 'u1', role: 'user', parts: [{ type: 'text', text: 'hello' }] }],
      })
      .expect(200);

    const events = parseSSELines(collectSSE(res)).filter((event) => event !== '[DONE]');
    const observerEvent = events.find((event) => event.type === 'data-observer-result');

    expect(observerEvent).toEqual({
      type: 'data-observer-result',
      data: { entityIds: { decisions: [1], assumptions: [2] } },
    });
  });
});

describe('GET /api/projects/:id', () => {
  it('returns structured question state after a tool-driven turn', async () => {
    const projectId = await createTestProject();
    mockStreamInterviewer.mockImplementation(async (dbArg, turn) =>
      makeStructuredQuestionInterviewer(dbArg as DB, (turn as { id: number }).id),
    );

    await request(app)
      .post(`/api/projects/${projectId}/chat`)
      .send({
        messages: [{ id: 'u1', role: 'user', parts: [{ type: 'text', text: 'hello' }] }],
      })
      .expect(200);

    const res = await request(app).get(`/api/projects/${projectId}`).expect(200);

    expect(res.body.turns).toHaveLength(1);
    expect(res.body.turns[0].question).toBe(structuredQuestion.question);
    expect(res.body.turns[0].options).toHaveLength(2);
    expect(res.body.turns[0].options[0].content).toBe('Web');
  });
});

describe('POST /api/projects/:id/turns/:turnId/select', () => {
  it('persists the selected option and free-text turn response into answer and user parts', async () => {
    const projectId = await createTestProject();
    mockStreamInterviewer.mockImplementation(async (dbArg, turn) =>
      makeStructuredQuestionInterviewer(dbArg as DB, (turn as { id: number }).id),
    );

    await request(app)
      .post(`/api/projects/${projectId}/chat`)
      .send({
        messages: [{ id: 'u1', role: 'user', parts: [{ type: 'text', text: 'hello' }] }],
      })
      .expect(200);

    const { getActivePath, getTurn, getOptionsForTurn } = await import('./db.js');
    const turn = getActivePath(db, projectId)[0];

    await request(app)
      .post(`/api/projects/${projectId}/turns/${turn.id}/select`)
      .send({ positions: [1], freeText: 'Best fit for our launch' })
      .expect(200);

    expect(getOptionsForTurn(db, turn.id)[1].is_selected).toBe(true);
    expect(getTurn(db, turn.id)?.answer).toBe('Desktop — Best fit for our launch');

    const userParts = JSON.parse(getTurn(db, turn.id)?.user_parts ?? '[]');
    expect(userParts).toEqual([
      { type: 'text', text: 'Desktop — Best fit for our launch' },
      {
        type: 'data-turn-response',
        data: {
          turnId: turn.id,
          selectedOptionIds: [getOptionsForTurn(db, turn.id)[1].id],
          freeText: 'Best fit for our launch',
        },
      },
    ]);
  });

  it('persists many selected options and free-text turn responses into answer and user parts', async () => {
    const projectId = await createTestProject();
    mockStreamInterviewer.mockImplementation(async (dbArg, turn) =>
      makeStructuredQuestionInterviewer(dbArg as DB, (turn as { id: number }).id),
    );

    await request(app)
      .post(`/api/projects/${projectId}/chat`)
      .send({
        messages: [{ id: 'u1', role: 'user', parts: [{ type: 'text', text: 'hello' }] }],
      })
      .expect(200);

    const { getActivePath, getTurn, getOptionsForTurn } = await import('./db.js');
    const turn = getActivePath(db, projectId)[0];

    await request(app)
      .post(`/api/projects/${projectId}/turns/${turn.id}/select`)
      .send({ positions: [0, 1], freeText: 'Covers both launch paths' })
      .expect(200);

    const selectedOptions = getOptionsForTurn(db, turn.id).filter((option) => option.is_selected);
    expect(selectedOptions.map((option) => option.content)).toEqual(['Web', 'Desktop']);
    expect(getTurn(db, turn.id)?.answer).toBe('Web, Desktop — Covers both launch paths');

    const userParts = JSON.parse(getTurn(db, turn.id)?.user_parts ?? '[]');
    expect(userParts).toEqual([
      { type: 'text', text: 'Web, Desktop — Covers both launch paths' },
      {
        type: 'data-turn-response',
        data: {
          turnId: turn.id,
          selectedOptionIds: selectedOptions.map((option) => option.id),
          freeText: 'Covers both launch paths',
        },
      },
    ]);
  });

  it('persists a free-text-only turn response when no option is selected', async () => {
    const projectId = await createTestProject();
    mockStreamInterviewer.mockImplementation(async (dbArg, turn) =>
      makeStructuredQuestionInterviewer(dbArg as DB, (turn as { id: number }).id),
    );

    await request(app)
      .post(`/api/projects/${projectId}/chat`)
      .send({
        messages: [{ id: 'u1', role: 'user', parts: [{ type: 'text', text: 'hello' }] }],
      })
      .expect(200);

    const { getActivePath, getTurn, getOptionsForTurn } = await import('./db.js');
    const turn = getActivePath(db, projectId)[0];

    await request(app)
      .post(`/api/projects/${projectId}/turns/${turn.id}/select`)
      .send({ freeText: 'None of these fit our use case' })
      .expect(200);

    expect(getOptionsForTurn(db, turn.id).every((option) => !option.is_selected)).toBe(true);
    expect(getTurn(db, turn.id)?.answer).toBe('None of these fit our use case');

    const userParts = JSON.parse(getTurn(db, turn.id)?.user_parts ?? '[]');
    expect(userParts).toEqual([
      { type: 'text', text: 'None of these fit our use case' },
      {
        type: 'data-turn-response',
        data: { turnId: turn.id, selectedOptionIds: [], freeText: 'None of these fit our use case' },
      },
    ]);
  });

  it('rejects a free-text-only turn response when no free text is provided', async () => {
    const projectId = await createTestProject();
    mockStreamInterviewer.mockImplementation(async (dbArg, turn) =>
      makeStructuredQuestionInterviewer(dbArg as DB, (turn as { id: number }).id),
    );

    await request(app)
      .post(`/api/projects/${projectId}/chat`)
      .send({
        messages: [{ id: 'u1', role: 'user', parts: [{ type: 'text', text: 'hello' }] }],
      })
      .expect(200);

    const { getActivePath } = await import('./db.js');
    const turn = getActivePath(db, projectId)[0];

    await request(app)
      .post(`/api/projects/${projectId}/turns/${turn.id}/select`)
      .send({ freeText: '   ' })
      .expect(400);
  });
});
