import { existsSync } from 'node:fs';
import { mkdir, rename } from 'node:fs/promises';
import { join } from 'node:path';

import Database from 'better-sqlite3';

import { BRUNCH_DIR } from '../constants.js';
import { createDb } from '../db/connection.js';
import { CommandExecutor } from './command-executor.js';
import {
  getNodes,
  getOpenReconciliationNeeds,
  latestGraphLsn,
  queryGraph,
  resolveGraphEdgeId,
  resolveGraphNodeCode,
} from './queries.js';
import type {
  GetNodesOptions,
  GraphReadOptions,
  GraphSlice,
  GraphFilter,
  NodeNeighborhood,
  NodeSelector,
} from './queries.js';

/**
 * Spec-scoped graph reads. Returned by `WorkspaceGraphRuntime.forSpec`
 * so callers interact with one spec's graph without threading `specId` through
 * every read.
 */
export interface SpecScopedReaders {
  readonly queryGraph: (filter?: GraphFilter, options?: GraphReadOptions) => GraphSlice;
  readonly getNodes: (
    selectors: readonly NodeSelector[],
    options?: GetNodesOptions,
  ) => readonly NodeNeighborhood[];
  readonly resolveNodeCode: (code: string) => number | undefined;
  readonly resolveEdgeId: (edgeId: number) => number | undefined;
  readonly getOpenReconciliationNeeds: () => ReturnType<typeof getOpenReconciliationNeeds>;
  /** Cheap current-LSN read; detect graph change without a full queryGraph. */
  readonly latestLsn: () => number;
}

export interface WorkspaceGraphRuntime {
  readonly commandExecutor: CommandExecutor;
  /** Bind graph reads to a single spec (D61-L). */
  readonly forSpec: (specId: number) => SpecScopedReaders;
  /**
   * Whether a sibling 0.x `.brunch/brunch.db` was detected alongside this
   * open (I63-L posture evidence; D118-L consumer). The 0.x file itself is
   * never opened, migrated, or deleted.
   */
  readonly legacyZeroXDetected: boolean;
}

export async function openWorkspaceGraphRuntime(cwd: string): Promise<WorkspaceGraphRuntime> {
  const [db, legacyZeroXDetected] = await Promise.all([openWorkspaceDb(cwd), detectLegacyZeroXDatabase(cwd)]);
  const commandExecutor = new CommandExecutor(db);
  return {
    commandExecutor,
    legacyZeroXDetected,
    forSpec(specId: number): SpecScopedReaders {
      return {
        queryGraph: (filter, options) => queryGraph(db, specId, filter, options),
        getNodes: (selectors, options) => getNodes(db, specId, selectors, options),
        resolveNodeCode: (code) => resolveGraphNodeCode(db, specId, code),
        resolveEdgeId: (edgeId) => resolveGraphEdgeId(db, specId, edgeId),
        getOpenReconciliationNeeds: () => getOpenReconciliationNeeds(db, specId),
        latestLsn: () => latestGraphLsn(db, specId),
      };
    },
  };
}

export async function openWorkspaceCommandExecutor(cwd: string): Promise<CommandExecutor> {
  return (await openWorkspaceGraphRuntime(cwd)).commandExecutor;
}

/**
 * The current workspace database filename, under the `brunch-v{major}.db`
 * lineage policy (D124-L): the DB format may change incompatibly only across
 * major product versions, and the filename is the compatibility contract.
 * 0.x's `.brunch/brunch.db` is this line's retroactive v0
 * (`LEGACY_ZERO_X_DB_FILENAME`); this is v1. Bump the major segment only
 * alongside a deliberate incompatible schema/format change.
 */
export const WORKSPACE_DB_FILENAME = 'brunch-v1.db';

/**
 * The pre-1.0 alpha workspace DB filename. One-shot-recovered by rename into
 * `WORKSPACE_DB_FILENAME` (plus `-wal`/`-shm` sidecars) on first open when the
 * current-line file is absent — owed to existing alpha workspaces (D124-L
 * mechanic 4). Never opened directly; never deleted.
 */
export const LEGACY_ALPHA_DB_FILENAME = 'data.db';

/**
 * The 0.x workspace DB filename — this lineage's retroactive v0. A sibling is
 * detected as a pure filesystem check and surfaced as populated-cwd/
 * brownfield posture evidence (D118-L); never opened, migrated, or deleted
 * (I63-L).
 */
export const LEGACY_ZERO_X_DB_FILENAME = 'brunch.db';

/** SQLite `application_id` magic stamped on every `brunch-v1.db` (ASCII "BRV1"). */
const BRUNCH_APPLICATION_ID = 0x42_52_56_31;

/** The table name drizzle-orm's better-sqlite3 migrator creates (its default; `db/connection.ts` doesn't override it). */
const DRIZZLE_MIGRATIONS_TABLE = '__drizzle_migrations';

/**
 * Thrown when a `brunch-v1.db`-named file does not self-identify as the
 * current Brunch major line (I63-L: fail-safe refusal). Thrown before
 * `createDb`'s migration runs, so a foreign or incompatible file is never
 * opened for write, migrated, or deleted.
 */
export class WorkspaceDbRefusalError extends Error {
  constructor(
    readonly path: string,
    readonly foundApplicationId: number,
  ) {
    super(
      foundApplicationId === 0
        ? `Refusing to open ${path}: application_id is unset (0) and the file shows no Brunch lineage ` +
            `(no ${DRIZZLE_MIGRATIONS_TABLE} table, and it is not empty). Zero is SQLite's own default, not a ` +
            'Brunch marker, so this file was not created by this Brunch line and will not be opened, migrated, ' +
            'or deleted.'
        : `Refusing to open ${path}: application_id ${foundApplicationId} does not match the Brunch v1 line ` +
            `(${BRUNCH_APPLICATION_ID}). This file was not created by this Brunch line and will not be opened, ` +
            'migrated, or deleted.',
    );
    this.name = 'WorkspaceDbRefusalError';
  }
}

/**
 * Detects a sibling 0.x `.brunch/brunch.db` without opening it — a pure
 * filesystem existence check (I63-L: the 0.x file is never opened, migrated,
 * or deleted). Feeds populated-cwd/brownfield posture evidence (D118-L) at
 * the spec-establishment seam (`session/workspace-session-coordinator.ts`).
 */
export async function detectLegacyZeroXDatabase(cwd: string): Promise<boolean> {
  return existsSync(join(cwd, BRUNCH_DIR, LEGACY_ZERO_X_DB_FILENAME));
}

/**
 * Opens the workspace's `brunch-v1.db`: recovers a legacy alpha `data.db` by
 * rename first (D124-L mechanic 4), then enforces the fail-safe
 * `application_id` open guard (I63-L) before handing off to `createDb`'s
 * migration.
 */
export async function openWorkspaceDb(cwd: string) {
  const brunchDir = join(cwd, BRUNCH_DIR);
  await mkdir(brunchDir, { recursive: true });
  await recoverLegacyAlphaDatabase(brunchDir);

  const dbPath = join(brunchDir, WORKSPACE_DB_FILENAME);
  const preexisting = existsSync(dbPath);
  if (preexisting) {
    checkApplicationIdOrRefuse(dbPath);
  }

  const db = createDb(dbPath);
  if (!preexisting) {
    // A file we just created ourselves: safe to stamp after migration, which
    // guarantees page 1 exists rather than relying on pragma writes against
    // a still-empty file.
    db.$client.pragma(`application_id = ${BRUNCH_APPLICATION_ID}`);
  }
  return db;
}

/**
 * One-shot recovery (D124-L mechanic 4): when `brunch-v1.db` is absent and a
 * legacy alpha `data.db` exists, adopt it by rename — main file plus
 * `-wal`/`-shm` sidecars, before any open. Never runs while `brunch-v1.db`
 * already exists (that file always wins; the legacy file is left
 * untouched), and never renames while a connection to the legacy file is
 * open — this function only renames closed files on disk.
 */
async function recoverLegacyAlphaDatabase(brunchDir: string): Promise<void> {
  const targetPath = join(brunchDir, WORKSPACE_DB_FILENAME);
  const legacyPath = join(brunchDir, LEGACY_ALPHA_DB_FILENAME);
  if (existsSync(targetPath) || !existsSync(legacyPath)) return;

  for (const suffix of ['', '-wal', '-shm']) {
    const from = `${legacyPath}${suffix}`;
    if (existsSync(from)) await rename(from, `${targetPath}${suffix}`);
  }
}

/**
 * Checks an existing `brunch-v1.db`'s `application_id` before any migration
 * runs. An unstamped file (`application_id` 0) is only ours to adopt when it
 * shows Brunch lineage evidence — see {@link hasBrunchLineageEvidence}; any
 * other value, or a zero-id file without that evidence, throws
 * {@link WorkspaceDbRefusalError} and leaves the file untouched.
 */
function checkApplicationIdOrRefuse(dbPath: string): void {
  const sqlite = new Database(dbPath);
  try {
    const current = sqlite.pragma('application_id', { simple: true }) as number;
    if (current === BRUNCH_APPLICATION_ID) return;
    if (current !== 0 || !hasBrunchLineageEvidence(sqlite)) {
      throw new WorkspaceDbRefusalError(dbPath, current);
    }
    sqlite.pragma(`application_id = ${BRUNCH_APPLICATION_ID}`);
  } finally {
    sqlite.close();
  }
}

/**
 * Zero is SQLite's universal default `application_id`, not a Brunch marker
 * — an arbitrary foreign SQLite file placed at `brunch-v1.db` also has it
 * (I63-L: the runtime opens only databases that self-identify). An unstamped
 * file is only trustworthy to adopt when it carries independent Brunch
 * lineage evidence: drizzle's own migrations table (true of every
 * just-recovered legacy alpha file, since `createDb` always migrates), or no
 * user tables at all — nothing to protect, safe to adopt.
 */
function hasBrunchLineageEvidence(sqlite: Database.Database): boolean {
  const tables = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .all() as { name: string }[];
  if (tables.length === 0) return true;
  return tables.some((table) => table.name === DRIZZLE_MIGRATIONS_TABLE);
}
