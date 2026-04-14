import { useState } from 'react';

import { Badge } from '@/client/components/ui/badge';
import { cn } from '@/client/lib/utils';
import type { EntitiesData, ReviewStatus } from '@/shared/api-types.js';
import {
  knowledgeKindRegistry,
  knowledgeKindRegistryByCollectionKey,
  type KnowledgeCollectionKey,
} from '@/shared/knowledge.js';

function entityKey(collection: 'knowledge_item' | 'decision' | 'assumption', id: number) {
  return `${collection}:${id}`;
}

function renderKnowledgeItems(
  items: ReadonlyArray<{
    id: number;
    content: string;
    subtype: string | null;
    rationale: string | null;
    reviewStatus?: ReviewStatus;
  }>,
  emptyMessage: string,
) {
  if (items.length === 0) {
    return <p className="text-sm italic text-muted-foreground">{emptyMessage}</p>;
  }

  return items.map((item) => (
    <div key={item.id} className="rounded-md border p-2.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm">{item.content}</p>
        {item.reviewStatus && (
          <Badge
            variant={
              item.reviewStatus === 'approved'
                ? 'default'
                : item.reviewStatus === 'rejected'
                  ? 'destructive'
                  : 'secondary'
            }
          >
            {item.reviewStatus === 'approved'
              ? 'Approved'
              : item.reviewStatus === 'rejected'
                ? 'Rejected'
                : 'Pending'}
          </Badge>
        )}
      </div>
      {item.subtype && <p className="mt-1 text-xs text-muted-foreground">{item.subtype}</p>}
      {item.rationale && <p className="mt-1 text-xs text-muted-foreground">{item.rationale}</p>}
    </div>
  ));
}

export function EntitySidebar({ entityState }: { entityState: EntitiesData }) {
  const [activeTab, setActiveTab] = useState<KnowledgeCollectionKey>('decisions');
  const {
    goals,
    terms,
    contexts,
    constraints,
    requirements,
    criteria,
    decisions,
    assumptions,
    relationships,
  } = entityState;
  const contentByEntity = new Map<string, string>([
    ...goals.map((item) => [entityKey('knowledge_item', item.id), item.content] as const),
    ...terms.map((item) => [entityKey('knowledge_item', item.id), item.content] as const),
    ...contexts.map((item) => [entityKey('knowledge_item', item.id), item.content] as const),
    ...constraints.map((item) => [entityKey('knowledge_item', item.id), item.content] as const),
    ...requirements.map((item) => [entityKey('knowledge_item', item.id), item.content] as const),
    ...criteria.map((item) => [entityKey('knowledge_item', item.id), item.content] as const),
    ...decisions.map((decision) => [entityKey('decision', decision.id), decision.content] as const),
    ...assumptions.map((assumption) => [entityKey('assumption', assumption.id), assumption.content] as const),
  ]);

  function getDependencies(source: { collection: 'decision' | 'assumption'; id: number }) {
    return relationships
      .filter(
        (relationship) =>
          relationship.type === 'depends_on' &&
          relationship.source.collection === source.collection &&
          relationship.source.id === source.id,
      )
      .map((relationship) => {
        const key = entityKey(relationship.target.collection, relationship.target.id);
        const label = contentByEntity.get(key);
        return label ? { key, label } : null;
      })
      .filter((dependency): dependency is { key: string; label: string } => dependency !== null);
  }

  return (
    <div className="flex h-full w-72 flex-col border-l bg-card">
      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 border-b p-2">
        {knowledgeKindRegistry.map((entry) => {
          const count = entityState[entry.collectionKey].length;
          return (
            <button
              key={entry.collectionKey}
              type="button"
              onClick={() => setActiveTab(entry.collectionKey)}
              className={cn(
                'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                activeTab === entry.collectionKey
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {entry.label}
              {count > 0 && (
                <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-[10px]">
                  {count}
                </Badge>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {(() => {
          const activeEntry = knowledgeKindRegistryByCollectionKey[activeTab];

          if (activeEntry.entityCollection === 'knowledge_item') {
            const items =
              activeTab === 'goals'
                ? goals
                : activeTab === 'terms'
                  ? terms
                  : activeTab === 'contexts'
                    ? contexts
                    : activeTab === 'constraints'
                      ? constraints
                      : activeTab === 'requirements'
                        ? requirements
                        : criteria;

            return (
              <div className="flex flex-col gap-2">
                {renderKnowledgeItems(items, activeEntry.emptyStateCopy)}
              </div>
            );
          }

          if (activeTab === 'decisions') {
            return (
              <div className="flex flex-col gap-2">
                {decisions.length === 0 && (
                  <p className="text-sm italic text-muted-foreground">{activeEntry.emptyStateCopy}</p>
                )}
                {decisions.map((d) => {
                  const dependencies = getDependencies({ collection: 'decision', id: d.id });

                  return (
                    <div key={d.id} className="rounded-md border p-2.5">
                      <p className="text-sm">{d.content}</p>
                      {d.rationale && <p className="mt-1 text-xs text-muted-foreground">{d.rationale}</p>}
                      {dependencies.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-medium text-muted-foreground">Depends on</p>
                          <ul className="mt-1 list-disc pl-4 text-xs text-muted-foreground">
                            {dependencies.map((dependency) => (
                              <li key={dependency.key}>{dependency.label}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          }

          return (
            <div className="flex flex-col gap-2">
              {assumptions.length === 0 && (
                <p className="text-sm italic text-muted-foreground">{activeEntry.emptyStateCopy}</p>
              )}
              {assumptions.map((a) => {
                const dependencies = getDependencies({ collection: 'assumption', id: a.id });

                return (
                  <div key={a.id} className="rounded-md border p-2.5">
                    <p className="text-sm">{a.content}</p>
                    {dependencies.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-medium text-muted-foreground">Depends on</p>
                        <ul className="mt-1 list-disc pl-4 text-xs text-muted-foreground">
                          {dependencies.map((dependency) => (
                            <li key={dependency.key}>{dependency.label}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
