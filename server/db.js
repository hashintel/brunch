import Database from 'better-sqlite3';
import { resolve } from 'node:path';
import { readFileSync, readdirSync } from 'node:fs';
import { mkdirSync } from 'node:fs';

const __dirname = new URL('.', import.meta.url).pathname;
const DATA_DIR = resolve(__dirname, 'data');
const DB_PATH = resolve(DATA_DIR, 'brunch.db');
const MIGRATIONS_DIR = resolve(__dirname, 'migrations');

mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode and foreign keys
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Simple migration tracking
db.exec(`CREATE TABLE IF NOT EXISTS "_migrations" (
    "name" TEXT PRIMARY KEY,
    "applied_at" TEXT NOT NULL DEFAULT (datetime('now'))
)`);

// Run pending migrations in order
const applied = new Set(
    db.prepare('SELECT name FROM _migrations').all().map(r => r.name)
);

const files = readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(resolve(MIGRATIONS_DIR, file), 'utf-8');
    db.exec(sql);
    db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file);
    console.log(`[db] applied migration: ${file}`);
}

export default db;
