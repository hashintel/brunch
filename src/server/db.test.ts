import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { createDb, getOrCreateProject, saveMessage, getMessages, type DB } from './db.js';

let db: DB;

beforeEach(() => {
	db = createDb(); // :memory:
});

afterEach(() => {
	db.close();
});

describe('createDb', () => {
	it('creates project and message tables', () => {
		const tables = db
			.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
			.all() as Array<{ name: string }>;
		const names = tables.map((t) => t.name);
		expect(names).toContain('project');
		expect(names).toContain('message');
	});

	it('creates database file on disk when given a path', () => {
		const dir = join(tmpdir(), `brunch-test-${randomUUID()}`);
		mkdirSync(dir, { recursive: true });
		const dbPath = join(dir, 'test.db');
		const diskDb = createDb(dbPath);
		expect(existsSync(dbPath)).toBe(true);
		diskDb.close();
		unlinkSync(dbPath);
	});

	it('enables WAL journal mode for file-backed databases', () => {
		const dir = join(tmpdir(), `brunch-test-${randomUUID()}`);
		mkdirSync(dir, { recursive: true });
		const dbPath = join(dir, 'wal-test.db');
		const fileDb = createDb(dbPath);
		const row = fileDb.prepare('PRAGMA journal_mode').get() as { journal_mode: string };
		expect(row.journal_mode).toBe('wal');
		fileDb.close();
		unlinkSync(dbPath);
	});
});

describe('getOrCreateProject', () => {
	it('creates a default project when none exists', () => {
		const project = getOrCreateProject(db);
		expect(project).toMatchObject({ name: 'default' });
		expect(project.id).toBeDefined();
		expect(project.created_at).toBeDefined();
	});

	it('returns the existing project on subsequent calls', () => {
		const first = getOrCreateProject(db);
		const second = getOrCreateProject(db);
		expect(second.id).toBe(first.id);
	});
});

describe('saveMessage / getMessages', () => {
	it('persists user and assistant messages', () => {
		const project = getOrCreateProject(db);
		saveMessage(db, project.id, 'user', 'hello');
		saveMessage(db, project.id, 'assistant', 'hi there');
		const messages = getMessages(db, project.id);
		expect(messages).toHaveLength(2);
		expect(messages[0]).toMatchObject({ role: 'user', content: 'hello' });
		expect(messages[1]).toMatchObject({ role: 'assistant', content: 'hi there' });
	});

	it('returns messages ordered by creation time', () => {
		const project = getOrCreateProject(db);
		saveMessage(db, project.id, 'user', 'first');
		saveMessage(db, project.id, 'assistant', 'second');
		saveMessage(db, project.id, 'user', 'third');
		const messages = getMessages(db, project.id);
		expect(messages.map((m) => m.content)).toEqual(['first', 'second', 'third']);
	});

	it('assigns unique IDs to each message', () => {
		const project = getOrCreateProject(db);
		saveMessage(db, project.id, 'user', 'a');
		saveMessage(db, project.id, 'assistant', 'b');
		const messages = getMessages(db, project.id);
		expect(messages[0].id).not.toBe(messages[1].id);
	});

	it('returns empty array for project with no messages', () => {
		const project = getOrCreateProject(db);
		const messages = getMessages(db, project.id);
		expect(messages).toEqual([]);
	});
});

describe('DB lifecycle', () => {
	it('create → persist → close → reopen → state intact', () => {
		const dir = join(tmpdir(), `brunch-test-${randomUUID()}`);
		mkdirSync(dir, { recursive: true });
		const dbPath = join(dir, 'lifecycle.db');

		// Create and populate
		const db1 = createDb(dbPath);
		const project = getOrCreateProject(db1);
		saveMessage(db1, project.id, 'user', 'hello');
		saveMessage(db1, project.id, 'assistant', 'world');
		db1.close();

		// Reopen and verify
		const db2 = createDb(dbPath);
		const reopenedProject = getOrCreateProject(db2);
		expect(reopenedProject.id).toBe(project.id);
		const messages = getMessages(db2, reopenedProject.id);
		expect(messages).toHaveLength(2);
		expect(messages[0]).toMatchObject({ role: 'user', content: 'hello' });
		expect(messages[1]).toMatchObject({ role: 'assistant', content: 'world' });
		db2.close();

		// Cleanup
		unlinkSync(dbPath);
	});
});
