import { and, eq, inArray, or, type InferSelectModel } from 'drizzle-orm';

import type { EdgeRelation } from '@/shared/api-types.js';
import {
  createKnowledgeCollectionRecord,
  createKnowledgeReferenceCode,
  knowledgeCollectionKeyByKind,
} from '@/shared/knowledge.js';

import type { DB } from './db.js';
import {
  getKnowledgeRelationshipEndpointLabel,
  getKnowledgeRelationshipPolicy,
  type KnowledgeRelationshipEndpoint,
  type KnowledgeRelationshipSnapshotBucket,
} from './knowledge-relationship-policy.js';
import * as schema from './schema.js';

export type IntentNeighborhoodMode =
  | 'immediate'
  | 'dependencies'
  | 'dependents'
  | 'evidence'
  | 'reconciliation';

type KnowledgeItemRow = InferSelectModel<typeof schema.knowledgeItem>;
type KnowledgeEdgeRow = InferSelectModel<typeof schema.knowledgeEdge>;
type ReconciliationNeedRow = InferSelectModel<typeof schema.reconciliationNeed>;

type KnowledgeItemSummary = Pick<
  IntentItemSnapshot,
  'id' | 'kind' | 'referenceCode' | 'content' | 'rationale'
>;

export interface IntentSnapshotRelation {
  relation: EdgeRelation;
  endpoint: KnowledgeRelationshipEndpoint;
  label: string;
  otherItem: KnowledgeItemSummary;
}

export type IntentSnapshotRelationGroups = Record<
  KnowledgeRelationshipSnapshotBucket,
  IntentSnapshotRelation[]
>;

export interface IntentSnapshotReconciliationNeed {
  id: number;
  kind: ReconciliationNeedRow['kind'];
  status: ReconciliationNeedRow['status'];
  reason?: string;
  source: KnowledgeItemSummary;
  target: KnowledgeItemSummary;
}

export interface IntentItemSnapshot {
  id: number;
  kind: KnowledgeItemRow['kind'];
  referenceCode: string;
  content: string;
  rationale: string | null;
  relations: IntentSnapshotRelationGroups;
  reconciliationNeeds: IntentSnapshotReconciliationNeed[];
}

export interface IntentContextSnapshot {
  scope: 'items';
  specificationId: number;
  neighborhood: IntentNeighborhoodMode;
  requestedItemIds: number[];
  items: IntentItemSnapshot[];
}

export interface EconomicIntentGraphSnapshot {
  scope: 'whole-graph';
  specificationId: number;
  itemsByKind: ReturnType<typeof createKnowledgeCollectionRecord<KnowledgeItemSummary[]>>;
  edges: Array<{
    relation: EdgeRelation;
    source: KnowledgeItemSummary;
    target: KnowledgeItemSummary;
    sourceLabel: string;
    targetLabel: string;
  }>;
}

export interface IntentContextSnapshotInput {
  specificationId: number;
  itemIds: number[];
  neighborhood?: IntentNeighborhoodMode;
}

export interface EconomicIntentGraphSnapshotInput {
  specificationId: number;
}

function createEmptyRelationGroups(): IntentSnapshotRelationGroups {
  return {
    dependencies: [],
    dependents: [],
    evidence: [],
    refinements: [],
  };
}

function summarizeItem(item: KnowledgeItemRow): KnowledgeItemSummary {
  return {
    id: item.id,
    kind: item.kind,
    referenceCode: createKnowledgeReferenceCode(item.kind, item.kind_ordinal),
    content: item.content,
    rationale: item.rationale,
  };
}

function listSpecificationItems(db: DB, specificationId: number): KnowledgeItemRow[] {
  return db
    .select()
    .from(schema.knowledgeItem)
    .where(eq(schema.knowledgeItem.specification_id, specificationId))
    .orderBy(schema.knowledgeItem.kind, schema.knowledgeItem.kind_ordinal, schema.knowledgeItem.id)
    .all() as KnowledgeItemRow[];
}

function listIncidentEdges(db: DB, itemIds: number[]): KnowledgeEdgeRow[] {
  if (itemIds.length === 0) return [];
  return db
    .select()
    .from(schema.knowledgeEdge)
    .where(
      or(
        inArray(schema.knowledgeEdge.from_item_id, itemIds),
        inArray(schema.knowledgeEdge.to_item_id, itemIds),
      ),
    )
    .all() as KnowledgeEdgeRow[];
}

function listSpecificationEdges(db: DB, itemIds: number[]): KnowledgeEdgeRow[] {
  if (itemIds.length === 0) return [];
  return db
    .select()
    .from(schema.knowledgeEdge)
    .where(
      and(
        inArray(schema.knowledgeEdge.from_item_id, itemIds),
        inArray(schema.knowledgeEdge.to_item_id, itemIds),
      ),
    )
    .all() as KnowledgeEdgeRow[];
}

function listIncidentReconciliationNeeds(db: DB, itemIds: number[]): ReconciliationNeedRow[] {
  if (itemIds.length === 0) return [];
  return db
    .select()
    .from(schema.reconciliationNeed)
    .where(
      or(
        inArray(schema.reconciliationNeed.source_item_id, itemIds),
        inArray(schema.reconciliationNeed.target_item_id, itemIds),
      ),
    )
    .orderBy(schema.reconciliationNeed.id)
    .all() as ReconciliationNeedRow[];
}

function shouldIncludeBucket(
  neighborhood: IntentNeighborhoodMode,
  bucket: KnowledgeRelationshipSnapshotBucket,
): boolean {
  return neighborhood === 'immediate' || neighborhood === bucket;
}

function compareRelations(left: IntentSnapshotRelation, right: IntentSnapshotRelation): number {
  const endpointOrder = { source: 0, target: 1 } satisfies Record<KnowledgeRelationshipEndpoint, number>;
  return (
    endpointOrder[left.endpoint] - endpointOrder[right.endpoint] ||
    left.otherItem.referenceCode.localeCompare(right.otherItem.referenceCode) ||
    left.relation.localeCompare(right.relation)
  );
}

export function buildIntentContextSnapshot(db: DB, input: IntentContextSnapshotInput): IntentContextSnapshot {
  const neighborhood = input.neighborhood ?? 'immediate';
  const allItems = listSpecificationItems(db, input.specificationId);
  const itemsById = new Map(allItems.map((item) => [item.id, item]));
  const requestedItems = input.itemIds.flatMap((itemId) => {
    const item = itemsById.get(itemId);
    return item ? [item] : [];
  });
  const requestedIds = requestedItems.map((item) => item.id);

  const snapshotsById = new Map<number, IntentItemSnapshot>(
    requestedItems.map((item) => [
      item.id,
      {
        ...summarizeItem(item),
        relations: createEmptyRelationGroups(),
        reconciliationNeeds: [],
      },
    ]),
  );

  for (const edge of listIncidentEdges(db, requestedIds)) {
    const relation = edge.relation as EdgeRelation;
    const policy = getKnowledgeRelationshipPolicy(relation);
    const sourceItem = itemsById.get(edge.from_item_id);
    const targetItem = itemsById.get(edge.to_item_id);
    if (!sourceItem || !targetItem) continue;

    const sourceSnapshot = snapshotsById.get(edge.from_item_id);
    if (sourceSnapshot && shouldIncludeBucket(neighborhood, policy.sourceSnapshotBucket)) {
      sourceSnapshot.relations[policy.sourceSnapshotBucket].push({
        relation,
        endpoint: 'source',
        label: getKnowledgeRelationshipEndpointLabel(relation, 'source'),
        otherItem: summarizeItem(targetItem),
      });
    }

    const targetSnapshot = snapshotsById.get(edge.to_item_id);
    if (targetSnapshot && shouldIncludeBucket(neighborhood, policy.targetSnapshotBucket)) {
      targetSnapshot.relations[policy.targetSnapshotBucket].push({
        relation,
        endpoint: 'target',
        label: getKnowledgeRelationshipEndpointLabel(relation, 'target'),
        otherItem: summarizeItem(sourceItem),
      });
    }
  }

  if (neighborhood === 'reconciliation') {
    for (const need of listIncidentReconciliationNeeds(db, requestedIds)) {
      const source = itemsById.get(need.source_item_id);
      const target = itemsById.get(need.target_item_id);
      if (!source || !target) continue;
      const projectedNeed: IntentSnapshotReconciliationNeed = {
        id: need.id,
        kind: need.kind,
        status: need.status,
        reason: need.reason ?? undefined,
        source: summarizeItem(source),
        target: summarizeItem(target),
      };
      snapshotsById.get(need.source_item_id)?.reconciliationNeeds.push(projectedNeed);
      if (need.target_item_id !== need.source_item_id) {
        snapshotsById.get(need.target_item_id)?.reconciliationNeeds.push(projectedNeed);
      }
    }
  }

  const items = requestedIds.map((itemId) => snapshotsById.get(itemId)).filter((item) => item !== undefined);
  for (const item of items) {
    for (const relations of Object.values(item.relations)) relations.sort(compareRelations);
  }

  return {
    scope: 'items',
    specificationId: input.specificationId,
    neighborhood,
    requestedItemIds: requestedIds,
    items,
  };
}

export function buildEconomicIntentGraphSnapshot(
  db: DB,
  input: EconomicIntentGraphSnapshotInput,
): EconomicIntentGraphSnapshot {
  const items = listSpecificationItems(db, input.specificationId);
  const itemsById = new Map(items.map((item) => [item.id, item]));
  const itemIds = items.map((item) => item.id);
  const itemsByKind = createKnowledgeCollectionRecord<KnowledgeItemSummary[]>(() => []);

  for (const item of items) {
    itemsByKind[knowledgeCollectionKeyByKind[item.kind]].push(summarizeItem(item));
  }

  const edges = listSpecificationEdges(db, itemIds).flatMap((edge) => {
    const source = itemsById.get(edge.from_item_id);
    const target = itemsById.get(edge.to_item_id);
    if (!source || !target) return [];
    const relation = edge.relation as EdgeRelation;
    return [
      {
        relation,
        source: summarizeItem(source),
        target: summarizeItem(target),
        sourceLabel: getKnowledgeRelationshipEndpointLabel(relation, 'source'),
        targetLabel: getKnowledgeRelationshipEndpointLabel(relation, 'target'),
      },
    ];
  });

  return { scope: 'whole-graph', specificationId: input.specificationId, itemsByKind, edges };
}

function formatItemLabel(item: KnowledgeItemSummary): string {
  return `${item.referenceCode} ${item.kind}: ${item.content}`;
}

export function renderIntentContextSnapshot(snapshot: IntentContextSnapshot): string {
  const lines = [`Intent context snapshot (${snapshot.neighborhood})`];

  for (const item of snapshot.items) {
    lines.push('', formatItemLabel(item));
    if (item.rationale) lines.push(`Rationale: ${item.rationale}`);

    const groups: Array<[string, IntentSnapshotRelation[]]> = [
      ['Dependencies', item.relations.dependencies],
      ['Dependents', item.relations.dependents],
      ['Evidence', item.relations.evidence],
      ['Refinements', item.relations.refinements],
    ];

    for (const [heading, relations] of groups) {
      if (relations.length === 0) continue;
      lines.push(`${heading}:`);
      for (const relation of relations) {
        lines.push(`- ${relation.label} ${formatItemLabel(relation.otherItem)}`);
      }
    }

    if (item.reconciliationNeeds.length > 0) {
      lines.push('Reconciliation needs:');
      for (const need of item.reconciliationNeeds) {
        lines.push(
          `- RN#${need.id} ${need.kind} (${need.status}): ${need.source.referenceCode} → ${need.target.referenceCode}`,
        );
        if (need.reason) lines.push(`  Reason: ${need.reason}`);
      }
    }
  }

  return lines.join('\n');
}
