import { useNodesState, type Node, type OnNodesChange } from '@xyflow/react';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { forceLayout } from '@/client/components/graph/forceLayout.js';
import {
  buildSimulation,
  convergenceTicks,
  type LayoutMode,
  type SimModel,
  type SimNode,
} from '@/client/components/graph/graphForces.js';
import type { NodePosition } from '@/client/components/graph/graphPositions.js';
import { workflowLayout } from '@/client/components/graph/workflowLayout.js';

const STEPS_PER_FRAME = 3;
const DRAG_ALPHA = 0.3;

export interface ForceLayout {
  nodes: Node[];
  onNodesChange: OnNodesChange<Node>;
  onNodeDragStart: (id: string) => void;
  onNodeDrag: (id: string, position: { x: number; y: number }) => void;
  onNodeDragStop: (id: string) => void;
}

interface SimHandle {
  byId: Map<string, SimNode>;
  pin: (id: string, x: number, y: number) => void;
  unpin: (id: string) => void;
  warm: () => void;
  cool: () => void;
  kick: () => void;
}

function seedNodes(model: SimModel): Node[] {
  if (model.nodes.length === 0) return [];
  return forceLayout(model).map((node) => ({
    id: node.id,
    type: 'graph',
    position: node.position,
    data: node.data as unknown as Record<string, unknown>,
  }));
}

export function useForceLayout(
  model: SimModel,
  mode: LayoutMode = 'force',
  overridesFor?: (mode: LayoutMode) => Map<string, NodePosition>,
): ForceLayout {
  const seed = useMemo(() => seedNodes(model), [model]);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(seed);
  const handleRef = useRef<SimHandle | null>(null);

  useEffect(() => {
    if (model.nodes.length === 0) {
      setNodes([]);
      handleRef.current = null;
      return;
    }

    if (mode !== 'force') {
      // Static layouts: arrange once (workflow = layered flow, free = tidy force
      // pass), then overlay any positions the user has manually saved for this
      // mode, and leave nodes alone — no simulation loop and no drag handle, so
      // React Flow's native drag moves a node freely with no reflow.
      const layout = mode === 'workflow' ? workflowLayout(model) : forceLayout(model);
      const saved = overridesFor?.(mode);
      setNodes(
        layout.map((node) => ({
          id: node.id,
          type: 'graph',
          position: saved?.get(node.id) ?? node.position,
          data: node.data as unknown as Record<string, unknown>,
        })),
      );
      handleRef.current = null;
      return;
    }

    const { simulation, nodes: simNodes } = buildSimulation(model);
    simulation.tick(convergenceTicks(simulation));

    const byId = new Map(simNodes.map((node) => [node.id, node]));
    setNodes(
      simNodes.map((node) => ({
        id: node.id,
        type: 'graph',
        position: { x: node.x ?? 0, y: node.y ?? 0 },
        data: node.data as unknown as Record<string, unknown>,
      })),
    );

    let frame = 0;
    const sync = () => {
      setNodes((current) =>
        current.map((node) => {
          const sim = byId.get(node.id);
          return sim === undefined ? node : { ...node, position: { x: sim.x ?? 0, y: sim.y ?? 0 } };
        }),
      );
    };
    const tick = () => {
      let running = true;
      for (let step = 0; step < STEPS_PER_FRAME && running; step++) {
        simulation.tick();
        running = simulation.alpha() >= simulation.alphaMin();
      }
      sync();
      frame = running ? requestAnimationFrame(tick) : 0;
    };
    const kick = () => {
      if (frame === 0) frame = requestAnimationFrame(tick);
    };

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
  }, [model, mode, setNodes, overridesFor]);

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

  return { nodes, onNodesChange, onNodeDragStart, onNodeDrag, onNodeDragStop };
}
