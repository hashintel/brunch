import { and, eq, sql, type InferSelectModel } from 'drizzle-orm';

import type {
  AssumptionEntity as SharedAssumption,
  DecisionEntity as SharedDecision,
} from '@/shared/api-types.js';
import type { KnowledgeKind as SharedKnowledgeKind } from '@/shared/knowledge.js';

import type { DB } from '../db.js';
import * as schema from '../schema.js';

type PersistedKnowledgeItem = InferSelectModel<typeof schema.knowledgeItem>;
export type KnowledgeItem = Omit<PersistedKnowledgeItem, 'specification_id'> & {
  specification_id: number;
};
export type KnowledgeKind = Extract<KnowledgeItem['kind'], SharedKnowledgeKind>;

export type Decision = SharedDecision & { specification_id: number };
export type Assumption = SharedAssumption & { specification_id: number };

type ProjectedKnowledgeEntity<K extends 'decision' | 'assumption'> = K extends 'decision'
  ? Decision & { kind_ordinal: number }
  : Assumption & { kind_ordinal: number };

function projectKnowledgeItemEntity<K extends 'decision' | 'assumption'>(
  item: KnowledgeItem,
  kind: K,
): ProjectedKnowledgeEntity<K> {
  const base = {
    id: item.id,
    specification_id: item.specification_id,
    content: item.content,
    kind_ordinal: item.kind_ordinal,
  };

  if (kind === 'decision') {
    return {
      ...base,
      rationale: item.rationale,
    } as unknown as ProjectedKnowledgeEntity<K>;
  }

  return base as unknown as ProjectedKnowledgeEntity<K>;
}

export function createDecision(
  db: DB,
  specificationId: number,
  content: string,
  rationale?: string | null,
): Decision {
  return projectKnowledgeItemEntity(
    db
      .insert(schema.knowledgeItem)
      .values({
        specification_id: specificationId,
        kind: 'decision',
        subtype: null,
        content,
        rationale: rationale ?? null,
        kind_ordinal: sql`(SELECT COALESCE(MAX(kind_ordinal), 0) + 1 FROM knowledge_item WHERE specification_id = ${specificationId} AND kind = 'decision')`,
      })
      .returning()
      .get() as KnowledgeItem,
    'decision',
  );
}

export function createAssumption(db: DB, specificationId: number, content: string): Assumption {
  return projectKnowledgeItemEntity(
    db
      .insert(schema.knowledgeItem)
      .values({
        specification_id: specificationId,
        kind: 'assumption',
        subtype: null,
        content,
        rationale: null,
        kind_ordinal: sql`(SELECT COALESCE(MAX(kind_ordinal), 0) + 1 FROM knowledge_item WHERE specification_id = ${specificationId} AND kind = 'assumption')`,
      })
      .returning()
      .get() as KnowledgeItem,
    'assumption',
  );
}

export function linkDecisionToTurn(db: DB, decisionId: number, turnId: number): void {
  linkKnowledgeItemToTurn(db, decisionId, turnId);
}

export function linkAssumptionToTurn(db: DB, assumptionId: number, turnId: number): void {
  linkKnowledgeItemToTurn(db, assumptionId, turnId);
}

export function createKnowledgeItem(
  db: DB,
  specificationId: number,
  kind: KnowledgeKind,
  content: string,
  options?: { subtype?: string | null; rationale?: string | null },
): KnowledgeItem {
  return db
    .insert(schema.knowledgeItem)
    .values({
      specification_id: specificationId,
      kind,
      subtype: options?.subtype ?? null,
      content,
      rationale: options?.rationale ?? null,
      kind_ordinal: sql`(SELECT COALESCE(MAX(kind_ordinal), 0) + 1 FROM knowledge_item WHERE specification_id = ${specificationId} AND kind = ${kind})`,
    })
    .returning()
    .get() as KnowledgeItem;
}

export function getKnowledgeItem(db: DB, itemId: number): KnowledgeItem | undefined {
  return db.select().from(schema.knowledgeItem).where(eq(schema.knowledgeItem.id, itemId)).get() as
    | KnowledgeItem
    | undefined;
}

export function linkKnowledgeItemToTurn(
  db: DB,
  itemId: number,
  turnId: number,
  relation: InferSelectModel<typeof schema.turnKnowledgeItem>['relation'] = 'captured',
): void {
  db.insert(schema.turnKnowledgeItem)
    .values({ turn_id: turnId, item_id: itemId, relation })
    .onConflictDoNothing()
    .run();
}

export function addKnowledgeRelationship(
  db: DB,
  fromItemId: number,
  toItemId: number,
  relation: InferSelectModel<typeof schema.knowledgeEdge>['relation'],
): boolean {
  const inserted = db
    .insert(schema.knowledgeEdge)
    .values({ from_item_id: fromItemId, to_item_id: toItemId, relation })
    .onConflictDoNothing()
    .returning({ fromItemId: schema.knowledgeEdge.from_item_id })
    .get();
  return inserted !== undefined;
}

export function addDecisionParentDecision(db: DB, decisionId: number, parentDecisionId: number): void {
  addKnowledgeRelationship(db, decisionId, parentDecisionId, 'depends_on');
}

export function addDecisionParentAssumption(db: DB, decisionId: number, parentAssumptionId: number): void {
  addKnowledgeRelationship(db, decisionId, parentAssumptionId, 'depends_on');
}

export function addAssumptionParentAssumption(
  db: DB,
  assumptionId: number,
  parentAssumptionId: number,
): void {
  addKnowledgeRelationship(db, assumptionId, parentAssumptionId, 'depends_on');
}

export function updateKnowledgeItemContent(
  db: DB,
  itemId: number,
  updates: { content?: string; rationale?: string | null },
): void {
  const values: Record<string, unknown> = {};
  if (updates.content !== undefined) values.content = updates.content;
  if (updates.rationale !== undefined) values.rationale = updates.rationale;
  if (Object.keys(values).length === 0) return;
  db.update(schema.knowledgeItem).set(values).where(eq(schema.knowledgeItem.id, itemId)).run();
}

export function removeKnowledgeRelationship(
  db: DB,
  fromItemId: number,
  toItemId: number,
  relation: InferSelectModel<typeof schema.knowledgeEdge>['relation'],
): boolean {
  const deleted = db
    .delete(schema.knowledgeEdge)
    .where(
      and(
        eq(schema.knowledgeEdge.from_item_id, fromItemId),
        eq(schema.knowledgeEdge.to_item_id, toItemId),
        eq(schema.knowledgeEdge.relation, relation),
      ),
    )
    .returning({ fromItemId: schema.knowledgeEdge.from_item_id })
    .get();
  return deleted !== undefined;
}
