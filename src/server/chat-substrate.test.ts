import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  advanceHead,
  createDb,
  createKnowledgeItem,
  createSpecification,
  createThread,
  createTurn,
  createTurnForThread,
  findOrCreateSideChatThread,
  getSpecification,
  type DB,
} from './db.js';

let db: DB;

beforeEach(() => {
  db = createDb();
});

afterEach(() => {
  db.$client.close();
});

describe('thread substrate schema', () => {
  it('thread table exists with expected columns', () => {
    const columns = db.$client.prepare("PRAGMA table_info('thread')").all() as Array<{ name: string }>;
    const names = columns.map((c) => c.name);
    expect(names).toContain('id');
    expect(names).toContain('chat_id');
    expect(names).toContain('kind');
    expect(names).toContain('target_item_id');
    expect(names).toContain('context_spec');
    expect(names).toContain('kickoff_turn_id');
    expect(names).toContain('invoked_in_turn_id');
    expect(names).toContain('active_turn_id');
    expect(names).toContain('status');
    expect(names).toContain('created_at');
  });

  it('chat table has no kind or active_turn_id column', () => {
    const columns = db.$client.prepare("PRAGMA table_info('chat')").all() as Array<{ name: string }>;
    const names = columns.map((c) => c.name);
    expect(names).toContain('id');
    expect(names).toContain('specification_id');
    expect(names).toContain('created_at');
    expect(names).not.toContain('kind');
    expect(names).not.toContain('active_turn_id');
  });

  it('turn table has thread_id, not chat_id', () => {
    const columns = db.$client.prepare("PRAGMA table_info('turn')").all() as Array<{ name: string }>;
    const names = columns.map((c) => c.name);
    expect(names).toContain('thread_id');
    expect(names).not.toContain('chat_id');
  });

  it('specification table still has primary_chat_id', () => {
    const columns = db.$client.prepare("PRAGMA table_info('specification')").all() as Array<{
      name: string;
    }>;
    expect(columns.map((c) => c.name)).toContain('primary_chat_id');
  });
});

describe('thread substrate — spec creation atomic quad', () => {
  it('createSpecification inserts spec + chat + interview thread in one transaction', () => {
    const spec = createSpecification(db, 'Test');
    const chats = db.$client
      .prepare('SELECT id, specification_id FROM chat WHERE specification_id = ?')
      .all(spec.id) as Array<{ id: number; specification_id: number }>;
    expect(chats).toHaveLength(1);
    expect(chats[0].specification_id).toBe(spec.id);

    const threads = db.$client
      .prepare('SELECT id, chat_id, kind, active_turn_id, status FROM thread WHERE chat_id = ?')
      .all(chats[0].id) as Array<{
      id: number;
      chat_id: number;
      kind: string;
      active_turn_id: number | null;
      status: string;
    }>;
    expect(threads).toHaveLength(1);
    expect(threads[0].kind).toBe('interview');
    expect(threads[0].active_turn_id).toBeNull();
    expect(threads[0].status).toBe('open');
  });

  it('spec.primary_chat_id points to the chat that owns the interview thread', () => {
    const spec = createSpecification(db, 'Test');
    const reread = getSpecification(db, spec.id) as
      | (typeof spec & { primary_chat_id: number | null })
      | undefined;
    expect(reread).toBeDefined();
    const interviewThread = db.$client
      .prepare("SELECT chat_id FROM thread WHERE chat_id = ? AND kind = 'interview'")
      .get(reread!.primary_chat_id) as { chat_id: number } | undefined;
    expect(interviewThread).toBeDefined();
    expect(interviewThread!.chat_id).toBe(reread!.primary_chat_id);
  });

  it('every spec has exactly one interview thread per chat', () => {
    createSpecification(db, 'Alpha');
    createSpecification(db, 'Beta');
    const counts = db.$client
      .prepare("SELECT chat_id, COUNT(*) AS n FROM thread WHERE kind = 'interview' GROUP BY chat_id")
      .all() as Array<{ chat_id: number; n: number }>;
    expect(counts).toHaveLength(2);
    for (const row of counts) expect(row.n).toBe(1);
  });

  it('partial unique index prevents a second interview thread on the same chat', () => {
    const spec = createSpecification(db, 'Test');
    const reread = getSpecification(db, spec.id) as
      | (typeof spec & { primary_chat_id: number | null })
      | undefined;
    expect(() => {
      db.$client
        .prepare("INSERT INTO thread (chat_id, kind, status) VALUES (?, 'interview', 'open')")
        .run(reread!.primary_chat_id);
    }).toThrow();
  });
});

describe('thread substrate — turn writes', () => {
  it('createTurn populates thread_id from the interview thread', () => {
    const spec = createSpecification(db, 'Test');
    const turn = createTurn(db, spec.id, { phase: 'grounding', question: 'Q1' });
    const row = db.$client.prepare('SELECT thread_id FROM turn WHERE id = ?').get(turn.id) as {
      thread_id: number;
    };
    const interviewThread = db.$client
      .prepare(
        `SELECT t.id FROM thread t
         JOIN chat c ON c.id = t.chat_id
         WHERE c.specification_id = ? AND t.kind = 'interview'`,
      )
      .get(spec.id) as { id: number };
    expect(row.thread_id).toBe(interviewThread.id);
  });

  it('createTurn rejects parent that lives in a different thread', () => {
    const spec = createSpecification(db, 'Test');
    const otherSpec = createSpecification(db, 'Other');
    const otherTurn = createTurn(db, otherSpec.id, { phase: 'grounding', question: 'Other Q' });
    expect(() =>
      createTurn(db, spec.id, {
        phase: 'grounding',
        question: 'Q',
        parent_turn_id: otherTurn.id,
      }),
    ).toThrow();
  });
});

describe('thread substrate — head mirroring', () => {
  it('advanceHead mirrors active_turn_id to the interview thread', () => {
    const spec = createSpecification(db, 'Test');
    const turn = createTurn(db, spec.id, { phase: 'grounding', question: 'Q1' });
    advanceHead(db, spec.id, turn.id);
    const row = db.$client
      .prepare(
        `SELECT t.active_turn_id FROM thread t
         JOIN chat c ON c.id = t.chat_id
         WHERE c.specification_id = ? AND t.kind = 'interview'`,
      )
      .get(spec.id) as { active_turn_id: number };
    expect(row.active_turn_id).toBe(turn.id);
  });

  it('spec.active_turn_id and interview thread.active_turn_id stay in sync across advances', () => {
    const spec = createSpecification(db, 'Test');
    const t1 = createTurn(db, spec.id, { phase: 'grounding', question: 'Q1' });
    advanceHead(db, spec.id, t1.id);
    const t2 = createTurn(db, spec.id, {
      phase: 'grounding',
      question: 'Q2',
      parent_turn_id: t1.id,
    });
    advanceHead(db, spec.id, t2.id);

    const reread = getSpecification(db, spec.id);
    const threadHead = db.$client
      .prepare(
        `SELECT t.active_turn_id FROM thread t
         JOIN chat c ON c.id = t.chat_id
         WHERE c.specification_id = ? AND t.kind = 'interview'`,
      )
      .get(spec.id) as { active_turn_id: number };
    expect(reread?.active_turn_id).toBe(t2.id);
    expect(threadHead.active_turn_id).toBe(reread?.active_turn_id ?? null);
  });
});

describe('thread substrate — head mirroring atomicity', () => {
  it('rolls back the spec head if the interview thread row is missing', () => {
    const spec = createSpecification(db, 'Test');
    const t1 = createTurn(db, spec.id, { phase: 'grounding', question: 'Q1' });
    advanceHead(db, spec.id, t1.id);
    const t2 = createTurn(db, spec.id, {
      phase: 'grounding',
      question: 'Q2',
      parent_turn_id: t1.id,
    });

    // Delete the interview thread to simulate corruption
    const interviewThread = db.$client
      .prepare(
        `SELECT t.id FROM thread t
         JOIN chat c ON c.id = t.chat_id
         WHERE c.specification_id = ? AND t.kind = 'interview'`,
      )
      .get(spec.id) as { id: number };
    db.$client.exec('PRAGMA foreign_keys = OFF');
    db.$client.prepare('DELETE FROM thread WHERE id = ?').run(interviewThread.id);
    db.$client.exec('PRAGMA foreign_keys = ON');

    expect(() => advanceHead(db, spec.id, t2.id)).toThrow();

    const after = getSpecification(db, spec.id);
    expect(after?.active_turn_id).toBe(t1.id);
  });
});

describe('thread substrate — read-path equivalence', () => {
  it('spec.active_turn_id equals interview thread.active_turn_id', () => {
    const spec = createSpecification(db, 'Test');
    const t1 = createTurn(db, spec.id, { phase: 'grounding', question: 'Q1' });
    advanceHead(db, spec.id, t1.id);

    const row = db.$client
      .prepare(
        `SELECT s.active_turn_id AS spec_head, t.active_turn_id AS thread_head
         FROM specification s
         JOIN chat c ON c.id = s.primary_chat_id
         JOIN thread t ON t.chat_id = c.id AND t.kind = 'interview'
         WHERE s.id = ?`,
      )
      .get(spec.id) as { spec_head: number; thread_head: number };
    expect(row.spec_head).toBe(t1.id);
    expect(row.thread_head).toBe(row.spec_head);
  });
});

describe('side-chat thread lifecycle', () => {
  it('findOrCreateSideChatThread creates a side-chat thread for a knowledge item', () => {
    const spec = createSpecification(db, 'Test');
    const item = createKnowledgeItem(db, spec.id, 'decision', 'Use SQLite');
    const thread = findOrCreateSideChatThread(db, spec.primary_chat_id!, item.id);
    expect(thread.kind).toBe('side');
    expect(thread.target_item_id).toBe(item.id);
    expect(thread.chat_id).toBe(spec.primary_chat_id);
    expect(thread.status).toBe('open');
  });

  it('findOrCreateSideChatThread reuses an existing open thread for the same item', () => {
    const spec = createSpecification(db, 'Test');
    const item = createKnowledgeItem(db, spec.id, 'decision', 'Use SQLite');
    const first = findOrCreateSideChatThread(db, spec.primary_chat_id!, item.id);
    const second = findOrCreateSideChatThread(db, spec.primary_chat_id!, item.id);
    expect(second.id).toBe(first.id);
  });

  it('turn.phase is nullable — side-chat turns can have null phase', () => {
    const spec = createSpecification(db, 'Test');
    const item = createKnowledgeItem(db, spec.id, 'decision', 'Use SQLite');
    const thread = createThread(db, { chatId: spec.primary_chat_id!, kind: 'side', target_item_id: item.id });
    // Insert a turn with null phase directly via raw SQL to prove the schema allows it
    db.$client
      .prepare(`INSERT INTO turn (specification_id, thread_id, phase, question) VALUES (?, ?, NULL, '')`)
      .run(spec.id, thread.id);
    const row = db.$client.prepare('SELECT phase FROM turn WHERE thread_id = ?').get(thread.id) as {
      phase: string | null;
    };
    expect(row.phase).toBeNull();
  });

  it('createTurnForThread creates a turn with null phase on a side-chat thread', () => {
    const spec = createSpecification(db, 'Test');
    const item = createKnowledgeItem(db, spec.id, 'decision', 'Use SQLite');
    const thread = createThread(db, { chatId: spec.primary_chat_id!, kind: 'side', target_item_id: item.id });
    const turn = createTurnForThread(db, spec.id, thread.id, {
      user_parts: JSON.stringify([{ type: 'text', text: 'Why SQLite?' }]),
    });
    expect(turn.thread_id).toBe(thread.id);
    expect(turn.specification_id).toBe(spec.id);
    expect(turn.phase).toBeNull();
  });
});
