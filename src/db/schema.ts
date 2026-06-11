/**
 * Drizzle table definitions — canonical column-level source of truth.
 *
 * SPEC decisions: D16-L, D51-L, D54-L, D56-L, D73-L
 * Canonical reference: docs/design/GRAPH_MODEL.md
 *
 * Domain enum taxonomy lives in graph/schema/kinds.ts; this persistence layer
 * imports those literals for column constraints.
 */

import { sql } from 'drizzle-orm';
import {
  type AnySQLiteColumn,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

import {
  EDGE_CATEGORIES,
  EDGE_STANCES,
  GAP_DISPOSITIONS,
  GAP_PREDICATE_KINDS,
  LENS_AFFINITIES,
  NODE_BASES,
  NODE_PLANES,
  READINESS_BANDS,
} from '../graph/schema/kinds.js';

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export const specs = sqliteTable('specs', {
  id: integer().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  slug: text().notNull(),
});

export const nodes = sqliteTable(
  'nodes',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    spec_id: integer()
      .notNull()
      .references(() => specs.id),
    plane: text({ enum: NODE_PLANES }).notNull(),
    kind: text().notNull(), // validated at domain layer against plane-specific enum
    kind_ordinal: integer().notNull(),
    title: text().notNull(),
    body: text(),
    basis: text({ enum: NODE_BASES }).notNull().default('explicit'),
    source: text(),
    detail: text(), // JSON column: decision → {chosen_option, rejected, rationale}, term → {definition, aliases?}
    created_at_lsn: integer().notNull(),
    updated_at_lsn: integer().notNull(),
  },
  (table) => [
    uniqueIndex('nodes_spec_plane_kind_ordinal_unique').on(
      table.spec_id,
      table.plane,
      table.kind,
      table.kind_ordinal,
    ),
  ],
);

export const edges = sqliteTable('edges', {
  id: integer().primaryKey({ autoIncrement: true }),
  spec_id: integer()
    .notNull()
    .references(() => specs.id),
  category: text({ enum: EDGE_CATEGORIES }).notNull(),
  source_id: integer()
    .notNull()
    .references(() => nodes.id),
  target_id: integer()
    .notNull()
    .references(() => nodes.id),
  stance: text({ enum: EDGE_STANCES }),
  basis: text({ enum: NODE_BASES }).notNull().default('explicit'),
  rationale: text(),
  created_at_lsn: integer().notNull(),
  updated_at_lsn: integer().notNull(),
});

export const graphClock = sqliteTable('graph_clock', {
  spec_id: integer()
    .primaryKey()
    .references(() => specs.id),
  lsn: integer().notNull().default(0),
});

export const nodeKindCounters = sqliteTable(
  'node_kind_counters',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    spec_id: integer()
      .notNull()
      .references(() => specs.id),
    plane: text({ enum: NODE_PLANES }).notNull(),
    kind: text().notNull(),
    next_ordinal: integer().notNull().default(1),
  },
  (table) => [
    uniqueIndex('node_kind_counters_spec_plane_kind_unique').on(table.spec_id, table.plane, table.kind),
  ],
);

export const changeLog = sqliteTable(
  'change_log',
  {
    spec_id: integer()
      .notNull()
      .references(() => specs.id),
    lsn: integer().notNull(),
    operation: text().notNull(),
    payload: text().notNull(), // JSON summary of the mutation
    created_at: text()
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [primaryKey({ columns: [table.spec_id, table.lsn], name: 'change_log_spec_lsn_pk' })],
);

export const reconciliationNeed = sqliteTable('reconciliation_need', {
  id: integer().primaryKey({ autoIncrement: true }),
  spec_id: integer()
    .notNull()
    .references(() => specs.id),
  // target is {kind:'edge', edgeId} or {kind:'node_pair', aId, bId}
  target_kind: text({ enum: ['edge', 'node_pair'] }).notNull(),
  target_edge_id: integer().references(() => edges.id),
  target_a_id: integer().references(() => nodes.id),
  target_b_id: integer().references(() => nodes.id),
  kind: text().notNull(), // substantive taxonomy deferred per A8-L
  status: text({ enum: ['open', 'resolved'] })
    .notNull()
    .default('open'),
  reason: text(),
  created_at_lsn: integer().notNull(),
  resolved_at_lsn: integer(),
});

export const elicitationGaps = sqliteTable('elicitation_gaps', {
  id: integer().primaryKey({ autoIncrement: true }),
  spec_id: integer()
    .notNull()
    .references(() => specs.id),
  refers_to: text().notNull(),
  question: text().notNull(),
  rationale: text().notNull(),
  disposition: text({ enum: GAP_DISPOSITIONS }).notNull().default('open'),
  basis: text({ enum: NODE_BASES }).notNull().default('explicit'),
  readiness_band: text({ enum: READINESS_BANDS }).notNull(),
  predicate_kind: text({ enum: GAP_PREDICATE_KINDS }).notNull(),
  predicate: text().notNull(),
  importance: integer().notNull().default(1),
  plane_affinity: text({ enum: NODE_PLANES }),
  lens_affinity: text({ enum: LENS_AFFINITIES }),
  arose_from_gap_id: integer().references((): AnySQLiteColumn => elicitationGaps.id),
  resolved_by_node_id: integer().references(() => nodes.id),
  created_at_lsn: integer().notNull(),
  disposition_set_at_lsn: integer(),
});
