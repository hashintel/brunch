import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockStreamText, mockStreamInterviewer, mockRunObserver, mockAnthropic } = vi.hoisted(() => ({
  mockStreamText: vi.fn(),
  mockStreamInterviewer: vi.fn(),
  mockRunObserver: vi.fn(),
  mockAnthropic: vi.fn(() => 'mock-secondary-chat-model'),
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

interface FakeStreamTextOptions {
  text?: string;
  toolCalls?: ReadonlyArray<{ toolCallId: string; toolName: string; input?: unknown }>;
  finishReason?: string;
}

function makeStreamTextResult(options: FakeStreamTextOptions = {}) {
  const text = options.text ?? 'Hello from secondary-chat.';
  const toolCalls = options.toolCalls ?? [];
  const finishReason = options.finishReason ?? 'stop';

  return {
    toUIMessageStream: () => {
      const chunks: Array<Record<string, unknown>> = [
        { type: 'start', messageId: `msg-${Date.now()}` },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: text },
        { type: 'text-end', id: 'text-1' },
      ];
      for (const tc of toolCalls) {
        chunks.push({ type: 'tool-input-start', toolCallId: tc.toolCallId, toolName: tc.toolName });
        chunks.push({
          type: 'tool-input-available',
          toolCallId: tc.toolCallId,
          toolName: tc.toolName,
          input: tc.input ?? {},
        });
      }
      return new ReadableStream({
        start(controller) {
          for (const chunk of chunks) controller.enqueue(chunk);
          controller.close();
        },
      });
    },
    finishReason: Promise.resolve(finishReason),
    toolCalls: Promise.resolve(
      toolCalls.map((tc) => ({
        toolCallId: tc.toolCallId,
        toolName: tc.toolName,
        input: tc.input ?? {},
      })),
    ),
  };
}

function userMessagePayload(text: string): { messages: unknown[] } {
  return {
    messages: [
      {
        id: `user-${Date.now()}-${Math.random()}`,
        role: 'user',
        parts: [{ type: 'text', text }],
      },
    ],
  };
}

async function createSpec(name = 'Secondary-chat test spec'): Promise<number> {
  const res = await request(app).post('/api/specifications').send({ name }).expect(201);
  return res.body.id as number;
}

interface SecondaryChatFixture {
  specId: number;
  chatId: number;
  itemId: number;
  parentChatId: number;
  invokedInTurnId: number;
}

async function createSecondaryChatFixture(specName = 'Test'): Promise<SecondaryChatFixture> {
  const specId = await createSpec(specName);
  const item = dbModule.createKnowledgeItem(db, specId, 'goal', 'Reach product-market fit.');
  const parent = dbModule.getSpecification(db, specId);
  const parentChatId = parent!.primary_chat_id!;
  const parentTurn = dbModule.createTurn(db, specId, { phase: 'grounding', question: 'Q' });
  const res = await request(app)
    .post(`/api/specifications/${specId}/secondary-chats`)
    .send({
      parentChatId,
      invokedInTurnId: parentTurn.id,
      itemKind: 'goal',
      itemId: item.id,
    })
    .expect(200);
  return {
    specId,
    chatId: res.body.chatId as number,
    itemId: item.id,
    parentChatId,
    invokedInTurnId: parentTurn.id,
  };
}

beforeEach(() => {
  mockStreamText.mockReset();
  mockStreamInterviewer.mockReset();
  mockRunObserver.mockReset();
  mockAnthropic.mockClear();
  mockStreamText.mockReturnValue(makeStreamTextResult());

  const created = createApp();
  app = created.app;
  db = created.db;
});

afterEach(() => {
  db.$client.close();
});

describe('POST /api/specifications/:id/secondary-chats/:chatId/messages', () => {
  it('streams an assistant turn and round-trips it through the bundle in explore mode', async () => {
    const fixture = await createSecondaryChatFixture('FE-716 stream explore');

    const res = await request(app)
      .post(`/api/specifications/${fixture.specId}/secondary-chats/${fixture.chatId}/messages`)
      .send(userMessagePayload('Why product-market fit?'))
      .expect(200);

    expect(res.text).toContain('"type":"text-delta"');
    expect(res.text).toContain('Hello from secondary-chat.');

    const snapshotRes = await request(app).get(`/api/specifications/${fixture.specId}`).expect(200);
    const snapshot = snapshotRes.body as {
      secondaryChats?: Array<{
        chat: { id: number };
        turns: Array<{ user_parts: string | null; assistant_parts: string | null }>;
      }>;
    };
    const row = snapshot.secondaryChats?.find((r) => r.chat.id === fixture.chatId);
    expect(row).toBeTruthy();
    expect(row!.turns).toHaveLength(2);
    expect(row!.turns[0].user_parts).toBe('Why product-market fit?');
    expect(row!.turns[1].assistant_parts).toBe('Hello from secondary-chat.');
  });

  it('emits propose_edit as a tool-* UIMessage part AND data-edit-impact keyed by toolCallId in edit mode', async () => {
    const fixture = await createSecondaryChatFixture('FE-716 stream edit');
    await request(app)
      .patch(`/api/specifications/${fixture.specId}/secondary-chats/${fixture.chatId}/mode`)
      .send({ mode: 'edit' })
      .expect(200);

    mockStreamText.mockReturnValueOnce(
      makeStreamTextResult({
        text: 'Proposing an edit.',
        toolCalls: [
          {
            toolCallId: 'call-1',
            toolName: 'propose_edit',
            input: { newContent: 'Reach PMF.' },
          },
        ],
        finishReason: 'tool-calls',
      }),
    );

    const res = await request(app)
      .post(`/api/specifications/${fixture.specId}/secondary-chats/${fixture.chatId}/messages`)
      .send(userMessagePayload('Make this terser.'))
      .expect(200);

    expect(res.text).toContain('"type":"tool-input-available"');
    expect(res.text).toContain('"toolName":"propose_edit"');
    expect(res.text).toContain('"type":"data-edit-impact"');
    expect(res.text).toContain('"toolCallId":"call-1"');
  });

  it('passes the edit-mode tool set to streamText when chat.mode is edit', async () => {
    const fixture = await createSecondaryChatFixture('FE-716 edit tools');
    await request(app)
      .patch(`/api/specifications/${fixture.specId}/secondary-chats/${fixture.chatId}/mode`)
      .send({ mode: 'edit' })
      .expect(200);

    await request(app)
      .post(`/api/specifications/${fixture.specId}/secondary-chats/${fixture.chatId}/messages`)
      .send(userMessagePayload('Edit this.'))
      .expect(200);

    const callArgs = mockStreamText.mock.calls.at(-1)?.[0] as { tools?: Record<string, unknown> };
    expect(callArgs.tools).toBeDefined();
    expect(callArgs.tools).toHaveProperty('propose_edit');
  });

  it('does not pass edit tools to streamText when chat.mode is explore', async () => {
    const fixture = await createSecondaryChatFixture('FE-716 explore tools');

    await request(app)
      .post(`/api/specifications/${fixture.specId}/secondary-chats/${fixture.chatId}/messages`)
      .send(userMessagePayload('Tell me more.'))
      .expect(200);

    const callArgs = mockStreamText.mock.calls.at(-1)?.[0] as { tools?: Record<string, unknown> };
    expect(Object.keys(callArgs.tools ?? {})).toHaveLength(0);
  });

  it('replays prior persisted turns as history into the prompt', async () => {
    const fixture = await createSecondaryChatFixture('FE-716 history replay');

    await request(app)
      .post(`/api/specifications/${fixture.specId}/secondary-chats/${fixture.chatId}/messages`)
      .send(userMessagePayload('first?'))
      .expect(200);

    mockStreamText.mockClear();
    mockStreamText.mockReturnValue(makeStreamTextResult({ text: 'second-reply' }));

    await request(app)
      .post(`/api/specifications/${fixture.specId}/secondary-chats/${fixture.chatId}/messages`)
      .send(userMessagePayload('second?'))
      .expect(200);

    const callArgs = mockStreamText.mock.calls.at(-1)?.[0] as {
      messages: { role: string; content: string }[];
    };
    expect(callArgs.messages.length).toBeGreaterThanOrEqual(3);
    const lastUser = [...callArgs.messages].reverse().find((m) => m.role === 'user')!;
    expect(lastUser.content).toContain('second?');
    const assistantMessage = callArgs.messages.find((m) => m.role === 'assistant');
    expect(assistantMessage?.content).toContain('Hello from secondary-chat.');
  });

  it('returns 404 when targeting a primary (interview) chat', async () => {
    const specId = await createSpec('FE-716 message primary');
    const interviewChatId = dbModule.getSpecification(db, specId)!.primary_chat_id!;

    await request(app)
      .post(`/api/specifications/${specId}/secondary-chats/${interviewChatId}/messages`)
      .send(userMessagePayload('hi'))
      .expect(404);
    expect(mockStreamText).not.toHaveBeenCalled();
  });

  it('returns 404 when the chat does not exist', async () => {
    const specId = await createSpec('FE-716 message missing chat');

    await request(app)
      .post(`/api/specifications/${specId}/secondary-chats/999999/messages`)
      .send(userMessagePayload('hi'))
      .expect(404);
    expect(mockStreamText).not.toHaveBeenCalled();
  });

  it('returns 404 when the chat belongs to a different specification', async () => {
    const fixture = await createSecondaryChatFixture('FE-716 message cross-spec owner');
    const otherSpecId = await createSpec('FE-716 message cross-spec viewer');

    await request(app)
      .post(`/api/specifications/${otherSpecId}/secondary-chats/${fixture.chatId}/messages`)
      .send(userMessagePayload('hi'))
      .expect(404);
    expect(mockStreamText).not.toHaveBeenCalled();
  });

  it('returns 404 when the specification does not exist', async () => {
    await request(app)
      .post('/api/specifications/999999/secondary-chats/1/messages')
      .send(userMessagePayload('hi'))
      .expect(404);
    expect(mockStreamText).not.toHaveBeenCalled();
  });

  it('returns 400 when the latest user message has no text content', async () => {
    const fixture = await createSecondaryChatFixture('FE-716 message empty');

    await request(app)
      .post(`/api/specifications/${fixture.specId}/secondary-chats/${fixture.chatId}/messages`)
      .send(userMessagePayload('   '))
      .expect(400);
    expect(mockStreamText).not.toHaveBeenCalled();
  });

  it('does not invoke the interviewer or observer (D113 invariant carry-over)', async () => {
    const fixture = await createSecondaryChatFixture('FE-716 message no-interview');

    await request(app)
      .post(`/api/specifications/${fixture.specId}/secondary-chats/${fixture.chatId}/messages`)
      .send(userMessagePayload('hi'))
      .expect(200);

    expect(mockStreamInterviewer).not.toHaveBeenCalled();
    expect(mockRunObserver).not.toHaveBeenCalled();
  });

  it('resolves `#REF-CODE` mentions into the prompt and persists the snapshot on the user turn (FE-716 C6)', async () => {
    const fixture = await createSecondaryChatFixture('FE-716 mention resolution');
    const requirement = dbModule.createKnowledgeItem(
      db,
      fixture.specId,
      'requirement',
      'Export the spec as markdown',
    );
    const requirementCode = `R${requirement.kind_ordinal}`;

    await request(app)
      .post(`/api/specifications/${fixture.specId}/secondary-chats/${fixture.chatId}/messages`)
      .send(userMessagePayload(`Why does ${`#${requirementCode}`} matter? Also #G99 should be skipped.`))
      .expect(200);

    const callArgs = mockStreamText.mock.calls.at(-1)?.[0] as { system: string };
    expect(callArgs.system).toContain('Mentioned items');
    expect(callArgs.system).toContain(`[${requirementCode}]`);
    expect(callArgs.system).toContain('Export the spec as markdown');
    expect(callArgs.system).not.toContain('[G99]');

    const snapshotRes = await request(app).get(`/api/specifications/${fixture.specId}`).expect(200);
    const snapshot = snapshotRes.body as {
      secondaryChats?: Array<{
        chat: { id: number };
        turns: Array<{ user_parts: string | null; assistant_parts: string | null }>;
      }>;
    };
    const row = snapshot.secondaryChats?.find((r) => r.chat.id === fixture.chatId);
    const userTurn = row?.turns.find((turn) => turn.user_parts !== null);
    expect(userTurn?.user_parts).toContain(`#${requirementCode}`);
    expect(userTurn?.user_parts).toContain('Mentioned items');
    expect(userTurn?.user_parts).toContain('Export the spec as markdown');
  });

  it('leaves the user turn untouched when no `#` mentions resolve (FE-716 C6)', async () => {
    const fixture = await createSecondaryChatFixture('FE-716 mention no-op');

    await request(app)
      .post(`/api/specifications/${fixture.specId}/secondary-chats/${fixture.chatId}/messages`)
      .send(userMessagePayload('a plain question with no mentions'))
      .expect(200);

    const callArgs = mockStreamText.mock.calls.at(-1)?.[0] as { system: string };
    expect(callArgs.system).not.toContain('Mentioned items');

    const snapshotRes = await request(app).get(`/api/specifications/${fixture.specId}`).expect(200);
    const snapshot = snapshotRes.body as {
      secondaryChats?: Array<{
        chat: { id: number };
        turns: Array<{ user_parts: string | null }>;
      }>;
    };
    const row = snapshot.secondaryChats?.find((r) => r.chat.id === fixture.chatId);
    const userTurn = row?.turns.find((turn) => turn.user_parts !== null);
    expect(userTurn?.user_parts).toBe('a plain question with no mentions');
  });
});

describe('POST /api/specifications/:id/secondary-chats — kickoff template enrichment', () => {
  it('uses an "Editing" verb when the chat is created in edit mode', async () => {
    const specId = await createSpec('FE-716 kickoff edit');
    const item = dbModule.createKnowledgeItem(db, specId, 'goal', 'Reach product-market fit.');
    const parentChatId = dbModule.getSpecification(db, specId)!.primary_chat_id!;
    const parentTurn = dbModule.createTurn(db, specId, { phase: 'grounding', question: 'Q' });

    const res = await request(app)
      .post(`/api/specifications/${specId}/secondary-chats`)
      .send({
        parentChatId,
        invokedInTurnId: parentTurn.id,
        itemKind: 'goal',
        itemId: item.id,
        mode: 'edit',
      })
      .expect(200);

    const snapshotRes = await request(app).get(`/api/specifications/${specId}`).expect(200);
    const snapshot = snapshotRes.body as {
      secondaryChats?: Array<{
        chat: { id: number; mode: string | null };
        kickoffTurn: { assistant_parts: string | null } | null;
      }>;
    };
    const row = snapshot.secondaryChats?.find((r) => r.chat.id === res.body.chatId);
    expect(row?.chat.mode).toBe('edit');
    expect(row?.kickoffTurn?.assistant_parts).toMatch(/^Editing /);
  });

  it('uses an "Anchored to" verb when the chat is created in explore mode (default)', async () => {
    const fixture = await createSecondaryChatFixture('FE-716 kickoff explore');

    const snapshotRes = await request(app).get(`/api/specifications/${fixture.specId}`).expect(200);
    const snapshot = snapshotRes.body as {
      secondaryChats?: Array<{
        chat: { id: number; mode: string | null };
        kickoffTurn: { assistant_parts: string | null } | null;
      }>;
    };
    const row = snapshot.secondaryChats?.find((r) => r.chat.id === fixture.chatId);
    expect(row?.chat.mode).toBe('explore');
    expect(row?.kickoffTurn?.assistant_parts).toMatch(/^Anchored to /);
  });
});
