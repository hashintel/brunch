/**
 * Uses drizzle-kit migrations generated from `src/db/schema.ts`.
 *
 * better-sqlite3 connection lifecycle.
 *
 * SPEC decisions: D16-L (settled by A20-L spike)
 * Stack: drizzle-orm@0.45.x + better-sqlite3@12.x
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import * as schema from './schema.js';

export type BrunchDb = ReturnType<typeof drizzle<typeof schema>>;

/**
 * Create a Brunch database connection and run Drizzle-managed migrations.
 *
 * For tests, pass `":memory:"` for an in-memory database.
 */
export function createDb(path: string): BrunchDb {
  const sqlite = new Database(path);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: migrationsFolder() });
  return db;
}

function migrationsFolder(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '../../drizzle');
}
