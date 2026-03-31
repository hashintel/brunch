import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

export type DB = Database.Database;

export interface Project {
	id: string;
	name: string;
	created_at: string;
}

export interface Message {
	id: string;
	project_id: string;
	role: string;
	content: string;
	created_at: string;
}

export function createDb(path: string = ':memory:'): DB {
	const db = new Database(path);
	db.pragma('journal_mode = WAL');
	db.exec(`
		CREATE TABLE IF NOT EXISTS project (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		);
		CREATE TABLE IF NOT EXISTS message (
			id TEXT PRIMARY KEY,
			project_id TEXT NOT NULL REFERENCES project(id),
			role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
			content TEXT NOT NULL,
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		);
	`);
	return db;
}

export function getOrCreateProject(db: DB, name = 'default'): Project {
	const existing = db.prepare('SELECT * FROM project ORDER BY created_at DESC LIMIT 1').get() as Project | undefined;
	if (existing) return existing;
	const id = randomUUID();
	db.prepare('INSERT INTO project (id, name) VALUES (?, ?)').run(id, name);
	return db.prepare('SELECT * FROM project WHERE id = ?').get(id) as Project;
}

export function saveMessage(db: DB, projectId: string, role: string, content: string): Message {
	const id = randomUUID();
	db.prepare('INSERT INTO message (id, project_id, role, content) VALUES (?, ?, ?, ?)').run(id, projectId, role, content);
	return db.prepare('SELECT * FROM message WHERE id = ?').get(id) as Message;
}

export function getMessages(db: DB, projectId: string): Message[] {
	return db.prepare('SELECT * FROM message WHERE project_id = ? ORDER BY created_at ASC, rowid ASC').all(projectId) as Message[];
}
