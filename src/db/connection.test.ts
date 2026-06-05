import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

import { createDb } from './connection.js';
import { changeLog, edges, graphClock, nodeKindCounters, nodes, specs } from './schema.js';

describe('createDb', () => {
  it('creates a missing database file and can reopen it idempotently', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'brunch-db-'));
    const dbPath = join(dir, 'data.db');

    try {
      const db = createDb(dbPath);
      db.insert(specs)
        .values({ name: 'Spec A', slug: 'spec-a', readiness_grade: 'grounding_onboarding' })
        .run();

      const specId = db.select({ id: specs.id }).from(specs).get()!.id;
      db.insert(graphClock).values({ spec_id: specId, lsn: 0 }).run();
      expect((await stat(dbPath)).isFile()).toBe(true);

      const reopened = createDb(dbPath);
      expect(reopened.select().from(specs).all()).toHaveLength(1);
      expect(reopened.select().from(graphClock).all()).toHaveLength(1);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('migrates a non-empty legacy graph database to kind ordinals and explicit basis', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'brunch-db-legacy-'));
    const dbPath = join(dir, 'legacy.db');

    try {
      await createLegacy0000Database(dbPath);

      const db = createDb(dbPath);
      const nodeRows = db.select().from(nodes).all();
      const edgeRows = db.select().from(edges).all();
      const counterRows = db.select().from(nodeKindCounters).all();

      expect(nodeRows.map((row) => [row.kind, row.kind_ordinal, row.basis])).toEqual([
        ['goal', 1, 'explicit'],
        ['goal', 2, 'explicit'],
        ['requirement', 1, 'explicit'],
      ]);
      expect(edgeRows.map((row) => row.basis)).toEqual(['explicit']);
      expect(counterRows.map((row) => [row.plane, row.kind, row.next_ordinal])).toEqual([
        ['intent', 'goal', 3],
        ['intent', 'requirement', 2],
      ]);
      expect(db.select({ specId: graphClock.spec_id, lsn: graphClock.lsn }).from(graphClock).all()).toEqual([
        { specId: 1, lsn: 9 },
      ]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('migrates legacy spec-only change-log history into a matching graph clock row', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'brunch-db-legacy-spec-only-'));
    const dbPath = join(dir, 'legacy.db');

    try {
      await createLegacy0000SpecOnlyHistoryDatabase(dbPath);

      const db = createDb(dbPath);

      expect(db.select({ specId: graphClock.spec_id, lsn: graphClock.lsn }).from(graphClock).all()).toEqual([
        { specId: 1, lsn: 4 },
      ]);
      expect(db.select({ specId: changeLog.spec_id, lsn: changeLog.lsn }).from(changeLog).all()).toEqual([
        { specId: 1, lsn: 1 },
        { specId: 1, lsn: 4 },
      ]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('migrates a legacy spec with no local history into a zero-valued graph clock row', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'brunch-db-legacy-empty-spec-'));
    const dbPath = join(dir, 'legacy.db');

    try {
      await createLegacy0000EmptySpecDatabase(dbPath);

      const db = createDb(dbPath);

      expect(db.select({ specId: graphClock.spec_id, lsn: graphClock.lsn }).from(graphClock).all()).toEqual([
        { specId: 1, lsn: 0 },
      ]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

async function createLegacy0000Database(dbPath: string): Promise<void> {
  const migration = await readFile(new URL('../../drizzle/0000_deep_maria_hill.sql', import.meta.url));
  const sqlite = new Database(dbPath);
  try {
    sqlite.exec(migration.toString('utf8'));
    sqlite.exec(`
      INSERT INTO specs (id, name, slug, readiness_grade)
      VALUES (1, 'Legacy spec', 'legacy-spec', 'grounding_onboarding');

      INSERT INTO nodes (
        id, spec_id, plane, kind, title, body, basis, source, detail, created_at_lsn, updated_at_lsn
      )
      VALUES
        (1, 1, 'intent', 'goal', 'First goal', NULL, 'accepted_review_set', NULL, NULL, 2, 5),
        (2, 1, 'intent', 'goal', 'Second goal', NULL, 'explicit', NULL, NULL, 3, 3),
        (3, 1, 'intent', 'requirement', 'Requirement', NULL, 'accepted_review_set', NULL, NULL, 4, 7);

      INSERT INTO edges (
        id, spec_id, category, source_id, target_id, stance, basis, rationale, created_at_lsn, updated_at_lsn
      )
      VALUES (1, 1, 'support', 1, 3, 'for', 'accepted_review_set', NULL, 6, 8);

      INSERT INTO reconciliation_need (
        id, spec_id, target_kind, target_edge_id, target_a_id, target_b_id, kind, status, reason, created_at_lsn, resolved_at_lsn
      )
      VALUES (1, 1, 'edge', 1, NULL, NULL, 'semantic_conflict', 'open', NULL, 9, NULL);

      CREATE TABLE "__drizzle_migrations" (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at numeric
      );
    `);
    sqlite
      .prepare('INSERT INTO "__drizzle_migrations" (hash, created_at) VALUES (?, ?)')
      .run(createHash('sha256').update(migration).digest('hex'), 1780478757603);
  } finally {
    sqlite.close();
  }
}

async function createLegacy0000SpecOnlyHistoryDatabase(dbPath: string): Promise<void> {
  const migration = await readFile(new URL('../../drizzle/0000_deep_maria_hill.sql', import.meta.url));
  const sqlite = new Database(dbPath);
  try {
    sqlite.exec(migration.toString('utf8'));
    sqlite.exec(`
      INSERT INTO specs (id, name, slug, readiness_grade)
      VALUES (1, 'Spec-only history', 'spec-only-history', 'grounding_onboarding');

      INSERT INTO change_log (lsn, operation, payload)
      VALUES
        (1, 'create_spec', '{"specId":1,"name":"Spec-only history","slug":"spec-only-history","readinessGrade":"grounding_onboarding"}'),
        (4, 'update_spec_readiness_grade', '{"specId":1,"readinessGrade":"elicitation_ready"}');

      CREATE TABLE "__drizzle_migrations" (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at numeric
      );
    `);
    sqlite
      .prepare('INSERT INTO "__drizzle_migrations" (hash, created_at) VALUES (?, ?)')
      .run(createHash('sha256').update(migration).digest('hex'), 1780478757603);
  } finally {
    sqlite.close();
  }
}

async function createLegacy0000EmptySpecDatabase(dbPath: string): Promise<void> {
  const migration = await readFile(new URL('../../drizzle/0000_deep_maria_hill.sql', import.meta.url));
  const sqlite = new Database(dbPath);
  try {
    sqlite.exec(migration.toString('utf8'));
    sqlite.exec(`
      INSERT INTO specs (id, name, slug, readiness_grade)
      VALUES (1, 'Empty legacy spec', 'empty-legacy-spec', 'grounding_onboarding');

      CREATE TABLE "__drizzle_migrations" (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at numeric
      );
    `);
    sqlite
      .prepare('INSERT INTO "__drizzle_migrations" (hash, created_at) VALUES (?, ?)')
      .run(createHash('sha256').update(migration).digest('hex'), 1780478757603);
  } finally {
    sqlite.close();
  }
}
