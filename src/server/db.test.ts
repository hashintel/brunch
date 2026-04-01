import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import {
	createDb,
	getOrCreateProject,
	createTurn,
	updateTurn,
	createOption,
	getActivePath,
	advanceHead,
	type DB,
} from './db.js';

let db: DB;

beforeEach(() => {
	db = createDb(); // :memory:
});

afterEach(() => {
	db.close();
});

describe('createDb', () => {
	it('creates all 13 tables from schema.dbml', () => {
		const tables = db
			.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
			.all() as Array<{ name: string }>;
		const names = tables.map((t) => t.name);
		const expected = [
			'project',
			'turn',
			'option',
			'decision',
			'assumption',
			'requirement',
			'criterion',
			'turn_decision',
			'turn_assumption',
			'decision_parent_decision',
			'decision_parent_assumption',
			'assumption_parent_assumption',
			'requirement_decision',
		];
		for (const table of expected) {
			expect(names).toContain(table);
		}
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
	it('creates a default project with null active_turn_id', () => {
		const project = getOrCreateProject(db);
		expect(project).toMatchObject({ name: 'default', active_turn_id: null });
		expect(project.id).toBeDefined();
		expect(project.created_at).toBeDefined();
	});

	it('returns the existing project on subsequent calls', () => {
		const first = getOrCreateProject(db);
		const second = getOrCreateProject(db);
		expect(second.id).toBe(first.id);
	});
});

describe('turn CRUD', () => {
	it('creates a root turn with no parent', () => {
		const project = getOrCreateProject(db);
		const turn = createTurn(db, project.id, {
			phase: 'scope',
			question: 'What is the project about?',
			answer: 'A chat app',
		});
		expect(turn.id).toBeDefined();
		expect(turn.parent_turn_id).toBeNull();
		expect(turn.phase).toBe('scope');
		expect(turn.question).toBe('What is the project about?');
		expect(turn.answer).toBe('A chat app');
		expect(turn.is_resolution).toBe(0);
	});

	it('creates child turns with parent chain', () => {
		const project = getOrCreateProject(db);
		const t1 = createTurn(db, project.id, { phase: 'scope', question: 'Q1', answer: 'A1' });
		const t2 = createTurn(db, project.id, { phase: 'scope', question: 'Q2', answer: 'A2', parent_turn_id: t1.id });
		const t3 = createTurn(db, project.id, { phase: 'scope', question: 'Q3', answer: 'A3', parent_turn_id: t2.id });
		expect(t2.parent_turn_id).toBe(t1.id);
		expect(t3.parent_turn_id).toBe(t2.id);
	});

	it('creates options for a turn', () => {
		const project = getOrCreateProject(db);
		const turn = createTurn(db, project.id, { phase: 'scope', question: 'Pick one' });
		const opt1 = createOption(db, turn.id, { position: 0, content: 'Option A', is_recommended: true });
		const opt2 = createOption(db, turn.id, { position: 1, content: 'Option B' });
		expect(opt1.is_recommended).toBe(1);
		expect(opt1.content).toBe('Option A');
		expect(opt2.is_recommended).toBe(0);
	});

	it('enforces unique (turn_id, position) on options', () => {
		const project = getOrCreateProject(db);
		const turn = createTurn(db, project.id, { phase: 'scope', question: 'Pick one' });
		createOption(db, turn.id, { position: 0, content: 'Option A' });
		expect(() => createOption(db, turn.id, { position: 0, content: 'Duplicate' })).toThrow();
	});

	it('updates turn answer and question', () => {
		const project = getOrCreateProject(db);
		const turn = createTurn(db, project.id, { phase: 'scope', question: '' });
		updateTurn(db, turn.id, { question: 'Updated Q', answer: 'User said this' });
		const updated = db.prepare('SELECT * FROM turn WHERE id = ?').get(turn.id) as any;
		expect(updated.question).toBe('Updated Q');
		expect(updated.answer).toBe('User said this');
	});

	it('partial update only changes specified fields', () => {
		const project = getOrCreateProject(db);
		const turn = createTurn(db, project.id, { phase: 'scope', question: 'Original Q', answer: 'Original A' });
		updateTurn(db, turn.id, { question: 'New Q' });
		const updated = db.prepare('SELECT * FROM turn WHERE id = ?').get(turn.id) as any;
		expect(updated.question).toBe('New Q');
		expect(updated.answer).toBe('Original A');
	});
});

describe('active path resolution', () => {
	it('returns empty array when no HEAD is set', () => {
		const project = getOrCreateProject(db);
		const path = getActivePath(db, project.id);
		expect(path).toEqual([]);
	});

	it('resolves linear chain from root to HEAD', () => {
		const project = getOrCreateProject(db);
		const t1 = createTurn(db, project.id, { phase: 'scope', question: 'Q1', answer: 'A1' });
		const t2 = createTurn(db, project.id, { phase: 'scope', question: 'Q2', answer: 'A2', parent_turn_id: t1.id });
		const t3 = createTurn(db, project.id, { phase: 'scope', question: 'Q3', answer: 'A3', parent_turn_id: t2.id });
		advanceHead(db, project.id, t3.id);

		const path = getActivePath(db, project.id);
		expect(path).toHaveLength(3);
		expect(path.map((t) => t.id)).toEqual([t1.id, t2.id, t3.id]);
	});

	it('resolves correct branch after fork', () => {
		const project = getOrCreateProject(db);
		const t1 = createTurn(db, project.id, { phase: 'scope', question: 'Q1', answer: 'A1' });
		const t2a = createTurn(db, project.id, { phase: 'scope', question: 'Q2a', answer: 'A2a', parent_turn_id: t1.id });
		const t2b = createTurn(db, project.id, { phase: 'scope', question: 'Q2b', answer: 'A2b', parent_turn_id: t1.id });

		// HEAD at branch b
		advanceHead(db, project.id, t2b.id);
		const pathB = getActivePath(db, project.id);
		expect(pathB.map((t) => t.id)).toEqual([t1.id, t2b.id]);

		// Switch HEAD to branch a
		advanceHead(db, project.id, t2a.id);
		const pathA = getActivePath(db, project.id);
		expect(pathA.map((t) => t.id)).toEqual([t1.id, t2a.id]);
	});

	it('handles single-turn tree (root = HEAD)', () => {
		const project = getOrCreateProject(db);
		const t1 = createTurn(db, project.id, { phase: 'scope', question: 'Q1', answer: 'A1' });
		advanceHead(db, project.id, t1.id);
		const path = getActivePath(db, project.id);
		expect(path).toHaveLength(1);
		expect(path[0].id).toBe(t1.id);
	});

	it('resolves deep fork correctly', () => {
		const project = getOrCreateProject(db);
		const t1 = createTurn(db, project.id, { phase: 'scope', question: 'Q1', answer: 'A1' });
		const t2 = createTurn(db, project.id, { phase: 'scope', question: 'Q2', answer: 'A2', parent_turn_id: t1.id });
		const t3 = createTurn(db, project.id, { phase: 'scope', question: 'Q3', answer: 'A3', parent_turn_id: t2.id });
		// Fork from t2 (not from t3)
		const t4 = createTurn(db, project.id, { phase: 'design', question: 'Q4', answer: 'A4', parent_turn_id: t2.id });
		const t5 = createTurn(db, project.id, { phase: 'design', question: 'Q5', answer: 'A5', parent_turn_id: t4.id });

		advanceHead(db, project.id, t5.id);
		const path = getActivePath(db, project.id);
		expect(path.map((t) => t.id)).toEqual([t1.id, t2.id, t4.id, t5.id]);
		// t3 is on the other branch — not in the active path
	});
});

describe('advanceHead', () => {
	it('updates project active_turn_id', () => {
		const project = getOrCreateProject(db);
		const turn = createTurn(db, project.id, { phase: 'scope', question: 'Q1' });
		advanceHead(db, project.id, turn.id);
		const updated = getOrCreateProject(db);
		expect(updated.active_turn_id).toBe(turn.id);
	});
});

describe('DB lifecycle — turn tree persistence', () => {
	it('create → persist turns → close → reopen → state intact', () => {
		const dir = join(tmpdir(), `brunch-test-${randomUUID()}`);
		mkdirSync(dir, { recursive: true });
		const dbPath = join(dir, 'lifecycle.db');

		// Create and populate
		const db1 = createDb(dbPath);
		const project = getOrCreateProject(db1);
		const t1 = createTurn(db1, project.id, { phase: 'scope', question: 'Q1', answer: 'A1' });
		const t2 = createTurn(db1, project.id, { phase: 'scope', question: 'Q2', answer: 'A2', parent_turn_id: t1.id });
		createOption(db1, t1.id, { position: 0, content: 'Opt A', is_recommended: true });
		createOption(db1, t1.id, { position: 1, content: 'Opt B' });
		advanceHead(db1, project.id, t2.id);
		db1.close();

		// Reopen and verify
		const db2 = createDb(dbPath);
		const reopened = getOrCreateProject(db2);
		expect(reopened.id).toBe(project.id);
		expect(reopened.active_turn_id).toBe(t2.id);
		const path = getActivePath(db2, reopened.id);
		expect(path).toHaveLength(2);
		expect(path[0].question).toBe('Q1');
		expect(path[1].question).toBe('Q2');
		// Verify options survived
		const options = db2.prepare('SELECT * FROM option WHERE turn_id = ? ORDER BY position').all(t1.id) as any[];
		expect(options).toHaveLength(2);
		expect(options[0].content).toBe('Opt A');
		db2.close();

		unlinkSync(dbPath);
	});
});
