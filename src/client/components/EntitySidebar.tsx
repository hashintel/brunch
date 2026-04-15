import { Badge } from '@/client/components/ui/badge';
import { ScrollArea } from '@/client/components/ui/scroll-area';
import type { EntitiesData } from '@/shared/api-types.js';
import { knowledgeKindRegistry } from '@/shared/knowledge.js';

export function EntitySidebar({ entityState }: { entityState: EntitiesData }) {
  const totalItems = knowledgeKindRegistry.reduce(
    (sum, entry) => sum + entityState[entry.collectionKey].length,
    0,
  );
  const totalConnections = entityState.relationships.length;

  return (
    <div className="flex h-full flex-col bg-card">
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
        <div className="flex flex-col gap-4 p-3">
          {knowledgeKindRegistry.map((entry) => {
            const items = entityState[entry.collectionKey];
            return (
              <section key={entry.collectionKey}>
                <h3 className="mb-2 text-xs font-medium text-hint">
                  {entry.label}
                  {items.length > 0 && <span className="ml-1.5 text-sub">{items.length}</span>}
                </h3>
                {items.length === 0 ? (
                  <p className="text-xs italic text-hint">{entry.emptyStateCopy}</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {items.map((item) => (
                      <div key={item.id} className="rounded-md border border-rule p-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-0.5">
                            {'referenceCode' in item && item.referenceCode ? (
                              <p className="font-mono text-xxs font-medium uppercase tracking-wide text-hint">
                                {item.referenceCode}
                              </p>
                            ) : null}
                            <p className="text-xs text-ink">{item.content}</p>
                          </div>
                          {'reviewStatus' in item && item.reviewStatus && (
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
                      </div>
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
