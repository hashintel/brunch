export const BRUNCH_DIR = '.brunch';
export const STATE_FILE = 'workspace.json';
export const SESSION_DIR = 'sessions';
export const STATE_SCHEMA_VERSION = 1;

/**
 * The current workspace database filename, under the `brunch-v{major}.db`
 * lineage policy (D124-L): the DB format may change incompatibly only across
 * major product versions, and the filename is the compatibility contract.
 * 0.x's `.brunch/brunch.db` is this line's retroactive v0; this is v1.
 * Bump the major segment only alongside a deliberate incompatible
 * schema/format change.
 *
 * Lives here — not in `graph/workspace-store.ts`, which owns the open/guard
 * lifecycle — so leaf consumers like `drizzle.config.ts` can read the name
 * without loading better-sqlite3 and the DB runtime.
 */
export const WORKSPACE_DB_FILENAME = 'brunch-v1.db';

/**
 * The pre-1.0 alpha workspace DB filename. One-shot-recovered by rename into
 * `WORKSPACE_DB_FILENAME` (plus `-wal`/`-shm` sidecars) on first open when the
 * current-line file is absent — owed to existing alpha workspaces (D124-L
 * mechanic 4). Never opened directly; never deleted. Recovery mechanics live
 * in `graph/workspace-store.ts`.
 */
export const LEGACY_ALPHA_DB_FILENAME = 'data.db';
