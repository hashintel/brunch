import { KindToggleChip } from '@/client/routes/specification/$id/-kind-toggle-chip.js';
import { type knowledgeKindRegistry, type KnowledgeKind } from '@/shared/knowledge.js';

export interface PopulatedKind {
  entry: (typeof knowledgeKindRegistry)[number];
  count: number;
}

export function GraphKindFilter({
  populatedKinds,
  hiddenKinds,
  onToggle,
  onNavigate,
}: {
  populatedKinds: PopulatedKind[];
  hiddenKinds: ReadonlySet<KnowledgeKind>;
  onToggle: (kind: KnowledgeKind) => void;
  onNavigate: (kind: KnowledgeKind) => void;
}) {
  if (populatedKinds.length === 0) return null;

  return (
    <div
      data-graph-kind-filter=""
      className="flex max-w-md flex-wrap items-center gap-1.5 rounded-lg border border-rule bg-white/90 px-2 py-2 shadow-[var(--shadow-card)] backdrop-blur-sm"
    >
      {populatedKinds.map(({ entry, count }) => (
        <KindToggleChip
          key={entry.kind}
          entry={entry}
          count={count}
          isHidden={hiddenKinds.has(entry.kind)}
          onNavigate={onNavigate}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
}
