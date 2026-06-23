/** The shared graph canvas: owns focus state (select/hover) and composes the card view, panel, and legend. */

import { ReactFlow, type Edge, type EdgeProps, type Node } from '@xyflow/react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import type { EntitiesData } from '@/shared/api-types.js';
import type { KnowledgeKind } from '@/shared/knowledge.js';
import { buildGraphModel, type GraphModel } from '@/views/graph/buildGraphModel.js';
import { isEdgeIncident, neighborIds } from '@/views/graph/focus.js';
import { buildGraphDetail } from '@/views/graph/graphDetail.js';
import { GraphDetailPanel } from '@/views/graph/GraphDetailPanel.js';
import { GraphEdge } from '@/views/graph/GraphEdge.js';
import { GraphEmptyState } from '@/views/graph/GraphEmptyState.js';
import { GraphNode } from '@/views/graph/GraphNode';
import { Legend } from '@/views/graph/Legend.js';
import type { GraphEdgeRelationship, GraphNodeData } from '@/views/graph/types.js';
import { useForceLayout } from '@/views/graph/useForceLayout.js';
import { ZoomControl } from '@/views/graph/ZoomControl';

import '@xyflow/react/dist/style.css';

interface FlowEdgeData extends Record<string, unknown> {
  relationship: GraphEdgeRelationship;
  labelsVisible: boolean;
  selected: boolean;
  dimmed: boolean;
}

/** Adapts a React Flow edge into the standalone GraphEdge renderer. */
function GraphFlowEdge({ sourceX, sourceY, targetX, targetY, data }: EdgeProps<Edge<FlowEdgeData>>) {
  if (data === undefined) return null;
  return (
    <GraphEdge
      relationship={data.relationship}
      source={{ x: sourceX, y: sourceY }}
      target={{ x: targetX, y: targetY }}
      labelsShown={data.labelsVisible}
      selected={data.selected}
      dimmed={data.dimmed}
    />
  );
}

const nodeTypes = { graph: GraphNode };
const edgeTypes = { graph: GraphFlowEdge };

/** Inner canvas: lays out once, then renders the surface with focus-driven dimming and incident labels. */
function Canvas({ model }: { model: GraphModel }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Positions stream from a live, self-settling simulation rather than a one-shot
  // synchronous layout, so the graph glides in and stays movable (SPEC D128: these
  // positions are ephemeral graph-local interaction, never written back to the model).
  const { nodes: liveNodes, onNodeDragStart, onNodeDrag, onNodeDragStop } = useForceLayout(model);

  const nodeIds = useMemo(() => new Set(model.nodes.map((node) => node.id)), [model.nodes]);
  const activeSelectedId = selectedId !== null && nodeIds.has(selectedId) ? selectedId : null;
  const activeHoveredId = hoveredId !== null && nodeIds.has(hoveredId) ? hoveredId : null;

  useEffect(() => {
    setSelectedId((current) => (current !== null && !nodeIds.has(current) ? null : current));
    setHoveredId((current) => (current !== null && !nodeIds.has(current) ? null : current));
  }, [nodeIds]);

  const neighbors = useMemo(
    () => neighborIds(model.edges, activeSelectedId),
    [model.edges, activeSelectedId],
  );

  // Overlay focus (selected/dimmed) onto the live positions without disturbing them:
  // positions come from the simulation, selection/dimming from focus state.
  const flowNodes = useMemo<Node[]>(() => {
    return liveNodes.map((node): Node => {
      const data: GraphNodeData = {
        ...node.data,
        selected: node.id === activeSelectedId,
        dimmed: activeSelectedId !== null && !neighbors.has(node.id),
      };
      return {
        id: node.id,
        type: 'graph',
        position: node.position,
        data: data as unknown as Record<string, unknown>,
      };
    });
  }, [liveNodes, activeSelectedId, neighbors]);

  // Label/highlight/dim by incidence to the hovered or selected node; never re-runs layout.
  const flowEdges = useMemo<Edge<FlowEdgeData>[]>(() => {
    return model.edges.map((edge, index) => {
      const incidentToSelected = isEdgeIncident(edge, activeSelectedId);
      const incidentToHovered = isEdgeIncident(edge, activeHoveredId);
      return {
        id: `${edge.source}->${edge.target}#${index}`,
        source: edge.source,
        target: edge.target,
        type: 'graph',
        data: {
          relationship: edge.data.relationship,
          labelsVisible: incidentToSelected || incidentToHovered,
          selected: incidentToSelected,
          dimmed: activeSelectedId !== null && !incidentToSelected,
        },
      };
    });
  }, [model.edges, activeSelectedId, activeHoveredId]);

  const presentKinds = useMemo(
    () => new Set<KnowledgeKind>(model.nodes.map((node) => node.data.kind)),
    [model.nodes],
  );

  const detail = useMemo(
    () => (activeSelectedId === null ? null : buildGraphDetail(activeSelectedId, model)),
    [activeSelectedId, model],
  );

  // The detail panel floats as a right-edge overlay rather than a flex sibling, so
  // opening it never resizes the React Flow viewport — keeping the canvas-centered
  // ZoomControl (and the layout) from shifting when a node is selected.
  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={(_, node) => setSelectedId((prev) => (prev === node.id ? null : node.id))}
        onNodeMouseEnter={(_, node) => setHoveredId(node.id)}
        onNodeMouseLeave={() => setHoveredId(null)}
        onPaneClick={() => setSelectedId(null)}
        onNodeDragStart={(_, node) => onNodeDragStart(node.id)}
        onNodeDrag={(_, node) => onNodeDrag(node.id, node.position)}
        onNodeDragStop={(_, node) => onNodeDragStop(node.id)}
        nodesDraggable
        nodesConnectable={false}
        fitView
      >
        <ZoomControl />
        <div className="absolute bottom-2 left-2 z-10">
          <Legend kinds={presentKinds} />
        </div>
      </ReactFlow>
      {detail !== null ? (
        <div className="absolute inset-y-0 right-0 z-20">
          <GraphDetailPanel detail={detail} onClose={() => setSelectedId(null)} />
        </div>
      ) : null}
    </div>
  );
}

/** The shared graph canvas's sole composing component. */
export function GraphCanvas({
  entityState,
  emptyStateAction,
}: {
  entityState: EntitiesData;
  emptyStateAction?: ReactNode;
}) {
  const model = useMemo(() => buildGraphModel(entityState), [entityState]);

  if (model.nodes.length === 0) {
    return <GraphEmptyState action={emptyStateAction} />;
  }

  return <Canvas model={model} />;
}
