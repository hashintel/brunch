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
  const lines = [
    '[Selected-spec node context]',
    `- anchor: [#${result.anchor.id}] ${result.anchor.plane}/${result.anchor.kind}: ${result.anchor.title}`,
  ];

  if (result.anchor.body) {
    lines.push(`- anchor body: ${truncate(result.anchor.body, 180)}`);
  }

  if (result.neighbors.length === 0) {
    lines.push('- neighbors: none within requested hops');
  } else {
    lines.push('- neighbors:');
    for (const neighbor of result.neighbors.slice(0, maxNeighbors)) {
      lines.push(`  - [#${neighbor.id}] ${neighbor.plane}/${neighbor.kind}: ${neighbor.title}`);
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
      lines.push(
        `  - #${edge.id}: #${edge.sourceId} -[${edge.category}${stance}]-> #${edge.targetId}${rationale}`,
      );
    }
    if (result.edges.length > maxEdges) {
      lines.push(`  - …${result.edges.length - maxEdges} more edge(s) omitted`);
    }
  }

  return lines.join('\n');
}

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}…`;
}
