import { useState } from 'react';

import { Badge } from '@/client/components/ui/badge';
import type { EntitiesData, EntityRelationship, ReviewStatus } from '@/shared/api-types.js';
import { knowledgeKindRegistry, type KnowledgeCollectionKey } from '@/shared/knowledge.js';

type EntityItem = {
  id: number;
  content: string;
  subtype?: string | null;
  rationale?: string | null;
  reviewStatus?: ReviewStatus;
  collection: EntityRelationship['source']['collection'];
  kind: string;
};

function collectAllItems(entityState: EntitiesData): EntityItem[] {
  const items: EntityItem[] = [];

  for (const entry of knowledgeKindRegistry) {
    const collection = entityState[entry.collectionKey];
    for (const item of collection) {
      items.push({
        id: item.id,
        content: item.content,
        subtype: 'subtype' in item ? item.subtype : null,
        rationale: 'rationale' in item ? item.rationale : null,
        reviewStatus: 'reviewStatus' in item ? (item.reviewStatus as ReviewStatus) : undefined,
        collection: entry.entityCollection,
        kind: entry.kind,
      });
    }
  }

  return items;
}

function getRelationshipsForItem(
  relationships: EntitiesData['relationships'],
  collection: EntityRelationship['source']['collection'],
  id: number,
  allItems: EntityItem[],
): Array<{ type: string; targetContent: string }> {
  const result: Array<{ type: string; targetContent: string }> = [];

  for (const r of relationships) {
    if (r.source.collection === collection && r.source.id === id) {
      const target = allItems.find(
        (item) => item.collection === r.target.collection && item.id === r.target.id,
      );
      if (target) {
        result.push({ type: r.type, targetContent: target.content });
      }
    }
  }

  return result;
}

const relationTypeLabels: Record<string, string> = {
  depends_on: 'Depends on',
  derived_from: 'Derived from',
  constrains: 'Constrains',
  verifies: 'Verifies',
  refines: 'Refines',
};

function EntityCard({
  item,
  relationships,
}: {
  item: EntityItem;
  relationships: Array<{ type: string; targetContent: string }>;
}) {
  return (
    <div data-entity-card className="rounded-md border p-3">
      <p className="text-sm">{item.content}</p>
      {item.subtype && <p className="mt-1 text-xs text-muted-foreground">{item.subtype}</p>}
      {item.rationale && <p className="mt-1 text-xs text-muted-foreground">{item.rationale}</p>}
      {item.reviewStatus && (
        <Badge
          variant={
            item.reviewStatus === 'approved'
              ? 'default'
              : item.reviewStatus === 'rejected'
                ? 'destructive'
                : 'secondary'
          }
          className="mt-1"
        >
          {item.reviewStatus === 'approved'
            ? 'Approved'
            : item.reviewStatus === 'rejected'
              ? 'Rejected'
              : 'Pending'}
        </Badge>
      )}
      {relationships.length > 0 && (
        <div className="mt-2">
          {relationships.map((rel, i) => (
            <p key={i} className="text-xs text-muted-foreground">
              <span className="font-medium">{relationTypeLabels[rel.type] ?? rel.type}</span>:{' '}
              {rel.targetContent}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export function GraphView({ entityState }: { entityState: EntitiesData }) {
  const [hiddenKinds, setHiddenKinds] = useState<Set<KnowledgeCollectionKey>>(new Set());

  const allItems = collectAllItems(entityState);
  const totalItems = allItems.length;

  if (totalItems === 0) {
    return (
      <div data-graph-view className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">
          No knowledge items yet. They will appear as the interview progresses.
        </p>
      </div>
    );
  }

  function toggleKind(collectionKey: KnowledgeCollectionKey) {
    setHiddenKinds((current) => {
      const next = new Set(current);
      if (next.has(collectionKey)) {
        next.delete(collectionKey);
      } else {
        next.add(collectionKey);
      }
      return next;
    });
  }

  const populatedGroups = knowledgeKindRegistry.filter(
    (entry) => entityState[entry.collectionKey].length > 0,
  );

  return (
    <div data-graph-view className="flex h-full flex-col overflow-hidden">
      {/* Kind filter controls */}
      <div className="flex flex-wrap gap-3 border-b px-4 py-3">
        {populatedGroups.map((entry) => (
          <label key={entry.collectionKey} className="flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={!hiddenKinds.has(entry.collectionKey)}
              onChange={() => toggleKind(entry.collectionKey)}
              aria-label={entry.label}
            />
            <span>{entry.label}</span>
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
              {entityState[entry.collectionKey].length}
            </Badge>
          </label>
        ))}
      </div>

      {/* Entity groups */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-3xl space-y-6">
          {populatedGroups
            .filter((entry) => !hiddenKinds.has(entry.collectionKey))
            .map((entry) => {
              const items = entityState[entry.collectionKey];

              return (
                <section key={entry.collectionKey}>
                  <h3 className="mb-2 text-sm font-semibold">
                    {entry.label}
                    <Badge variant="secondary" className="ml-2 px-1.5 py-0 text-[10px]">
                      {items.length}
                    </Badge>
                  </h3>
                  <div className="flex flex-col gap-2">
                    {items.map((item) => {
                      const entityItem: EntityItem = {
                        id: item.id,
                        content: item.content,
                        subtype: 'subtype' in item ? item.subtype : null,
                        rationale: 'rationale' in item ? item.rationale : null,
                        reviewStatus:
                          'reviewStatus' in item ? (item.reviewStatus as ReviewStatus) : undefined,
                        collection: entry.entityCollection,
                        kind: entry.kind,
                      };
                      const rels = getRelationshipsForItem(
                        entityState.relationships,
                        entry.entityCollection,
                        item.id,
                        allItems,
                      );
                      return <EntityCard key={item.id} item={entityItem} relationships={rels} />;
                    })}
                  </div>
                </section>
              );
            })}
        </div>
      </div>
    </div>
  );
}
