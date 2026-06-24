/**
 * Formats selected-spec GraphSlice reads into model-facing text.
 */

import type { EdgeEndpoint } from '../../graph/policy/category-policy.js';
import { edgeImpact } from '../../graph/projection/direction.js';
import { edgeLabel } from '../../graph/projection/labels.js';
import type { GraphSlice } from '../../graph/queries.js';
import { NODE_KINDS, NODE_PLANES } from '../../graph/schema/kinds.js';
import {
  NODE_KIND_METADATA,
  bandsForKind,
  formatGraphNodeCode,
  type NodeKind,
  type ReadinessBand,
} from '../../graph/schema/nodes.js';
import { markdownTable, joinMarkdownBlocks } from '../markdown.js';

/**
 * The full, uncapped graph overview — node codes/planes/kinds/titles plus the
 * edge list — the canonical agent-facing render shared by the `read_graph`
 * tool and the context-seed payload (D78-L revised 2026-06-12: the seed
 * carries this render so the opening turn needs no read tool call; never
 * truncated — conciseness for large graphs is a future "ultra compact"
 * variant of this renderer, not a payload cut).
 */
export interface GraphOverviewRenderContext {
  readonly requestedReadinessBands?: readonly ReadinessBand[];
}

type RenderBand = ReadinessBand | 'unbanded';

export function formatGraphOverview(
  overview: Pick<GraphSlice, 'nodes' | 'edges' | 'lsn'>,
  heading = 'Graph overview',
  context: GraphOverviewRenderContext = {},
): string {
  if (overview.nodes.length === 0 && overview.edges.length === 0) {
    return `${heading} (LSN ${overview.lsn}): empty (no nodes or edges).`;
  }

  const header = `${heading} (LSN ${overview.lsn}): ${overview.nodes.length} nodes, ${overview.edges.length} edges`;
  const nodesById = new Map(overview.nodes.map((node) => [node.id, node]));

  return joinMarkdownBlocks(
    header,
    formatLegend(overview.nodes.map((node) => node.kind)),
    ...formatNodeSections(overview.nodes, context),
    formatEdgeTable(overview.edges, nodesById),
  );
}

const BAND_ORDER: readonly RenderBand[] = [
  'grounding',
  'elicitation',
  'projection',
  'commitment',
  'unbanded',
];

function formatLegend(kinds: readonly NodeKind[]): string {
  const present = new Set(kinds);
  const entries = NODE_KINDS.filter((kind) => present.has(kind)).map(
    (kind) => `${NODE_KIND_METADATA[kind].label}=${kind}`,
  );
  return entries.length > 0 ? `legend: ${entries.join(', ')}` : '';
}

function formatNodeSections(
  nodes: readonly GraphSlice['nodes'][number][],
  context: GraphOverviewRenderContext,
): string[] {
  const sections: string[] = [];
  const bandOrder: readonly RenderBand[] = context.requestedReadinessBands ?? BAND_ORDER;
  const nodeGroups = new Map<string, typeof nodes>();
  for (const node of nodes) {
    const band = bandForRender(node.kind, context.requestedReadinessBands);
    const key = `${node.plane}\u0000${band}`;
    nodeGroups.set(key, [...(nodeGroups.get(key) ?? []), node]);
  }

  for (const plane of NODE_PLANES) {
    for (const band of bandOrder) {
      const sectionNodes = nodeGroups.get(`${plane}\u0000${band}`);
      if (!sectionNodes || sectionNodes.length === 0) continue;
      const sortedNodes = [...sectionNodes].sort(compareNodes);
      sections.push(
        [
          `nodes — ${plane} · ${band} (${sortedNodes.length})`,
          markdownTable([
            ['code', 'id', 'title'],
            ...sortedNodes.map((node) => [
              formatGraphNodeCode(node.kind, node.kindOrdinal),
              node.id,
              node.title,
            ]),
          ]),
        ].join('\n'),
      );
    }
  }

  return sections;
}

function bandForRender(
  kind: NodeKind,
  requestedReadinessBands: readonly ReadinessBand[] | undefined,
): RenderBand {
  if (requestedReadinessBands) {
    const kindBands = bandsForKind(kind);
    const band = requestedReadinessBands.find((candidate) => kindBands.includes(candidate));
    if (!band) {
      throw new Error(
        `Node kind ${kind} does not belong to requested readiness bands: ${requestedReadinessBands.join(', ')}`,
      );
    }
    return band;
  }
  return bandsForKind(kind)[0] ?? 'unbanded';
}

function compareNodes(a: GraphSlice['nodes'][number], b: GraphSlice['nodes'][number]): number {
  return (
    NODE_KINDS.indexOf(a.kind) - NODE_KINDS.indexOf(b.kind) || a.kindOrdinal - b.kindOrdinal || a.id - b.id
  );
}

function formatEdgeTable(
  edges: readonly GraphSlice['edges'][number][],
  nodesById: ReadonlyMap<number, GraphSlice['nodes'][number]>,
): string | undefined {
  if (edges.length === 0) return undefined;
  const rows = [...edges].map((edge) => edgeRow(edge, nodesById)).sort(compareEdgeRows);
  return [
    'edges (sorted by upstream)',
    markdownTable([
      ['id', 'upstream', 'relation', 'downstream'],
      ...rows.map((row) => [row.id, row.upstream, row.relation, row.downstream]),
    ]),
  ].join('\n');
}

interface RenderedEdgeRow {
  readonly id: number;
  readonly upstream: string;
  readonly relation: string;
  readonly downstream: string;
}

function edgeRow(
  edge: GraphSlice['edges'][number],
  nodesById: ReadonlyMap<number, GraphSlice['nodes'][number]>,
): RenderedEdgeRow {
  const impact = edgeImpact(edge.category);
  const source = nodesById.get(edge.sourceId);
  const target = nodesById.get(edge.targetId);
  const sourceCode = source ? formatGraphNodeCode(source.kind, source.kindOrdinal) : `#${edge.sourceId}`;
  const targetCode = target ? formatGraphNodeCode(target.kind, target.kindOrdinal) : `#${edge.targetId}`;

  if (impact.downstreamEndpoint === 'none') {
    return {
      id: edge.id,
      upstream: sourceCode,
      relation: edgeLabel({
        category: edge.category,
        anchorRole: 'source',
        stance: edge.stance,
        sourceKind: source?.kind,
        targetKind: target?.kind,
      }),
      downstream: targetCode,
    };
  }

  const upstreamEndpoint: EdgeEndpoint = impact.downstreamEndpoint === 'target' ? 'source' : 'target';
  return {
    id: edge.id,
    upstream: upstreamEndpoint === 'source' ? sourceCode : targetCode,
    relation: edgeLabel({
      category: edge.category,
      anchorRole: upstreamEndpoint,
      stance: edge.stance,
      sourceKind: source?.kind,
      targetKind: target?.kind,
    }),
    downstream: impact.downstreamEndpoint === 'source' ? sourceCode : targetCode,
  };
}

function compareEdgeRows(a: RenderedEdgeRow, b: RenderedEdgeRow): number {
  return a.upstream.localeCompare(b.upstream, 'en', { numeric: true }) || a.id - b.id;
}
