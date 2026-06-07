/**
 * Canonical projection for selected-spec node neighborhood snapshots.
 *
 * Input:
 * - NeighborhoodResult from graph/snapshot.ts
 *
 * Output:
 * - compact typed shape for anchor, neighbors, and connecting edges
 * - omission counts, truncation policy, and not_found normalization
 *
 * Used by:
 * - renderers/graph/neighborhood.ts
 * - .pi/extensions/graph/index.ts via read_graph neighborhood results
 */

import { formatGraphNodeCode } from '../../graph/schema/nodes.js';
import type { GraphNode } from '../../graph/schema/nodes.js';
import type { NeighborhoodResult } from '../../graph/snapshot.js';

export interface ProjectNeighborhoodOptions {
  readonly maxNeighbors?: number;
  readonly maxEdges?: number;
}

export interface ProjectedNeighborhoodNotFound {
  readonly status: 'not_found';
}

export interface ProjectedNeighborhoodSuccess {
  readonly status: 'success';
  readonly anchor: {
    readonly code: string;
    readonly label: string;
    readonly body?: string;
  };
  readonly neighbors: {
    readonly items: readonly string[];
    readonly omittedCount: number;
  };
  readonly edges: {
    readonly items: readonly string[];
    readonly omittedCount: number;
  };
}

export type ProjectedNeighborhood = ProjectedNeighborhoodNotFound | ProjectedNeighborhoodSuccess;

const DEFAULT_MAX_NEIGHBORS = 6;
const DEFAULT_MAX_EDGES = 8;

export function projectNeighborhood(
  result: NeighborhoodResult,
  options: ProjectNeighborhoodOptions = {},
): ProjectedNeighborhood {
  if (result.status === 'not_found') {
    return { status: 'not_found' };
  }

  const maxNeighbors = options.maxNeighbors ?? DEFAULT_MAX_NEIGHBORS;
  const maxEdges = options.maxEdges ?? DEFAULT_MAX_EDGES;
  const nodesById = new Map([
    [result.anchor.id, result.anchor],
    ...result.neighbors.map((node) => [node.id, node] as const),
  ]);

  return {
    status: 'success',
    anchor: {
      code: formatGraphNodeCode(result.anchor.kind, result.anchor.kindOrdinal),
      label: `${result.anchor.plane}/${result.anchor.kind}: ${result.anchor.title}`,
      ...(result.anchor.body ? { body: truncate(result.anchor.body, 180) } : {}),
    },
    neighbors: {
      items: result.neighbors.slice(0, maxNeighbors).map((neighbor) => {
        const code = formatGraphNodeCode(neighbor.kind, neighbor.kindOrdinal);
        return `[${code}] ${neighbor.plane}/${neighbor.kind}: ${neighbor.title}`;
      }),
      omittedCount: Math.max(0, result.neighbors.length - maxNeighbors),
    },
    edges: {
      items: result.edges.slice(0, maxEdges).map((edge) => {
        const stance = edge.stance ? `/${edge.stance}` : '';
        const rationale = edge.rationale ? ` — ${truncate(edge.rationale, 100)}` : '';
        const source = nodesById.get(edge.sourceId);
        const target = nodesById.get(edge.targetId);
        return `${formatEdgeEndpoint(edge.sourceId, source)} -[${edge.category}${stance}]-> ${formatEdgeEndpoint(edge.targetId, target)}${rationale}`;
      }),
      omittedCount: Math.max(0, result.edges.length - maxEdges),
    },
  };
}

function formatEdgeEndpoint(id: number, node: Pick<GraphNode, 'kind' | 'kindOrdinal'> | undefined): string {
  return node ? formatGraphNodeCode(node.kind, node.kindOrdinal) : `#${id}`;
}

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}…`;
}
