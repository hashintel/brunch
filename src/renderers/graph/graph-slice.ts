/**
 * Formats selected-spec GraphSlice reads into model-facing text.
 */

import type { GraphEdge, GraphSlice } from '../../graph/index.js';
import { formatGraphNodeCode, type GraphNode } from '../../graph/schema/nodes.js';
import { markdownBullet } from '../markdown.js';

type RenderGraphSliceVariant = 'compact-summary' | 'grouped-list' | 'full-debug';

export interface RenderGraphSliceOptions {
  readonly heading?: string;
  readonly variant?: RenderGraphSliceVariant;
  readonly maxNodes?: number;
  readonly maxNodesPerGroup?: number;
  readonly maxEdges?: number;
  readonly maxTitleLength?: number;
}

const DEFAULT_MAX_NODES = 8;
const DEFAULT_MAX_NODES_PER_GROUP = 3;
const DEFAULT_MAX_EDGES = 12;
const DEFAULT_MAX_TITLE_LENGTH = 96;

/**
 * The full, uncapped graph overview — node codes/planes/kinds/titles plus the
 * edge list — the canonical agent-facing render shared by the `read_graph`
 * tool and the context-seed payload (D78-L revised 2026-06-12: the seed
 * carries this render so the opening turn needs no read tool call; never
 * truncated — conciseness for large graphs is a future "ultra compact"
 * variant of this renderer, not a payload cut).
 */
export function formatGraphOverview(
  overview: Pick<GraphSlice, 'nodes' | 'edges' | 'lsn'>,
  heading = 'Graph overview',
): string {
  if (overview.nodes.length === 0) {
    return `${heading}: empty (no nodes or edges).`;
  }

  const lines: string[] = [
    `${heading} (LSN ${overview.lsn}): ${overview.nodes.length} node(s), ${overview.edges.length} edge(s).`,
    '',
  ];
  const nodesById = new Map(overview.nodes.map((node) => [node.id, node]));

  for (const node of overview.nodes) {
    const detail = node.detail ? ` [has detail]` : '';
    lines.push(
      `- [${formatGraphNodeCode(node.kind, node.kindOrdinal)}] ${node.plane}/${node.kind}: "${node.title}"${detail}`,
    );
  }

  if (overview.edges.length > 0) {
    lines.push('');
    for (const edge of overview.edges) {
      const stance = edge.stance ? ` (${edge.stance})` : '';
      const source = nodesById.get(edge.sourceId);
      const target = nodesById.get(edge.targetId);
      const sourceCode = source ? formatGraphNodeCode(source.kind, source.kindOrdinal) : `#${edge.sourceId}`;
      const targetCode = target ? formatGraphNodeCode(target.kind, target.kindOrdinal) : `#${edge.targetId}`;
      lines.push(`- Edge #${edge.id}: ${sourceCode} —[${edge.category}${stance}]→ ${targetCode}`);
    }
  }

  return lines.join('\n');
}

export function formatGraphSlice(slice: GraphSlice, options: RenderGraphSliceOptions = {}): string {
  const variant = options.variant ?? 'compact-summary';
  if (variant === 'grouped-list') return formatGroupedList(slice, options);
  if (variant === 'full-debug') return formatFullDebug(slice, options);
  return formatCompactSummary(slice, options);
}

function formatCompactSummary(slice: GraphSlice, options: RenderGraphSliceOptions): string {
  const maxNodes = options.maxNodes ?? DEFAULT_MAX_NODES;
  const maxTitleLength = options.maxTitleLength ?? DEFAULT_MAX_TITLE_LENGTH;
  const nodeGroups = countNodesByGroup(slice.nodes);
  const edgeGroups = countEdgesByCategory(slice.edges);
  const selectedNodes = slice.nodes.slice(0, maxNodes);
  const lines = summaryHeader(slice, options.heading ?? 'Selected-spec graph summary');

  lines.push(markdownBullet('node groups:'));
  appendCounts(lines, nodeGroups);
  lines.push(markdownBullet('edge categories:'));
  appendCounts(lines, edgeGroups);
  lines.push(markdownBullet(`nodes: first ${selectedNodes.length} of ${slice.nodes.length}`));
  for (const node of selectedNodes) {
    lines.push(`  ${markdownBullet(formatNode(node, maxTitleLength))}`);
  }
  appendOmitted(lines, slice.nodes.length - selectedNodes.length, 'node(s)');

  return lines.join('\n');
}

function formatGroupedList(slice: GraphSlice, options: RenderGraphSliceOptions): string {
  const maxNodesPerGroup = options.maxNodesPerGroup ?? DEFAULT_MAX_NODES_PER_GROUP;
  const maxTitleLength = options.maxTitleLength ?? DEFAULT_MAX_TITLE_LENGTH;
  const groups = groupNodes(slice.nodes);
  const lines = summaryHeader(slice, options.heading ?? 'Selected-spec graph grouped list');

  if (groups.length === 0) {
    lines.push(markdownBullet('node groups: none'));
    return lines.join('\n');
  }

  for (const [label, nodes] of groups) {
    const selectedNodes = nodes.slice(0, maxNodesPerGroup);
    lines.push(markdownBullet(`${label} (${nodes.length}):`));
    for (const node of selectedNodes) {
      lines.push(`  ${markdownBullet(formatNode(node, maxTitleLength))}`);
    }
    appendOmitted(lines, nodes.length - selectedNodes.length, 'node(s)');
  }

  return lines.join('\n');
}

function formatFullDebug(slice: GraphSlice, options: RenderGraphSliceOptions): string {
  const maxNodes = options.maxNodes ?? DEFAULT_MAX_NODES;
  const maxEdges = options.maxEdges ?? DEFAULT_MAX_EDGES;
  const maxTitleLength = options.maxTitleLength ?? DEFAULT_MAX_TITLE_LENGTH;
  const selectedNodes = slice.nodes.slice(0, maxNodes);
  const selectedEdges = slice.edges.slice(0, maxEdges);
  const nodesById = new Map(slice.nodes.map((node) => [node.id, node] as const));
  const lines = summaryHeader(slice, options.heading ?? 'Selected-spec graph debug');

  lines.push(markdownBullet(`nodes: first ${selectedNodes.length} of ${slice.nodes.length}`));
  for (const node of selectedNodes) {
    lines.push(`  ${markdownBullet(formatNode(node, maxTitleLength))}`);
  }
  appendOmitted(lines, slice.nodes.length - selectedNodes.length, 'node(s)');

  lines.push(markdownBullet(`edges: first ${selectedEdges.length} of ${slice.edges.length}`));
  for (const edge of selectedEdges) {
    lines.push(`  ${markdownBullet(formatEdge(edge, nodesById))}`);
  }
  appendOmitted(lines, slice.edges.length - selectedEdges.length, 'edge(s)');

  return lines.join('\n');
}

function summaryHeader(slice: GraphSlice, heading: string): string[] {
  return [
    `[${heading}]`,
    markdownBullet(`lsn: ${slice.lsn}`),
    markdownBullet(`totals: ${slice.nodes.length} node(s), ${slice.edges.length} edge(s)`),
  ];
}

function countNodesByGroup(nodes: readonly GraphNode[]): readonly (readonly [string, number])[] {
  const counts = new Map<string, number>();
  for (const node of nodes) {
    const key = `${node.plane}/${node.kind}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return sortedCounts(counts);
}

function countEdgesByCategory(edges: readonly GraphEdge[]): readonly (readonly [string, number])[] {
  const counts = new Map<string, number>();
  for (const edge of edges) {
    counts.set(edge.category, (counts.get(edge.category) ?? 0) + 1);
  }
  return sortedCounts(counts);
}

function sortedCounts(counts: ReadonlyMap<string, number>): readonly (readonly [string, number])[] {
  return [...counts.entries()].sort(([left], [right]) => left.localeCompare(right));
}

function groupNodes(nodes: readonly GraphNode[]): readonly (readonly [string, readonly GraphNode[]])[] {
  const groups = new Map<string, GraphNode[]>();
  for (const node of nodes) {
    const key = `${node.plane}/${node.kind}`;
    const group = groups.get(key) ?? [];
    group.push(node);
    groups.set(key, group);
  }
  return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right));
}

function appendCounts(lines: string[], counts: readonly (readonly [string, number])[]): void {
  if (counts.length === 0) {
    lines.push(`  ${markdownBullet('none')}`);
    return;
  }
  for (const [label, count] of counts) {
    lines.push(`  ${markdownBullet(`${label}: ${count}`)}`);
  }
}

function appendOmitted(lines: string[], omitted: number, label: string): void {
  if (omitted > 0) {
    lines.push(`  ${markdownBullet(`…${omitted} more ${label} omitted`)}`);
  }
}

function formatNode(node: GraphNode, maxTitleLength: number): string {
  return `[${formatGraphNodeCode(node.kind, node.kindOrdinal)}] ${node.plane}/${node.kind}: ${truncate(node.title, maxTitleLength)}`;
}

function formatEdge(
  edge: GraphEdge,
  nodesById: ReadonlyMap<number, Pick<GraphNode, 'kind' | 'kindOrdinal'>>,
): string {
  const source = nodesById.get(edge.sourceId);
  const target = nodesById.get(edge.targetId);
  const stance = edge.stance ? `/${edge.stance}` : '';
  const rationale = edge.rationale ? ` — ${truncate(edge.rationale, 100)}` : '';
  return `${formatEndpoint(edge.sourceId, source)} -[${edge.category}${stance}]-> ${formatEndpoint(edge.targetId, target)}${rationale}`;
}

function formatEndpoint(id: number, node: Pick<GraphNode, 'kind' | 'kindOrdinal'> | undefined): string {
  return node ? formatGraphNodeCode(node.kind, node.kindOrdinal) : `#${id}`;
}

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}…`;
}
