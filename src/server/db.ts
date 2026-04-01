import Database from 'better-sqlite3';
import { desc, eq, sql, type InferSelectModel } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import * as schema from './schema.js';

export type DB = ReturnType<typeof drizzle<typeof schema>>;
export type Project = InferSelectModel<typeof schema.project>;
export type Turn = InferSelectModel<typeof schema.turn>;
export type Option = InferSelectModel<typeof schema.option>;
export type Phase = Turn['phase'];
export type Impact = NonNullable<Turn['impact']>;

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
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: './drizzle' });
  return db;
}

export function getOrCreateProject(db: DB, name = 'default'): Project {
  const existing = db.select().from(schema.project).orderBy(desc(schema.project.created_at)).limit(1).get();
  if (existing) return existing as Project;
  const result = db.insert(schema.project).values({ name }).returning().get();
  return result as Project;
}

export function listProjects(db: DB): Project[] {
  return db.select().from(schema.project).orderBy(desc(schema.project.updated_at)).all() as Project[];
}

export function createProject(db: DB, name: string): Project {
  const result = db.insert(schema.project).values({ name }).returning().get();
  return result as Project;
}

export function getProject(db: DB, id: number): Project | undefined {
  return db.select().from(schema.project).where(eq(schema.project.id, id)).get() as Project | undefined;
}

export function getTurn(db: DB, turnId: number): Turn | undefined {
  return db.select().from(schema.turn).where(eq(schema.turn.id, turnId)).get() as Turn | undefined;
}

export function createTurn(db: DB, projectId: number, input: CreateTurnInput): Turn {
  const result = db
    .insert(schema.turn)
    .values({
      project_id: projectId,
      parent_turn_id: input.parent_turn_id ?? null,
      phase: input.phase,
      question: input.question,
      why: input.why ?? null,
      impact: input.impact ?? null,
      answer: input.answer ?? null,
      is_resolution: input.is_resolution ?? false,
    })
    .returning()
    .get();
  return result as Turn;
}

export interface UpdateTurnInput {
  question?: string;
  answer?: string;
  why?: string | null;
  impact?: Impact | null;
}

export function updateTurn(db: DB, turnId: number, updates: UpdateTurnInput): void {
  if (
    updates.question === undefined &&
    updates.answer === undefined &&
    updates.why === undefined &&
    updates.impact === undefined
  )
    return;
  const values: Record<string, unknown> = {};
  if (updates.question !== undefined) values.question = updates.question;
  if (updates.answer !== undefined) values.answer = updates.answer;
  if (updates.why !== undefined) values.why = updates.why;
  if (updates.impact !== undefined) values.impact = updates.impact;
  db.update(schema.turn).set(values).where(eq(schema.turn.id, turnId)).run();
}

export function createOption(db: DB, turnId: number, input: CreateOptionInput): Option {
  const result = db
    .insert(schema.option)
    .values({
      turn_id: turnId,
      position: input.position,
      content: input.content,
      is_recommended: input.is_recommended ?? false,
      is_selected: input.is_selected ?? false,
    })
    .returning()
    .get();
  return result as Option;
}

export function getActivePath(db: DB, projectId: number): Turn[] {
  const project = db
    .select({ active_turn_id: schema.project.active_turn_id })
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

export function getOptionsForTurn(db: DB, turnId: number): Option[] {
  return db
    .select()
    .from(schema.option)
    .where(eq(schema.option.turn_id, turnId))
    .orderBy(schema.option.position)
    .all() as Option[];
}

export function selectOption(db: DB, turnId: number, position: number): void {
  // Clear any previous selection for this turn
  db.update(schema.option).set({ is_selected: false }).where(eq(schema.option.turn_id, turnId)).run();
  // Select the chosen option
  db.update(schema.option)
    .set({ is_selected: true })
    .where(sql`${schema.option.turn_id} = ${turnId} AND ${schema.option.position} = ${position}`)
    .run();
}

export function advanceHead(db: DB, projectId: number, turnId: number): void {
  db.update(schema.project)
    .set({ active_turn_id: turnId, updated_at: sql`datetime('now')` })
    .where(eq(schema.project.id, projectId))
    .run();
}
