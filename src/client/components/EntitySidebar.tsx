import { Link } from '@tanstack/react-router';
import { ChevronRight, Maximize2 } from 'lucide-react';

import { EmptyCard } from '@/client/components/app-shell';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/client/components/ui/collapsible';
import { ScrollArea } from '@/client/components/ui/scroll-area';
import type { EntitiesData } from '@/shared/api-types.js';
import type { KnowledgeEntityCollection, KnowledgeKind } from '@/shared/knowledge.js';
import {
  knowledgeCollectionKeyByKind,
  knowledgeEntityCollectionByKind,
  knowledgeKindRegistry,
} from '@/shared/knowledge.js';

import { KnowledgeDetailCard, type KnowledgeEdgeData, type KnowledgeItemData } from './knowledge-card';
import { hiddenWhenEmptyGroups, knowledgeDisplayGroups, isVisibleKnowledgeKind } from './knowledge-display';

// ── Helpers ─────────────────────────────────────────────────────────

function toKnowledgeItemData(
  item: {
    id: number;
    content: string;
    rationale?: string | null;
    subtype?: string | null;
    referenceCode?: string;
  },
  kind: KnowledgeItemData['kind'],
): KnowledgeItemData {
  return {
    id: item.id,
    kind,
    content: item.content,
    ...(item.rationale ? { rationale: item.rationale } : {}),
    ...(item.subtype ? { subtype: item.subtype } : {}),
    ...(item.referenceCode ? { referenceCode: item.referenceCode } : {}),
  };
}

function getReferenceCodeForEntity(
  entityState: EntitiesData,
  kind: KnowledgeKind,
  id: number,
): string | undefined {
  const collectionKey = knowledgeCollectionKeyByKind[kind];
  return entityState[collectionKey].find((item) => item.id === id)?.referenceCode;
}

function buildOutgoingEdgesForItem(
  entityState: EntitiesData,
  collection: KnowledgeEntityCollection,
  id: number,
): KnowledgeEdgeData[] {
  return entityState.relationships
    .filter((relationship) => relationship.source.collection === collection && relationship.source.id === id)
    .map((relationship) => ({
      type: relationship.type,
      label: 'Links to',
      sourceId: relationship.source.id,
      sourceCollection: relationship.source.collection,
      relatedId: relationship.target.id,
      relatedCollection: relationship.target.collection,
      relatedKind: relationship.target.kind,
      relatedReferenceCode: getReferenceCodeForEntity(
        entityState,
        relationship.target.kind,
        relationship.target.id,
      ),
    }));
}

// ── Component ───────────────────────────────────────────────────────

export function EntitySidebar({
  entityState,
  specificationId,
}: {
  entityState: EntitiesData;
  specificationId?: string;
}) {
  const totalItems = knowledgeKindRegistry
    .filter((entry) => isVisibleKnowledgeKind(entry.kind))
    .reduce((sum, entry) => sum + entityState[entry.collectionKey].length, 0);
  const totalConnections = entityState.relationships.length;

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-rule bg-background px-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-hint">Knowledge Graph</span>
          <div className="flex items-center gap-2.5 text-base text-sub">
            <span>
              <span className="font-medium text-ink">{totalItems}</span> Items
            </span>
            <span>
              <span className="font-medium text-ink">{totalConnections}</span> Connections
            </span>
          </div>
        </div>
        {specificationId && (
          <Link
            to="/specification/$id/graph"
            params={{ id: specificationId }}
            aria-label="Open knowledge graph view"
            title="Open knowledge graph view"
            className="flex size-7 items-center justify-center rounded text-sub outline-none hover:bg-wash hover:text-ink focus-visible:ring-2 focus-visible:ring-foreground/30"
          >
            <Maximize2 className="size-3.5" />
          </Link>
        )}
      </div>

      {/* Grouped knowledge list */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-6 p-4">
          {knowledgeDisplayGroups.map((group) => {
            // Collect all items across the group's kinds
            const groupItems: { item: KnowledgeItemData; edges: KnowledgeEdgeData[] }[] = [];
            for (const kind of group.kinds) {
              const collectionKey = knowledgeCollectionKeyByKind[kind];
              const entityCollection = knowledgeEntityCollectionByKind[kind];
              const items = entityState[collectionKey];
              for (const item of items) {
                groupItems.push({
                  item: toKnowledgeItemData(item, kind),
                  edges: buildOutgoingEdgesForItem(entityState, entityCollection, item.id),
                });
              }
            }

            const count = groupItems.length;

            if (count === 0 && hiddenWhenEmptyGroups.has(group.label)) {
              return null;
            }

            return (
              <Collapsible key={group.label} defaultOpen asChild>
                <section data-knowledge-group={group.label}>
                  <CollapsibleTrigger className="group mb-2 flex w-full items-center justify-between gap-2 rounded px-1 py-1 text-xs font-medium text-sub outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-foreground/30">
                    <span>
                      {group.label}
                      {count > 0 && <span className="ml-1.5 font-mono text-hint">{count}</span>}
                    </span>
                    <ChevronRight className="size-3.5 shrink-0 transition-transform group-data-[state=open]:rotate-90" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    {count === 0 ? (
                      <EmptyCard
                        title={`No ${group.label.toLowerCase()} yet`}
                        description="Items will appear as the interview progresses."
                      />
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        {groupItems.map(({ item, edges }) => (
                          <KnowledgeDetailCard
                            key={`${item.kind}-${item.id}`}
                            item={item}
                            edges={edges.length > 0 ? edges : undefined}
                          />
                        ))}
                      </div>
                    )}
                  </CollapsibleContent>
                </section>
              </Collapsible>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
