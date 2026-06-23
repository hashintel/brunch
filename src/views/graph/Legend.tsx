/** Kind legend: maps each kind present in the graph to its accent swatch + label, in registry order. */

import { knowledgeKindRegistry, type KnowledgeKind } from '@/shared/knowledge.js';
import { nodeColor } from '@/views/graph/graphStyle';

export function Legend({ kinds }: { kinds: ReadonlySet<KnowledgeKind> }) {
  const present = knowledgeKindRegistry.filter((entry) => kinds.has(entry.kind));
  if (present.length === 0) return null;

  return (
    <div
      data-graph-legend=""
      className="pointer-events-none flex flex-col gap-1 rounded-lg border border-rule bg-white/90 px-2.5 py-2 shadow-[var(--shadow-card)] backdrop-blur-sm"
    >
      {present.map((entry) => (
        <div key={entry.kind} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="size-2.5 shrink-0 rounded-sm"
            style={{ background: nodeColor(entry.kind) }}
          />
          <span className="text-xxs font-medium text-sub">{entry.label}</span>
        </div>
      ))}
    </div>
  );
}
