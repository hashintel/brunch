import { formatNeighborhood } from '../../../graph/format/neighborhood.js';
import { projectNeighborhood } from '../../../graph/project/neighborhood.js';
import type { NeighborhoodResult } from '../../../graph/snapshot.js';

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
  return formatNeighborhood(
    projectNeighborhood(result, {
      maxNeighbors: options.maxNeighbors ?? DEFAULT_MAX_NEIGHBORS,
      maxEdges: options.maxEdges ?? DEFAULT_MAX_EDGES,
    }),
  );
}
