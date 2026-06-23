/**
 * Live force layout: drives node positions frame-by-frame from a per-instance d3
 * simulation built from the shared `graphForces` config. Nodes start at the
 * simulation's seed positions and glide as it ticks, settling into the same layout
 * the synchronous `forceLayout` pass produces. The frame loop parks itself once the
 * simulation cools below alphaMin and is torn down on unmount, so a settled or
 * unmounted canvas costs nothing.
 *
 * Dragging pins a node (d3 fx/fy) so the simulation holds it under the pointer while
 * the rest of the graph reflows around it; releasing clears the pin so forces ease it
 * back into equilibrium ("unmold → re-mold").
 *
 * Positions and pins are ephemeral graph-local interaction (SPEC D128): they live only
 * inside this hook and never flow back into the graph model or entity truth.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { buildSimulation, type SimModel, type SimNode } from '@/views/graph/graphForces.js';

import type { GraphNodeData } from './types.js';

/** Simulation ticks advanced per painted frame — settles the glide-in faster than 1 tick/frame. */
const STEPS_PER_FRAME = 3;

/** Alpha held while a node is dragged, so the graph keeps reflowing until release. */
const DRAG_ALPHA = 0.3;

/** A node positioned by the live simulation. */
export interface LiveNode {
  id: string;
  data: GraphNodeData;
  position: { x: number; y: number };
}

export interface ForceLayout {
  nodes: LiveNode[];
  /** Begin dragging: pin the node at its current spot and reheat so neighbors react. */
  onNodeDragStart: (id: string) => void;
  /** Continue dragging: hold the node at the pointer position. */
  onNodeDrag: (id: string, position: { x: number; y: number }) => void;
  /** End dragging: release the pin so the node eases back into equilibrium. */
  onNodeDragStop: (id: string) => void;
}

/** Live handle the drag callbacks reach through; rebuilt whenever the model changes. */
interface SimHandle {
  byId: Map<string, SimNode>;
  pin: (id: string, x: number, y: number) => void;
  unpin: (id: string) => void;
  /** Reheat and keep the simulation warm so it reflows for the duration of a drag. */
  warm: () => void;
  /** Let the simulation cool back to rest so the released node eases into equilibrium. */
  cool: () => void;
  kick: () => void;
}

export function useForceLayout(model: SimModel): ForceLayout {
  const [nodes, setNodes] = useState<LiveNode[]>([]);
  const handleRef = useRef<SimHandle | null>(null);

  useEffect(() => {
    if (model.nodes.length === 0) {
      setNodes([]);
      handleRef.current = null;
      return;
    }

    const { simulation, nodes: simNodes } = buildSimulation(model);
    const byId = new Map(simNodes.map((node) => [node.id, node]));
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
      // than the ~5s of d3's full cooling schedule. With alphaTarget at rest (0) it
      // stops at the exact tick where alpha crosses alphaMin — so the settled layout
      // matches forceLayout; while dragging, alphaTarget keeps it warm until release.
      let running = true;
      for (let step = 0; step < STEPS_PER_FRAME && running; step++) {
        simulation.tick();
        running = simulation.alpha() >= simulation.alphaMin();
      }
      setNodes(snapshot());
      frame = running ? requestAnimationFrame(tick) : 0;
    };
    const kick = () => {
      if (frame === 0) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    handleRef.current = {
      byId,
      pin: (id, x, y) => {
        const node = byId.get(id);
        if (node === undefined) return;
        node.fx = x;
        node.fy = y;
      },
      unpin: (id) => {
        const node = byId.get(id);
        if (node === undefined) return;
        node.fx = null;
        node.fy = null;
      },
      warm: () => {
        simulation.alphaTarget(DRAG_ALPHA);
        if (simulation.alpha() < DRAG_ALPHA) simulation.alpha(DRAG_ALPHA);
      },
      cool: () => simulation.alphaTarget(0),
      kick,
    };

    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
      simulation.stop();
      handleRef.current = null;
    };
  }, [model]);

  const onNodeDragStart = useCallback((id: string) => {
    const handle = handleRef.current;
    if (handle === null) return;
    const node = handle.byId.get(id);
    if (node === undefined) return;
    handle.pin(id, node.x ?? 0, node.y ?? 0);
    handle.warm();
    handle.kick();
  }, []);

  const onNodeDrag = useCallback((id: string, position: { x: number; y: number }) => {
    const handle = handleRef.current;
    if (handle === null) return;
    handle.pin(id, position.x, position.y);
    handle.warm();
    handle.kick();
  }, []);

  const onNodeDragStop = useCallback((id: string) => {
    const handle = handleRef.current;
    if (handle === null) return;
    handle.unpin(id);
    handle.cool();
    handle.kick();
  }, []);

  return { nodes, onNodeDragStart, onNodeDrag, onNodeDragStop };
}
