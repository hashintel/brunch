import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq, sql } from 'drizzle-orm';
import * as schema from './schema.js';

export type DB = ReturnType<typeof drizzle<typeof schema>>;
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
	const sqlite = new Database(path);
	sqlite.pragma('journal_mode = WAL');
	const db = drizzle(sqlite, { schema });
	migrate(db, { migrationsFolder: './drizzle' });
	return db;
}

export function getOrCreateProject(db: DB, name = 'default'): Project {
	const existing = db.select().from(schema.project).orderBy(schema.project.created_at).limit(1).get();
	if (existing) return existing as Project;
	db.insert(schema.project).values({ name }).run();
	const created = db.select().from(schema.project).orderBy(schema.project.id).limit(1).get();
	return created as Project;
}

export function createTurn(db: DB, projectId: number, input: CreateTurnInput): Turn {
	const result = db.insert(schema.turn).values({
		project_id: projectId,
		parent_turn_id: input.parent_turn_id ?? null,
		phase: input.phase,
		question: input.question,
		why: input.why ?? null,
		impact: input.impact ?? null,
		answer: input.answer ?? null,
		is_resolution: input.is_resolution ? 1 : 0,
	}).returning().get();
	return result as Turn;
}

export function updateTurn(db: DB, turnId: number, updates: { question?: string; answer?: string }): void {
	if (updates.question === undefined && updates.answer === undefined) return;
	const values: Record<string, string> = {};
	if (updates.question !== undefined) values.question = updates.question;
	if (updates.answer !== undefined) values.answer = updates.answer;
	db.update(schema.turn).set(values).where(eq(schema.turn.id, turnId)).run();
}

export function createOption(db: DB, turnId: number, input: CreateOptionInput): Option {
	const result = db.insert(schema.option).values({
		turn_id: turnId,
		position: input.position,
		content: input.content,
		is_recommended: input.is_recommended ? 1 : 0,
		is_selected: input.is_selected ? 1 : 0,
	}).returning().get();
	return result as Option;
}

export function getActivePath(db: DB, projectId: number): Turn[] {
	const project = db.select({ active_turn_id: schema.project.active_turn_id })
		.from(schema.project)
		.where(eq(schema.project.id, projectId))
		.get();
	if (!project?.active_turn_id) return [];

	// Recursive CTE — raw SQL via Drizzle's sql tag
	const rows = db.all(sql`
		WITH RECURSIVE path AS (
			SELECT * FROM turn WHERE id = ${project.active_turn_id}
			UNION ALL
			SELECT t.* FROM turn t JOIN path p ON t.id = p.parent_turn_id
		)
		SELECT * FROM path ORDER BY id ASC
	`);
	return rows as Turn[];
}

export function advanceHead(db: DB, projectId: number, turnId: number): void {
	db.update(schema.project)
		.set({ active_turn_id: turnId, updated_at: sql`datetime('now')` })
		.where(eq(schema.project.id, projectId))
		.run();
}
