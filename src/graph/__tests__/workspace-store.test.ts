import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createDb } from '../../db/connection.js';
import { specs } from '../../db/schema.js';
import {
  LEGACY_ALPHA_DB_FILENAME,
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

  it('refuses a zero-application_id brunch-v1.db that carries non-Brunch content, leaving it untouched', async () => {
    const foreignPath = join(brunchDir, WORKSPACE_DB_FILENAME);
    await mkdir(brunchDir, { recursive: true });
    // application_id 0 is SQLite's own default — an arbitrary non-Brunch
    // SQLite file placed at this path also has it. Content with no
    // __drizzle_migrations table (and not empty) is not Brunch lineage.
    const raw = new Database(foreignPath);
    raw.exec('CREATE TABLE some_other_apps_table (id INTEGER PRIMARY KEY)');
    raw.close();

    const before = await readFile(foreignPath);

    await expect(openWorkspaceDb(cwd)).rejects.toThrow(WorkspaceDbRefusalError);

    const after = await readFile(foreignPath);
    expect(after.equals(before)).toBe(true);

    const inspect = new Database(foreignPath, { readonly: true });
    const tables = inspect.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as {
      name: string;
    }[];
    const appId = inspect.pragma('application_id', { simple: true });
    inspect.close();
    expect(tables.map((row) => row.name)).toEqual(['some_other_apps_table']);
    expect(appId).toBe(0);
  });

  it('adopts and stamps a zero-application_id brunch-v1.db that is completely empty', async () => {
    const emptyPath = join(brunchDir, WORKSPACE_DB_FILENAME);
    await mkdir(brunchDir, { recursive: true });
    // A zero-byte/no-tables file at this path is nothing to protect: safe to
    // adopt in place (e.g. a partially-initialized file from an interrupted
    // create, or an empty file left by some other tool).
    new Database(emptyPath).close();

    const db = await openWorkspaceDb(cwd);
    expect(db.select().from(specs).all()).toEqual([]);
    db.$client.close();

    const recovered = new Database(emptyPath, { readonly: true });
    const appId = recovered.pragma('application_id', { simple: true });
    recovered.close();
    expect(appId).toBe(1112692273);
  });

  it('recovers a legacy alpha data.db by rename when brunch-v1.db is absent, including -wal/-shm sidecars', async () => {
    const legacyPath = join(brunchDir, LEGACY_ALPHA_DB_FILENAME);
    await mkdir(brunchDir, { recursive: true });

    // A real legacy alpha data.db was always created through this app's own
    // createDb (which always migrates), so it carries the drizzle migrations
    // table — that's the Brunch lineage evidence the zero-application_id
    // adoption path now requires.
    const legacy = createDb(legacyPath);
    legacy.insert(specs).values({ name: 'Legacy spec', slug: 'legacy-spec' }).run();
    legacy.$client.close();

    // Simulate stale sidecar files left behind by a prior session.
    await writeFile(`${legacyPath}-wal`, '');
    await writeFile(`${legacyPath}-shm`, '');

    const db = await openWorkspaceDb(cwd);
    // Drizzle migration authority is unchanged on an adopted file: the
    // current schema exists and is queryable through the normal drizzle
    // surface, not just "createDb didn't throw" — and the legacy row rode
    // along with the rename.
    expect(db.select({ slug: specs.slug }).from(specs).all()).toEqual([{ slug: 'legacy-spec' }]);
    db.$client.close();

    expect(existsSync(legacyPath)).toBe(false);
    expect(existsSync(`${legacyPath}-wal`)).toBe(false);
    expect(existsSync(`${legacyPath}-shm`)).toBe(false);
    expect(existsSync(join(brunchDir, WORKSPACE_DB_FILENAME))).toBe(true);

    const recovered = new Database(join(brunchDir, WORKSPACE_DB_FILENAME));
    const appId = recovered.pragma('application_id', { simple: true });
    recovered.close();
    expect(appId).toBe(1112692273);
  });

  it('refuses a foreign data.db in place — never renamed, bytes untouched, no brunch-v1.db created', async () => {
    const legacyPath = join(brunchDir, LEGACY_ALPHA_DB_FILENAME);
    await mkdir(brunchDir, { recursive: true });
    // A non-Brunch SQLite file at the legacy alpha path: has content, no
    // drizzle migrations table. Adoption-by-rename must not fire before the
    // ownership decision (I63-L) — otherwise the foreign file is silently
    // relocated to brunch-v1.db and only then refused.
    const raw = new Database(legacyPath);
    raw.exec('CREATE TABLE some_other_apps_table (id INTEGER PRIMARY KEY)');
    raw.close();

    const before = await readFile(legacyPath);

    await expect(openWorkspaceDb(cwd)).rejects.toThrow(WorkspaceDbRefusalError);

    expect(existsSync(legacyPath)).toBe(true);
    expect(existsSync(join(brunchDir, WORKSPACE_DB_FILENAME))).toBe(false);
    const after = await readFile(legacyPath);
    expect(after.equals(before)).toBe(true);
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
