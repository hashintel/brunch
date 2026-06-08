/**
 * Runtime row schemas derived from Drizzle table definitions.
 *
 * SPEC decisions: D16-L, D41-L (settled by A20-L spike)
 * Stack: drizzle-typebox@0.3.3 + @sinclair/typebox@0.34.14
 *
 * Do not hand-author parallel row schemas. These are the single
 * derived source for insert/select validation inside db/ and graph/.
 */

import { createInsertSchema, createSelectSchema } from 'drizzle-typebox';

import {
  changeLog,
  edges,
  elicitationBacklog,
  graphClock,
  nodeKindCounters,
  nodes,
  reconciliationNeed,
  specs,
} from './schema.js';

// --- Spec schemas ---
export const insertSpecSchema = createInsertSchema(specs);
export const selectSpecSchema = createSelectSchema(specs);

// --- Node schemas ---
export const insertNodeSchema = createInsertSchema(nodes);
export const selectNodeSchema = createSelectSchema(nodes);

// --- Edge schemas ---
export const insertEdgeSchema = createInsertSchema(edges);
export const selectEdgeSchema = createSelectSchema(edges);

// --- Change log schemas ---
export const insertChangeLogSchema = createInsertSchema(changeLog);
export const selectChangeLogSchema = createSelectSchema(changeLog);

// --- Graph clock schemas ---
export const insertGraphClockSchema = createInsertSchema(graphClock);

// --- Node kind counter schemas ---
export const insertNodeKindCounterSchema = createInsertSchema(nodeKindCounters);
export const selectNodeKindCounterSchema = createSelectSchema(nodeKindCounters);
// --- Reconciliation need schemas ---
export const insertReconciliationNeedSchema = createInsertSchema(reconciliationNeed);
export const selectReconciliationNeedSchema = createSelectSchema(reconciliationNeed);

// --- Elicitation backlog schemas ---
export const insertElicitationBacklogSchema = createInsertSchema(elicitationBacklog);
export const selectElicitationBacklogSchema = createSelectSchema(elicitationBacklog);
