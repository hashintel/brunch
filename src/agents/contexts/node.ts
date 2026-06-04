import { formatGraphNodeCode, type GraphNode } from '../../graph/schema/nodes.js';
import type { NeighborhoodResult } from '../../graph/snapshot.js';

export interface RenderNodeContextOptions {
  readonly maxNeighbors?: number;
  readonly maxEdges?: number;
}

const DEFAULT_MAX_NEIGHBORS = 6;
const DEFAULT_MAX_EDGES = 8;

export function renderNodeContext(
  result: NeighborhoodResult,
  options: RenderNodeContextOptions = {},
): string {
  if (result.status === 'not_found') {
    return '[Selected-spec node context]\n- node: not found in selected spec';
  }

  const maxNeighbors = options.maxNeighbors ?? DEFAULT_MAX_NEIGHBORS;
  const maxEdges = options.maxEdges ?? DEFAULT_MAX_EDGES;
  const nodesById = new Map([
    [result.anchor.id, result.anchor],
    ...result.neighbors.map((node) => [node.id, node] as const),
  ]);
  const lines = [
    '[Selected-spec node context]',
    `- anchor: [${formatGraphNodeCode(result.anchor.kind, result.anchor.kindOrdinal)}] ${result.anchor.plane}/${result.anchor.kind}: ${result.anchor.title}`,
  ];

  if (result.anchor.body) {
    lines.push(`- anchor body: ${truncate(result.anchor.body, 180)}`);
  }

  if (result.neighbors.length === 0) {
    lines.push('- neighbors: none within requested hops');
  } else {
    lines.push('- neighbors:');
    for (const neighbor of result.neighbors.slice(0, maxNeighbors)) {
      lines.push(
        `  - [${formatGraphNodeCode(neighbor.kind, neighbor.kindOrdinal)}] ${neighbor.plane}/${neighbor.kind}: ${neighbor.title}`,
      );
    }
    if (result.neighbors.length > maxNeighbors) {
      lines.push(`  - …${result.neighbors.length - maxNeighbors} more neighbor(s) omitted`);
    }
  }

  if (result.edges.length === 0) {
    lines.push('- edges: none');
  } else {
    lines.push('- edges:');
    for (const edge of result.edges.slice(0, maxEdges)) {
      const stance = edge.stance ? `/${edge.stance}` : '';
      const rationale = edge.rationale ? ` — ${truncate(edge.rationale, 100)}` : '';
      const source = nodesById.get(edge.sourceId);
      const target = nodesById.get(edge.targetId);
      lines.push(
        `  - #${edge.id}: ${formatEdgeEndpoint(edge.sourceId, source)} -[${edge.category}${stance}]-> ${formatEdgeEndpoint(edge.targetId, target)}${rationale}`,
      );
    }
    if (result.edges.length > maxEdges) {
      lines.push(`  - …${result.edges.length - maxEdges} more edge(s) omitted`);
    }
  }

  return lines.join('\n');
}

function formatEdgeEndpoint(id: number, node: GraphNode | undefined): string {
  return node ? formatGraphNodeCode(node.kind, node.kindOrdinal) : `#${id}`;
}
function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}…`;
}
