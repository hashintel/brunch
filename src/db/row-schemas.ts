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

import { changeLog, edges, graphClock, nodes, reconciliationNeed } from './schema.js';

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

// --- Reconciliation need schemas ---
export const insertReconciliationNeedSchema = createInsertSchema(reconciliationNeed);
export const selectReconciliationNeedSchema = createSelectSchema(reconciliationNeed);
