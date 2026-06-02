/**
 * better-sqlite3 connection lifecycle.
 *
 * SPEC decisions: D16-L (settled by A20-L spike)
 * Stack: drizzle-orm@0.45.2 + better-sqlite3@12.8.0
 */

import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"

import * as schema from "./schema.js"

export type BrunchDb = ReturnType<typeof drizzle<typeof schema>>

/**
 * Create a Brunch database connection with schema initialized.
 *
 * Creates all tables if they don't exist and seeds the graph_clock
 * with lsn=0. For tests, pass `":memory:"` for an in-memory database.
 *
 * When real migrations are needed (existing data to transform),
 * replace `initSchema` with `drizzle-kit`-managed migrations.
 */
export function createDb(path: string): BrunchDb {
  const sqlite = new Database(path)
  sqlite.pragma("journal_mode = WAL")
  sqlite.pragma("foreign_keys = ON")
  initSchema(sqlite)
  return drizzle(sqlite, { schema })
}

/**
 * Push schema DDL and seed initial data.
 *
 * This replaces drizzle-kit migrations for the initial M4 slice.
 * Pre-release posture: no existing data to preserve, so CREATE IF
 * NOT EXISTS is sufficient. Add migration files when schema evolution
 * needs data transformation.
 */
function initSchema(sqlite: Database.Database): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS nodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plane TEXT NOT NULL,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT,
      basis TEXT NOT NULL DEFAULT 'explicit',
      source TEXT,
      detail TEXT,
      created_at_lsn INTEGER NOT NULL,
      updated_at_lsn INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS edges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      source_id INTEGER NOT NULL REFERENCES nodes(id),
      target_id INTEGER NOT NULL REFERENCES nodes(id),
      stance TEXT,
      basis TEXT NOT NULL DEFAULT 'explicit',
      rationale TEXT,
      created_at_lsn INTEGER NOT NULL,
      updated_at_lsn INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS graph_clock (
      id INTEGER PRIMARY KEY,
      lsn INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS change_log (
      lsn INTEGER PRIMARY KEY,
      operation TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reconciliation_need (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_kind TEXT NOT NULL,
      target_edge_id INTEGER REFERENCES edges(id),
      target_a_id INTEGER REFERENCES nodes(id),
      target_b_id INTEGER REFERENCES nodes(id),
      kind TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      reason TEXT,
      created_at_lsn INTEGER NOT NULL,
      resolved_at_lsn INTEGER
    );

    INSERT OR IGNORE INTO graph_clock (id, lsn) VALUES (1, 0);
  `)
}
