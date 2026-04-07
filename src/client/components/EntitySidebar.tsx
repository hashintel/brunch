import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { WorkspaceDurableEntityState } from '@/workspace/workspace-controller-core';

const tabs = ['Framing', 'Decisions', 'Assumptions'] as const;
type Tab = (typeof tabs)[number];

function entityKey(collection: 'knowledge_item' | 'decision' | 'assumption', id: number) {
  return `${collection}:${id}`;
}

export function EntitySidebar({ entityState }: { entityState: WorkspaceDurableEntityState }) {
  const [activeTab, setActiveTab] = useState<Tab>('Decisions');
  const { framing, decisions, assumptions, relationships, isLoading } = entityState;
  const contentByEntity = new Map<string, string>([
    ...framing.map((item) => [entityKey('knowledge_item', item.id), item.content] as const),
    ...decisions.map((decision) => [entityKey('decision', decision.id), decision.content] as const),
    ...assumptions.map((assumption) => [entityKey('assumption', assumption.id), assumption.content] as const),
  ]);

  function getDependencyLabels(source: { collection: 'decision' | 'assumption'; id: number }) {
    return relationships
      .filter(
        (relationship) =>
          relationship.type === 'depends_on' &&
          relationship.source.collection === source.collection &&
          relationship.source.id === source.id,
      )
      .map((relationship) =>
        contentByEntity.get(entityKey(relationship.target.collection, relationship.target.id)),
      )
      .filter((content): content is string => Boolean(content));
  }

  return (
    <div className="flex h-full w-72 flex-col border-l bg-card">
      {/* Tab bar */}
      <div className="flex border-b">
        {tabs.map((tab) => {
          const count =
            tab === 'Framing' ? framing.length : tab === 'Decisions' ? decisions.length : assumptions.length;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                'flex-1 px-3 py-2 text-sm font-medium transition-colors',
                activeTab === tab
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tab}
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
        {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}

        {activeTab === 'Framing' && (
          <div className="flex flex-col gap-2">
            {framing.length === 0 && !isLoading && (
              <p className="text-sm italic text-muted-foreground">
                No framing items yet. They'll appear as the interview progresses.
              </p>
            )}
            {framing.map((item) => (
              <div key={item.id} className="rounded-md border p-2.5">
                <p className="text-sm">{item.content}</p>
                {item.subtype && <p className="mt-1 text-xs text-muted-foreground">{item.subtype}</p>}
                {item.rationale && <p className="mt-1 text-xs text-muted-foreground">{item.rationale}</p>}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'Decisions' && (
          <div className="flex flex-col gap-2">
            {decisions.length === 0 && !isLoading && (
              <p className="text-sm italic text-muted-foreground">
                No decisions yet. They'll appear as the interview progresses.
              </p>
            )}
            {decisions.map((d) => {
              const dependencyLabels = getDependencyLabels({ collection: 'decision', id: d.id });

              return (
                <div key={d.id} className="rounded-md border p-2.5">
                  <p className="text-sm">{d.content}</p>
                  {d.rationale && <p className="mt-1 text-xs text-muted-foreground">{d.rationale}</p>}
                  {dependencyLabels.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-muted-foreground">Depends on</p>
                      <ul className="mt-1 list-disc pl-4 text-xs text-muted-foreground">
                        {dependencyLabels.map((label) => (
                          <li key={label}>{label}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'Assumptions' && (
          <div className="flex flex-col gap-2">
            {assumptions.length === 0 && !isLoading && (
              <p className="text-sm italic text-muted-foreground">
                No assumptions yet. They'll appear as the interview progresses.
              </p>
            )}
            {assumptions.map((a) => {
              const dependencyLabels = getDependencyLabels({ collection: 'assumption', id: a.id });

              return (
                <div key={a.id} className="rounded-md border p-2.5">
                  <p className="text-sm">{a.content}</p>
                  {dependencyLabels.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-muted-foreground">Depends on</p>
                      <ul className="mt-1 list-disc pl-4 text-xs text-muted-foreground">
                        {dependencyLabels.map((label) => (
                          <li key={label}>{label}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
