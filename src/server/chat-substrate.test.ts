import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  advanceHead,
  createDb,
  createKickoffTurn,
  createKnowledgeItem,
  createSecondaryChat,
  createSpecification,
  createTurn,
  getSpecification,
  listSecondaryChatsForSpecification,
  setSecondaryChatMode,
  type DB,
} from './db.js';

let db: DB;

beforeEach(() => {
  db = createDb();
});

afterEach(() => {
  db.$client.close();
});

describe('chat container schema', () => {
  it('chat table exists with expected columns', () => {
    const columns = db.$client.prepare("PRAGMA table_info('chat')").all() as Array<{ name: string }>;
    const names = columns.map((c) => c.name);
    expect(names).toContain('id');
    expect(names).toContain('specification_id');
    expect(names).toContain('kind');
    expect(names).toContain('active_turn_id');
    expect(names).toContain('created_at');
  });

  it('turn table has chat_id column', () => {
    const columns = db.$client.prepare("PRAGMA table_info('turn')").all() as Array<{ name: string }>;
    expect(columns.map((c) => c.name)).toContain('chat_id');
  });

  it('specification table has primary_chat_id column', () => {
    const columns = db.$client.prepare("PRAGMA table_info('specification')").all() as Array<{
      name: string;
    }>;
    expect(columns.map((c) => c.name)).toContain('primary_chat_id');
  });
});

describe('chat container — spec creation transactional', () => {
  it('createSpecification inserts spec + interview chat in one transaction', () => {
    const spec = createSpecification(db, 'Test');
    const chats = db.$client
      .prepare('SELECT id, specification_id, kind, active_turn_id FROM chat WHERE specification_id = ?')
      .all(spec.id) as Array<{
      id: number;
      specification_id: number;
      kind: string;
      active_turn_id: number | null;
    }>;
    expect(chats).toHaveLength(1);
    expect(chats[0].kind).toBe('interview');
    expect(chats[0].specification_id).toBe(spec.id);
    expect(chats[0].active_turn_id).toBeNull();
  });

  it('spec.primary_chat_id points to the interview chat', () => {
    const spec = createSpecification(db, 'Test');
    const reread = getSpecification(db, spec.id) as
      | (typeof spec & { primary_chat_id: number | null })
      | undefined;
    expect(reread).toBeDefined();
    const interviewChat = db.$client
      .prepare("SELECT id FROM chat WHERE specification_id = ? AND kind = 'interview'")
      .get(spec.id) as { id: number };
    expect(reread?.primary_chat_id).toBe(interviewChat.id);
  });

  it('every spec has exactly one interview chat', () => {
    createSpecification(db, 'Alpha');
    createSpecification(db, 'Beta');
    const counts = db.$client
      .prepare(
        "SELECT specification_id, COUNT(*) AS n FROM chat WHERE kind = 'interview' GROUP BY specification_id",
      )
      .all() as Array<{ specification_id: number; n: number }>;
    expect(counts).toHaveLength(2);
    for (const row of counts) expect(row.n).toBe(1);
  });
});

describe('chat container — turn writes', () => {
  it('createTurn populates chat_id from spec primary chat', () => {
    const spec = createSpecification(db, 'Test');
    const turn = createTurn(db, spec.id, { phase: 'grounding', question: 'Q1' });
    const row = db.$client.prepare('SELECT chat_id FROM turn WHERE id = ?').get(turn.id) as {
      chat_id: number;
    };
    const reread = getSpecification(db, spec.id) as
      | (typeof spec & { primary_chat_id: number | null })
      | undefined;
    expect(row.chat_id).toBe(reread?.primary_chat_id);
  });

  it('createTurn rejects parent that lives in a different chat', () => {
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

describe('chat container — head mirroring', () => {
  it('advanceHead mirrors active_turn_id to the interview chat', () => {
    const spec = createSpecification(db, 'Test');
    const turn = createTurn(db, spec.id, { phase: 'grounding', question: 'Q1' });
    advanceHead(db, spec.id, turn.id);
    const row = db.$client
      .prepare("SELECT active_turn_id FROM chat WHERE specification_id = ? AND kind = 'interview'")
      .get(spec.id) as { active_turn_id: number };
    expect(row.active_turn_id).toBe(turn.id);
  });

  it('spec.active_turn_id and interview chat.active_turn_id stay in sync across advances', () => {
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
    const chatHead = db.$client
      .prepare("SELECT active_turn_id FROM chat WHERE specification_id = ? AND kind = 'interview'")
      .get(spec.id) as { active_turn_id: number };
    expect(reread?.active_turn_id).toBe(t2.id);
    expect(chatHead.active_turn_id).toBe(reread?.active_turn_id ?? null);
  });
});

describe('chat container — head mirroring atomicity', () => {
  it('rolls back the spec head if the interview chat row is missing', () => {
    const spec = createSpecification(db, 'Test');
    const t1 = createTurn(db, spec.id, { phase: 'grounding', question: 'Q1' });
    advanceHead(db, spec.id, t1.id);
    const t2 = createTurn(db, spec.id, {
      phase: 'grounding',
      question: 'Q2',
      parent_turn_id: t1.id,
    });

    const reread = getSpecification(db, spec.id) as
      | (typeof spec & { primary_chat_id: number | null })
      | undefined;
    db.$client.exec('PRAGMA foreign_keys = OFF');
    db.$client.prepare('DELETE FROM chat WHERE id = ?').run(reread?.primary_chat_id);
    db.$client.exec('PRAGMA foreign_keys = ON');

    expect(() => advanceHead(db, spec.id, t2.id)).toThrow();

    const after = getSpecification(db, spec.id);
    expect(after?.active_turn_id).toBe(t1.id);
  });
});

describe('chat container — secondary-chat columns', () => {
  it('chat table has the four new secondary-chat columns', () => {
    const columns = db.$client.prepare("PRAGMA table_info('chat')").all() as Array<{
      name: string;
      type: string;
      notnull: number;
    }>;
    const byName = new Map(columns.map((c) => [c.name, c]));

    const parent = byName.get('parent_chat_id');
    expect(parent).toBeDefined();
    expect(parent?.type.toUpperCase()).toBe('INTEGER');
    expect(parent?.notnull).toBe(0);

    const invoked = byName.get('invoked_in_turn_id');
    expect(invoked).toBeDefined();
    expect(invoked?.type.toUpperCase()).toBe('INTEGER');
    expect(invoked?.notnull).toBe(0);

    const pinnedItem = byName.get('pinned_item_id');
    expect(pinnedItem).toBeDefined();
    expect(pinnedItem?.type.toUpperCase()).toBe('INTEGER');
    expect(pinnedItem?.notnull).toBe(0);

    const pinnedSpan = byName.get('pinned_span_hint');
    expect(pinnedSpan).toBeDefined();
    expect(pinnedSpan?.type.toUpperCase()).toBe('TEXT');
    expect(pinnedSpan?.notnull).toBe(0);
  });

  it('chat table has indexes on parent_chat_id and invoked_in_turn_id', () => {
    const indexes = db.$client.prepare("PRAGMA index_list('chat')").all() as Array<{
      name: string;
    }>;
    const indexedColumns = new Set<string>();
    for (const ix of indexes) {
      const cols = db.$client.prepare(`PRAGMA index_info('${ix.name}')`).all() as Array<{
        name: string;
      }>;
      for (const c of cols) indexedColumns.add(c.name);
    }
    expect(indexedColumns).toContain('parent_chat_id');
    expect(indexedColumns).toContain('invoked_in_turn_id');
  });

  it('chat row insert with all four new columns null succeeds', () => {
    const spec = createSpecification(db, 'Test');
    const result = db.$client
      .prepare(
        `INSERT INTO chat (specification_id, kind, parent_chat_id, invoked_in_turn_id, pinned_item_id, pinned_span_hint)
         VALUES (?, 'side_chat', NULL, NULL, NULL, NULL)`,
      )
      .run(spec.id);
    expect(result.changes).toBe(1);
  });

  it('chat row with parent_chat_id pointing to another chat in the same spec succeeds', () => {
    const spec = createSpecification(db, 'Test');
    const parentRow = db.$client
      .prepare("SELECT id FROM chat WHERE specification_id = ? AND kind = 'interview'")
      .get(spec.id) as { id: number };

    const child = db.$client
      .prepare(
        `INSERT INTO chat (specification_id, kind, parent_chat_id) VALUES (?, 'side_chat', ?) RETURNING id`,
      )
      .get(spec.id, parentRow.id) as { id: number };
    expect(child.id).toBeGreaterThan(0);

    const reread = db.$client.prepare('SELECT parent_chat_id FROM chat WHERE id = ?').get(child.id) as {
      parent_chat_id: number;
    };
    expect(reread.parent_chat_id).toBe(parentRow.id);
  });

  it('chat row with parent_chat_id pointing to a missing chat is rejected by FK', () => {
    const spec = createSpecification(db, 'Test');
    expect(() =>
      db.$client
        .prepare(`INSERT INTO chat (specification_id, kind, parent_chat_id) VALUES (?, 'side_chat', 999999)`)
        .run(spec.id),
    ).toThrow(/FOREIGN KEY/i);
  });

  it('chat row with pinned_item_id pointing to a missing knowledge_item is rejected by FK', () => {
    const spec = createSpecification(db, 'Test');
    expect(() =>
      db.$client
        .prepare(`INSERT INTO chat (specification_id, kind, pinned_item_id) VALUES (?, 'side_chat', 999999)`)
        .run(spec.id),
    ).toThrow(/FOREIGN KEY/i);
  });

  it('chat row with invoked_in_turn_id pointing to a missing turn is rejected by FK', () => {
    const spec = createSpecification(db, 'Test');
    expect(() =>
      db.$client
        .prepare(
          `INSERT INTO chat (specification_id, kind, invoked_in_turn_id) VALUES (?, 'side_chat', 999999)`,
        )
        .run(spec.id),
    ).toThrow(/FOREIGN KEY/i);
  });

  it('chat.active_turn_id column is preserved (not retired)', () => {
    const columns = db.$client.prepare("PRAGMA table_info('chat')").all() as Array<{
      name: string;
    }>;
    expect(columns.map((c) => c.name)).toContain('active_turn_id');
  });
});

describe('createSecondaryChat', () => {
  it('inserts a chat with kind=side_chat and the parent_chat_id pointer', () => {
    const spec = createSpecification(db, 'Test');
    const reread = getSpecification(db, spec.id);
    const parentChatId = reread?.primary_chat_id;
    expect(parentChatId).toBeTruthy();

    const child = createSecondaryChat(db, spec.id, { parent_chat_id: parentChatId! });

    expect(child.kind).toBe('side_chat');
    expect(child.specification_id).toBe(spec.id);
    expect(child.parent_chat_id).toBe(parentChatId);
    expect(child.invoked_in_turn_id).toBeNull();
    expect(child.pinned_item_id).toBeNull();
    expect(child.pinned_span_hint).toBeNull();
  });

  it('persists invoked_in_turn_id, pinned_item_id, and pinned_span_hint when provided', () => {
    const spec = createSpecification(db, 'Test');
    const parentChatId = getSpecification(db, spec.id)!.primary_chat_id!;
    const turn = createTurn(db, spec.id, { phase: 'grounding', question: 'Q' });
    const item = createKnowledgeItem(db, spec.id, 'goal', 'Pinned goal');

    const child = createSecondaryChat(db, spec.id, {
      parent_chat_id: parentChatId,
      invoked_in_turn_id: turn.id,
      pinned_item_id: item.id,
      pinned_span_hint: 'highlighted phrase',
    });

    expect(child.invoked_in_turn_id).toBe(turn.id);
    expect(child.pinned_item_id).toBe(item.id);
    expect(child.pinned_span_hint).toBe('highlighted phrase');
  });

  it('throws when parent_chat_id references a missing chat', () => {
    const spec = createSpecification(db, 'Test');
    expect(() => createSecondaryChat(db, spec.id, { parent_chat_id: 999999 })).toThrow(/FOREIGN KEY/i);
  });

  it("defaults mode to 'explore' when not provided", () => {
    const spec = createSpecification(db, 'Test');
    const parentChatId = getSpecification(db, spec.id)!.primary_chat_id!;
    const child = createSecondaryChat(db, spec.id, { parent_chat_id: parentChatId });
    expect(child.mode).toBe('explore');
  });

  it("persists mode='edit' when explicitly provided", () => {
    const spec = createSpecification(db, 'Test');
    const parentChatId = getSpecification(db, spec.id)!.primary_chat_id!;
    const child = createSecondaryChat(db, spec.id, { parent_chat_id: parentChatId, mode: 'edit' });
    expect(child.mode).toBe('edit');
  });
});

describe('setSecondaryChatMode', () => {
  it('updates the mode of an existing secondary chat', () => {
    const spec = createSpecification(db, 'Test');
    const parentChatId = getSpecification(db, spec.id)!.primary_chat_id!;
    const child = createSecondaryChat(db, spec.id, { parent_chat_id: parentChatId });
    expect(child.mode).toBe('explore');

    const updated = setSecondaryChatMode(db, child.id, 'edit');
    expect(updated.mode).toBe('edit');

    const reread = listSecondaryChatsForSpecification(db, spec.id).find((row) => row.chat.id === child.id);
    expect(reread?.chat.mode).toBe('edit');
  });

  it('throws when chat is not a secondary chat (parent_chat_id is null)', () => {
    const spec = createSpecification(db, 'Test');
    const interviewChatId = getSpecification(db, spec.id)!.primary_chat_id!;
    expect(() => setSecondaryChatMode(db, interviewChatId, 'edit')).toThrow(/not found/i);
  });

  it('throws when chat does not exist', () => {
    expect(() => setSecondaryChatMode(db, 999999, 'edit')).toThrow(/not found/i);
  });
});

describe('createKickoffTurn', () => {
  it('inserts a turn with turn_kind=kickoff in the given chat', () => {
    const spec = createSpecification(db, 'Test');
    const parentChatId = getSpecification(db, spec.id)!.primary_chat_id!;
    const child = createSecondaryChat(db, spec.id, { parent_chat_id: parentChatId });

    const kickoff = createKickoffTurn(db, child.id, {
      phase: 'grounding',
      content: "Editing 'item'. 3 related items may need updating.",
    });

    expect(kickoff.turn_kind).toBe('kickoff');
    expect(kickoff.chat_id).toBe(child.id);
    expect(kickoff.assistant_parts).toBe("Editing 'item'. 3 related items may need updating.");
    expect(kickoff.specification_id).toBe(spec.id);
    expect(kickoff.phase).toBe('grounding');
  });

  it('throws when the chat does not exist', () => {
    expect(() => createKickoffTurn(db, 999999, { phase: 'grounding', content: 'x' })).toThrow();
  });
});

describe('listSecondaryChatsForSpecification', () => {
  it('returns empty array when no secondary chats exist', () => {
    const spec = createSpecification(db, 'Test');
    const rows = listSecondaryChatsForSpecification(db, spec.id);
    expect(rows).toEqual([]);
  });

  it('returns each secondary chat with its kickoff turn populated', () => {
    const spec = createSpecification(db, 'Test');
    const parentChatId = getSpecification(db, spec.id)!.primary_chat_id!;
    const parentTurn = createTurn(db, spec.id, { phase: 'grounding', question: 'Q' });

    const child = createSecondaryChat(db, spec.id, {
      parent_chat_id: parentChatId,
      invoked_in_turn_id: parentTurn.id,
    });
    const kickoff = createKickoffTurn(db, child.id, {
      phase: 'grounding',
      content: 'kickoff body',
    });

    const rows = listSecondaryChatsForSpecification(db, spec.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].chat.id).toBe(child.id);
    expect(rows[0].chat.parent_chat_id).toBe(parentChatId);
    expect(rows[0].chat.invoked_in_turn_id).toBe(parentTurn.id);
    expect(rows[0].kickoffTurn?.id).toBe(kickoff.id);
    expect(rows[0].kickoffTurn?.assistant_parts).toBe('kickoff body');
  });

  it('returns kickoffTurn=null for a secondary chat without a kickoff turn', () => {
    const spec = createSpecification(db, 'Test');
    const parentChatId = getSpecification(db, spec.id)!.primary_chat_id!;
    const child = createSecondaryChat(db, spec.id, { parent_chat_id: parentChatId });

    const rows = listSecondaryChatsForSpecification(db, spec.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].chat.id).toBe(child.id);
    expect(rows[0].kickoffTurn).toBeNull();
  });

  it('does not return the primary interview chat', () => {
    const spec = createSpecification(db, 'Test');
    const rows = listSecondaryChatsForSpecification(db, spec.id);
    expect(rows).toEqual([]);
  });

  it('scopes results to the given specification', () => {
    const specA = createSpecification(db, 'A');
    const specB = createSpecification(db, 'B');
    const parentA = getSpecification(db, specA.id)!.primary_chat_id!;
    const parentB = getSpecification(db, specB.id)!.primary_chat_id!;
    createSecondaryChat(db, specA.id, { parent_chat_id: parentA });
    createSecondaryChat(db, specB.id, { parent_chat_id: parentB });

    const rowsA = listSecondaryChatsForSpecification(db, specA.id);
    const rowsB = listSecondaryChatsForSpecification(db, specB.id);
    expect(rowsA).toHaveLength(1);
    expect(rowsB).toHaveLength(1);
    expect(rowsA[0].chat.specification_id).toBe(specA.id);
    expect(rowsB[0].chat.specification_id).toBe(specB.id);
  });
});

describe('SpecificationState bundle', () => {
  it('includes secondaryChats in getSpecificationState response', async () => {
    const { getSpecificationState } = await import('./core.js');
    const spec = createSpecification(db, 'Test');
    const parentChatId = getSpecification(db, spec.id)!.primary_chat_id!;
    const parentTurn = createTurn(db, spec.id, { phase: 'grounding', question: 'Q' });
    const child = createSecondaryChat(db, spec.id, {
      parent_chat_id: parentChatId,
      invoked_in_turn_id: parentTurn.id,
    });
    createKickoffTurn(db, child.id, { phase: 'grounding', content: 'hi' });

    const state = getSpecificationState(db, spec.id);
    expect(state).toBeTruthy();
    expect(state?.secondaryChats).toHaveLength(1);
    expect(state?.secondaryChats?.[0].chat.id).toBe(child.id);
    expect(state?.secondaryChats?.[0].kickoffTurn?.assistant_parts).toBe('hi');
  });
});

describe('chat container — read-path equivalence', () => {
  it('spec.active_turn_id equals spec.primary_chat → chat.active_turn_id', () => {
    const spec = createSpecification(db, 'Test');
    const t1 = createTurn(db, spec.id, { phase: 'grounding', question: 'Q1' });
    advanceHead(db, spec.id, t1.id);

    const row = db.$client
      .prepare(
        `SELECT s.active_turn_id AS legacy, c.active_turn_id AS chat
         FROM specification s
         JOIN chat c ON c.id = s.primary_chat_id
         WHERE s.id = ?`,
      )
      .get(spec.id) as { legacy: number; chat: number };
    expect(row.legacy).toBe(t1.id);
    expect(row.chat).toBe(row.legacy);
  });
});
