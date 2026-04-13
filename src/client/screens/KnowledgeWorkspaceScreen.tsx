import { Link } from '@tanstack/react-router';

import { EmptyCard } from '@/client/components/app-shell';
import {
  KnowledgeGroupCard,
  MetadataRow,
  type KnowledgeEdgeData,
  type KnowledgeItemData,
} from '@/client/components/knowledge-card';
import { ScrollArea } from '@/client/components/ui/scroll-area';
import type { EntitiesData } from '@/shared/api-types.js';
import {
  knowledgeKindRegistry,
  type KnowledgeEntityCollection,
  type KnowledgeKind,
} from '@/shared/knowledge.js';

type KnowledgeWorkspaceEntity = EntitiesData[Exclude<keyof EntitiesData, 'relationships'>][number];

function getOptionalSubtype(item: KnowledgeWorkspaceEntity): string | undefined {
  return 'subtype' in item && typeof item.subtype === 'string' ? item.subtype : undefined;
}

function getOptionalRationale(item: KnowledgeWorkspaceEntity): string | undefined {
  return 'rationale' in item && typeof item.rationale === 'string' ? item.rationale : undefined;
}

function getOptionalReviewStatus(item: KnowledgeWorkspaceEntity): KnowledgeItemData['reviewStatus'] {
  return 'reviewStatus' in item ? item.reviewStatus : undefined;
}

function toKnowledgeItems(
  rawItems: readonly KnowledgeWorkspaceEntity[],
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

function toKnowledgeEdges(
  entities: EntitiesData,
  entityCollection: KnowledgeEntityCollection,
  itemIds: Set<number>,
  contentMap: Map<string, string>,
): KnowledgeEdgeData[] {
  return entities.relationships
    .filter(
      (relationship) =>
        relationship.source.collection === entityCollection && itemIds.has(relationship.source.id),
    )
    .map((relationship) => ({
      type: relationship.type,
      sourceId: relationship.source.id,
      sourceCollection: relationship.source.collection,
      targetId: relationship.target.id,
      targetCollection: relationship.target.collection,
      targetLabel: contentMap.get(`${relationship.target.collection}:${relationship.target.id}`),
    }));
}

export function KnowledgeWorkspaceView({ entities }: { entities: EntitiesData }) {
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

export function KnowledgeWorkspaceScreen({
  projectId,
  entities,
}: {
  projectId: string;
  entities: EntitiesData;
}) {
  return (
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-3xl px-10 py-8 pb-0">
        <Link to="/project/$id" params={{ id: projectId }} className="text-xs text-hint hover:text-sub">
          ← Back to interview
        </Link>
        <h1 className="mt-4 text-[22px] font-medium leading-none tracking-[-0.015em] text-ink">Knowledge</h1>
        <p className="mt-2.5 text-sm leading-relaxed text-sub">
          Review captured knowledge items and relationships.
        </p>
      </div>
      <KnowledgeWorkspaceView entities={entities} />
    </ScrollArea>
  );
}
