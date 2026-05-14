import { sql } from 'drizzle-orm';
import { integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

// --- Core tables ---

export const specification = sqliteTable('specification', {
  id: integer().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  mode: text('mode', { enum: ['greenfield', 'brownfield'] })
    .notNull()
    .default('greenfield'),
  active_turn_id: integer(),
  primary_chat_id: integer().references((): any => chat.id),
  created_at: text()
    .notNull()
    .default(sql`(datetime('now'))`),
  updated_at: text()
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const chat = sqliteTable('chat', {
  id: integer().primaryKey({ autoIncrement: true }),
  specification_id: integer()
    .notNull()
    .references(() => specification.id),
  created_at: text()
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const thread = sqliteTable(
  'thread',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    chat_id: integer()
      .notNull()
      .references(() => chat.id),
    kind: text({ enum: ['interview', 'side', 'reconciliation', 'qa', 'agent_run'] }).notNull(),
    target_item_id: integer().references(() => knowledgeItem.id),
    context_spec: text(),
    kickoff_turn_id: integer().references((): any => turn.id),
    invoked_in_turn_id: integer().references((): any => turn.id),
    active_turn_id: integer().references((): any => turn.id),
    status: text({ enum: ['open', 'closed'] })
      .notNull()
      .default('open'),
    created_at: text()
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    uniqueIndex('thread_interview_unique')
      .on(table.chat_id)
      .where(sql`kind = 'interview'`),
  ],
);

export const turn = sqliteTable('turn', {
  id: integer().primaryKey({ autoIncrement: true }),
  specification_id: integer()
    .notNull()
    .references(() => specification.id),
  thread_id: integer()
    .notNull()
    .references(() => thread.id),
  parent_turn_id: integer().references((): any => turn.id),
  phase: text({ enum: ['grounding', 'design', 'requirements', 'criteria'] }).notNull(),
  turn_kind: text({ enum: ['question', 'kickoff', 'recovery'] })
    .notNull()
    .default('question'),
  question: text().notNull().default(''),
  why: text(),
  impact: text({ enum: ['high', 'medium', 'low'] }),
  answer: text(),
  is_resolution: integer({ mode: 'boolean' }).notNull().default(false),
  user_parts: text(),
  assistant_parts: text(),
  created_at: text()
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const option = sqliteTable(
  'option',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    turn_id: integer()
      .notNull()
      .references(() => turn.id),
    position: integer().notNull(),
    content: text().notNull(),
    is_recommended: integer({ mode: 'boolean' }).notNull().default(false),
    is_selected: integer({ mode: 'boolean' }).notNull().default(false),
  },
  (table) => [uniqueIndex('option_turn_position_unique').on(table.turn_id, table.position)],
);

export const phaseOutcome = sqliteTable('phase_outcome', {
  id: integer().primaryKey({ autoIncrement: true }),
  specification_id: integer()
    .notNull()
    .references(() => specification.id),
  phase: text({ enum: ['grounding', 'design', 'requirements', 'criteria'] }).notNull(),
  proposal_turn_id: integer()
    .notNull()
    .references(() => turn.id),
  status: text({ enum: ['proposed', 'confirmed', 'superseded'] })
    .notNull()
    .default('proposed'),
  summary: text().notNull(),
  closure_basis: text({ enum: ['interviewer_recommended', 'user_forced'] }),
  confirmation_turn_id: integer().references(() => turn.id),
  confirmed_at: text(),
  superseded_at: text(),
  created_at: text()
    .notNull()
    .default(sql`(datetime('now'))`),
});

// --- Knowledge extraction tables ---

export const knowledgeItem = sqliteTable('knowledge_item', {
  id: integer().primaryKey({ autoIncrement: true }),
  specification_id: integer()
    .notNull()
    .references(() => specification.id),
  kind: text({
    enum: ['goal', 'term', 'context', 'constraint', 'decision', 'assumption', 'requirement', 'criterion'],
  }).notNull(),
  subtype: text(),
  content: text().notNull(),
  rationale: text(),
  kind_ordinal: integer().notNull(),
});

// --- Join tables (provenance + dependency DAGs) ---

export const turnKnowledgeItem = sqliteTable(
  'turn_knowledge_item',
  {
    turn_id: integer()
      .notNull()
      .references(() => turn.id),
    item_id: integer()
      .notNull()
      .references(() => knowledgeItem.id),
    relation: text({ enum: ['captured', 'confirmed', 'edited', 'invalidated', 'reviewed', 'rejected'] })
      .notNull()
      .default('captured'),
  },
  (table) => [primaryKey({ columns: [table.turn_id, table.item_id, table.relation] })],
);

export const knowledgeEdge = sqliteTable(
  'knowledge_edge',
  {
    from_item_id: integer()
      .notNull()
      .references(() => knowledgeItem.id),
    to_item_id: integer()
      .notNull()
      .references(() => knowledgeItem.id),
    relation: text({ enum: ['depends_on', 'derived_from', 'constrains', 'verifies', 'refines'] }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.from_item_id, table.to_item_id, table.relation] })],
);

// --- Side-chat annotation (durable per-item notes; D133) ---

export const annotation = sqliteTable('annotation', {
  id: integer().primaryKey({ autoIncrement: true }),
  specification_id: integer()
    .notNull()
    .references(() => specification.id),
  knowledge_item_id: integer()
    .notNull()
    .references(() => knowledgeItem.id, { onDelete: 'cascade' }),
  summary: text().notNull(),
  body: text().notNull(),
  selection_start: integer(),
  selection_end: integer(),
  created_at: text()
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const reconciliationNeed = sqliteTable(
  'reconciliation_need',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    specification_id: integer()
      .notNull()
      .references(() => specification.id),
    source_item_id: integer()
      .notNull()
      .references(() => knowledgeItem.id, { onDelete: 'cascade' }),
    target_item_id: integer()
      .notNull()
      .references(() => knowledgeItem.id, { onDelete: 'cascade' }),
    kind: text({ enum: ['supersedes', 'needs_confirmation'] }).notNull(),
    status: text({ enum: ['open', 'resolved'] })
      .notNull()
      .default('open'),
    reason: text(),
    caused_by_turn_id: integer().references(() => turn.id),
    caused_by_patch_id: integer(),
    created_at: text()
      .notNull()
      .default(sql`(datetime('now'))`),
    resolved_at: text(),
    // V3.1 setup (card 1 in memory/CARDS.md): nullable source-content
    // snapshots captured when the cascade producer opens the need. Frozen
    // for the need's lifetime so downstream surfaces (Pending review diff,
    // V3.1 agent classification pre-image) don't re-derive the source delta
    // from mutable knowledge_item history. Advisory render data only —
    // never load-bearing for any invariant; nulls are valid for legacy rows
    // and tests that bypass the producer.
    source_previous_content: text(),
    source_current_content: text(),
    // V3.1 slice 4 (memory/CARDS.md): reconciliation-classifier lifecycle.
    // null      → never classified (default for new and legacy rows)
    // queued    → run-agent route picked the row up but hasn't called the LLM
    // classifying → the LLM call is in flight
    // classified  → the LLM returned a parseable label; agent_classification is non-null
    // failed     → the LLM threw OR returned an unparseable label; agent_proposal carries the error
    // Per I114 the lifecycle is recoverable: a per-row Re-run (slice 5) re-sets
    // agent_status to null so the run-agent route picks it up again. agent_proposal
    // is text-only and is NEVER auto-applied — the user always clicks Apply / Skip
    // (slice 6); that recoverability is what lets the inner-loop tests stay shallow.
    agent_status: text({ enum: ['queued', 'classifying', 'classified', 'failed'] }),
    agent_classification: text({ enum: ['auto-confirm', 'auto-edit', 'substantive'] }),
    agent_proposal: text(),
  },
  (table) => [
    // Omits specification_id because knowledge_item.id is globally unique across specs.
    uniqueIndex('reconciliation_need_open_unique')
      .on(table.source_item_id, table.target_item_id, table.kind)
      .where(sql`status = 'open'`),
  ],
);
