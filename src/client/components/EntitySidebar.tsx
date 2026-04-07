import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { WorkspaceDurableEntityState } from '@/workspace/workspace-controller-core';

const tabs = ['Framing', 'Decisions', 'Assumptions'] as const;
type Tab = (typeof tabs)[number];

export function EntitySidebar({ entityState }: { entityState: WorkspaceDurableEntityState }) {
  const [activeTab, setActiveTab] = useState<Tab>('Decisions');
  const { framing, decisions, assumptions, isLoading } = entityState;

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
            {decisions.map((d) => (
              <div key={d.id} className="rounded-md border p-2.5">
                <p className="text-sm">{d.content}</p>
                {d.rationale && <p className="mt-1 text-xs text-muted-foreground">{d.rationale}</p>}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'Assumptions' && (
          <div className="flex flex-col gap-2">
            {assumptions.length === 0 && !isLoading && (
              <p className="text-sm italic text-muted-foreground">
                No assumptions yet. They'll appear as the interview progresses.
              </p>
            )}
            {assumptions.map((a) => (
              <div key={a.id} className="rounded-md border p-2.5">
                <p className="text-sm">{a.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
