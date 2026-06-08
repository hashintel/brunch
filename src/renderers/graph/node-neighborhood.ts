/**
 * Formats selected-spec node neighborhoods into model-facing text.
 */

import type { GraphEdge, NodeNeighborhood } from '../../graph/index.js';
import { formatGraphNodeCode, type GraphNode } from '../../graph/schema/nodes.js';
import { markdownBullet } from '../markdown.js';

export interface RenderNodeNeighborhoodOptions {
  readonly maxNeighbors?: number;
  readonly maxEdges?: number;
}

const DEFAULT_MAX_NEIGHBORS = 6;
const DEFAULT_MAX_EDGES = 8;

export function formatNeighborhood(
  result: NodeNeighborhood,
  options: RenderNodeNeighborhoodOptions = {},
): string {
  if (result.status === 'not_found') {
    return '[Selected-spec node context]\n- node: not found in selected spec';
  }

  const maxNeighbors = options.maxNeighbors ?? DEFAULT_MAX_NEIGHBORS;
  const maxEdges = options.maxEdges ?? DEFAULT_MAX_EDGES;
  const nodesById = new Map([
    [result.node.id, result.node],
    ...result.related.map((node) => [node.id, node] as const),
  ]);
  const lines = [
    '[Selected-spec node context]',
    markdownBullet(
      `anchor: [${formatGraphNodeCode(result.node.kind, result.node.kindOrdinal)}] ${result.node.plane}/${result.node.kind}: ${result.node.title}`,
    ),
  ];

  if (result.node.body) {
    lines.push(markdownBullet(`anchor body: ${truncate(result.node.body, 180)}`));
  }

  const related = result.related.slice(0, maxNeighbors);
  if (related.length === 0) {
    lines.push(markdownBullet('neighbors: none within requested hops'));
  } else {
    lines.push(markdownBullet('neighbors:'));
    for (const neighbor of related) {
      lines.push(`  ${markdownBullet(formatNode(neighbor))}`);
    }
    const omitted = result.related.length - related.length;
    if (omitted > 0) {
      lines.push(`  ${markdownBullet(`…${omitted} more neighbor(s) omitted`)}`);
    }
  }

  const edges = result.edges.slice(0, maxEdges);
  if (edges.length === 0) {
    lines.push(markdownBullet('edges: none'));
  } else {
    lines.push(markdownBullet('edges:'));
    for (const edge of edges) {
      lines.push(`  ${markdownBullet(formatEdge(edge, nodesById))}`);
    }
    const omitted = result.edges.length - edges.length;
    if (omitted > 0) {
      lines.push(`  ${markdownBullet(`…${omitted} more edge(s) omitted`)}`);
    }
  }

  return lines.join('\n');
}

function formatNode(node: GraphNode): string {
  return `[${formatGraphNodeCode(node.kind, node.kindOrdinal)}] ${node.plane}/${node.kind}: ${node.title}`;
}

function formatEdge(
  edge: GraphEdge,
  nodesById: ReadonlyMap<number, Pick<GraphNode, 'kind' | 'kindOrdinal'>>,
) {
  const stance = edge.stance ? `/${edge.stance}` : '';
  const rationale = edge.rationale ? ` — ${truncate(edge.rationale, 100)}` : '';
  return `${formatEdgeEndpoint(edge.sourceId, nodesById.get(edge.sourceId))} -[${edge.category}${stance}]-> ${formatEdgeEndpoint(edge.targetId, nodesById.get(edge.targetId))}${rationale}`;
}

function formatEdgeEndpoint(id: number, node: Pick<GraphNode, 'kind' | 'kindOrdinal'> | undefined): string {
  return node ? formatGraphNodeCode(node.kind, node.kindOrdinal) : `#${id}`;
}

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}…`;
}
