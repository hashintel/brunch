import { and, asc, desc, eq, inArray, isNotNull, isNull, sql, type InferSelectModel } from 'drizzle-orm';

import type { SpecificationMode, TurnKind } from '@/shared/api-types.js';
import { createKnowledgeReferenceCode, type KnowledgeKind } from '@/shared/knowledge.js';
import type { ReconciliationNeedKind } from '@/shared/reconciliation-need.js';

import type { DB } from '../db.js';
import * as schema from '../schema.js';
import { reconcilePhaseOutcomesForSpecification } from './workflow-store.js';

export type Specification = InferSelectModel<typeof schema.specification>;
type PersistedTurn = InferSelectModel<typeof schema.turn>;
export type Turn = Omit<PersistedTurn, 'specification_id'> & {
  specification_id: number;
};
export type Chat = InferSelectModel<typeof schema.chat>;
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
      .values({ specification_id: inserted.id, kind: 'interview' })
      .returning({ id: schema.chat.id })
      .get();
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

export function getSpecification(db: DB, id: number): Specification | undefined {
  return db.select().from(schema.specification).where(eq(schema.specification.id, id)).get() as
    | Specification
    | undefined;
}

export function getTurn(db: DB, turnId: number): Turn | undefined {
  return db.select().from(schema.turn).where(eq(schema.turn.id, turnId)).get() as Turn | undefined;
}

export function createTurn(db: DB, specificationId: number, input: CreateTurnInput): Turn {
  const chatId = getInterviewChatIdForSpecification(db, specificationId);

  if (input.parent_turn_id != null) {
    const parent = db
      .select({ chat_id: schema.turn.chat_id })
      .from(schema.turn)
      .where(eq(schema.turn.id, input.parent_turn_id))
      .get();
    if (!parent) {
      throw new Error(`Parent turn ${input.parent_turn_id} not found`);
    }
    if (parent.chat_id !== chatId) {
      throw new Error(
        `Parent turn ${input.parent_turn_id} lives in chat ${parent.chat_id}, ` +
          `not chat ${chatId} — parent_turn_id must share chat_id with the new turn`,
      );
    }
  }

  const result = db
    .insert(schema.turn)
    .values({
      specification_id: specificationId,
      chat_id: chatId,
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

export type SecondaryChatMode = 'explore' | 'edit';

export interface CreateSecondaryChatInput {
  parent_chat_id: number;
  invoked_in_turn_id?: number | null;
  pinned_item_id?: number | null;
  pinned_span_hint?: string | null;
  pinned_reconciliation_need_id?: number | null;
  mode?: SecondaryChatMode;
}

export function createSecondaryChat(db: DB, specificationId: number, input: CreateSecondaryChatInput): Chat {
  return db
    .insert(schema.chat)
    .values({
      specification_id: specificationId,
      kind: 'side_chat',
      parent_chat_id: input.parent_chat_id,
      invoked_in_turn_id: input.invoked_in_turn_id ?? null,
      pinned_item_id: input.pinned_item_id ?? null,
      pinned_span_hint: input.pinned_span_hint ?? null,
      pinned_reconciliation_need_id: input.pinned_reconciliation_need_id ?? null,
      mode: input.mode ?? 'explore',
    })
    .returning()
    .get() as Chat;
}

/** Refuses to delete primary chats; only `parent_chat_id IS NOT NULL` rows are removable. */
export function deleteSecondaryChat(db: DB, specificationId: number, chatId: number): boolean {
  const chat = db
    .select({
      id: schema.chat.id,
      specification_id: schema.chat.specification_id,
      parent_chat_id: schema.chat.parent_chat_id,
    })
    .from(schema.chat)
    .where(eq(schema.chat.id, chatId))
    .get();
  if (!chat || chat.specification_id !== specificationId || chat.parent_chat_id === null) {
    return false;
  }
  // Drop turns first to satisfy the FK.
  db.delete(schema.turn).where(eq(schema.turn.chat_id, chatId)).run();
  db.delete(schema.chat).where(eq(schema.chat.id, chatId)).run();
  return true;
}

export function setSecondaryChatMode(db: DB, chatId: number, mode: SecondaryChatMode): Chat {
  const updated = db
    .update(schema.chat)
    .set({ mode })
    .where(and(eq(schema.chat.id, chatId), isNotNull(schema.chat.parent_chat_id)))
    .returning()
    .get() as Chat | undefined;
  if (!updated) {
    throw new Error(`Secondary chat ${chatId} not found`);
  }
  return updated;
}

export interface GetOrCreateItemSecondaryChatInput {
  parent_chat_id: number;
  itemId: number;
  itemKind: KnowledgeKind;
  invokedInTurnId?: number | null;
  spanHint?: string | null;
  mode?: SecondaryChatMode;
}

export interface GetOrCreateItemSecondaryChatResult {
  chat: Chat;
  /** Null when an existing chat was reused (dedupe path). */
  kickoffTurnId: number | null;
}

export interface GetOrCreateMasterSecondaryChatInput {
  parent_chat_id: number;
}

export interface GetOrCreateMasterSecondaryChatResult {
  chat: Chat;
  kickoffTurnId: null;
}

export function createEmptySecondaryChat(
  db: DB,
  specificationId: number,
  input: GetOrCreateMasterSecondaryChatInput,
): GetOrCreateMasterSecondaryChatResult {
  const chat = createSecondaryChat(db, specificationId, {
    parent_chat_id: input.parent_chat_id,
  });
  return { chat, kickoffTurnId: null };
}

export function getOrCreateMasterSecondaryChat(
  db: DB,
  specificationId: number,
  input: GetOrCreateMasterSecondaryChatInput,
): GetOrCreateMasterSecondaryChatResult {
  const existing = db
    .select()
    .from(schema.chat)
    .where(
      and(
        eq(schema.chat.specification_id, specificationId),
        eq(schema.chat.parent_chat_id, input.parent_chat_id),
        isNull(schema.chat.pinned_item_id),
        isNull(schema.chat.pinned_reconciliation_need_id),
      ),
    )
    .orderBy(asc(schema.chat.id))
    .limit(1)
    .get() as Chat | undefined;
  if (existing) {
    return { chat: existing, kickoffTurnId: null };
  }
  const chat = createSecondaryChat(db, specificationId, {
    parent_chat_id: input.parent_chat_id,
  });
  return { chat, kickoffTurnId: null };
}

function parseAnchoredItemIds(raw: string | null | undefined): number[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is number => typeof v === 'number' && Number.isInteger(v));
  } catch {
    return [];
  }
}

function findItemSecondaryChat(
  db: DB,
  specificationId: number,
  parentChatId: number,
  itemId: number,
): Chat | null {
  const row = db
    .select()
    .from(schema.chat)
    .where(
      and(
        eq(schema.chat.specification_id, specificationId),
        eq(schema.chat.parent_chat_id, parentChatId),
        eq(schema.chat.pinned_item_id, itemId),
        isNull(schema.chat.pinned_reconciliation_need_id),
      ),
    )
    .orderBy(asc(schema.chat.id))
    .limit(1)
    .get();
  return (row as Chat | undefined) ?? null;
}

/**
 * Friendly kickoff greeting rendered as the first assistant turn of every
 * item-anchored secondary chat. Intentionally minimal — the prior wording
 * ("Anchored to '<long snippet>'.") read as scaffolding; this version says
 * hi, names the anchor by its reference code (e.g. `#G1`), and invites the
 * user to take the next turn.
 */
function buildAnchoredKickoffContent(refCode: string, mode: SecondaryChatMode): string {
  if (mode === 'edit') {
    return `Hi! What would you like to change about **#${refCode}**?`;
  }
  return `Hi! How can I help with **#${refCode}**?`;
}

/**
 * Find-or-create the per-item secondary chat for a (parent, item) pair.
 * Dedupes by `(parent_chat_id, pinned_item_id)` with `pinned_reconciliation_need_id IS NULL`
 * so clicking the same item twice re-opens the existing chat rather than
 * creating a duplicate. Reconciliation chats use a separate path.
 *
 * Returns `kickoffTurnId = null` when reusing an existing chat (no new
 * kickoff turn is appended).
 */
export function getOrCreateItemSecondaryChat(
  db: DB,
  specificationId: number,
  input: GetOrCreateItemSecondaryChatInput,
): GetOrCreateItemSecondaryChatResult {
  const existing = findItemSecondaryChat(db, specificationId, input.parent_chat_id, input.itemId);
  if (existing) {
    // Refresh `invoked_in_turn_id` (and `pinned_span_hint`) when re-triggered
    // so the persisted anchor tracks the *latest* invocation context.
    // Without this, jump-to-anchor + scroll targets would stay pinned to the
    // first turn the chat was opened from, even after the user re-triggers
    // from a much later turn.
    const nextInvokedInTurnId = input.invokedInTurnId ?? null;
    const nextSpanHint = input.spanHint ?? null;
    const anchorChanged =
      nextInvokedInTurnId !== existing.invoked_in_turn_id || nextSpanHint !== existing.pinned_span_hint;
    if (!anchorChanged) {
      return { chat: existing, kickoffTurnId: null };
    }
    const refreshed = db
      .update(schema.chat)
      .set({ invoked_in_turn_id: nextInvokedInTurnId, pinned_span_hint: nextSpanHint })
      .where(eq(schema.chat.id, existing.id))
      .returning()
      .get() as Chat;
    return { chat: refreshed, kickoffTurnId: null };
  }

  const item = db
    .select({
      content: schema.knowledgeItem.content,
      kind: schema.knowledgeItem.kind,
      kind_ordinal: schema.knowledgeItem.kind_ordinal,
    })
    .from(schema.knowledgeItem)
    .where(eq(schema.knowledgeItem.id, input.itemId))
    .get();
  if (!item) {
    throw new Error(`Knowledge item ${input.itemId} not found`);
  }

  const chat = createSecondaryChat(db, specificationId, {
    parent_chat_id: input.parent_chat_id,
    invoked_in_turn_id: input.invokedInTurnId ?? null,
    pinned_item_id: input.itemId,
    pinned_span_hint: input.spanHint ?? null,
    ...(input.mode ? { mode: input.mode } : {}),
  });

  const persistedChat = db
    .update(schema.chat)
    .set({ anchored_item_ids: JSON.stringify([input.itemId]) })
    .where(eq(schema.chat.id, chat.id))
    .returning()
    .get() as Chat;

  const refCode = createKnowledgeReferenceCode(item.kind, item.kind_ordinal);
  const content = buildAnchoredKickoffContent(refCode, input.mode ?? 'explore');
  const kickoff = createKickoffTurn(db, chat.id, { phase: 'grounding', content });

  return { chat: persistedChat, kickoffTurnId: kickoff.id };
}

export interface CreateKickoffTurnInput {
  phase: Phase;
  content: string;
}

export interface SecondaryChatPinnedReconciliationNeed {
  needId: number;
  kind: ReconciliationNeedKind;
  sourceItemId: number;
  sourceRefCode: string | null;
  sourceExcerpt: string | null;
  targetItemId: number;
  targetRefCode: string | null;
  targetExcerpt: string | null;
}

export interface SecondaryChatWithKickoff {
  chat: Chat;
  kickoffTurn: Turn | null;
  /**
   * Post-kickoff turns ordered by id ascending. Each turn carries either
   * `user_parts` (role='user') or `assistant_parts` (role='assistant'),
   * never both.
   */
  turns: Turn[];
  pinnedItemKind: KnowledgeKind | null;
  pinnedReconciliationNeed: SecondaryChatPinnedReconciliationNeed | null;
  anchoredItemIds: number[];
}

export function listSecondaryChatsForSpecification(
  db: DB,
  specificationId: number,
): SecondaryChatWithKickoff[] {
  const chats = db
    .select()
    .from(schema.chat)
    .where(and(eq(schema.chat.specification_id, specificationId), isNotNull(schema.chat.parent_chat_id)))
    .orderBy(asc(schema.chat.id))
    .all() as Chat[];

  return chats.map((chat) => {
    const kickoffTurn = (db
      .select()
      .from(schema.turn)
      .where(and(eq(schema.turn.chat_id, chat.id), eq(schema.turn.turn_kind, 'kickoff')))
      .orderBy(asc(schema.turn.id))
      .limit(1)
      .get() ?? null) as Turn | null;
    const turns = db
      .select()
      .from(schema.turn)
      .where(and(eq(schema.turn.chat_id, chat.id), eq(schema.turn.turn_kind, 'question')))
      .orderBy(asc(schema.turn.id))
      .all() as Turn[];
    const pinnedItemRow =
      chat.pinned_item_id === null
        ? null
        : db
            .select({ kind: schema.knowledgeItem.kind })
            .from(schema.knowledgeItem)
            .where(eq(schema.knowledgeItem.id, chat.pinned_item_id))
            .get();
    const pinnedReconciliationNeed = resolvePinnedReconciliationNeed(db, chat.pinned_reconciliation_need_id);
    return {
      chat,
      kickoffTurn,
      turns,
      pinnedItemKind: (pinnedItemRow?.kind ?? null) as KnowledgeKind | null,
      pinnedReconciliationNeed,
      anchoredItemIds: parseAnchoredItemIds(chat.anchored_item_ids),
    };
  });
}

const RECONCILIATION_EXCERPT_LIMIT = 80;

function truncateExcerpt(text: string | null): string | null {
  if (text === null) return null;
  if (text.length <= RECONCILIATION_EXCERPT_LIMIT) return text;
  return `${text.slice(0, RECONCILIATION_EXCERPT_LIMIT - 1).trimEnd()}…`;
}

function resolvePinnedReconciliationNeed(
  db: DB,
  needId: number | null,
): SecondaryChatPinnedReconciliationNeed | null {
  if (needId === null) return null;
  const need = db
    .select({
      id: schema.reconciliationNeed.id,
      kind: schema.reconciliationNeed.kind,
      source_item_id: schema.reconciliationNeed.source_item_id,
      target_item_id: schema.reconciliationNeed.target_item_id,
      source_current_content: schema.reconciliationNeed.source_current_content,
    })
    .from(schema.reconciliationNeed)
    .where(eq(schema.reconciliationNeed.id, needId))
    .get();
  if (!need) return null;

  const itemRows = db
    .select({
      id: schema.knowledgeItem.id,
      kind: schema.knowledgeItem.kind,
      kind_ordinal: schema.knowledgeItem.kind_ordinal,
      content: schema.knowledgeItem.content,
    })
    .from(schema.knowledgeItem)
    .where(inArray(schema.knowledgeItem.id, [need.source_item_id, need.target_item_id]))
    .all();
  const sourceItem = itemRows.find((row) => row.id === need.source_item_id) ?? null;
  const targetItem = itemRows.find((row) => row.id === need.target_item_id) ?? null;

  const sourceContent = need.source_current_content ?? sourceItem?.content ?? null;
  return {
    needId: need.id,
    kind: need.kind,
    sourceItemId: need.source_item_id,
    sourceRefCode: sourceItem
      ? createKnowledgeReferenceCode(sourceItem.kind as KnowledgeKind, sourceItem.kind_ordinal)
      : null,
    sourceExcerpt: truncateExcerpt(sourceContent),
    targetItemId: need.target_item_id,
    targetRefCode: targetItem
      ? createKnowledgeReferenceCode(targetItem.kind as KnowledgeKind, targetItem.kind_ordinal)
      : null,
    targetExcerpt: truncateExcerpt(targetItem?.content ?? null),
  };
}

export function createKickoffTurn(db: DB, chatId: number, input: CreateKickoffTurnInput): Turn {
  const chat = db
    .select({ specification_id: schema.chat.specification_id })
    .from(schema.chat)
    .where(eq(schema.chat.id, chatId))
    .get();
  if (!chat) {
    throw new Error(`Chat ${chatId} not found`);
  }

  return db
    .insert(schema.turn)
    .values({
      specification_id: chat.specification_id,
      chat_id: chatId,
      parent_turn_id: null,
      phase: input.phase,
      turn_kind: 'kickoff',
      question: '',
      assistant_parts: input.content,
    })
    .returning()
    .get() as Turn;
}

export type SecondaryChatTurnRole = 'user' | 'assistant';

export interface AppendSecondaryChatTurnInput {
  role: SecondaryChatTurnRole;
  content: string;
}

/**
 * Appends a single user or assistant turn under a secondary chat. Throws when
 * `chatId` resolves to a primary (interview) chat — secondary-chat round-trips
 * must live under a chat with `parent_chat_id IS NOT NULL`.
 */
export function appendSecondaryChatTurn(db: DB, chatId: number, input: AppendSecondaryChatTurnInput): Turn {
  const chat = db
    .select({
      specification_id: schema.chat.specification_id,
      parent_chat_id: schema.chat.parent_chat_id,
    })
    .from(schema.chat)
    .where(eq(schema.chat.id, chatId))
    .get();
  if (!chat) {
    throw new Error(`Chat ${chatId} not found`);
  }
  if (chat.parent_chat_id === null) {
    throw new Error(`Chat ${chatId} is not a secondary chat (parent_chat_id is null)`);
  }

  return db
    .insert(schema.turn)
    .values({
      specification_id: chat.specification_id,
      chat_id: chatId,
      parent_turn_id: null,
      phase: 'grounding',
      turn_kind: 'question',
      question: '',
      user_parts: input.role === 'user' ? input.content : null,
      assistant_parts: input.role === 'assistant' ? input.content : null,
    })
    .returning()
    .get() as Turn;
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
  const chatId = getInterviewChatIdForSpecification(db, specificationId);
  db.transaction((tx) => {
    tx.update(schema.specification)
      .set({ active_turn_id: turnId, updated_at: sql`datetime('now')` })
      .where(eq(schema.specification.id, specificationId))
      .run();
    const updatedChat = tx
      .update(schema.chat)
      .set({ active_turn_id: turnId })
      .where(eq(schema.chat.id, chatId))
      .returning({ id: schema.chat.id })
      .get();
    if (!updatedChat) {
      throw new Error(`Interview chat ${chatId} for spec ${specificationId} not found; head update aborted`);
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
