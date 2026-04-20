import { sql } from 'drizzle-orm';
import { sqliteTable, integer, text, primaryKey, uniqueIndex } from 'drizzle-orm/sqlite-core';

// --- Core tables ---

export const project = sqliteTable('project', {
  id: integer().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  mode: text('mode', { enum: ['greenfield', 'brownfield'] })
    .notNull()
    .default('greenfield'),
  active_turn_id: integer(),
  created_at: text()
    .notNull()
    .default(sql`(datetime('now'))`),
  updated_at: text()
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const turn = sqliteTable('turn', {
  id: integer().primaryKey({ autoIncrement: true }),
  project_id: integer()
    .notNull()
    .references(() => project.id),
  parent_turn_id: integer().references((): any => turn.id),
  phase: text({ enum: ['scope', 'design', 'requirements', 'criteria'] }).notNull(),
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
  project_id: integer()
    .notNull()
    .references(() => project.id),
  phase: text({ enum: ['scope', 'design', 'requirements', 'criteria'] }).notNull(),
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
  project_id: integer()
    .notNull()
    .references(() => project.id),
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
