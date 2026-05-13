import { and, eq, sql, type InferSelectModel } from 'drizzle-orm';

import type { DB } from '../db.js';
import * as schema from '../schema.js';

export type ReconciliationNeed = InferSelectModel<typeof schema.reconciliationNeed>;
export type ReconciliationNeedKind = ReconciliationNeed['kind'];
// V3.1 slice 4: lifecycle and label vocabulary derive from the schema enums
// (see I114). Re-exported through db.ts so route + agent code can stay typesafe
// without importing the schema module directly.
export type ReconciliationNeedAgentStatus = NonNullable<ReconciliationNeed['agent_status']>;
export type ReconciliationNeedAgentClassification = NonNullable<ReconciliationNeed['agent_classification']>;

type KnowledgeItemOwner = Pick<InferSelectModel<typeof schema.knowledgeItem>, 'specification_id'>;

export interface OpenReconciliationNeedInput {
  specificationId: number;
  sourceItemId: number;
  targetItemId: number;
  kind: ReconciliationNeedKind;
  reason?: string | null;
  causedByTurnId?: number | null;
  // V3.1 setup (card 1): nullable source content snapshots, frozen for the
  // need's lifetime. The cascade producer (edit-route hard path) supplies
  // both; direct callers (tests, future agent paths) may omit them.
  sourcePreviousContent?: string | null;
  sourceCurrentContent?: string | null;
}

function getKnowledgeItemOwner(db: DB, itemId: number): KnowledgeItemOwner | undefined {
  return db
    .select({ specification_id: schema.knowledgeItem.specification_id })
    .from(schema.knowledgeItem)
    .where(eq(schema.knowledgeItem.id, itemId))
    .get() as KnowledgeItemOwner | undefined;
}

export function openReconciliationNeed(db: DB, input: OpenReconciliationNeedInput): ReconciliationNeed {
  const sourceItem = getKnowledgeItemOwner(db, input.sourceItemId);
  const targetItem = getKnowledgeItemOwner(db, input.targetItemId);
  if (
    !sourceItem ||
    !targetItem ||
    sourceItem.specification_id !== input.specificationId ||
    targetItem.specification_id !== input.specificationId
  ) {
    throw new Error('Reconciliation need items must belong to specification');
  }

  return db
    .insert(schema.reconciliationNeed)
    .values({
      specification_id: input.specificationId,
      source_item_id: input.sourceItemId,
      target_item_id: input.targetItemId,
      kind: input.kind,
      reason: input.reason ?? null,
      caused_by_turn_id: input.causedByTurnId ?? null,
      source_previous_content: input.sourcePreviousContent ?? null,
      source_current_content: input.sourceCurrentContent ?? null,
    })
    .returning()
    .get() as ReconciliationNeed;
}

/**
 * Open a reconciliation_need only if no matching open row exists. The
 * (source, target, kind) partial unique index guarantees idempotence; this
 * helper exposes the no-op as `null` so callers can report newly-opened ids
 * separately from already-open ones.
 */
export function openReconciliationNeedIfAbsent(
  db: DB,
  input: OpenReconciliationNeedInput,
): ReconciliationNeed | null {
  const existing = db.all(sql`
    SELECT 1
    FROM reconciliation_need
    WHERE specification_id = ${input.specificationId}
      AND source_item_id = ${input.sourceItemId}
      AND target_item_id = ${input.targetItemId}
      AND kind = ${input.kind}
      AND status = 'open'
    LIMIT 1
  `);
  if (existing.length > 0) return null;
  return openReconciliationNeed(db, input);
}

export function getReconciliationNeed(db: DB, needId: number): ReconciliationNeed | undefined {
  return db.select().from(schema.reconciliationNeed).where(eq(schema.reconciliationNeed.id, needId)).get() as
    | ReconciliationNeed
    | undefined;
}

export function resolveReconciliationNeed(db: DB, reconciliationNeedId: number): void {
  db.update(schema.reconciliationNeed)
    .set({ status: 'resolved', resolved_at: sql`datetime('now')` })
    .where(
      and(
        eq(schema.reconciliationNeed.id, reconciliationNeedId),
        eq(schema.reconciliationNeed.status, 'open'),
      ),
    )
    .run();
}

export function listOpenReconciliationNeeds(db: DB, specificationId: number): ReconciliationNeed[] {
  return db
    .select()
    .from(schema.reconciliationNeed)
    .where(
      and(
        eq(schema.reconciliationNeed.specification_id, specificationId),
        eq(schema.reconciliationNeed.status, 'open'),
      ),
    )
    .orderBy(schema.reconciliationNeed.id)
    .all() as ReconciliationNeed[];
}

/**
 * V3.1 slice 4: open needs that the run-agent route should pick up. Filters
 * out anything already classified or in flight. Per-row Re-run (slice 5)
 * resets agent_status to null so the row reappears in this query.
 */
export function listOpenReconciliationNeedsAwaitingClassification(
  db: DB,
  specificationId: number,
): ReconciliationNeed[] {
  return db
    .select()
    .from(schema.reconciliationNeed)
    .where(
      and(
        eq(schema.reconciliationNeed.specification_id, specificationId),
        eq(schema.reconciliationNeed.status, 'open'),
        sql`${schema.reconciliationNeed.agent_status} IS NULL`,
      ),
    )
    .orderBy(schema.reconciliationNeed.id)
    .all() as ReconciliationNeed[];
}

export function claimReconciliationNeedForClassification(db: DB, needId: number): boolean {
  const result = db
    .update(schema.reconciliationNeed)
    .set({ agent_status: 'queued' })
    .where(
      and(eq(schema.reconciliationNeed.id, needId), sql`${schema.reconciliationNeed.agent_status} IS NULL`),
    )
    .run();
  return result.changes === 1;
}

/**
 * V3.1 slice 4: partial update for the three agent_* columns. Used by the
 * classifier loop to walk a row through the lifecycle (null → queued →
 * classifying → classified | failed). Each call is one transition; callers
 * are responsible for the order and for never re-classifying without first
 * resetting agent_status to null.
 */
export function updateReconciliationNeedAgentFields(
  db: DB,
  needId: number,
  fields: {
    agent_status: ReconciliationNeedAgentStatus | null;
    agent_classification?: ReconciliationNeedAgentClassification | null;
    agent_proposal?: string | null;
  },
): void {
  const setClause: Record<string, string | null> = {
    agent_status: fields.agent_status,
  };
  if (Object.hasOwn(fields, 'agent_classification')) {
    setClause.agent_classification = fields.agent_classification ?? null;
  }
  if (Object.hasOwn(fields, 'agent_proposal')) {
    setClause.agent_proposal = fields.agent_proposal ?? null;
  }
  db.update(schema.reconciliationNeed).set(setClause).where(eq(schema.reconciliationNeed.id, needId)).run();
}

/**
 * V3.1 slice 4: look up the typed dependency edge that caused a need's
 * (source, target) pair. Cascade producer creates needs from edges where the
 * target is the upstream (changed) item and the source of the edge is the
 * downstream item; see cascade-producer.ts and getDownstreamEdges. Returns
 * undefined for orphan needs (target deleted, edge removed) — classifier
 * callers fall back to a relation-agnostic prompt in that case.
 */
export function getCascadeRelationBetween(
  db: DB,
  sourceItemId: number,
  targetItemId: number,
): InferSelectModel<typeof schema.knowledgeEdge>['relation'] | undefined {
  const row = db
    .select({ relation: schema.knowledgeEdge.relation })
    .from(schema.knowledgeEdge)
    .where(
      and(
        eq(schema.knowledgeEdge.from_item_id, targetItemId),
        eq(schema.knowledgeEdge.to_item_id, sourceItemId),
      ),
    )
    .limit(1)
    .get() as { relation: InferSelectModel<typeof schema.knowledgeEdge>['relation'] } | undefined;
  return row?.relation;
}
