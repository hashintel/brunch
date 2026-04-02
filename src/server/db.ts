import Database from 'better-sqlite3';

export type DB = Database.Database;
export type Phase = 'scope' | 'design' | 'requirements' | 'criteria';
export type Impact = 'high' | 'medium' | 'low';

export interface Project {
	id: number;
	name: string;
	active_turn_id: number | null;
	created_at: string;
	updated_at: string;
}

export interface Turn {
	id: number;
	project_id: number;
	parent_turn_id: number | null;
	phase: Phase;
	question: string;
	why: string | null;
	impact: Impact | null;
	answer: string | null;
	is_resolution: number;
	created_at: string;
}

export interface Option {
	id: number;
	turn_id: number;
	position: number;
	content: string;
	is_recommended: number;
	is_selected: number;
}

export interface CreateTurnInput {
	parent_turn_id?: number | null;
	phase: Phase;
	question: string;
	why?: string | null;
	impact?: Impact | null;
	answer?: string | null;
	is_resolution?: boolean;
}

export interface CreateOptionInput {
	position: number;
	content: string;
	is_recommended?: boolean;
	is_selected?: boolean;
}

export function createDb(path: string = ':memory:'): DB {
	const db = new Database(path);
	db.pragma('journal_mode = WAL');
	db.exec(`
		CREATE TABLE IF NOT EXISTS project (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			active_turn_id INTEGER,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			updated_at TEXT NOT NULL DEFAULT (datetime('now'))
		);

		CREATE TABLE IF NOT EXISTS turn (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			project_id INTEGER NOT NULL REFERENCES project(id),
			parent_turn_id INTEGER REFERENCES turn(id),
			phase TEXT NOT NULL CHECK (phase IN ('scope', 'design', 'requirements', 'criteria')),
			question TEXT NOT NULL DEFAULT '',
			why TEXT,
			impact TEXT CHECK (impact IS NULL OR impact IN ('high', 'medium', 'low')),
			answer TEXT,
			is_resolution INTEGER NOT NULL DEFAULT 0,
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		);

		CREATE TABLE IF NOT EXISTS option (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			turn_id INTEGER NOT NULL REFERENCES turn(id),
			position INTEGER NOT NULL,
			content TEXT NOT NULL,
			is_recommended INTEGER NOT NULL DEFAULT 0,
			is_selected INTEGER NOT NULL DEFAULT 0,
			UNIQUE(turn_id, position)
		);

		CREATE TABLE IF NOT EXISTS decision (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			project_id INTEGER NOT NULL REFERENCES project(id),
			content TEXT NOT NULL,
			rationale TEXT
		);

		CREATE TABLE IF NOT EXISTS assumption (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			project_id INTEGER NOT NULL REFERENCES project(id),
			content TEXT NOT NULL
		);

		CREATE TABLE IF NOT EXISTS requirement (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			project_id INTEGER NOT NULL REFERENCES project(id),
			content TEXT NOT NULL,
			reviewed_at TEXT
		);

		CREATE TABLE IF NOT EXISTS criterion (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			project_id INTEGER NOT NULL REFERENCES project(id),
			requirement_id INTEGER NOT NULL REFERENCES requirement(id),
			content TEXT NOT NULL,
			reviewed_at TEXT
		);

		CREATE TABLE IF NOT EXISTS turn_decision (
			turn_id INTEGER NOT NULL REFERENCES turn(id),
			decision_id INTEGER NOT NULL REFERENCES decision(id),
			PRIMARY KEY (turn_id, decision_id)
		);

		CREATE TABLE IF NOT EXISTS turn_assumption (
			turn_id INTEGER NOT NULL REFERENCES turn(id),
			assumption_id INTEGER NOT NULL REFERENCES assumption(id),
			PRIMARY KEY (turn_id, assumption_id)
		);

		CREATE TABLE IF NOT EXISTS decision_parent_decision (
			decision_id INTEGER NOT NULL REFERENCES decision(id),
			parent_decision_id INTEGER NOT NULL REFERENCES decision(id),
			PRIMARY KEY (decision_id, parent_decision_id)
		);

		CREATE TABLE IF NOT EXISTS decision_parent_assumption (
			decision_id INTEGER NOT NULL REFERENCES decision(id),
			parent_assumption_id INTEGER NOT NULL REFERENCES assumption(id),
			PRIMARY KEY (decision_id, parent_assumption_id)
		);

		CREATE TABLE IF NOT EXISTS assumption_parent_assumption (
			assumption_id INTEGER NOT NULL REFERENCES assumption(id),
			parent_assumption_id INTEGER NOT NULL REFERENCES assumption(id),
			PRIMARY KEY (assumption_id, parent_assumption_id)
		);

		CREATE TABLE IF NOT EXISTS requirement_decision (
			requirement_id INTEGER NOT NULL REFERENCES requirement(id),
			decision_id INTEGER NOT NULL REFERENCES decision(id),
			PRIMARY KEY (requirement_id, decision_id)
		);
	`);
	return db;
}

export function getOrCreateProject(db: DB, name = 'default'): Project {
	const existing = db.prepare('SELECT * FROM project ORDER BY created_at DESC LIMIT 1').get() as Project | undefined;
	if (existing) return existing;
	const result = db.prepare('INSERT INTO project (name) VALUES (?)').run(name);
	return db.prepare('SELECT * FROM project WHERE id = ?').get(result.lastInsertRowid) as Project;
}

export function createTurn(db: DB, projectId: number, input: CreateTurnInput): Turn {
	const result = db.prepare(`
		INSERT INTO turn (project_id, parent_turn_id, phase, question, why, impact, answer, is_resolution)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`).run(
		projectId,
		input.parent_turn_id ?? null,
		input.phase,
		input.question,
		input.why ?? null,
		input.impact ?? null,
		input.answer ?? null,
		input.is_resolution ? 1 : 0,
	);
	return db.prepare('SELECT * FROM turn WHERE id = ?').get(result.lastInsertRowid) as Turn;
}

export function updateTurn(db: DB, turnId: number, updates: { question?: string; answer?: string }): void {
	const setClauses: string[] = [];
	const values: unknown[] = [];
	if (updates.question !== undefined) {
		setClauses.push('question = ?');
		values.push(updates.question);
	}
	if (updates.answer !== undefined) {
		setClauses.push('answer = ?');
		values.push(updates.answer);
	}
	if (setClauses.length === 0) return;
	values.push(turnId);
	db.prepare(`UPDATE turn SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
}

export function createOption(db: DB, turnId: number, input: CreateOptionInput): Option {
	const result = db.prepare(`
		INSERT INTO option (turn_id, position, content, is_recommended, is_selected)
		VALUES (?, ?, ?, ?, ?)
	`).run(
		turnId,
		input.position,
		input.content,
		input.is_recommended ? 1 : 0,
		input.is_selected ? 1 : 0,
	);
	return db.prepare('SELECT * FROM option WHERE id = ?').get(result.lastInsertRowid) as Option;
}

export function getActivePath(db: DB, projectId: number): Turn[] {
	const project = db.prepare('SELECT active_turn_id FROM project WHERE id = ?').get(projectId) as Pick<Project, 'active_turn_id'> | undefined;
	if (!project?.active_turn_id) return [];

	return db.prepare(`
		WITH RECURSIVE path AS (
			SELECT * FROM turn WHERE id = ?
			UNION ALL
			SELECT t.* FROM turn t JOIN path p ON t.id = p.parent_turn_id
		)
		SELECT * FROM path ORDER BY id ASC
	`).all(project.active_turn_id) as Turn[];
}

export function advanceHead(db: DB, projectId: number, turnId: number): void {
	db.prepare("UPDATE project SET active_turn_id = ?, updated_at = datetime('now') WHERE id = ?").run(turnId, projectId);
}
