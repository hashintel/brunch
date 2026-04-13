import { Link, getRouteApi } from '@tanstack/react-router';

import { EmptyCard } from '@/client/components/app-shell';
import {
  KnowledgeGroupCard,
  MetadataRow,
  type KnowledgeEdgeData,
  type KnowledgeItemData,
} from '@/client/components/knowledge-card';
import { ScrollArea } from '@/client/components/ui/scroll-area';
import type { EntitiesData } from '@/shared/api-types.js';
import type { EntityReference, EntityRelationship } from '@/shared/api-types.js';
import {
  knowledgeKindRegistry,
  type KnowledgeEntityCollection,
  type KnowledgeKind,
} from '@/shared/knowledge.js';

type KnowledgeViewEntity = EntitiesData[Exclude<keyof EntitiesData, 'relationships'>][number];

function getOptionalSubtype(item: KnowledgeViewEntity): string | undefined {
  return 'subtype' in item && typeof item.subtype === 'string' ? item.subtype : undefined;
}

function getOptionalRationale(item: KnowledgeViewEntity): string | undefined {
  return 'rationale' in item && typeof item.rationale === 'string' ? item.rationale : undefined;
}

function getOptionalReviewStatus(item: KnowledgeViewEntity): KnowledgeItemData['reviewStatus'] {
  return 'reviewStatus' in item ? item.reviewStatus : undefined;
}

function toKnowledgeItems(
  rawItems: readonly KnowledgeViewEntity[],
  kind: KnowledgeKind,
): KnowledgeItemData[] {
  return rawItems.map((item) => ({
    id: item.id,
    kind,
    content: item.content,
    rationale: getOptionalRationale(item),
    subtype: getOptionalSubtype(item),
    reviewStatus: getOptionalReviewStatus(item),
  }));
}

function buildContentMap(entities: EntitiesData): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of knowledgeKindRegistry) {
    for (const item of entities[entry.collectionKey]) {
      map.set(`${entry.entityCollection}:${item.id}`, item.content);
    }
  }
  return map;
}

function getOutgoingRelationLabel(type: EntityRelationship['type']): string {
  switch (type) {
    case 'depends_on':
      return 'Depends on';
    case 'derived_from':
      return 'Derived from';
    case 'constrains':
      return 'Constrains';
    case 'verifies':
      return 'Verifies';
    case 'refines':
      return 'Refines';
  }
}

function getIncomingRelationLabel(type: EntityRelationship['type']): string {
  switch (type) {
    case 'depends_on':
      return 'Supports';
    case 'derived_from':
      return 'Basis for';
    case 'constrains':
      return 'Constrained by';
    case 'verifies':
      return 'Verified by';
    case 'refines':
      return 'Refined by';
  }
}

function getEntityContent(contentMap: Map<string, string>, reference: EntityReference): string | undefined {
  return contentMap.get(`${reference.collection}:${reference.id}`);
}

function toKnowledgeEdges(
  entities: EntitiesData,
  entityCollection: KnowledgeEntityCollection,
  itemIds: Set<number>,
  contentMap: Map<string, string>,
): KnowledgeEdgeData[] {
  return entities.relationships
    .filter(
      (relationship) =>
        (relationship.source.collection === entityCollection && itemIds.has(relationship.source.id)) ||
        (relationship.target.collection === entityCollection && itemIds.has(relationship.target.id)),
    )
    .map((relationship) => {
      if (relationship.source.collection === entityCollection && itemIds.has(relationship.source.id)) {
        return {
          type: relationship.type,
          label: getOutgoingRelationLabel(relationship.type),
          sourceId: relationship.source.id,
          sourceCollection: relationship.source.collection,
          relatedId: relationship.target.id,
          relatedCollection: relationship.target.collection,
          relatedLabel: getEntityContent(contentMap, relationship.target),
        };
      }

      return {
        type: relationship.type,
        label: getIncomingRelationLabel(relationship.type),
        sourceId: relationship.source.id,
        sourceCollection: relationship.source.collection,
        relatedId: relationship.source.id,
        relatedCollection: relationship.source.collection,
        relatedLabel: getEntityContent(contentMap, relationship.source),
      };
    });
}

export function KnowledgeViewContent({ entities }: { entities: EntitiesData }) {
  const contentMap = buildContentMap(entities);
  const totalItems = knowledgeKindRegistry.reduce(
    (sum, entry) => sum + entities[entry.collectionKey].length,
    0,
  );
  const totalRelationships = entities.relationships.length;

  return (
    <div className="mx-auto max-w-3xl px-10 py-8">
      <MetadataRow
        items={[
          { label: 'Knowledge items', value: String(totalItems) },
          { label: 'Relationships', value: String(totalRelationships) },
        ]}
      />

      <div className="mt-7 flex flex-col gap-5">
        {knowledgeKindRegistry.map((entry) => {
          const rawItems = entities[entry.collectionKey];
          if (rawItems.length === 0) {
            return (
              <EmptyCard key={entry.collectionKey} title={entry.label} description={entry.emptyStateCopy} />
            );
          }

          const items = toKnowledgeItems(rawItems, entry.kind);
          const itemIds = new Set(items.map((item) => item.id));
          const edges = toKnowledgeEdges(entities, entry.entityCollection, itemIds, contentMap);

          return (
            <KnowledgeGroupCard key={entry.collectionKey} kind={entry.kind} items={items} edges={edges} />
          );
        })}
      </div>
    </div>
  );
}

const knowledgeRouteApi = getRouteApi('/project/$id/knowledge');

export function KnowledgeView() {
  const { id } = knowledgeRouteApi.useParams();
  const { entitySnapshot } = knowledgeRouteApi.useLoaderData();

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-3xl px-10 py-8 pb-0">
        <Link to="/project/$id" params={{ id }} className="text-xs text-hint hover:text-sub">
          ← Back to interview
        </Link>
        <h1 className="mt-4 text-[22px] font-medium leading-none tracking-[-0.015em] text-ink">Knowledge</h1>
        <p className="mt-2.5 text-sm leading-relaxed text-sub">
          Review captured knowledge items and relationships.
        </p>
      </div>
      <KnowledgeViewContent entities={entitySnapshot} />
    </ScrollArea>
  );
}
