/**
 * Canonical projection for selected-spec node neighborhood context.
 *
 * Input:
 * - NeighborhoodResult from graph/queries.ts
 *
 * Output:
 * - compact typed shape for anchor, neighbors, and connecting edges
 * - omission counts, truncation policy, and not_found normalization
 *
 * Used by:
 * - renderers/graph/neighborhood.ts
 * - .pi/extensions/graph/index.ts via read_graph neighborhood results
 */

import type { NeighborhoodResult, NodeReadResult } from '../../graph/queries.js';
import { formatGraphNodeCode } from '../../graph/schema/nodes.js';
import type { GraphNode } from '../../graph/schema/nodes.js';
import { truncate } from '../../utils/strings.js';

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
  result: NodeReadResult | NeighborhoodResult,
  options: ProjectNeighborhoodOptions = {},
): ProjectedNeighborhood {
  if (result.status === 'not_found') {
    return { status: 'not_found' };
  }

  const source = normalizeNeighborhoodSource(result);
  const maxNeighbors = options.maxNeighbors ?? DEFAULT_MAX_NEIGHBORS;
  const maxEdges = options.maxEdges ?? DEFAULT_MAX_EDGES;
  const nodesById = new Map([
    [source.anchor.id, source.anchor],
    ...source.related.map((node) => [node.id, node] as const),
  ]);

  return {
    status: 'success',
    anchor: {
      code: formatGraphNodeCode(source.anchor.kind, source.anchor.kindOrdinal),
      label: `${source.anchor.plane}/${source.anchor.kind}: ${source.anchor.title}`,
      ...(source.anchor.body ? { body: truncate(source.anchor.body, 180) } : {}),
    },
    neighbors: {
      items: source.related.slice(0, maxNeighbors).map((neighbor) => {
        const code = formatGraphNodeCode(neighbor.kind, neighbor.kindOrdinal);
        return `[${code}] ${neighbor.plane}/${neighbor.kind}: ${neighbor.title}`;
      }),
      omittedCount: Math.max(0, source.related.length - maxNeighbors),
    },
    edges: {
      items: source.edges.slice(0, maxEdges).map((edge) => {
        const stance = edge.stance ? `/${edge.stance}` : '';
        const rationale = edge.rationale ? ` — ${truncate(edge.rationale, 100)}` : '';
        const source = nodesById.get(edge.sourceId);
        const target = nodesById.get(edge.targetId);
        return `${formatEdgeEndpoint(edge.sourceId, source)} -[${edge.category}${stance}]-> ${formatEdgeEndpoint(edge.targetId, target)}${rationale}`;
      }),
      omittedCount: Math.max(0, source.edges.length - maxEdges),
    },
  };
}

interface NeighborhoodSource {
  readonly anchor: GraphNode;
  readonly related: readonly GraphNode[];
  readonly edges: Extract<NeighborhoodResult, { status: 'success' }>['edges'];
}

function normalizeNeighborhoodSource(
  result: Extract<NodeReadResult, { status: 'found' }> | Extract<NeighborhoodResult, { status: 'success' }>,
): NeighborhoodSource {
  return 'node' in result
    ? { anchor: result.node, related: result.related, edges: result.edges }
    : { anchor: result.anchor, related: result.neighbors, edges: result.edges };
}

function formatEdgeEndpoint(id: number, node: Pick<GraphNode, 'kind' | 'kindOrdinal'> | undefined): string {
  return node ? formatGraphNodeCode(node.kind, node.kindOrdinal) : `#${id}`;
}
