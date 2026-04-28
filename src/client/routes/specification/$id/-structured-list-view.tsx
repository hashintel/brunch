import { useLocation } from '@tanstack/react-router';
import { ArrowDownLeft, ArrowUpRight, ChevronRight, MessageCircle } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';

import { knowledgeDisplayGroups } from '@/client/components/knowledge-display.js';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/client/components/ui/collapsible';
import type { EdgeRelation, EntitiesData } from '@/shared/api-types.js';
import { knowledgeKindRegistry, type KnowledgeKind } from '@/shared/knowledge.js';

import { RelationChip, type RelationChipTarget } from './-relation-chip.js';

const HASH_ANCHOR_HIGHLIGHT_MS = 1500;
const CHIP_TRUNCATE_LIMIT = 6;

function readHashTargetRef(rawHash: string): string | null {
  if (!rawHash) return null;
  const stripped = rawHash.startsWith('#') ? rawHash.slice(1) : rawHash;
  return stripped.length > 0 ? stripped : null;
}

function useGraphHashAnchor(containerRef: RefObject<HTMLElement | null>): {
  anchoredRowRef: string | null;
} {
  const location = useLocation();
  const [anchoredRowRef, setAnchoredRowRef] = useState<string | null>(null);
  const targetRef = readHashTargetRef(location.hash);

  useEffect(() => {
    if (!targetRef) {
      setAnchoredRowRef(null);
      return;
    }
    const row = containerRef.current?.querySelector(
      `[data-graph-row-ref="${CSS.escape(targetRef)}"]`,
    ) as HTMLElement | null;
    if (!row) {
      setAnchoredRowRef(null);
      return;
    }
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setAnchoredRowRef(targetRef);
    const timer = setTimeout(() => setAnchoredRowRef(null), HASH_ANCHOR_HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [targetRef, containerRef]);

  return { anchoredRowRef };
}

type KnowledgeItemSummary = RelationChipTarget;

interface DirectedEdge {
  type: EdgeRelation;
  other: KnowledgeItemSummary;
}

interface GraphProjection {
  itemsByKey: Map<string, KnowledgeItemSummary>;
  outgoingByItem: Map<string, DirectedEdge[]>;
  incomingByItem: Map<string, DirectedEdge[]>;
}

function compareReferenceCode(a: string, b: string): number {
  const aMatch = a.match(/^([A-Z]+)(\d+)$/);
  const bMatch = b.match(/^([A-Z]+)(\d+)$/);
  if (!aMatch || !bMatch) return a.localeCompare(b);
  const prefixCmp = aMatch[1].localeCompare(bMatch[1]);
  if (prefixCmp !== 0) return prefixCmp;
  return Number.parseInt(aMatch[2], 10) - Number.parseInt(bMatch[2], 10);
}

function pushBucket<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const bucket = map.get(key);
  if (bucket) {
    bucket.push(value);
  } else {
    map.set(key, [value]);
  }
}

function projectGraph(entityState: EntitiesData): GraphProjection {
  const itemsByKey = new Map<string, KnowledgeItemSummary>();
  const outgoingByItem = new Map<string, DirectedEdge[]>();
  const incomingByItem = new Map<string, DirectedEdge[]>();

  for (const entry of knowledgeKindRegistry) {
    for (const item of entityState[entry.collectionKey]) {
      const referenceCode = item.referenceCode ?? `${entry.referenceCodePrefix}${item.id}`;
      itemsByKey.set(`${entry.kind}:${item.id}`, {
        kind: entry.kind,
        id: item.id,
        referenceCode,
        content: item.content,
        rationale: 'rationale' in item ? item.rationale : null,
        outgoingCount: 0,
        incomingCount: 0,
      });
    }
  }

  for (const rel of entityState.relationships) {
    const sourceKey = `${rel.source.kind}:${rel.source.id}`;
    const targetKey = `${rel.target.kind}:${rel.target.id}`;
    const sourceItem = itemsByKey.get(sourceKey);
    const targetItem = itemsByKey.get(targetKey);

    if (sourceItem) sourceItem.outgoingCount += 1;
    if (targetItem) targetItem.incomingCount += 1;

    if (sourceItem && targetItem) {
      pushBucket(outgoingByItem, sourceKey, { type: rel.type, other: targetItem });
      pushBucket(incomingByItem, targetKey, { type: rel.type, other: sourceItem });
    }
  }

  return { itemsByKey, outgoingByItem, incomingByItem };
}

function collectItemsForGroup(
  entityState: EntitiesData,
  kinds: readonly KnowledgeKind[],
  itemsByKey: Map<string, KnowledgeItemSummary>,
  hiddenKinds: ReadonlySet<KnowledgeKind>,
): KnowledgeItemSummary[] {
  const result: KnowledgeItemSummary[] = [];
  for (const kind of kinds) {
    if (hiddenKinds.has(kind)) continue;
    const collectionEntry = knowledgeKindRegistry.find((entry) => entry.kind === kind);
    if (!collectionEntry) continue;
    for (const item of entityState[collectionEntry.collectionKey]) {
      const summary = itemsByKey.get(`${kind}:${item.id}`);
      if (summary) result.push(summary);
    }
  }
  return result;
}

function KindFilterToggler({
  entityState,
  hiddenKinds,
  onToggle,
}: {
  entityState: EntitiesData;
  hiddenKinds: ReadonlySet<KnowledgeKind>;
  onToggle: (kind: KnowledgeKind) => void;
}) {
  const populated = knowledgeKindRegistry.filter((entry) => entityState[entry.collectionKey].length > 0);
  if (populated.length === 0) return null;

  return (
    <div data-graph-kind-filter className="flex flex-wrap gap-1.5">
      {populated.map((entry) => {
        const isHidden = hiddenKinds.has(entry.kind);
        const count = entityState[entry.collectionKey].length;
        return (
          <button
            key={entry.kind}
            type="button"
            data-graph-kind-toggle={entry.kind}
            aria-pressed={!isHidden}
            onClick={() => onToggle(entry.kind)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
              isHidden
                ? 'border-rule bg-background text-hint hover:text-sub'
                : 'border-rule bg-wash text-ink hover:bg-tint'
            }`}
          >
            <span className="font-medium">{entry.label}</span>
            <span className="font-mono text-[10px] text-hint">{count}</span>
          </button>
        );
      })}
    </div>
  );
}

function groupEdgesByType(edges: DirectedEdge[]): Map<EdgeRelation, DirectedEdge[]> {
  const groups = new Map<EdgeRelation, DirectedEdge[]>();
  for (const edge of edges) {
    pushBucket(groups, edge.type, edge);
  }
  return groups;
}

const relationTypeColor: Record<EdgeRelation, string> = {
  depends_on: 'text-rel-depends-on',
  derived_from: 'text-rel-derived-from',
  constrains: 'text-rel-constrains',
  verifies: 'text-rel-verifies',
  refines: 'text-rel-refines',
};

const relationTypeLabel: Record<EdgeRelation, string> = {
  depends_on: 'Depends on',
  derived_from: 'Derived from',
  constrains: 'Constrains',
  verifies: 'Verifies',
  refines: 'Refines',
};

function ChipListByRelationType({ type, edges }: { type: EdgeRelation; edges: DirectedEdge[] }) {
  const [expanded, setExpanded] = useState(false);
  const overflowCount = edges.length - CHIP_TRUNCATE_LIMIT;
  const showMoreButton = !expanded && overflowCount > 0;
  const visibleEdges = expanded ? edges : edges.slice(0, CHIP_TRUNCATE_LIMIT);
  // depends_on is the most generic relation; the Outgoing/Incoming subsection
  // header already conveys direction, so the per-type label adds no signal.
  const showTypeLabel = type !== 'depends_on';

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {showTypeLabel && (
        <span className={`text-xs font-medium ${relationTypeColor[type]}`}>{relationTypeLabel[type]}</span>
      )}
      {visibleEdges.map((edge) => (
        <RelationChip key={`${type}-${edge.other.kind}-${edge.other.id}`} target={edge.other} />
      ))}
      {showMoreButton && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="rounded bg-wash px-1.5 py-0.5 text-xs text-sub outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-foreground/30"
        >
          +{overflowCount} more
        </button>
      )}
    </div>
  );
}

function RelationsSubsection({
  label,
  direction,
  edges,
}: {
  label: string;
  direction: 'outgoing' | 'incoming';
  edges: DirectedEdge[];
}) {
  if (edges.length === 0) return null;

  const grouped = groupEdgesByType(edges);
  const DirectionIcon = direction === 'outgoing' ? ArrowUpRight : ArrowDownLeft;

  return (
    <Collapsible defaultOpen className="flex flex-col">
      <div className="flex w-full items-center justify-between gap-2 px-3 py-2 text-xs text-sub">
        <span className="flex items-center gap-1.5">
          <DirectionIcon className="size-3.5 shrink-0 text-hint" />
          <span className="font-medium">{label}</span>
          <span className="font-mono text-hint">({edges.length})</span>
        </span>
        <CollapsibleTrigger
          data-graph-relations-subsection={direction}
          aria-label={`Toggle ${direction} relations`}
          className="group flex size-6 shrink-0 items-center justify-center rounded text-hint outline-none hover:bg-wash hover:text-ink focus-visible:ring-2 focus-visible:ring-foreground/30"
        >
          <ChevronRight className="size-3.5 transition-transform group-data-[state=open]:rotate-90" />
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="flex flex-col gap-1.5 px-3 pb-3">
        {Array.from(grouped.entries()).map(([type, typeEdges]) => (
          <ChipListByRelationType key={type} type={type} edges={typeEdges} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

function RelationsFooter({ outgoing, incoming }: { outgoing: DirectedEdge[]; incoming: DirectedEdge[] }) {
  if (outgoing.length === 0 && incoming.length === 0) return null;

  return (
    <div className="border-t border-rule bg-tint">
      <RelationsSubsection label="Outgoing" direction="outgoing" edges={outgoing} />
      {outgoing.length > 0 && incoming.length > 0 && <div className="border-t border-rule" />}
      <RelationsSubsection label="Incoming" direction="incoming" edges={incoming} />
    </div>
  );
}

function EmptyStateCard({ action }: { action?: ReactNode }) {
  return (
    <div
      data-graph-empty-state
      className="flex flex-col items-center gap-3 rounded-md border border-rule bg-tint p-8 text-center"
    >
      <p className="text-sm font-medium text-ink">No knowledge captured yet</p>
      <p className="max-w-md text-xs text-sub">
        Knowledge appears here as the interview progresses. Start a turn to populate the graph.
      </p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

function ItemActionRail() {
  return (
    <div data-graph-action-rail className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        data-graph-action="chat-with"
        disabled
        title="Chat about this item (coming soon)"
        aria-label="Chat about this item"
        className="flex size-6 items-center justify-center rounded text-hint opacity-40"
      >
        <MessageCircle className="size-3.5" />
      </button>
    </div>
  );
}

function ItemRow({
  item,
  outgoing,
  incoming,
  anchored,
}: {
  item: KnowledgeItemSummary;
  outgoing: DirectedEdge[];
  incoming: DirectedEdge[];
  anchored: boolean;
}) {
  return (
    <div
      data-graph-row
      data-graph-row-ref={item.referenceCode}
      data-graph-row-anchored={anchored ? 'true' : undefined}
      className={`overflow-hidden rounded-md border bg-background transition-all duration-700 ${anchored ? 'animate-in border-link/50 ring-2 ring-link/30 duration-300 fade-in' : 'border-rule'}`}
    >
      <div className="p-3">
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <span data-graph-row-reference className="shrink-0 font-mono text-xs text-hint">
              {item.referenceCode}
            </span>
            <p className="text-sm text-ink">{item.content}</p>
          </div>
          <ItemActionRail />
        </div>
        {item.rationale && <p className="mt-1 text-xs text-sub">{item.rationale}</p>}
      </div>
      <RelationsFooter outgoing={outgoing} incoming={incoming} />
    </div>
  );
}

export function StructuredListView({
  entityState,
  emptyStateAction,
  header,
}: {
  entityState: EntitiesData;
  emptyStateAction?: ReactNode;
  header?: ReactNode;
}) {
  const { itemsByKey, outgoingByItem, incomingByItem } = projectGraph(entityState);
  const containerRef = useRef<HTMLDivElement>(null);
  const { anchoredRowRef } = useGraphHashAnchor(containerRef);
  const [hiddenKinds, setHiddenKinds] = useState<ReadonlySet<KnowledgeKind>>(new Set());

  const toggleKind = (kind: KnowledgeKind) => {
    setHiddenKinds((current) => {
      const next = new Set(current);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  };

  const totalItems = itemsByKey.size;

  return (
    <div
      ref={containerRef}
      data-graph-structured-list
      className="flex h-full flex-col overflow-y-auto bg-background"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
        {header}
        {totalItems === 0 && <EmptyStateCard action={emptyStateAction} />}
        {totalItems > 0 && (
          <KindFilterToggler entityState={entityState} hiddenKinds={hiddenKinds} onToggle={toggleKind} />
        )}
        {totalItems > 0 &&
          knowledgeDisplayGroups.map((group) => {
            const items = collectItemsForGroup(entityState, group.kinds, itemsByKey, hiddenKinds).sort(
              (a, b) => compareReferenceCode(a.referenceCode, b.referenceCode),
            );
            if (items.length === 0) return null;
            return (
              <section key={group.label} data-graph-section={group.label}>
                <h2 className="mb-2 text-sm font-medium text-sub">{group.label}</h2>
                <div className="flex flex-col gap-2">
                  {items.map((item) => {
                    const itemKey = `${item.kind}:${item.id}`;
                    return (
                      <ItemRow
                        key={itemKey}
                        item={item}
                        outgoing={outgoingByItem.get(itemKey) ?? []}
                        incoming={incomingByItem.get(itemKey) ?? []}
                        anchored={anchoredRowRef === item.referenceCode}
                      />
                    );
                  })}
                </div>
              </section>
            );
          })}
      </div>
    </div>
  );
}
