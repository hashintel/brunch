import { Link, useLoaderData, useParams } from '@tanstack/react-router';

import { EmptyCard } from '@/client/components/app-shell';
import {
  KnowledgeGroupCard,
  MetadataRow,
  type KnowledgeEdgeData,
  type KnowledgeItemData,
} from '@/client/components/knowledge-card';
import { ScrollArea } from '@/client/components/ui/scroll-area';
import type { EntitiesData } from '@/shared/api-types.js';
import { knowledgeKindRegistry, type KnowledgeKind } from '@/shared/knowledge.js';

import type { KnowledgeWorkspaceLoaderData } from '../workspace/workspace-loader.js';

function toKnowledgeItems(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- entity collections are a union of heterogeneous shapes
  rawItems: Array<any>,
  kind: KnowledgeKind,
): KnowledgeItemData[] {
  return rawItems.map((item: Record<string, unknown>) => ({
    id: item.id as number,
    kind,
    content: item.content as string,
    rationale: typeof item.rationale === 'string' ? item.rationale : undefined,
    subtype: typeof item.subtype === 'string' ? item.subtype : undefined,
    reviewStatus:
      item.reviewStatus === 'approved' || item.reviewStatus === 'rejected' || item.reviewStatus === 'pending'
        ? item.reviewStatus
        : undefined,
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
  entityCollection: string,
  itemIds: Set<number>,
  contentMap: Map<string, string>,
): KnowledgeEdgeData[] {
  return entities.relationships
    .filter((r) => r.source.collection === entityCollection && itemIds.has(r.source.id))
    .map((r) => ({
      type: r.type,
      sourceId: r.source.id,
      sourceCollection: r.source.collection,
      targetId: r.target.id,
      targetCollection: r.target.collection,
      targetLabel: contentMap.get(`${r.target.collection}:${r.target.id}`),
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
          const itemIds = new Set(items.map((i) => i.id));
          const edges = toKnowledgeEdges(entities, entry.entityCollection, itemIds, contentMap);

          return (
            <KnowledgeGroupCard key={entry.collectionKey} kind={entry.kind} items={items} edges={edges} />
          );
        })}
      </div>
    </div>
  );
}

export function KnowledgeWorkspace() {
  const { id } = useParams({ from: '/project/$id/knowledge' });
  const { entitySnapshot } = useLoaderData({
    from: '/project/$id/knowledge',
  }) as KnowledgeWorkspaceLoaderData;

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
      <KnowledgeWorkspaceView entities={entitySnapshot} />
    </ScrollArea>
  );
}
