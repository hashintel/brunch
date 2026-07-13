import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { specs } from '../../db/schema.js';
import {
  detectLegacyZeroXDatabase,
  LEGACY_ALPHA_DB_FILENAME,
  LEGACY_ZERO_X_DB_FILENAME,
  openWorkspaceDb,
  WORKSPACE_DB_FILENAME,
  WorkspaceDbRefusalError,
} from '../workspace-store.js';

describe('workspace-store — brunch-v1.db identity (D124-L, I63-L)', () => {
  let cwd: string;
  let brunchDir: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'brunch-workspace-store-'));
    brunchDir = join(cwd, '.brunch');
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it('exports the brunch-v1.db filename constant', () => {
    expect(WORKSPACE_DB_FILENAME).toBe('brunch-v1.db');
  });

  it('stamps a fresh create with the Brunch application_id, and a reopen succeeds', async () => {
    const first = await openWorkspaceDb(cwd);
    first.insert(specs).values({ name: 'Spec A', slug: 'spec-a' }).run();
    first.$client.close();

    expect(existsSync(join(brunchDir, WORKSPACE_DB_FILENAME))).toBe(true);

    const reopened = await openWorkspaceDb(cwd);
    expect(reopened.select().from(specs).all()).toHaveLength(1);
    reopened.$client.close();
  });

  it('refuses to open a brunch-v1.db with a foreign application_id, leaving it untouched', async () => {
    const foreignPath = join(brunchDir, WORKSPACE_DB_FILENAME);
    await mkdir(brunchDir, { recursive: true });
    const raw = new Database(foreignPath);
    raw.pragma('application_id = 424242');
    raw.exec('CREATE TABLE foreign_marker (id INTEGER PRIMARY KEY)');
    raw.close();

    const before = await readFile(foreignPath);

    await expect(openWorkspaceDb(cwd)).rejects.toThrow(WorkspaceDbRefusalError);

    const after = await readFile(foreignPath);
    expect(after.equals(before)).toBe(true);

    // The refusal error names the path and never migrated the foreign file.
    const inspect = new Database(foreignPath, { readonly: true });
    const tables = inspect.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as {
      name: string;
    }[];
    inspect.close();
    expect(tables.map((row) => row.name)).toEqual(['foreign_marker']);
  });

  it('names the refused path on the typed error', async () => {
    const foreignPath = join(brunchDir, WORKSPACE_DB_FILENAME);
    await mkdir(brunchDir, { recursive: true });
    const raw = new Database(foreignPath);
    raw.pragma('application_id = 7');
    raw.close();

    try {
      await openWorkspaceDb(cwd);
      expect.unreachable('expected a WorkspaceDbRefusalError');
    } catch (error) {
      expect(error).toBeInstanceOf(WorkspaceDbRefusalError);
      expect((error as WorkspaceDbRefusalError).path).toBe(foreignPath);
      expect((error as Error).message).toContain(foreignPath);
    }
  });

  it('detects a sibling 0.x brunch.db without opening it, and never migrates it', async () => {
    await mkdir(brunchDir, { recursive: true });
    const zeroXPath = join(brunchDir, LEGACY_ZERO_X_DB_FILENAME);
    // Deliberately not a valid SQLite file: if anything ever opened it as a
    // database this test would throw, proving the detection is a pure
    // filesystem check.
    await writeFile(zeroXPath, 'not a sqlite database');

    await expect(detectLegacyZeroXDatabase(cwd)).resolves.toBe(true);

    // Opening the current-line db must succeed independently of the 0.x file.
    const db = await openWorkspaceDb(cwd);
    db.$client.close();

    const untouched = await readFile(zeroXPath, 'utf8');
    expect(untouched).toBe('not a sqlite database');
  });

  it('reports no 0.x sibling when none exists', async () => {
    await expect(detectLegacyZeroXDatabase(cwd)).resolves.toBe(false);
  });

  it('recovers a legacy alpha data.db by rename when brunch-v1.db is absent, including -wal/-shm sidecars', async () => {
    const legacyPath = join(brunchDir, LEGACY_ALPHA_DB_FILENAME);
    await mkdir(brunchDir, { recursive: true });

    const legacy = new Database(legacyPath);
    legacy.pragma('journal_mode = WAL');
    legacy.exec('CREATE TABLE marker (id INTEGER PRIMARY KEY)');
    legacy.prepare('INSERT INTO marker (id) VALUES (1)').run();
    legacy.close();

    // Simulate stale sidecar files left behind by a prior session.
    await writeFile(`${legacyPath}-wal`, '');
    await writeFile(`${legacyPath}-shm`, '');

    const db = await openWorkspaceDb(cwd);
    // Drizzle migration authority is unchanged on an adopted file: the
    // current schema exists and is queryable through the normal drizzle
    // surface, not just "createDb didn't throw".
    expect(db.select().from(specs).all()).toEqual([]);
    db.$client.close();

    expect(existsSync(legacyPath)).toBe(false);
    expect(existsSync(`${legacyPath}-wal`)).toBe(false);
    expect(existsSync(`${legacyPath}-shm`)).toBe(false);
    expect(existsSync(join(brunchDir, WORKSPACE_DB_FILENAME))).toBe(true);

    const recovered = new Database(join(brunchDir, WORKSPACE_DB_FILENAME));
    const markerRows = recovered.prepare('SELECT id FROM marker').all();
    const appId = recovered.pragma('application_id', { simple: true });
    recovered.close();
    expect(markerRows).toEqual([{ id: 1 }]);
    expect(appId).toBe(1112692273);
  });

  it('leaves a legacy alpha data.db untouched when brunch-v1.db already exists', async () => {
    const first = await openWorkspaceDb(cwd);
    first.insert(specs).values({ name: 'Current', slug: 'current' }).run();
    first.$client.close();

    const legacyPath = join(brunchDir, LEGACY_ALPHA_DB_FILENAME);
    const legacy = new Database(legacyPath);
    legacy.exec('CREATE TABLE marker (id INTEGER PRIMARY KEY)');
    legacy.close();
    const legacyBytesBefore = await readFile(legacyPath);

    const db = await openWorkspaceDb(cwd);
    const rows = db.select().from(specs).all();
    db.$client.close();

    expect(rows.map((row) => row.slug)).toEqual(['current']);
    const legacyBytesAfter = await readFile(legacyPath);
    expect(legacyBytesAfter.equals(legacyBytesBefore)).toBe(true);
  });
});
