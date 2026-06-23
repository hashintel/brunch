/**
 * d3-force layout pass: ticks the shared simulation to convergence synchronously
 * (no fly-in) so connected items cluster, hubs centre, and orphans drift out, with a
 * gentle per-kind vertical bias (`kindRank`) tilting the knowledge hierarchy
 * top-to-bottom. Forces live in `graphForces`; this is the synchronous settle pass.
 */

import { buildSimulation, convergenceTicks, type SimModel } from '@/views/graph/graphForces.js';

import type { GraphNodeData } from './types.js';

// kindRank stays importable from here for the layout contract test and any
// hierarchy-aware consumer that already reaches for it on this module.
export { kindRank } from '@/views/graph/graphForces.js';

/** A node with its settled layout position. */
export interface PositionedNode {
  id: string;
  data: GraphNodeData;
  position: { x: number; y: number };
}

export function forceLayout(model: SimModel): PositionedNode[] {
  if (model.nodes.length === 0) {
    return [];
  }

  const { simulation, nodes } = buildSimulation(model);
  simulation.tick(convergenceTicks(simulation));

  return nodes.map((node) => ({
    id: node.id,
    data: node.data,
    position: { x: node.x ?? 0, y: node.y ?? 0 },
  }));
}
