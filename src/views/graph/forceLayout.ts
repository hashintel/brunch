import { buildSimulation, convergenceTicks, type SimModel } from '@/views/graph/graphForces.js';

import type { GraphNodeData } from './types.js';

export { kindRank } from '@/views/graph/graphForces.js';

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
