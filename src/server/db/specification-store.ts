import { and, desc, eq, inArray, sql, type InferSelectModel } from 'drizzle-orm';

import type { SpecificationMode, TurnKind } from '@/shared/api-types.js';

import type { DB } from '../db.js';
import * as schema from '../schema.js';
import { reconcilePhaseOutcomesForSpecification } from './workflow-store.js';

export type Specification = InferSelectModel<typeof schema.specification>;
type PersistedTurn = InferSelectModel<typeof schema.turn>;
export type Turn = Omit<PersistedTurn, 'specification_id'> & {
  specification_id: number;
};
export type Option = InferSelectModel<typeof schema.option>;
export type Phase = Turn['phase'];
export type Impact = NonNullable<Turn['impact']>;

export interface CreateTurnInput {
  parent_turn_id?: number | null;
  phase: Phase;
  turn_kind?: TurnKind;
  question: string;
  why?: string | null;
  impact?: Impact | null;
  answer?: string | null;
  is_resolution?: boolean;
  user_parts?: string | null;
  assistant_parts?: string | null;
}

export interface CreateOptionInput {
  position: number;
  content: string;
  is_recommended?: boolean;
  is_selected?: boolean;
}

export function getOrCreateSpecification(db: DB, name = 'default'): Specification {
  const existing = db
    .select()
    .from(schema.specification)
    .orderBy(desc(schema.specification.created_at))
    .limit(1)
    .get();
  if (existing) return existing as Specification;
  return insertSpecificationWithInterviewChat(db, { name });
}

export function listSpecifications(db: DB): Specification[] {
  return db
    .select()
    .from(schema.specification)
    .orderBy(desc(schema.specification.updated_at))
    .all() as Specification[];
}

export interface CreateSpecificationOptions {
  mode?: SpecificationMode;
}

export function createSpecification(
  db: DB,
  name: string,
  options?: CreateSpecificationOptions,
): Specification {
  return insertSpecificationWithInterviewChat(db, {
    name,
    ...(options?.mode ? { mode: options.mode } : {}),
  });
}

function insertSpecificationWithInterviewChat(
  db: DB,
  values: { name: string; mode?: SpecificationMode },
): Specification {
  return db.transaction((tx) => {
    const inserted = tx.insert(schema.specification).values(values).returning().get() as Specification;
    const chatRow = tx
      .insert(schema.chat)
      .values({ specification_id: inserted.id })
      .returning({ id: schema.chat.id })
      .get();
    tx.insert(schema.thread).values({ chat_id: chatRow.id, kind: 'interview' }).run();
    const updated = tx
      .update(schema.specification)
      .set({ primary_chat_id: chatRow.id })
      .where(eq(schema.specification.id, inserted.id))
      .returning()
      .get();
    return updated as Specification;
  });
}

function getInterviewChatIdForSpecification(db: DB, specificationId: number): number {
  const spec = db
    .select({ primary_chat_id: schema.specification.primary_chat_id })
    .from(schema.specification)
    .where(eq(schema.specification.id, specificationId))
    .get();
  if (!spec?.primary_chat_id) {
    throw new Error(`Specification ${specificationId} has no primary_chat_id; substrate invariant violated`);
  }
  return spec.primary_chat_id;
}

function getInterviewThreadIdForSpecification(db: DB, specificationId: number): number {
  const chatId = getInterviewChatIdForSpecification(db, specificationId);
  const threadRow = db
    .select({ id: schema.thread.id })
    .from(schema.thread)
    .where(and(eq(schema.thread.chat_id, chatId), eq(schema.thread.kind, 'interview')))
    .get();
  if (!threadRow) {
    throw new Error(`Specification ${specificationId} has no interview thread; substrate invariant violated`);
  }
  return threadRow.id;
}

export function getSpecification(db: DB, id: number): Specification | undefined {
  return db.select().from(schema.specification).where(eq(schema.specification.id, id)).get() as
    | Specification
    | undefined;
}

export function getTurn(db: DB, turnId: number): Turn | undefined {
  return db.select().from(schema.turn).where(eq(schema.turn.id, turnId)).get() as Turn | undefined;
}

export function createTurn(db: DB, specificationId: number, input: CreateTurnInput): Turn {
  const threadId = getInterviewThreadIdForSpecification(db, specificationId);

  if (input.parent_turn_id != null) {
    const parent = db
      .select({ thread_id: schema.turn.thread_id })
      .from(schema.turn)
      .where(eq(schema.turn.id, input.parent_turn_id))
      .get();
    if (!parent) {
      throw new Error(`Parent turn ${input.parent_turn_id} not found`);
    }
    if (parent.thread_id !== threadId) {
      throw new Error(
        `Parent turn ${input.parent_turn_id} lives in thread ${parent.thread_id}, ` +
          `not thread ${threadId} — parent_turn_id must share thread with the new turn`,
      );
    }
  }

  const result = db
    .insert(schema.turn)
    .values({
      specification_id: specificationId,
      thread_id: threadId,
      parent_turn_id: input.parent_turn_id ?? null,
      phase: input.phase,
      turn_kind: input.turn_kind ?? 'question',
      question: input.question,
      why: input.why ?? null,
      impact: input.impact ?? null,
      answer: input.answer ?? null,
      is_resolution: input.is_resolution ?? false,
      user_parts: input.user_parts ?? null,
      assistant_parts: input.assistant_parts ?? null,
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
  user_parts?: string | null;
  assistant_parts?: string | null;
}

export function updateTurn(db: DB, turnId: number, updates: UpdateTurnInput): void {
  if (
    updates.question === undefined &&
    updates.answer === undefined &&
    updates.why === undefined &&
    updates.impact === undefined &&
    updates.user_parts === undefined &&
    updates.assistant_parts === undefined
  )
    return;
  const values: Record<string, unknown> = {};
  if (updates.question !== undefined) values.question = updates.question;
  if (updates.answer !== undefined) values.answer = updates.answer;
  if (updates.why !== undefined) values.why = updates.why;
  if (updates.impact !== undefined) values.impact = updates.impact;
  if (updates.user_parts !== undefined) values.user_parts = updates.user_parts;
  if (updates.assistant_parts !== undefined) values.assistant_parts = updates.assistant_parts;
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

export function getActivePath(db: DB, specificationId: number): Turn[] {
  const project = db
    .select({ active_turn_id: schema.specification.active_turn_id })
    .from(schema.specification)
    .where(eq(schema.specification.id, specificationId))
    .get();
  if (!project?.active_turn_id) return [];

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

export function applyTurnResponseSelections(db: DB, turnId: number, selectedPositions: number[]): void {
  const uniquePositions = [...new Set(selectedPositions)];

  db.update(schema.option).set({ is_selected: false }).where(eq(schema.option.turn_id, turnId)).run();

  if (uniquePositions.length === 0) {
    return;
  }

  db.update(schema.option)
    .set({ is_selected: true })
    .where(and(eq(schema.option.turn_id, turnId), inArray(schema.option.position, uniquePositions)))
    .run();
}

export function advanceHead(db: DB, specificationId: number, turnId: number): void {
  const threadId = getInterviewThreadIdForSpecification(db, specificationId);
  db.transaction((tx) => {
    tx.update(schema.specification)
      .set({ active_turn_id: turnId, updated_at: sql`datetime('now')` })
      .where(eq(schema.specification.id, specificationId))
      .run();
    const updatedThread = tx
      .update(schema.thread)
      .set({ active_turn_id: turnId })
      .where(eq(schema.thread.id, threadId))
      .returning({ id: schema.thread.id })
      .get();
    if (!updatedThread) {
      throw new Error(
        `Interview thread ${threadId} for spec ${specificationId} not found; head update aborted`,
      );
    }
  });
  reconcilePhaseOutcomesForSpecification(db, specificationId);
}

export function updateSpecificationMode(db: DB, specificationId: number, mode: SpecificationMode): void {
  db.update(schema.specification)
    .set({ mode, updated_at: sql`datetime('now')` })
    .where(eq(schema.specification.id, specificationId))
    .run();
}
