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

function makeTextStream(chunks: readonly string[]) {
  return makeFullStream(chunks.map((text) => ({ type: 'text-delta', text })));
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
  mockStreamText.mockReturnValue(makeTextStream(['Hello ', 'from ', 'secondary-chat.']));

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
      .send({ message: 'Why product-market fit?' })
      .expect(200)
      .expect('Content-Type', /text\/event-stream/);

    expect(res.text).toContain('Hello ');
    expect(res.text).toContain('secondary-chat.');
    expect(res.text).toContain('[DONE]');

    // Bundle round-trip surfaces user + assistant turns under the secondary chat.
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

  it('emits a propose_edit patch-proposal SSE chunk in edit mode', async () => {
    const fixture = await createSecondaryChatFixture('FE-716 stream edit');
    await request(app)
      .patch(`/api/specifications/${fixture.specId}/secondary-chats/${fixture.chatId}/mode`)
      .send({ mode: 'edit' })
      .expect(200);

    mockStreamText.mockReturnValueOnce(
      makeFullStream([
        { type: 'text-delta', text: 'Proposing an edit.' },
        {
          type: 'tool-call',
          toolCallId: 'call-1',
          toolName: 'propose_edit',
          input: { newContent: 'Reach PMF.' },
        },
      ]),
    );

    const res = await request(app)
      .post(`/api/specifications/${fixture.specId}/secondary-chats/${fixture.chatId}/messages`)
      .send({ message: 'Make this terser.' })
      .expect(200);

    expect(res.text).toContain('Proposing an edit.');
    expect(res.text).toContain('"type":"patch-proposal"');
    expect(res.text).toContain('"toolName":"propose_edit"');
  });

  it('passes the edit-mode tool set to streamText when chat.mode is edit', async () => {
    const fixture = await createSecondaryChatFixture('FE-716 edit tools');
    await request(app)
      .patch(`/api/specifications/${fixture.specId}/secondary-chats/${fixture.chatId}/mode`)
      .send({ mode: 'edit' })
      .expect(200);

    await request(app)
      .post(`/api/specifications/${fixture.specId}/secondary-chats/${fixture.chatId}/messages`)
      .send({ message: 'Edit this.' })
      .expect(200);

    const callArgs = mockStreamText.mock.calls.at(-1)?.[0] as { tools?: Record<string, unknown> };
    expect(callArgs.tools).toBeDefined();
    expect(callArgs.tools).toHaveProperty('propose_edit');
  });

  it('does not pass edit tools to streamText when chat.mode is explore', async () => {
    const fixture = await createSecondaryChatFixture('FE-716 explore tools');

    await request(app)
      .post(`/api/specifications/${fixture.specId}/secondary-chats/${fixture.chatId}/messages`)
      .send({ message: 'Tell me more.' })
      .expect(200);

    const callArgs = mockStreamText.mock.calls.at(-1)?.[0] as { tools?: Record<string, unknown> };
    expect(Object.keys(callArgs.tools ?? {})).toHaveLength(0);
  });

  it('replays prior persisted turns as history into the prompt', async () => {
    const fixture = await createSecondaryChatFixture('FE-716 history replay');

    await request(app)
      .post(`/api/specifications/${fixture.specId}/secondary-chats/${fixture.chatId}/messages`)
      .send({ message: 'first?' })
      .expect(200);

    mockStreamText.mockClear();
    mockStreamText.mockReturnValue(makeTextStream(['second-reply']));

    await request(app)
      .post(`/api/specifications/${fixture.specId}/secondary-chats/${fixture.chatId}/messages`)
      .send({ message: 'second?' })
      .expect(200);

    const callArgs = mockStreamText.mock.calls.at(-1)?.[0] as {
      messages: { role: string; content: string }[];
    };
    // first user turn (from initial pinned-item user content), assistant reply,
    // and the new user message — three messages minimum.
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
      .send({ message: 'hi' })
      .expect(404);
    expect(mockStreamText).not.toHaveBeenCalled();
  });

  it('returns 404 when the chat does not exist', async () => {
    const specId = await createSpec('FE-716 message missing chat');

    await request(app)
      .post(`/api/specifications/${specId}/secondary-chats/999999/messages`)
      .send({ message: 'hi' })
      .expect(404);
    expect(mockStreamText).not.toHaveBeenCalled();
  });

  it('returns 404 when the chat belongs to a different specification', async () => {
    const fixture = await createSecondaryChatFixture('FE-716 message cross-spec owner');
    const otherSpecId = await createSpec('FE-716 message cross-spec viewer');

    await request(app)
      .post(`/api/specifications/${otherSpecId}/secondary-chats/${fixture.chatId}/messages`)
      .send({ message: 'hi' })
      .expect(404);
    expect(mockStreamText).not.toHaveBeenCalled();
  });

  it('returns 404 when the specification does not exist', async () => {
    await request(app)
      .post('/api/specifications/999999/secondary-chats/1/messages')
      .send({ message: 'hi' })
      .expect(404);
    expect(mockStreamText).not.toHaveBeenCalled();
  });

  it('returns 400 when the message body is empty or whitespace', async () => {
    const fixture = await createSecondaryChatFixture('FE-716 message empty');

    await request(app)
      .post(`/api/specifications/${fixture.specId}/secondary-chats/${fixture.chatId}/messages`)
      .send({ message: '   ' })
      .expect(400);
    expect(mockStreamText).not.toHaveBeenCalled();
  });

  it('does not invoke the interviewer or observer (D113 invariant carry-over)', async () => {
    const fixture = await createSecondaryChatFixture('FE-716 message no-interview');

    await request(app)
      .post(`/api/specifications/${fixture.specId}/secondary-chats/${fixture.chatId}/messages`)
      .send({ message: 'hi' })
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
      .send({ message: `Why does ${`#${requirementCode}`} matter? Also #G99 should be skipped.` })
      .expect(200);

    // Prompt: system block carries the resolved snapshot so the model sees it.
    const callArgs = mockStreamText.mock.calls.at(-1)?.[0] as { system: string };
    expect(callArgs.system).toContain('Mentioned items');
    expect(callArgs.system).toContain(`[${requirementCode}]`);
    expect(callArgs.system).toContain('Export the spec as markdown');
    expect(callArgs.system).not.toContain('[G99]');

    // Persistence: the user turn captures the snapshot inline so replay/audit
    // sees the same context the assistant saw, even after the source item changes.
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
      .send({ message: 'a plain question with no mentions' })
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
