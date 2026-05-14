import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockStreamText, mockStreamInterviewer, mockRunObserver, mockAnthropic } = vi.hoisted(() => ({
  mockStreamText: vi.fn(),
  mockStreamInterviewer: vi.fn(),
  mockRunObserver: vi.fn(),
  mockAnthropic: vi.fn(() => 'mock-side-chat-model'),
}));

vi.mock('ai', async () => {
  const actual = await vi.importActual<typeof import('ai')>('ai');
  return {
    ...actual,
    streamText: mockStreamText,
  };
});

vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: mockAnthropic,
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
const dbModule = await import('./db.js');

let app: ReturnType<typeof createApp>['app'];
let db: ReturnType<typeof createApp>['db'];

function makeTextStream(chunks: readonly string[]) {
  return {
    textStream: (async function* () {
      for (const chunk of chunks) {
        yield chunk;
      }
    })(),
    fullStream: (async function* () {
      for (const chunk of chunks) {
        yield { type: 'text-delta', text: chunk };
      }
    })(),
  };
}

function makeFullStream(parts: readonly Record<string, unknown>[]) {
  return {
    textStream: (async function* () {
      for (const part of parts) {
        if (part.type === 'text-delta' && typeof part.text === 'string') {
          yield part.text;
        }
      }
    })(),
    fullStream: (async function* () {
      for (const part of parts) {
        yield part;
      }
    })(),
  };
}

function makeFailingTextStream(chunksBeforeError: readonly string[], error: Error) {
  return {
    textStream: (async function* () {
      for (const chunk of chunksBeforeError) {
        yield chunk;
      }
      throw error;
    })(),
    fullStream: (async function* () {
      for (const chunk of chunksBeforeError) {
        yield { type: 'text-delta', text: chunk };
      }
      throw error;
    })(),
  };
}

async function createSpec(name = 'Side-chat test spec'): Promise<number> {
  const res = await request(app).post('/api/specifications').send({ name }).expect(201);
  return res.body.id;
}

function seedKnowledgeItem(
  specId: number,
  kind: 'goal' | 'term' | 'context' | 'constraint' | 'requirement' | 'criterion' | 'decision' | 'assumption',
  content: string,
  rationale: string | null = null,
) {
  return dbModule.createKnowledgeItem(db, specId, kind, content, { rationale });
}

beforeEach(() => {
  mockStreamText.mockReset();
  mockStreamInterviewer.mockReset();
  mockRunObserver.mockReset();
  mockAnthropic.mockClear();
  mockStreamText.mockReturnValue(makeTextStream(['Hello ', 'from ', 'side-chat.']));

  const created = createApp();
  app = created.app;
  db = created.db;
});

afterEach(() => {
  db.$client.close();
});

describe('POST /api/specifications/:id/side-chat', () => {
  it('returns 404 when the specification does not exist', async () => {
    const res = await request(app)
      .post('/api/specifications/99999/side-chat')
      .send({ itemKind: 'decision', itemId: 1, message: 'Why?' })
      .expect(404);

    expect(res.body).toMatchObject({ error: expect.any(String) });
    expect(mockStreamText).not.toHaveBeenCalled();
  });

  it('returns 400 when the specification id is not a number', async () => {
    await request(app)
      .post('/api/specifications/not-a-number/side-chat')
      .send({ itemKind: 'decision', itemId: 1, message: 'Why?' })
      .expect(400);
    expect(mockStreamText).not.toHaveBeenCalled();
  });

  it('returns 400 when the request body is invalid', async () => {
    const specId = await createSpec();
    await request(app)
      .post(`/api/specifications/${specId}/side-chat`)
      .send({ itemKind: 'not-a-kind', itemId: 1, message: 'Why?' })
      .expect(400);
    expect(mockStreamText).not.toHaveBeenCalled();
  });

  it('returns 400 when the message is empty', async () => {
    const specId = await createSpec();
    const decision = seedKnowledgeItem(specId, 'decision', 'Use SQLite.');

    await request(app)
      .post(`/api/specifications/${specId}/side-chat`)
      .send({ itemKind: 'decision', itemId: decision.id, message: '   ' })
      .expect(400);
    expect(mockStreamText).not.toHaveBeenCalled();
  });

  it('returns 404 when (itemKind, itemId) does not resolve to an item in the spec', async () => {
    const specId = await createSpec();
    seedKnowledgeItem(specId, 'decision', 'Use SQLite.');

    await request(app)
      .post(`/api/specifications/${specId}/side-chat`)
      .send({ itemKind: 'decision', itemId: 99999, message: 'Why?' })
      .expect(404);
    expect(mockStreamText).not.toHaveBeenCalled();
  });

  it('returns 404 when the (itemKind, itemId) belongs to a different spec', async () => {
    const specA = await createSpec('Spec A');
    const specB = await createSpec('Spec B');
    const decisionInSpecA = seedKnowledgeItem(specA, 'decision', 'Spec A decision');

    await request(app)
      .post(`/api/specifications/${specB}/side-chat`)
      .send({ itemKind: 'decision', itemId: decisionInSpecA.id, message: 'Why?' })
      .expect(404);
    expect(mockStreamText).not.toHaveBeenCalled();
  });

  it('returns 200 with text/event-stream and streams chunks incrementally for a valid request', async () => {
    const specId = await createSpec();
    const decision = seedKnowledgeItem(specId, 'decision', 'Use SQLite.', 'Local-first.');

    const res = await request(app)
      .post(`/api/specifications/${specId}/side-chat`)
      .send({ itemKind: 'decision', itemId: decision.id, message: 'Why SQLite?' })
      .expect(200)
      .expect('Content-Type', /text\/event-stream/);

    expect(res.text).toContain('Hello ');
    expect(res.text).toContain('from ');
    expect(res.text).toContain('side-chat.');
    expect(res.text).toContain('[DONE]');
  });

  it('does not pass tools to streamText when mode is omitted (explore default)', async () => {
    const specId = await createSpec();
    const decision = seedKnowledgeItem(specId, 'decision', 'Use SQLite.');

    await request(app)
      .post(`/api/specifications/${specId}/side-chat`)
      .send({ itemKind: 'decision', itemId: decision.id, message: 'Why SQLite?' })
      .expect(200);

    expect(mockStreamText).toHaveBeenCalled();
    const callArgs = mockStreamText.mock.calls[0]?.[0] as { tools?: Record<string, unknown> };
    const tools = callArgs.tools ?? {};
    expect(Object.keys(tools)).toHaveLength(0);
  });

  it('passes the propose_edit tool to streamText when mode is "edit"', async () => {
    const specId = await createSpec();
    const decision = seedKnowledgeItem(specId, 'decision', 'Use SQLite.');

    await request(app)
      .post(`/api/specifications/${specId}/side-chat`)
      .send({
        itemKind: 'decision',
        itemId: decision.id,
        message: 'Reword this terser',
        mode: 'edit',
      })
      .expect(200);

    expect(mockStreamText).toHaveBeenCalled();
    const callArgs = mockStreamText.mock.calls[0]?.[0] as { tools?: Record<string, unknown> };
    expect(callArgs.tools).toBeDefined();
    expect(callArgs.tools).toHaveProperty('propose_edit');
  });

  it('passes the edit-mode addendum to streamText system when mode is "edit"', async () => {
    const specId = await createSpec();
    const decision = seedKnowledgeItem(specId, 'decision', 'Use SQLite.');

    await request(app)
      .post(`/api/specifications/${specId}/side-chat`)
      .send({
        itemKind: 'decision',
        itemId: decision.id,
        message: 'Reword',
        mode: 'edit',
      })
      .expect(200);

    const callArgs = mockStreamText.mock.calls[0]?.[0] as { system: string };
    expect(callArgs.system).toMatch(/edit mode/i);
    expect(callArgs.system).toMatch(/propose_edit/i);
  });

  it('emits a patch-proposal SSE chunk when the model calls propose_edit in edit mode', async () => {
    mockStreamText.mockReturnValueOnce(
      makeFullStream([
        { type: 'text-delta', text: "Sure, I'll propose an edit. " },
        {
          type: 'tool-call',
          toolCallId: 'call-1',
          toolName: 'propose_edit',
          input: { newContent: 'SQLite for local persistence.', newRationale: 'Terser.' },
        },
      ]),
    );
    const specId = await createSpec();
    const decision = seedKnowledgeItem(specId, 'decision', 'Use SQLite.');

    const res = await request(app)
      .post(`/api/specifications/${specId}/side-chat`)
      .send({
        itemKind: 'decision',
        itemId: decision.id,
        message: 'Reword terser',
        mode: 'edit',
      })
      .expect(200);

    expect(res.text).toContain("Sure, I'll propose an edit. ");
    expect(res.text).toContain('"type":"patch-proposal"');
    expect(res.text).toContain('"toolName":"propose_edit"');
    expect(res.text).toContain('"newContent":"SQLite for local persistence."');
    expect(res.text).toContain('"newRationale":"Terser."');
    expect(res.text).toContain('[DONE]');
  });

  it('omits patch-proposal chunks for tool calls with names other than propose_edit', async () => {
    // Defensive: if a future tool call slips through with an unknown toolName,
    // the SSE stream should not echo it as a patch-proposal.
    mockStreamText.mockReturnValueOnce(
      makeFullStream([
        { type: 'text-delta', text: 'reply' },
        {
          type: 'tool-call',
          toolCallId: 'call-x',
          toolName: 'unknown_tool',
          input: { foo: 'bar' },
        },
      ]),
    );
    const specId = await createSpec();
    const decision = seedKnowledgeItem(specId, 'decision', 'Use SQLite.');

    const res = await request(app)
      .post(`/api/specifications/${specId}/side-chat`)
      .send({
        itemKind: 'decision',
        itemId: decision.id,
        message: 'hi',
        mode: 'edit',
      })
      .expect(200);

    expect(res.text).toContain('reply');
    expect(res.text).not.toContain('patch-proposal');
    expect(res.text).not.toContain('unknown_tool');
  });

  it('rejects unknown mode values with 400', async () => {
    const specId = await createSpec();
    const decision = seedKnowledgeItem(specId, 'decision', 'Use SQLite.');

    await request(app)
      .post(`/api/specifications/${specId}/side-chat`)
      .send({
        itemKind: 'decision',
        itemId: decision.id,
        message: 'Why?',
        mode: 'invalid-mode',
      })
      .expect(400);

    expect(mockStreamText).not.toHaveBeenCalled();
  });

  it('emits an error event instead of a done sentinel when the model fails mid-stream', async () => {
    mockStreamText.mockReturnValueOnce(makeFailingTextStream(['Partial reply.'], new Error('rate limited')));
    const specId = await createSpec();
    const decision = seedKnowledgeItem(specId, 'decision', 'Use SQLite.', 'Local-first.');

    const res = await request(app)
      .post(`/api/specifications/${specId}/side-chat`)
      .send({ itemKind: 'decision', itemId: decision.id, message: 'Why SQLite?' })
      .expect(200)
      .expect('Content-Type', /text\/event-stream/);

    expect(res.text).toContain('Partial reply.');
    expect(res.text).toContain('"type":"error"');
    expect(res.text).toContain('"message"');
    expect(res.text).not.toContain('[DONE]');
  });

  it('does not affect the interview active path (D113 invariant)', async () => {
    const specId = await createSpec();
    const decision = seedKnowledgeItem(specId, 'decision', 'Use SQLite.');

    const turnsBefore = dbModule.getActivePath(db, specId).length;

    await request(app)
      .post(`/api/specifications/${specId}/side-chat`)
      .send({ itemKind: 'decision', itemId: decision.id, message: 'Why?' })
      .expect(200);

    const turnsAfter = dbModule.getActivePath(db, specId).length;
    expect(turnsAfter - turnsBefore).toBe(0);
  });

  it('creates a side-chat thread and persists user + assistant turns', async () => {
    const specId = await createSpec();
    const decision = seedKnowledgeItem(specId, 'decision', 'Use SQLite.');

    await request(app)
      .post(`/api/specifications/${specId}/side-chat`)
      .send({ itemKind: 'decision', itemId: decision.id, message: 'Why SQLite?' })
      .expect(200);

    // Verify thread was created
    const spec = dbModule.getSpecification(db, specId)!;
    const threads = dbModule.listThreadsForChat(db, spec.primary_chat_id!);
    const sideThreads = threads.filter((t) => t.kind === 'side');
    expect(sideThreads).toHaveLength(1);
    expect(sideThreads[0].target_item_id).toBe(decision.id);
    // Anchored at the spec's active_turn_id at creation time
    expect(sideThreads[0].invoked_in_turn_id).toBe(spec.active_turn_id);

    // Verify user + assistant turns persisted
    const turnCounts = dbModule.countTurnsPerThread(db, [sideThreads[0].id]);
    expect(turnCounts.get(sideThreads[0].id)).toBe(2); // 1 user + 1 assistant
  });

  it('reuses the same side-chat thread across multiple messages to the same item', async () => {
    mockStreamText.mockReturnValue(makeTextStream(['First ', 'reply.']));
    const specId = await createSpec();
    const decision = seedKnowledgeItem(specId, 'decision', 'Use SQLite.');

    await request(app)
      .post(`/api/specifications/${specId}/side-chat`)
      .send({ itemKind: 'decision', itemId: decision.id, message: 'Why SQLite?' })
      .expect(200);

    mockStreamText.mockReturnValue(makeTextStream(['Second ', 'reply.']));
    await request(app)
      .post(`/api/specifications/${specId}/side-chat`)
      .send({
        itemKind: 'decision',
        itemId: decision.id,
        message: 'What about backups?',
        history: [
          { role: 'user', text: 'Why SQLite?' },
          { role: 'assistant', text: 'Hello from side-chat.' },
        ],
      })
      .expect(200);

    const spec = dbModule.getSpecification(db, specId)!;
    const threads = dbModule.listThreadsForChat(db, spec.primary_chat_id!);
    const sideThreads = threads.filter((t) => t.kind === 'side');
    expect(sideThreads).toHaveLength(1); // reused, not duplicated

    const turnCounts = dbModule.countTurnsPerThread(db, [sideThreads[0].id]);
    expect(turnCounts.get(sideThreads[0].id)).toBe(4); // 2 user + 2 assistant
  });

  it('does not invoke the observer across the full request lifecycle (D113 invariant)', async () => {
    const specId = await createSpec();
    const decision = seedKnowledgeItem(specId, 'decision', 'Use SQLite.');

    await request(app)
      .post(`/api/specifications/${specId}/side-chat`)
      .send({ itemKind: 'decision', itemId: decision.id, message: 'Why?' })
      .expect(200);

    expect(mockRunObserver).not.toHaveBeenCalled();
    expect(mockStreamInterviewer).not.toHaveBeenCalled();
  });

  it('passes the resolved item, message, and spec name into the LLM prompt', async () => {
    const specId = await createSpec('My Brunch Spec');
    const requirement = seedKnowledgeItem(
      specId,
      'requirement',
      'Users can export specs as Markdown.',
      'Markdown is the lingua franca of dev tooling.',
    );

    await request(app)
      .post(`/api/specifications/${specId}/side-chat`)
      .send({
        itemKind: 'requirement',
        itemId: requirement.id,
        message: 'Should this include images?',
      })
      .expect(200);

    expect(mockStreamText).toHaveBeenCalledTimes(1);
    const [callArgs] = mockStreamText.mock.calls[0];
    expect(callArgs.system).toMatch(/side[- ]chat/i);
    expect(callArgs.system).toContain('My Brunch Spec');

    const userMessages = callArgs.messages.filter((m: { role: string }) => m.role === 'user');
    expect(userMessages).toHaveLength(1);
    const [userMessage] = userMessages;
    expect(userMessage.content).toContain('Users can export specs as Markdown.');
    expect(userMessage.content).toContain('Markdown is the lingua franca of dev tooling.');
    expect(userMessage.content).toContain('Should this include images?');
    // The route looks the referenceCode up server-side.
    expect(userMessage.content).toMatch(/R\d+/);
  });

  it('forwards prior conversation turns into the LLM prompt as history', async () => {
    const specId = await createSpec();
    const decision = seedKnowledgeItem(specId, 'decision', 'Use SQLite.');

    await request(app)
      .post(`/api/specifications/${specId}/side-chat`)
      .send({
        itemKind: 'decision',
        itemId: decision.id,
        message: 'What about backups then?',
        history: [
          { role: 'user', text: 'Why SQLite?' },
          { role: 'assistant', text: 'In-process, zero ops.' },
        ],
      })
      .expect(200);

    const [callArgs] = mockStreamText.mock.calls[0];
    expect(callArgs.messages).toHaveLength(3);
    expect(callArgs.messages[0].role).toBe('user');
    expect(callArgs.messages[0].content).toContain('Why SQLite?');
    expect(callArgs.messages[1]).toEqual({
      role: 'assistant',
      content: 'In-process, zero ops.',
    });
    expect(callArgs.messages[2]).toEqual({
      role: 'user',
      content: 'What about backups then?',
    });
  });

  it('rejects history entries with empty text', async () => {
    const specId = await createSpec();
    const decision = seedKnowledgeItem(specId, 'decision', 'Use SQLite.');

    await request(app)
      .post(`/api/specifications/${specId}/side-chat`)
      .send({
        itemKind: 'decision',
        itemId: decision.id,
        message: 'Why?',
        history: [{ role: 'user', text: '' }],
      })
      .expect(400);
    expect(mockStreamText).not.toHaveBeenCalled();
  });

  it('does not include phase-stage interviewer instructions in the prompt', async () => {
    const specId = await createSpec();
    const decision = seedKnowledgeItem(specId, 'decision', 'Use SQLite.');

    await request(app)
      .post(`/api/specifications/${specId}/side-chat`)
      .send({ itemKind: 'decision', itemId: decision.id, message: 'Why?' })
      .expect(200);

    const [callArgs] = mockStreamText.mock.calls[0];
    expect(callArgs.system).not.toMatch(/grounding phase/i);
    expect(callArgs.system).not.toMatch(/ask_question/i);
    expect(callArgs.system).not.toMatch(/propose_phase_closure/i);
  });
});

describe('side-chat route — context extensions', () => {
  it('forwards activeAnnotations into the system prompt', async () => {
    const specId = await createSpec();
    const decision = seedKnowledgeItem(specId, 'decision', 'Use SQLite.');

    mockStreamText.mockReturnValue(makeTextStream(['ok']));

    await request(app)
      .post(`/api/specifications/${specId}/side-chat`)
      .send({
        itemKind: 'decision',
        itemId: decision.id,
        message: 'tell me more',
        activeAnnotations: [{ referenceCode: 'C1', snapshot: 'household', body: null }],
      })
      .expect(200);

    const callArgs = mockStreamText.mock.calls.at(-1)![0] as { system: string };
    expect(callArgs.system).toContain('User-pinned snippets');
    expect(callArgs.system).toContain('[C1]');
    expect(callArgs.system).toContain('household');
  });

  it('forwards spanHint into the latest user message content', async () => {
    const specId = await createSpec();
    const decision = seedKnowledgeItem(specId, 'decision', 'Use SQLite.');

    mockStreamText.mockReturnValue(makeTextStream(['ok']));

    await request(app)
      .post(`/api/specifications/${specId}/side-chat`)
      .send({
        itemKind: 'decision',
        itemId: decision.id,
        message: 'tell me more',
        spanHint: 'phrase',
      })
      .expect(200);

    const callArgs = mockStreamText.mock.calls.at(-1)![0] as {
      messages: { role: string; content: string }[];
    };
    const lastUser = [...callArgs.messages].reverse().find((m) => m.role === 'user')!;
    expect(lastUser.content).toContain('About the highlighted phrase');
    expect(lastUser.content).toContain('phrase');
    expect(lastUser.content).toContain('tell me more');
  });

  it('rejects activeAnnotations entries with empty referenceCode', async () => {
    const specId = await createSpec();
    const decision = seedKnowledgeItem(specId, 'decision', 'Use SQLite.');

    await request(app)
      .post(`/api/specifications/${specId}/side-chat`)
      .send({
        itemKind: 'decision',
        itemId: decision.id,
        message: 'm',
        activeAnnotations: [{ referenceCode: '', snapshot: 'x', body: null }],
      })
      .expect(400);
  });
});
