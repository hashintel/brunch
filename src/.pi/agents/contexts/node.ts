import type { NodeNeighborhood } from '../../../graph/queries.js';
import { formatNeighborhood } from '../../../renderers/graph/node-neighborhood.js';

export interface RenderNodeContextOptions {
  readonly maxEdges?: number;
}

export function renderNodeContext(result: NodeNeighborhood, options: RenderNodeContextOptions = {}): string {
  return formatNeighborhood(result, options);
}
