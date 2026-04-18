import { EmptyCard } from '@/client/components/app-shell';
import { ScrollArea } from '@/client/components/ui/scroll-area';
import type { EntitiesData } from '@/shared/api-types.js';
import type { KnowledgeEntityCollection, KnowledgeKind } from '@/shared/knowledge.js';
import {
  knowledgeCollectionKeyByKind,
  knowledgeEntityCollectionByKind,
  knowledgeKindRegistry,
} from '@/shared/knowledge.js';

import { KnowledgeDetailCard, type KnowledgeEdgeData, type KnowledgeItemData } from './knowledge-card';

// ── Hard-coded display grouping registry (D104) ─────────────────────
//
// | Group label              | Kinds                     | Visible |
// | -------------------------| --------------------------| ------- |
// | Goals & Context          | goal, context, constraint | yes     |
// | Assumptions & Decisions  | assumption, decision      | yes     |
// | Requirements             | requirement               | yes     |
// | Acceptance Criteria      | criterion                 | yes     |
// | (hidden)                 | term                      | no      |

interface KnowledgeDisplayGroup {
  label: string;
  kinds: KnowledgeKind[];
}

const knowledgeDisplayGroups: KnowledgeDisplayGroup[] = [
  { label: 'Goals & Context', kinds: ['goal', 'context', 'constraint'] },
  { label: 'Assumptions & Decisions', kinds: ['assumption', 'decision'] },
  { label: 'Requirements', kinds: ['requirement'] },
  { label: 'Acceptance Criteria', kinds: ['criterion'] },
];

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

export function EntitySidebar({ entityState }: { entityState: EntitiesData }) {
  // Count only visible kinds (exclude term)
  const visibleKinds = new Set(knowledgeDisplayGroups.flatMap((g) => g.kinds));
  const totalItems = knowledgeKindRegistry
    .filter((entry) => visibleKinds.has(entry.kind))
    .reduce((sum, entry) => sum + entityState[entry.collectionKey].length, 0);
  const totalConnections = entityState.relationships.length;

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex h-16 shrink-0 items-center border-b border-rule bg-background px-3">
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

            return (
              <section key={group.label}>
                <h3 className="mb-2 text-xs font-medium text-sub">
                  {group.label}
                  {count > 0 && <span className="ml-1.5 text-sub">{count}</span>}
                </h3>
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
              </section>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
