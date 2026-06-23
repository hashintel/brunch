/**
 * Live force layout: drives node positions frame-by-frame from a per-instance d3
 * simulation built from the shared `graphForces` config. Nodes start at the
 * simulation's seed positions and glide as it ticks, settling into the same layout
 * the synchronous `forceLayout` pass produces. The frame loop parks itself once the
 * simulation cools below alphaMin and is torn down on unmount, so a settled or
 * unmounted canvas costs nothing.
 *
 * Positions are ephemeral graph-local interaction (SPEC D128): they live only inside
 * this hook and never flow back into the graph model or entity truth.
 */

import { useEffect, useState } from 'react';

import { buildSimulation, type SimModel } from '@/views/graph/graphForces.js';

import type { GraphNodeData } from './types.js';

/** Simulation ticks advanced per painted frame — settles the glide-in faster than 1 tick/frame. */
const STEPS_PER_FRAME = 3;

/** A node positioned by the live simulation. */
export interface LiveNode {
  id: string;
  data: GraphNodeData;
  position: { x: number; y: number };
}

export function useForceLayout(model: SimModel): { nodes: LiveNode[] } {
  const [nodes, setNodes] = useState<LiveNode[]>([]);

  useEffect(() => {
    if (model.nodes.length === 0) {
      setNodes([]);
      return;
    }

    const { simulation, nodes: simNodes } = buildSimulation(model);
    const snapshot = (): LiveNode[] =>
      simNodes.map((node) => ({
        id: node.id,
        data: node.data,
        position: { x: node.x ?? 0, y: node.y ?? 0 },
      }));

    setNodes(snapshot());

    let frame = 0;
    const tick = () => {
      // Advance several ticks per painted frame so the glide settles in ~1.7s rather
      // than the ~5s of d3's full cooling schedule, while still stopping at the exact
      // tick where alpha crosses alphaMin — so the settled layout matches forceLayout.
      let running = true;
      for (let step = 0; step < STEPS_PER_FRAME && running; step++) {
        simulation.tick();
        running = simulation.alpha() >= simulation.alphaMin();
      }
      setNodes(snapshot());
      frame = running ? requestAnimationFrame(tick) : 0;
    };
    frame = requestAnimationFrame(tick);

    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
      simulation.stop();
    };
  }, [model]);

  return { nodes };
}
