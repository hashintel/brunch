import { useLocation, useNavigate } from '@tanstack/react-router';
import { ArrowDownLeft, ArrowUpRight, ChevronRight, MessageCircle } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { flushSync } from 'react-dom';

import { kindColor, kindTextColor } from '@/client/components/knowledge-card';
import { graphDisplayGroups } from '@/client/components/knowledge-display.js';
import { Button } from '@/client/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/client/components/ui/collapsible';
import type { EdgeRelation, EntitiesData } from '@/shared/api-types.js';
import { knowledgeKindRegistry, type KnowledgeKind } from '@/shared/knowledge.js';

import { KindToggleChip } from './-kind-toggle-chip.js';
import { ChipActivateProvider, RelationChip, type RelationChipTarget } from './-relation-chip.js';

const HASH_ANCHOR_HIGHLIGHT_MS = 1500;
const CHIP_TRUNCATE_LIMIT = 6;
export const KIND_HASH_PREFIX = 'kind-';

function readHashTargetRef(rawHash: string): string | null {
  if (!rawHash) return null;
  const stripped = rawHash.startsWith('#') ? rawHash.slice(1) : rawHash;
  return stripped.length > 0 ? stripped : null;
}

function useGraphHashAnchor(scrollAreaRef: RefObject<HTMLElement | null>): {
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
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) {
      setAnchoredRowRef(null);
      return;
    }

    const node = targetRef.startsWith(KIND_HASH_PREFIX)
      ? scrollArea.querySelector(
          `[data-graph-kind-anchor="${CSS.escape(targetRef.slice(KIND_HASH_PREFIX.length))}"]`,
        )
      : scrollArea.querySelector(`[data-graph-row-ref="${CSS.escape(targetRef)}"]`);
    if (!(node instanceof HTMLElement)) {
      setAnchoredRowRef(null);
      return;
    }

    const areaRect = scrollArea.getBoundingClientRect();
    const nodeRect = node.getBoundingClientRect();
    const nodeTopWithinArea = nodeRect.top - areaRect.top + scrollArea.scrollTop;
    const targetTop = nodeTopWithinArea - scrollArea.clientHeight / 2 + node.clientHeight / 2;
    scrollArea.scrollTo({ top: targetTop, behavior: 'smooth' });
    setAnchoredRowRef(targetRef);
    const timer = setTimeout(() => setAnchoredRowRef(null), HASH_ANCHOR_HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [targetRef, scrollAreaRef]);

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
      pushBucket(outgoingByItem, sourceKey, {
        type: rel.type,
        other: targetItem,
      });
      pushBucket(incomingByItem, targetKey, {
        type: rel.type,
        other: sourceItem,
      });
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
  // Items render in the group's declared kinds order so toggle chips at the
  // top map to contiguous, matching blocks in the section
  const result: KnowledgeItemSummary[] = [];
  for (const kind of kinds) {
    if (hiddenKinds.has(kind)) continue;
    const collectionEntry = knowledgeKindRegistry.find((entry) => entry.kind === kind);
    if (!collectionEntry) continue;
    const kindItems: KnowledgeItemSummary[] = [];
    for (const item of entityState[collectionEntry.collectionKey]) {
      const summary = itemsByKey.get(`${kind}:${item.id}`);
      if (summary) kindItems.push(summary);
    }
    kindItems.sort((a, b) => a.id - b.id);
    result.push(...kindItems);
  }
  return result;
}

interface PopulatedKind {
  entry: (typeof knowledgeKindRegistry)[number];
  count: number;
}

function getPopulatedKinds(entityState: EntitiesData): PopulatedKind[] {
  return knowledgeKindRegistry
    .map((entry) => ({ entry, count: entityState[entry.collectionKey].length }))
    .filter(({ count }) => count > 0);
}

function KindFilterToggler({
  populatedKinds,
  hiddenKinds,
  onNavigate,
  onToggle,
  onShowAll,
}: {
  populatedKinds: PopulatedKind[];
  hiddenKinds: ReadonlySet<KnowledgeKind>;
  onNavigate: (kind: KnowledgeKind) => void;
  onToggle: (kind: KnowledgeKind) => void;
  onShowAll: () => void;
}) {
  if (populatedKinds.length === 0) return null;

  return (
    <div data-graph-kind-filter className="flex flex-wrap items-center gap-1.5">
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
      {hiddenKinds.size > 0 && (
        <button
          type="button"
          data-graph-kind-show-all
          onClick={onShowAll}
          aria-label="Show all kinds"
          className="ml-1 cursor-pointer rounded px-2 py-0.5 text-xs text-sub outline-none hover:bg-wash hover:text-ink focus-visible:ring-2 focus-visible:ring-foreground/30"
        >
          Show all
        </button>
      )}
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

const relationTypeLabel: Record<EdgeRelation, string> = {
  depends_on: 'Depends on',
  derived_from: 'Derived from',
  constrains: 'Constrains',
  verifies: 'Verifies',
  refines: 'Refines',
};

function DirectionalChipRow({
  direction,
  edges,
}: {
  direction: 'outgoing' | 'incoming';
  edges: DirectedEdge[];
}) {
  const [expanded, setExpanded] = useState(false);
  const overflowCount = edges.length - CHIP_TRUNCATE_LIMIT;
  const showMoreButton = !expanded && overflowCount > 0;
  const visibleEdges = expanded ? edges : edges.slice(0, CHIP_TRUNCATE_LIMIT);
  const DirectionIcon = direction === 'outgoing' ? ArrowUpRight : ArrowDownLeft;
  const directionLabel = direction === 'outgoing' ? 'Outgoing' : 'Incoming';

  return (
    <div className="flex items-start gap-2">
      <DirectionIcon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-hint" />
      <span className="sr-only">{directionLabel}</span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
        {visibleEdges.map((edge) => (
          <RelationChip key={`${direction}-${edge.other.kind}-${edge.other.id}`} target={edge.other} />
        ))}
        {showMoreButton && (
          <Badge variant="secondary" asChild>
            <button type="button" onClick={() => setExpanded(true)} className="cursor-pointer">
              +{overflowCount} more
            </button>
          </Badge>
        )}
      </div>
    </div>
  );
}

function RelationTypeSubsection({
  type,
  direction,
  edges,
}: {
  type: EdgeRelation;
  direction: 'outgoing' | 'incoming';
  edges: DirectedEdge[];
}) {
  const [expanded, setExpanded] = useState(false);
  const overflowCount = edges.length - CHIP_TRUNCATE_LIMIT;
  const showMoreButton = !expanded && overflowCount > 0;
  const visibleEdges = expanded ? edges : edges.slice(0, CHIP_TRUNCATE_LIMIT);
  const DirectionIcon = direction === 'outgoing' ? ArrowUpRight : ArrowDownLeft;

  return (
    <Collapsible defaultOpen className="flex flex-col">
      <div className="flex w-full items-center justify-between gap-2 px-3 py-2 text-xs text-sub">
        <span className="flex items-center gap-1.5">
          <DirectionIcon className="size-3.5 shrink-0 text-hint" />
          <span className="font-medium">{relationTypeLabel[type]}</span>
          <span className="font-mono text-hint">({edges.length})</span>
        </span>
        <CollapsibleTrigger
          data-graph-relations-subsection={`${direction}-${type}`}
          aria-label={`Toggle ${direction} ${relationTypeLabel[type]} relations`}
          className="group flex size-6 shrink-0 items-center justify-center rounded text-hint outline-none hover:bg-wash hover:text-ink focus-visible:ring-2 focus-visible:ring-foreground/30"
        >
          <ChevronRight className="size-3.5 transition-transform group-data-[state=open]:rotate-90" />
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="flex flex-col gap-1.5 px-3 pb-3">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {visibleEdges.map((edge) => (
            <RelationChip key={`${type}-${edge.other.kind}-${edge.other.id}`} target={edge.other} />
          ))}
          {showMoreButton && (
            <Badge variant="secondary" asChild>
              <button type="button" onClick={() => setExpanded(true)} className="cursor-pointer">
                +{overflowCount} more
              </button>
            </Badge>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function DependsOnSubsection({ outgoing, incoming }: { outgoing: DirectedEdge[]; incoming: DirectedEdge[] }) {
  const totalCount = outgoing.length + incoming.length;

  return (
    <Collapsible defaultOpen className="flex flex-col">
      <div className="flex w-full items-center justify-between gap-2 px-3 py-2 text-xs text-sub">
        <span className="flex items-center gap-1.5">
          <span className="font-medium">{relationTypeLabel.depends_on}</span>
          <span className="font-mono text-hint">({totalCount})</span>
        </span>
        <CollapsibleTrigger
          data-graph-relations-subsection="depends_on"
          aria-label="Toggle Depends on relations"
          className="group flex size-6 shrink-0 items-center justify-center rounded text-hint outline-none hover:bg-wash hover:text-ink focus-visible:ring-2 focus-visible:ring-foreground/30"
        >
          <ChevronRight className="size-3.5 transition-transform group-data-[state=open]:rotate-90" />
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="flex flex-col gap-2 px-3 pb-3">
        {outgoing.length > 0 && <DirectionalChipRow direction="outgoing" edges={outgoing} />}
        {incoming.length > 0 && <DirectionalChipRow direction="incoming" edges={incoming} />}
      </CollapsibleContent>
    </Collapsible>
  );
}

const TYPED_RELATION_ORDER: readonly EdgeRelation[] = ['derived_from', 'refines', 'constrains', 'verifies'];

function renderTypedRelationSubsections(outgoing: DirectedEdge[], incoming: DirectedEdge[]): ReactNode[] {
  if (outgoing.length === 0 && incoming.length === 0) return [];
  const outgoingByType = groupEdgesByType(outgoing);
  const incomingByType = groupEdgesByType(incoming);
  const sections: ReactNode[] = [];
  for (const type of TYPED_RELATION_ORDER) {
    for (const direction of ['outgoing', 'incoming'] as const) {
      const typeEdges = (direction === 'outgoing' ? outgoingByType : incomingByType).get(type);
      if (!typeEdges || typeEdges.length === 0) continue;
      sections.push(
        <RelationTypeSubsection
          key={`${direction}-${type}`}
          type={type}
          direction={direction}
          edges={typeEdges}
        />,
      );
    }
  }
  return sections;
}

function partitionDependsOn(edges: DirectedEdge[]): {
  dependsOn: DirectedEdge[];
  others: DirectedEdge[];
} {
  const dependsOn: DirectedEdge[] = [];
  const others: DirectedEdge[] = [];
  for (const edge of edges) {
    if (edge.type === 'depends_on') dependsOn.push(edge);
    else others.push(edge);
  }
  return { dependsOn, others };
}

function ItemDetailsFooter({
  rationale,
  outgoing,
  incoming,
}: {
  rationale: string | null;
  outgoing: DirectedEdge[];
  incoming: DirectedEdge[];
}) {
  const hasRelations = outgoing.length > 0 || incoming.length > 0;
  const hasRationale = Boolean(rationale);
  if (!hasRationale && !hasRelations) return null;

  const outgoingSplit = partitionDependsOn(outgoing);
  const incomingSplit = partitionDependsOn(incoming);
  const hasDependsOn = outgoingSplit.dependsOn.length > 0 || incomingSplit.dependsOn.length > 0;

  return (
    <div className="border-t border-rule bg-tint">
      {hasRationale && (
        <div className="px-3 py-2.5">
          <p className="text-xs leading-relaxed text-sub">{rationale}</p>
        </div>
      )}
      {hasRationale && hasRelations && <div className="border-t border-rule" />}
      {hasDependsOn && (
        <DependsOnSubsection outgoing={outgoingSplit.dependsOn} incoming={incomingSplit.dependsOn} />
      )}
      {renderTypedRelationSubsections(outgoingSplit.others, incomingSplit.others)}
    </div>
  );
}

function EmptyStateCard({
  state,
  title,
  description,
  action,
}: {
  state: 'no-items' | 'all-kinds-hidden';
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div
      data-graph-empty-state={state}
      className="flex flex-col items-center gap-3 rounded-md border border-rule bg-tint p-8 text-center"
    >
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="max-w-md text-xs text-sub">{description}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

function ItemActionRail() {
  return (
    <div
      data-graph-action-rail
      className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-focus-within/row:opacity-100 group-hover/row:opacity-100"
    >
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
  defaultOpen = true,
  kindAnchor = null,
}: {
  item: KnowledgeItemSummary;
  outgoing: DirectedEdge[];
  incoming: DirectedEdge[];
  anchored: boolean;
  defaultOpen?: boolean;
  kindAnchor: KnowledgeKind | null;
}) {
  const hasExpansion = Boolean(item.rationale) || outgoing.length > 0 || incoming.length > 0;

  return (
    <Collapsible defaultOpen={defaultOpen} asChild>
      <div
        data-graph-row
        data-graph-row-ref={item.referenceCode}
        data-graph-kind-anchor={kindAnchor ?? undefined}
        data-graph-row-anchored={anchored ? 'true' : undefined}
        className={`group/row overflow-hidden rounded-xl border bg-background shadow-[var(--shadow-card)] transition-all duration-700 ${anchored ? `animate-in border-current/50 ring-2 ring-current/30 duration-300 fade-in ${kindTextColor[item.kind]}` : 'border-rule'}`}
      >
        <div className="flex items-baseline justify-between gap-2 p-3">
          <div className="flex items-baseline gap-2">
            <span
              data-graph-row-reference
              className={`inline-flex shrink-0 items-center rounded px-1.5 py-0.5 font-mono text-xs font-medium ${kindColor[item.kind]}`}
            >
              {item.referenceCode}
            </span>
            <p className="text-sm text-ink">{item.content}</p>
          </div>
          <div className="flex items-center gap-1">
            <ItemActionRail />
            {hasExpansion && (
              <CollapsibleTrigger
                data-graph-row-toggle
                aria-label="Toggle item details"
                className="group flex size-6 shrink-0 items-center justify-center rounded text-hint outline-none hover:bg-wash hover:text-ink focus-visible:ring-2 focus-visible:ring-foreground/30"
              >
                <ChevronRight className="size-3.5 transition-transform group-data-[state=open]:rotate-90" />
              </CollapsibleTrigger>
            )}
          </div>
        </div>
        <CollapsibleContent>
          <ItemDetailsFooter rationale={item.rationale} outgoing={outgoing} incoming={incoming} />
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export function StructuredListView({
  entityState,
  emptyStateAction,
  header,
  rowsDefaultOpen = true,
  rowsRemountKey = 0,
}: {
  entityState: EntitiesData;
  emptyStateAction?: ReactNode;
  header?: ReactNode;
  rowsDefaultOpen?: boolean;
  rowsRemountKey?: number;
}) {
  const { itemsByKey, outgoingByItem, incomingByItem } = projectGraph(entityState);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { anchoredRowRef } = useGraphHashAnchor(scrollAreaRef);
  const [hiddenKinds, setHiddenKinds] = useState<ReadonlySet<KnowledgeKind>>(new Set());
  const navigate = useNavigate();

  const toggleKind = (kind: KnowledgeKind) => {
    setHiddenKinds((current) => {
      const next = new Set(current);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  };

  const onChipActivate = useCallback(
    (target: RelationChipTarget) => {
      // Force the unhide to commit before navigate updates the hash, so the
      // target row is mounted by the time useGraphHashAnchor's effect fires.
      // Without flushSync, the two state updates can land in different renders
      // (router state vs. component state) and the anchor effect — keyed only
      // off targetRef — won't re-run once the row eventually appears.
      flushSync(() => {
        setHiddenKinds((current) => {
          if (!current.has(target.kind)) return current;
          const next = new Set(current);
          next.delete(target.kind);
          return next;
        });
      });
      void navigate({ to: '.', hash: target.referenceCode });
    },
    [navigate],
  );

  const unhideAndNavigate = useCallback(
    (kind: KnowledgeKind) => {
      flushSync(() => {
        setHiddenKinds((current) => {
          if (!current.has(kind)) return current;
          const next = new Set(current);
          next.delete(kind);
          return next;
        });
      });
      void navigate({ to: '.', hash: `${KIND_HASH_PREFIX}${kind}` });
    },
    [navigate],
  );

  const populatedKinds = getPopulatedKinds(entityState);
  const totalItems = itemsByKey.size;
  const view: 'empty' | 'all-hidden' | 'list' =
    totalItems === 0
      ? 'empty'
      : populatedKinds.every(({ entry }) => hiddenKinds.has(entry.kind))
        ? 'all-hidden'
        : 'list';

  return (
    <ChipActivateProvider value={onChipActivate}>
      <div data-graph-structured-list className="flex h-full flex-col bg-background">
        <div data-graph-header-bar className="flex h-16 shrink-0 items-center border-b border-rule px-6">
          <div className="mx-auto w-full max-w-3xl">{header}</div>
        </div>
        {view !== 'empty' && (
          <div data-graph-filter-bar className="shrink-0 border-b border-rule bg-tint px-6 py-2">
            <div className="mx-auto w-full max-w-3xl">
              <KindFilterToggler
                populatedKinds={populatedKinds}
                hiddenKinds={hiddenKinds}
                onNavigate={unhideAndNavigate}
                onToggle={toggleKind}
                onShowAll={() => setHiddenKinds(new Set())}
              />
            </div>
          </div>
        )}
        <div ref={scrollAreaRef} className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 pt-6 pb-8">
            {view === 'empty' && (
              <EmptyStateCard
                state="no-items"
                title="No knowledge captured yet"
                description="Knowledge appears here as the interview progresses. Start a turn to populate the graph."
                action={emptyStateAction}
              />
            )}
            {view === 'all-hidden' && (
              <EmptyStateCard
                state="all-kinds-hidden"
                title="All kinds are hidden"
                description="Show at least one kind to see your knowledge graph."
                action={
                  <Button size="sm" variant="secondary" onClick={() => setHiddenKinds(new Set())}>
                    Show all kinds
                  </Button>
                }
              />
            )}
            {view === 'list' &&
              graphDisplayGroups.map((group) => {
                const items = collectItemsForGroup(entityState, group.kinds, itemsByKey, hiddenKinds);
                if (items.length === 0) return null;
                return (
                  <Collapsible key={group.label} defaultOpen asChild>
                    <section data-graph-section={group.label}>
                      <div className="mb-2 flex w-full items-center justify-between gap-2 pr-3">
                        <h2 className="text-sm font-medium text-sub">{group.label}</h2>
                        <CollapsibleTrigger
                          aria-label={`Toggle ${group.label}`}
                          className="group flex size-6 shrink-0 items-center justify-center rounded text-hint outline-none hover:bg-wash hover:text-ink focus-visible:ring-2 focus-visible:ring-foreground/30"
                        >
                          <ChevronRight className="size-3.5 transition-transform group-data-[state=open]:rotate-90" />
                        </CollapsibleTrigger>
                      </div>
                      <CollapsibleContent>
                        <div className="flex flex-col gap-2">
                          {(() => {
                            let previousKind: KnowledgeKind | null = null;
                            return items.map((item) => {
                              const itemKey = `${item.kind}:${item.id}`;
                              const isFirstOfKind = previousKind !== item.kind;
                              previousKind = item.kind;
                              return (
                                <ItemRow
                                  key={`${itemKey}-v${rowsRemountKey}`}
                                  item={item}
                                  outgoing={outgoingByItem.get(itemKey) ?? []}
                                  incoming={incomingByItem.get(itemKey) ?? []}
                                  anchored={anchoredRowRef === item.referenceCode}
                                  defaultOpen={rowsDefaultOpen}
                                  kindAnchor={isFirstOfKind ? item.kind : null}
                                />
                              );
                            });
                          })()}
                        </div>
                      </CollapsibleContent>
                    </section>
                  </Collapsible>
                );
              })}
          </div>
        </div>
      </div>
    </ChipActivateProvider>
  );
}
