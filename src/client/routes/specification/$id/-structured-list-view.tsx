import { knowledgeDisplayGroups } from '@/client/components/knowledge-display.js';
import type { EdgeRelation, EntitiesData } from '@/shared/api-types.js';
import { knowledgeKindRegistry, type KnowledgeKind } from '@/shared/knowledge.js';

import { RelationChip, type RelationChipTarget } from './-relation-chip.js';

type KnowledgeItemSummary = RelationChipTarget;

interface DirectedEdge {
  type: EdgeRelation;
  other: KnowledgeItemSummary | undefined;
}

function compareReferenceCode(a: string, b: string): number {
  const aMatch = a.match(/^([A-Z]+)(\d+)$/);
  const bMatch = b.match(/^([A-Z]+)(\d+)$/);
  if (!aMatch || !bMatch) return a.localeCompare(b);
  const prefixCmp = aMatch[1].localeCompare(bMatch[1]);
  if (prefixCmp !== 0) return prefixCmp;
  return Number.parseInt(aMatch[2], 10) - Number.parseInt(bMatch[2], 10);
}

function buildItemIndex(entityState: EntitiesData): Map<string, KnowledgeItemSummary> {
  const map = new Map<string, KnowledgeItemSummary>();

  for (const entry of knowledgeKindRegistry) {
    for (const item of entityState[entry.collectionKey]) {
      const referenceCode = item.referenceCode ?? `${entry.referenceCodePrefix}${item.id}`;
      map.set(`${entry.kind}:${item.id}`, {
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
    const source = map.get(`${rel.source.kind}:${rel.source.id}`);
    if (source) source.outgoingCount += 1;
    const target = map.get(`${rel.target.kind}:${rel.target.id}`);
    if (target) target.incomingCount += 1;
  }

  return map;
}

function collectItemsForGroup(
  entityState: EntitiesData,
  kinds: readonly KnowledgeKind[],
  itemIndex: Map<string, KnowledgeItemSummary>,
): KnowledgeItemSummary[] {
  const result: KnowledgeItemSummary[] = [];
  for (const kind of kinds) {
    const collectionEntry = knowledgeKindRegistry.find((entry) => entry.kind === kind);
    if (!collectionEntry) continue;
    for (const item of entityState[collectionEntry.collectionKey]) {
      const summary = itemIndex.get(`${kind}:${item.id}`);
      if (summary) result.push(summary);
    }
  }
  return result;
}

function getEdgesForItem(
  entityState: EntitiesData,
  itemIndex: Map<string, KnowledgeItemSummary>,
  item: KnowledgeItemSummary,
): { outgoing: DirectedEdge[]; incoming: DirectedEdge[] } {
  const outgoing: DirectedEdge[] = [];
  const incoming: DirectedEdge[] = [];
  for (const rel of entityState.relationships) {
    if (rel.source.kind === item.kind && rel.source.id === item.id) {
      outgoing.push({
        type: rel.type,
        other: itemIndex.get(`${rel.target.kind}:${rel.target.id}`),
      });
    }
    if (rel.target.kind === item.kind && rel.target.id === item.id) {
      incoming.push({
        type: rel.type,
        other: itemIndex.get(`${rel.source.kind}:${rel.source.id}`),
      });
    }
  }
  return { outgoing, incoming };
}

function groupEdgesByType(edges: DirectedEdge[]): Map<EdgeRelation, DirectedEdge[]> {
  const groups = new Map<EdgeRelation, DirectedEdge[]>();
  for (const edge of edges) {
    const bucket = groups.get(edge.type);
    if (bucket) {
      bucket.push(edge);
    } else {
      groups.set(edge.type, [edge]);
    }
  }
  return groups;
}

function RelationsSubsection({ label, edges }: { label: string; edges: DirectedEdge[] }) {
  if (edges.length === 0) return null;

  const grouped = groupEdgesByType(edges);

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xxs font-medium tracking-wide text-hint uppercase">{label}</span>
      <div className="flex flex-col gap-1">
        {Array.from(grouped.entries()).map(([type, typeEdges]) => (
          <div key={type} className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-sub">{type}</span>
            {typeEdges.map((edge, index) =>
              edge.other ? (
                <RelationChip key={`${type}-${edge.other.kind}-${edge.other.id}`} target={edge.other} />
              ) : (
                <span
                  key={`${type}-missing-${index}`}
                  data-testid="relation-chip-missing"
                  className="text-xs text-hint italic"
                >
                  (missing)
                </span>
              ),
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function RelationsFooter({ outgoing, incoming }: { outgoing: DirectedEdge[]; incoming: DirectedEdge[] }) {
  if (outgoing.length === 0 && incoming.length === 0) return null;

  return (
    <div className="mt-2 flex flex-col gap-2 border-t border-rule pt-2">
      <RelationsSubsection label="Outgoing" edges={outgoing} />
      <RelationsSubsection label="Incoming" edges={incoming} />
    </div>
  );
}

function ItemRow({
  item,
  outgoing,
  incoming,
}: {
  item: KnowledgeItemSummary;
  outgoing: DirectedEdge[];
  incoming: DirectedEdge[];
}) {
  return (
    <div
      data-graph-row
      data-graph-row-ref={item.referenceCode}
      className="rounded-md border border-rule bg-background p-3"
    >
      <div className="flex items-baseline gap-2">
        <span data-graph-row-reference className="shrink-0 font-mono text-xs text-hint">
          {item.referenceCode}
        </span>
        <p className="text-sm text-ink">{item.content}</p>
      </div>
      {item.rationale && <p className="mt-1 text-xs text-sub">{item.rationale}</p>}
      <RelationsFooter outgoing={outgoing} incoming={incoming} />
    </div>
  );
}

export function StructuredListView({ entityState }: { entityState: EntitiesData }) {
  const itemIndex = buildItemIndex(entityState);

  return (
    <div data-graph-structured-list className="flex h-full flex-col overflow-y-auto bg-background">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
        {knowledgeDisplayGroups.map((group) => {
          const items = collectItemsForGroup(entityState, group.kinds, itemIndex).sort((a, b) =>
            compareReferenceCode(a.referenceCode, b.referenceCode),
          );
          if (items.length === 0) return null;
          return (
            <section key={group.label} data-graph-section={group.label}>
              <h2 className="mb-2 text-sm font-medium text-sub">{group.label}</h2>
              <div className="flex flex-col gap-2">
                {items.map((item) => {
                  const { outgoing, incoming } = getEdgesForItem(entityState, itemIndex, item);
                  return (
                    <ItemRow
                      key={`${item.kind}:${item.id}`}
                      item={item}
                      outgoing={outgoing}
                      incoming={incoming}
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
