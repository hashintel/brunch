import { sql } from 'drizzle-orm';
import { sqliteTable, integer, text, primaryKey, uniqueIndex } from 'drizzle-orm/sqlite-core';

// --- Core tables ---

export const project = sqliteTable('project', {
  id: integer().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
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
  question: text().notNull().default(''),
  why: text(),
  impact: text({ enum: ['high', 'medium', 'low'] }),
  answer: text(),
  is_resolution: integer({ mode: 'boolean' }).notNull().default(false),
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

// --- Knowledge extraction tables ---

export const decision = sqliteTable('decision', {
  id: integer().primaryKey({ autoIncrement: true }),
  project_id: integer()
    .notNull()
    .references(() => project.id),
  content: text().notNull(),
  rationale: text(),
});

export const assumption = sqliteTable('assumption', {
  id: integer().primaryKey({ autoIncrement: true }),
  project_id: integer()
    .notNull()
    .references(() => project.id),
  content: text().notNull(),
});

export const requirement = sqliteTable('requirement', {
  id: integer().primaryKey({ autoIncrement: true }),
  project_id: integer()
    .notNull()
    .references(() => project.id),
  content: text().notNull(),
  reviewed_at: text(),
});

export const criterion = sqliteTable('criterion', {
  id: integer().primaryKey({ autoIncrement: true }),
  project_id: integer()
    .notNull()
    .references(() => project.id),
  requirement_id: integer()
    .notNull()
    .references(() => requirement.id),
  content: text().notNull(),
  reviewed_at: text(),
});

// --- Join tables (provenance + dependency DAGs) ---

export const turnDecision = sqliteTable(
  'turn_decision',
  {
    turn_id: integer()
      .notNull()
      .references(() => turn.id),
    decision_id: integer()
      .notNull()
      .references(() => decision.id),
  },
  (table) => [primaryKey({ columns: [table.turn_id, table.decision_id] })],
);

export const turnAssumption = sqliteTable(
  'turn_assumption',
  {
    turn_id: integer()
      .notNull()
      .references(() => turn.id),
    assumption_id: integer()
      .notNull()
      .references(() => assumption.id),
  },
  (table) => [primaryKey({ columns: [table.turn_id, table.assumption_id] })],
);

export const decisionParentDecision = sqliteTable(
  'decision_parent_decision',
  {
    decision_id: integer()
      .notNull()
      .references(() => decision.id),
    parent_decision_id: integer()
      .notNull()
      .references(() => decision.id),
  },
  (table) => [primaryKey({ columns: [table.decision_id, table.parent_decision_id] })],
);

export const decisionParentAssumption = sqliteTable(
  'decision_parent_assumption',
  {
    decision_id: integer()
      .notNull()
      .references(() => decision.id),
    parent_assumption_id: integer()
      .notNull()
      .references(() => assumption.id),
  },
  (table) => [primaryKey({ columns: [table.decision_id, table.parent_assumption_id] })],
);

export const assumptionParentAssumption = sqliteTable(
  'assumption_parent_assumption',
  {
    assumption_id: integer()
      .notNull()
      .references(() => assumption.id),
    parent_assumption_id: integer()
      .notNull()
      .references(() => assumption.id),
  },
  (table) => [primaryKey({ columns: [table.assumption_id, table.parent_assumption_id] })],
);

export const requirementDecision = sqliteTable(
  'requirement_decision',
  {
    requirement_id: integer()
      .notNull()
      .references(() => requirement.id),
    decision_id: integer()
      .notNull()
      .references(() => decision.id),
  },
  (table) => [primaryKey({ columns: [table.requirement_id, table.decision_id] })],
);
