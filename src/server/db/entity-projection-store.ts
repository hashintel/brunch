import { and, desc, eq, inArray, sql, type InferSelectModel } from 'drizzle-orm';

import type {
  CriterionEntity as SharedCriterionEntity,
  EntitiesData,
  EntityReference as SharedEntityReference,
  EntityRelationship as SharedEntityRelationship,
  SpecificationStateTurn,
  RequirementEntity as SharedRequirementEntity,
} from '@/shared/api-types.js';
import {
  createKnowledgeReferenceCode,
  genericKnowledgeKindRegistry,
  knowledgeEntityCollectionByKind,
  knowledgeKindRegistry,
  type GenericKnowledgeCollectionKey,
  type GenericKnowledgeKind,
  type KnowledgeEntityCollection,
  type KnowledgeKind as SharedKnowledgeKind,
} from '@/shared/knowledge.js';

import type { DB } from '../db.js';
import * as schema from '../schema.js';
import type { Assumption, Decision, KnowledgeItem } from './intent-graph-store.js';

type Turn = InferSelectModel<typeof schema.turn>;
type PhaseOutcome = InferSelectModel<typeof schema.phaseOutcome>;
type Phase = Turn['phase'];

function getActivePath(db: DB, specificationId: number): Turn[] {
  const project = db
    .select({ active_turn_id: schema.specification.active_turn_id })
    .from(schema.specification)
    .where(eq(schema.specification.id, specificationId))
    .get();
  if (!project?.active_turn_id) return [];

  const rows = db.all(sql`
    WITH RECURSIVE path AS (
      SELECT * FROM turn WHERE id = ${project.active_turn_id}
      UNION ALL
      SELECT t.* FROM turn t JOIN path p ON t.id = p.parent_turn_id
    )
    SELECT * FROM path ORDER BY id ASC
  `);
  return rows as Turn[];
}

function listPhaseOutcomesForSpecification(db: DB, specificationId: number): PhaseOutcome[] {
  return db
    .select()
    .from(schema.phaseOutcome)
    .where(eq(schema.phaseOutcome.specification_id, specificationId))
    .orderBy(desc(schema.phaseOutcome.id))
    .all() as PhaseOutcome[];
}

function findConfirmedPhaseOutcomeOnActivePath(
  db: DB,
  specificationId: number,
  phase: Phase,
): PhaseOutcome | undefined {
  const activeTurnIds = new Set(getActivePath(db, specificationId).map((turn) => turn.id));
  if (activeTurnIds.size === 0) {
    return undefined;
  }

  return listPhaseOutcomesForSpecification(db, specificationId).find(
    (outcome) =>
      outcome.phase === phase &&
      outcome.status === 'confirmed' &&
      activeTurnIds.has(outcome.proposal_turn_id),
  );
}

export function getAcceptedKnowledgeItemIdsForPhase(
  db: DB,
  specificationId: number,
  phase: 'requirements' | 'criteria',
  kind: 'requirement' | 'criterion',
): Set<number> {
  const confirmationTurnId = findConfirmedPhaseOutcomeOnActivePath(
    db,
    specificationId,
    phase,
  )?.confirmation_turn_id;
  if (!confirmationTurnId) {
    return new Set();
  }

  const rows = db
    .select({ itemId: schema.turnKnowledgeItem.item_id })
    .from(schema.turnKnowledgeItem)
    .innerJoin(schema.knowledgeItem, eq(schema.knowledgeItem.id, schema.turnKnowledgeItem.item_id))
    .where(
      and(
        eq(schema.knowledgeItem.specification_id, specificationId),
        eq(schema.knowledgeItem.kind, kind),
        eq(schema.turnKnowledgeItem.turn_id, confirmationTurnId),
        eq(schema.turnKnowledgeItem.relation, 'reviewed'),
      ),
    )
    .all() as Array<{ itemId: number }>;

  return new Set(rows.map((row) => row.itemId));
}

export function countAcceptedKnowledgeItemsForPhase(
  db: DB,
  specificationId: number,
  phase: 'requirements' | 'criteria',
  kind: 'requirement' | 'criterion',
): number {
  return getAcceptedKnowledgeItemIdsForPhase(db, specificationId, phase, kind).size;
}

export type EntityCollection = KnowledgeEntityCollection;
export type EntityReference = SharedEntityReference;
export type EntityRelationship = SharedEntityRelationship;
export type RequirementEntity = SharedRequirementEntity & { kind_ordinal: number };
export type CriterionEntity = SharedCriterionEntity & { kind_ordinal: number };
type GenericKnowledgeEntity<K extends GenericKnowledgeKind> = K extends 'requirement'
  ? RequirementEntity
  : K extends 'criterion'
    ? CriterionEntity
    : KnowledgeItem & { kind: K };
export type EntitiesForSpecification = EntitiesData;

function projectKnowledgeItemEntity<K extends 'decision' | 'assumption'>(
  item: KnowledgeItem,
  kind: K,
): K extends 'decision' ? Decision & { kind_ordinal: number } : Assumption & { kind_ordinal: number } {
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
    } as K extends 'decision' ? Decision & { kind_ordinal: number } : Assumption & { kind_ordinal: number };
  }

  return base as K extends 'decision'
    ? Decision & { kind_ordinal: number }
    : Assumption & { kind_ordinal: number };
}

function getKnowledgeItemsForSpecificationByKind(
  db: DB,
  specificationId: number,
  kind: GenericKnowledgeKind | 'decision' | 'assumption',
): KnowledgeItem[] {
  return db
    .select()
    .from(schema.knowledgeItem)
    .where(
      and(eq(schema.knowledgeItem.specification_id, specificationId), eq(schema.knowledgeItem.kind, kind)),
    )
    .all() as KnowledgeItem[];
}

function withReferenceCodes<T extends { id: number; kind: SharedKnowledgeKind; kind_ordinal: number }>(
  items: readonly T[],
): Array<T & { referenceCode: string }> {
  return items
    .slice()
    .sort((left, right) => left.id - right.id)
    .map((item) => ({
      ...item,
      referenceCode: createKnowledgeReferenceCode(item.kind, item.kind_ordinal),
    }));
}

function getGenericKnowledgeEntitiesForSpecificationByKind<K extends GenericKnowledgeKind>(
  db: DB,
  specificationId: number,
  kind: K,
): Array<GenericKnowledgeEntity<K>> {
  return getKnowledgeItemsForSpecificationByKind(db, specificationId, kind).map((item) => ({
    ...item,
    specification_id: item.specification_id,
    kind,
  })) as unknown as Array<GenericKnowledgeEntity<K>>;
}

export function getAcceptedRequirementEntitiesForSpecification(
  db: DB,
  specificationId: number,
): RequirementEntity[] {
  const acceptedIds = getAcceptedKnowledgeItemIdsForPhase(db, specificationId, 'requirements', 'requirement');
  if (acceptedIds.size === 0) {
    return [];
  }

  return getGenericKnowledgeEntitiesForSpecificationByKind(db, specificationId, 'requirement').filter(
    (item) => acceptedIds.has(item.id),
  );
}

export function getAcceptedCriterionEntitiesForSpecification(
  db: DB,
  specificationId: number,
): CriterionEntity[] {
  const acceptedIds = getAcceptedKnowledgeItemIdsForPhase(db, specificationId, 'criteria', 'criterion');
  if (acceptedIds.size === 0) {
    return [];
  }

  return getGenericKnowledgeEntitiesForSpecificationByKind(db, specificationId, 'criterion').filter((item) =>
    acceptedIds.has(item.id),
  );
}

export function getGroundingBundleForSpecification(db: DB, specificationId: number) {
  return {
    goals: getKnowledgeItemsForSpecificationByKind(db, specificationId, 'goal'),
    terms: getKnowledgeItemsForSpecificationByKind(db, specificationId, 'term'),
    contexts: getKnowledgeItemsForSpecificationByKind(db, specificationId, 'context'),
    constraints: getKnowledgeItemsForSpecificationByKind(db, specificationId, 'constraint'),
  };
}

function getKnowledgeItemIdsLinkedToActivePath(db: DB, specificationId: number): Set<number> {
  const activeTurnIds = getActivePath(db, specificationId).map((turn) => turn.id);
  if (activeTurnIds.length === 0) {
    return new Set();
  }

  const rows = db
    .select({ itemId: schema.turnKnowledgeItem.item_id })
    .from(schema.turnKnowledgeItem)
    .innerJoin(schema.knowledgeItem, eq(schema.knowledgeItem.id, schema.turnKnowledgeItem.item_id))
    .where(
      and(
        eq(schema.knowledgeItem.specification_id, specificationId),
        inArray(schema.turnKnowledgeItem.turn_id, activeTurnIds),
      ),
    )
    .all() as Array<{ itemId: number }>;

  return new Set(rows.map((row) => row.itemId));
}

export type EntityProjectionMode = 'project-wide' | 'active-path';

function getSpecificationWideEntitiesForSpecification(
  db: DB,
  specificationId: number,
): EntitiesForSpecification {
  const genericKnowledgeCollections = Object.fromEntries(
    genericKnowledgeKindRegistry.map((entry) => [
      entry.collectionKey,
      withReferenceCodes(
        getGenericKnowledgeEntitiesForSpecificationByKind(db, specificationId, entry.kind),
      ).map(({ kind_ordinal: _, ...item }) => item),
    ]),
  ) as Pick<EntitiesForSpecification, GenericKnowledgeCollectionKey>;
  const decisions = withReferenceCodes(
    getKnowledgeItemsForSpecificationByKind(db, specificationId, 'decision')
      .map((item) => projectKnowledgeItemEntity(item, 'decision'))
      .map((decision) => ({
        ...decision,
        kind: 'decision' as const,
      })),
  ).map(({ kind: _, kind_ordinal: __, ...decision }) => decision);
  const assumptions = withReferenceCodes(
    getKnowledgeItemsForSpecificationByKind(db, specificationId, 'assumption')
      .map((item) => projectKnowledgeItemEntity(item, 'assumption'))
      .map((assumption) => ({
        ...assumption,
        kind: 'assumption' as const,
      })),
  ).map(({ kind: _, kind_ordinal: __, ...assumption }) => assumption);
  const relationships = db.all(sql`
    SELECT
      edge.relation AS type,
      source.kind AS source_kind,
      source.id AS source_id,
      target.kind AS target_kind,
      target.id AS target_id
    FROM knowledge_edge edge
    JOIN knowledge_item source ON source.id = edge.from_item_id
    JOIN knowledge_item target ON target.id = edge.to_item_id
    WHERE
      source.specification_id = ${specificationId}
      AND target.specification_id = ${specificationId}
    ORDER BY
      CASE source.kind WHEN 'decision' THEN 0 WHEN 'assumption' THEN 1 ELSE 2 END,
      source.id,
      CASE target.kind WHEN 'decision' THEN 0 WHEN 'assumption' THEN 1 ELSE 2 END,
      target.id
  `) as Array<{
    type: EntityRelationship['type'];
    source_kind: EntityReference['kind'];
    source_id: number;
    target_kind: EntityReference['kind'];
    target_id: number;
  }>;

  return {
    ...genericKnowledgeCollections,
    decisions,
    assumptions,
    relationships: relationships.map((relationship) => ({
      type: relationship.type,
      source: {
        collection: knowledgeEntityCollectionByKind[relationship.source_kind],
        kind: relationship.source_kind,
        id: relationship.source_id,
      },
      target: {
        collection: knowledgeEntityCollectionByKind[relationship.target_kind],
        kind: relationship.target_kind,
        id: relationship.target_id,
      },
    })),
  };
}

function filterGenericKnowledgeCollectionsToActivePath(
  entities: EntitiesForSpecification,
  activeItemIds: ReadonlySet<number>,
  options?: {
    acceptedRequirementIds?: ReadonlySet<number>;
    acceptedCriterionIds?: ReadonlySet<number>;
  },
): Pick<EntitiesForSpecification, GenericKnowledgeCollectionKey> {
  return Object.fromEntries(
    genericKnowledgeKindRegistry.map((entry) => {
      const acceptedIds =
        entry.kind === 'requirement'
          ? options?.acceptedRequirementIds
          : entry.kind === 'criterion'
            ? options?.acceptedCriterionIds
            : undefined;
      const visibleItems =
        acceptedIds && acceptedIds.size > 0
          ? entities[entry.collectionKey].filter((item) => acceptedIds.has(item.id))
          : entities[entry.collectionKey].filter((item) => activeItemIds.has(item.id));
      return [entry.collectionKey, visibleItems];
    }),
  ) as Pick<EntitiesForSpecification, GenericKnowledgeCollectionKey>;
}

function filterEntitiesToActivePath(
  entities: EntitiesForSpecification,
  activeItemIds: ReadonlySet<number>,
  options?: {
    acceptedRequirementIds?: ReadonlySet<number>;
    acceptedCriterionIds?: ReadonlySet<number>;
  },
): EntitiesForSpecification {
  const genericKnowledgeCollections = filterGenericKnowledgeCollectionsToActivePath(
    entities,
    activeItemIds,
    options,
  );
  const decisions = entities.decisions.filter((item) => activeItemIds.has(item.id));
  const assumptions = entities.assumptions.filter((item) => activeItemIds.has(item.id));

  const visibleIdsByCollection = {
    knowledge_item: new Set([
      ...genericKnowledgeKindRegistry.flatMap((entry) =>
        genericKnowledgeCollections[entry.collectionKey].map((item) => item.id),
      ),
      ...decisions.map((item) => item.id),
      ...assumptions.map((item) => item.id),
    ]),
  } satisfies Record<EntityRelationship['source']['collection'], Set<number>>;

  return {
    ...genericKnowledgeCollections,
    decisions,
    assumptions,
    relationships: entities.relationships.filter(
      (relationship) =>
        visibleIdsByCollection[relationship.source.collection].has(relationship.source.id) &&
        visibleIdsByCollection[relationship.target.collection].has(relationship.target.id),
    ),
  };
}

export function getEntitiesForSpecificationByMode(
  db: DB,
  specificationId: number,
  mode: EntityProjectionMode,
): EntitiesForSpecification {
  const projectWideEntities = getSpecificationWideEntitiesForSpecification(db, specificationId);
  if (mode === 'project-wide') {
    return projectWideEntities;
  }

  return filterEntitiesToActivePath(
    projectWideEntities,
    getKnowledgeItemIdsLinkedToActivePath(db, specificationId),
    {
      acceptedRequirementIds: getAcceptedKnowledgeItemIdsForPhase(
        db,
        specificationId,
        'requirements',
        'requirement',
      ),
      acceptedCriterionIds: getAcceptedKnowledgeItemIdsForPhase(db, specificationId, 'criteria', 'criterion'),
    },
  );
}

export function getEntitiesForSpecification(db: DB, specificationId: number): EntitiesForSpecification {
  return getEntitiesForSpecificationByMode(db, specificationId, 'project-wide');
}

export function getEntitiesForSpecificationOnActivePath(
  db: DB,
  specificationId: number,
): EntitiesForSpecification {
  return getEntitiesForSpecificationByMode(db, specificationId, 'active-path');
}

export function getCapturedItemsForTurns(
  db: DB,
  specificationId: number,
  turnIds: readonly number[],
): Map<number, NonNullable<SpecificationStateTurn['captured_items']>> {
  const capturedItemsByTurn = new Map<number, NonNullable<SpecificationStateTurn['captured_items']>>();
  if (turnIds.length === 0) {
    return capturedItemsByTurn;
  }

  const projectWideEntities = getEntitiesForSpecification(db, specificationId);
  const itemsById = new Map<number, NonNullable<SpecificationStateTurn['captured_items']>[number]>();

  for (const entry of knowledgeKindRegistry) {
    const items = projectWideEntities[entry.collectionKey] as ReadonlyArray<{
      id: number;
      content: string;
      referenceCode?: string;
      kind?: SharedKnowledgeKind;
    }>;
    for (const item of items) {
      itemsById.set(item.id, {
        collection: entry.entityCollection,
        kind: item.kind ?? entry.kind,
        id: item.id,
        content: item.content,
        referenceCode: item.referenceCode,
      });
    }
  }

  const rows = db
    .select({
      turnId: schema.turnKnowledgeItem.turn_id,
      itemId: schema.turnKnowledgeItem.item_id,
    })
    .from(schema.turnKnowledgeItem)
    .innerJoin(schema.knowledgeItem, eq(schema.knowledgeItem.id, schema.turnKnowledgeItem.item_id))
    .where(
      and(
        eq(schema.knowledgeItem.specification_id, specificationId),
        eq(schema.turnKnowledgeItem.relation, 'captured'),
        inArray(schema.turnKnowledgeItem.turn_id, [...turnIds]),
      ),
    )
    .all() as Array<{ turnId: number; itemId: number }>;

  rows.sort((left, right) => left.turnId - right.turnId || left.itemId - right.itemId);

  for (const row of rows) {
    const item = itemsById.get(row.itemId);
    if (!item) {
      continue;
    }

    const currentTurnItems = capturedItemsByTurn.get(row.turnId) ?? [];
    currentTurnItems.push(item);
    capturedItemsByTurn.set(row.turnId, currentTurnItems);
  }

  return capturedItemsByTurn;
}
