import type { EntitiesData } from '@/shared/api-types.js';
import { knowledgeKindRegistry } from '@/shared/knowledge.js';

import { isVisibleKnowledgeKind } from './knowledge-display';

function countVisibleItems(entityState: EntitiesData): number {
  return knowledgeKindRegistry
    .filter((entry) => isVisibleKnowledgeKind(entry.kind))
    .reduce((sum, entry) => sum + entityState[entry.collectionKey].length, 0);
}

export function KnowledgeGraphIdentity({ entityState }: { entityState: EntitiesData }) {
  const totalItems = countVisibleItems(entityState);
  const totalConnections = entityState.relationships.length;

  return (
    <div data-knowledge-graph-identity className="flex flex-col gap-0.5">
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
  );
}
