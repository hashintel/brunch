/**
 * Drizzle table definitions — canonical column-level source of truth.
 *
 * SPEC decisions: D16-L, D51-L, D54-L, D56-L
 * Canonical reference: docs/design/GRAPH_MODEL.md
 *
 * Enum const arrays are exported for reuse by graph/ domain types
 * and by Pi tool parameter schemas (via typebox v1.x).
 */

import { sql } from "drizzle-orm"
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

// ---------------------------------------------------------------------------
// Shared enum arrays — the single source for text enum columns,
// graph/ domain types, and Pi tool parameter schemas.
// ---------------------------------------------------------------------------

export const INTENT_KINDS = [
  "goal",
  "thesis",
  "term",
  "context",
  "requirement",
  "assumption",
  "constraint",
  "invariant",
  "decision",
  "criterion",
  "example",
] as const

export const ORACLE_KINDS = [
  "check",
  "validation_method",
  "evidence",
  "obligation",
] as const

export const DESIGN_KINDS = ["module", "interface"] as const

export const PLAN_KINDS = ["milestone", "frontier", "slice"] as const

export const NODE_BASES = ["explicit", "accepted_review_set"] as const

export const EDGE_CATEGORIES = [
  "dependency",
  "proof",
  "support",
  "realization",
  "boundary",
  "composition",
  "association",
  "supersession",
] as const

export const EDGE_STANCES = ["for", "against"] as const

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export const nodes = sqliteTable("nodes", {
  id: integer().primaryKey({ autoIncrement: true }),
  plane: text({ enum: ["intent", "oracle", "design", "plan"] }).notNull(),
  kind: text().notNull(), // validated at domain layer against plane-specific enum
  title: text().notNull(),
  body: text(),
  basis: text({ enum: NODE_BASES }).notNull().default("explicit"),
  source: text(),
  detail: text(), // JSON column: decision → {chosen_option, rejected, rationale}, term → {definition, aliases?}
  created_at_lsn: integer().notNull(),
  updated_at_lsn: integer().notNull(),
})

export const edges = sqliteTable("edges", {
  id: integer().primaryKey({ autoIncrement: true }),
  category: text({ enum: EDGE_CATEGORIES }).notNull(),
  source_id: integer()
    .notNull()
    .references(() => nodes.id),
  target_id: integer()
    .notNull()
    .references(() => nodes.id),
  stance: text({ enum: EDGE_STANCES }),
  basis: text({ enum: NODE_BASES }).notNull().default("explicit"),
  rationale: text(),
  created_at_lsn: integer().notNull(),
})

export const graphClock = sqliteTable("graph_clock", {
  id: integer().primaryKey(), // always row 1
  lsn: integer().notNull().default(0),
})

export const changeLog = sqliteTable("change_log", {
  lsn: integer().primaryKey(),
  operation: text().notNull(),
  payload: text().notNull(), // JSON summary of the mutation
  created_at: text().notNull().default(sql`(datetime('now'))`),
})

export const reconciliationNeed = sqliteTable("reconciliation_need", {
  id: integer().primaryKey({ autoIncrement: true }),
  // target is {kind:'edge', edgeId} or {kind:'node_pair', aId, bId}
  target_kind: text({ enum: ["edge", "node_pair"] }).notNull(),
  target_edge_id: integer().references(() => edges.id),
  target_a_id: integer().references(() => nodes.id),
  target_b_id: integer().references(() => nodes.id),
  kind: text().notNull(), // substantive taxonomy deferred per A8-L
  status: text({ enum: ["open", "resolved"] })
    .notNull()
    .default("open"),
  reason: text(),
  created_at_lsn: integer().notNull(),
  resolved_at_lsn: integer(),
})
