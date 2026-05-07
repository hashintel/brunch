import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createDb,
  createKnowledgeItem,
  createSpecification,
  createTurn,
  listOpenReconciliationNeeds,
  openReconciliationNeed,
  resolveReconciliationNeed,
  type DB,
} from './db.js';

let db: DB;

beforeEach(() => {
  db = createDb();
});

afterEach(() => {
  db.$client.close();
});

function seedSpecWithTwoItems() {
  const spec = createSpecification(db, 'Test');
  const turn = createTurn(db, spec.id, { phase: 'grounding', question: 'Q1' });
  const source = createKnowledgeItem(db, spec.id, 'decision', 'Source decision');
  const target = createKnowledgeItem(db, spec.id, 'decision', 'Target decision');
  return { spec, turn, source, target };
}

describe('reconciliation_need schema', () => {
  it('table exists with expected columns', () => {
    const columns = db.$client.prepare("PRAGMA table_info('reconciliation_need')").all() as Array<{
      name: string;
    }>;
    const names = columns.map((c) => c.name);
    expect(names).toContain('id');
    expect(names).toContain('specification_id');
    expect(names).toContain('source_item_id');
    expect(names).toContain('target_item_id');
    expect(names).toContain('kind');
    expect(names).toContain('status');
    expect(names).toContain('reason');
    expect(names).toContain('caused_by_turn_id');
    expect(names).toContain('caused_by_patch_id');
    expect(names).toContain('created_at');
    expect(names).toContain('resolved_at');
  });

  it('declares ON DELETE CASCADE on both knowledge_item foreign keys', () => {
    const fks = db.$client.prepare("PRAGMA foreign_key_list('reconciliation_need')").all() as Array<{
      table: string;
      from: string;
      on_delete: string;
    }>;
    const itemFks = fks.filter((row) => row.table === 'knowledge_item');
    expect(itemFks).toHaveLength(2);
    for (const fk of itemFks) {
      expect(fk.on_delete).toBe('CASCADE');
    }
  });

  it('declares the partial unique index on (source, target, kind) where status = open', () => {
    const indexes = db.$client.prepare("PRAGMA index_list('reconciliation_need')").all() as Array<{
      name: string;
      unique: number;
    }>;
    const partial = indexes.find((idx) => idx.name === 'reconciliation_need_open_unique');
    expect(partial).toBeDefined();
    expect(partial?.unique).toBe(1);

    const sqlRow = db.$client
      .prepare(
        "SELECT sql FROM sqlite_master WHERE type='index' AND name = 'reconciliation_need_open_unique'",
      )
      .get() as { sql: string };
    expect(sqlRow.sql.toLowerCase()).toContain("status = 'open'");
  });
});

describe('reconciliation_need lifecycle', () => {
  it('opens a row and reads it back unchanged', () => {
    const { spec, turn, source, target } = seedSpecWithTwoItems();
    const need = openReconciliationNeed(db, {
      specificationId: spec.id,
      sourceItemId: source.id,
      targetItemId: target.id,
      kind: 'needs_confirmation',
      reason: 'Source content shifted',
      causedByTurnId: turn.id,
    });
    expect(need.id).toBeDefined();
    expect(need.status).toBe('open');
    expect(need.source_item_id).toBe(source.id);
    expect(need.target_item_id).toBe(target.id);
    expect(need.kind).toBe('needs_confirmation');
    expect(need.reason).toBe('Source content shifted');
    expect(need.caused_by_turn_id).toBe(turn.id);
    expect(need.caused_by_patch_id).toBeNull();
    expect(need.resolved_at).toBeNull();
  });

  it('rejects a duplicate open row with the same (source, target, kind)', () => {
    const { spec, turn, source, target } = seedSpecWithTwoItems();
    openReconciliationNeed(db, {
      specificationId: spec.id,
      sourceItemId: source.id,
      targetItemId: target.id,
      kind: 'supersedes',
      causedByTurnId: turn.id,
    });
    expect(() =>
      openReconciliationNeed(db, {
        specificationId: spec.id,
        sourceItemId: source.id,
        targetItemId: target.id,
        kind: 'supersedes',
        causedByTurnId: turn.id,
      }),
    ).toThrow();
  });

  it('allows reopening the same triple after the previous row resolves', () => {
    const { spec, turn, source, target } = seedSpecWithTwoItems();
    const first = openReconciliationNeed(db, {
      specificationId: spec.id,
      sourceItemId: source.id,
      targetItemId: target.id,
      kind: 'supersedes',
      causedByTurnId: turn.id,
    });
    resolveReconciliationNeed(db, first.id);
    const second = openReconciliationNeed(db, {
      specificationId: spec.id,
      sourceItemId: source.id,
      targetItemId: target.id,
      kind: 'supersedes',
      causedByTurnId: turn.id,
    });
    expect(second.id).not.toBe(first.id);
    expect(second.status).toBe('open');

    const resolvedRow = db.$client
      .prepare('SELECT status, resolved_at FROM reconciliation_need WHERE id = ?')
      .get(first.id) as { status: string; resolved_at: string | null };
    expect(resolvedRow.status).toBe('resolved');
    expect(resolvedRow.resolved_at).not.toBeNull();
  });

  it('allows two open rows for the same pair with different kinds', () => {
    const { spec, turn, source, target } = seedSpecWithTwoItems();
    openReconciliationNeed(db, {
      specificationId: spec.id,
      sourceItemId: source.id,
      targetItemId: target.id,
      kind: 'supersedes',
      causedByTurnId: turn.id,
    });
    const second = openReconciliationNeed(db, {
      specificationId: spec.id,
      sourceItemId: source.id,
      targetItemId: target.id,
      kind: 'needs_confirmation',
      causedByTurnId: turn.id,
    });
    expect(second.kind).toBe('needs_confirmation');
    expect(listOpenReconciliationNeeds(db, spec.id)).toHaveLength(2);
  });

  it('rejects source and target items outside the specification', () => {
    const { spec, turn, source } = seedSpecWithTwoItems();
    const otherSpec = createSpecification(db, 'Other spec');
    const otherItem = createKnowledgeItem(db, otherSpec.id, 'decision', 'Other decision');

    expect(() =>
      openReconciliationNeed(db, {
        specificationId: spec.id,
        sourceItemId: source.id,
        targetItemId: otherItem.id,
        kind: 'needs_confirmation',
        causedByTurnId: turn.id,
      }),
    ).toThrow('Reconciliation need items must belong to specification');

    expect(listOpenReconciliationNeeds(db, spec.id)).toHaveLength(0);
  });

  it('cascade-deletes rows when source or target knowledge_item is deleted', () => {
    const { spec, turn, source, target } = seedSpecWithTwoItems();
    openReconciliationNeed(db, {
      specificationId: spec.id,
      sourceItemId: source.id,
      targetItemId: target.id,
      kind: 'needs_confirmation',
      causedByTurnId: turn.id,
    });

    db.$client.prepare('DELETE FROM knowledge_item WHERE id = ?').run(source.id);

    const remaining = db.$client
      .prepare('SELECT COUNT(*) AS n FROM reconciliation_need WHERE specification_id = ?')
      .get(spec.id) as { n: number };
    expect(remaining.n).toBe(0);
  });
});

describe('reconciliation_need queries', () => {
  it('listOpenReconciliationNeeds returns only open rows ordered by id ascending', () => {
    const { spec, turn, source, target } = seedSpecWithTwoItems();
    const a = openReconciliationNeed(db, {
      specificationId: spec.id,
      sourceItemId: source.id,
      targetItemId: target.id,
      kind: 'needs_confirmation',
      causedByTurnId: turn.id,
    });
    const b = openReconciliationNeed(db, {
      specificationId: spec.id,
      sourceItemId: source.id,
      targetItemId: target.id,
      kind: 'supersedes',
      causedByTurnId: turn.id,
    });
    resolveReconciliationNeed(db, a.id);

    const open = listOpenReconciliationNeeds(db, spec.id);
    expect(open).toHaveLength(1);
    expect(open[0].id).toBe(b.id);
  });
});
