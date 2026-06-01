/**
 * better-sqlite3 connection lifecycle.
 *
 * SPEC decisions: D16-L (settled by A20-L spike)
 * Stack: drizzle-orm@0.45.2 + better-sqlite3@12.8.0
 */

import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import { migrate } from "drizzle-orm/better-sqlite3/migrator"

import * as schema from "./schema.js"

export type BrunchDb = ReturnType<typeof drizzle<typeof schema>>

export function createDb(path: string): BrunchDb {
  const sqlite = new Database(path)
  sqlite.pragma("journal_mode = WAL")
  sqlite.pragma("foreign_keys = ON")
  const db = drizzle(sqlite, { schema })
  // migrate(db, { migrationsFolder: ... }) — wired when first migration lands
  return db
}
