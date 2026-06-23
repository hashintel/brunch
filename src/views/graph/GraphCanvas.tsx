/** The shared graph canvas: owns focus + kind-visibility state and composes the card view, panel, and kind filter. */

import { ReactFlow, type Edge, type EdgeProps, type Node } from '@xyflow/react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import type { EntitiesData } from '@/shared/api-types.js';
import type { KnowledgeKind } from '@/shared/knowledge.js';
import { buildGraphModel, type GraphModel } from '@/views/graph/buildGraphModel.js';
import { isEdgeIncident, neighborIds } from '@/views/graph/focus.js';
import { GraphArrowLegend } from '@/views/graph/GraphArrowLegend.js';
import { buildGraphDetail } from '@/views/graph/graphDetail.js';
import { GraphDetailPanel } from '@/views/graph/GraphDetailPanel.js';
import { GraphEdge } from '@/views/graph/GraphEdge.js';
import { GraphEmptyState } from '@/views/graph/GraphEmptyState.js';
import { GraphNode } from '@/views/graph/GraphNode';
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
function GraphFlowEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<Edge<FlowEdgeData>>) {
  if (data === undefined) return null;
  return (
    <GraphEdge
      relationship={data.relationship}
      source={{ x: sourceX, y: sourceY }}
      target={{ x: targetX, y: targetY }}
      sourcePosition={sourcePosition}
      targetPosition={targetPosition}
      labelsShown={data.labelsVisible}
      selected={data.selected}
      dimmed={data.dimmed}
    />
  );
}

const nodeTypes = { graph: GraphNode };
const edgeTypes = { graph: GraphFlowEdge };
const EMPTY_HIDDEN_KINDS: ReadonlySet<KnowledgeKind> = new Set();

/** Inner canvas: lays out once, then renders the surface with focus-driven dimming and incident labels. */
function Canvas({ model, hiddenKinds }: { model: GraphModel; hiddenKinds: ReadonlySet<KnowledgeKind> }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const visibleModel = useMemo<GraphModel>(() => {
    if (hiddenKinds.size === 0) return model;
    const nodes = model.nodes.filter((node) => !hiddenKinds.has(node.data.kind));
    const visibleIds = new Set(nodes.map((node) => node.id));
    const edges = model.edges.filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target));
    return { nodes, edges };
  }, [model, hiddenKinds]);

  const {
    nodes: liveNodes,
    onNodesChange,
    onNodeDragStart,
    onNodeDrag,
    onNodeDragStop,
  } = useForceLayout(visibleModel);

  const nodeIds = useMemo(() => new Set(visibleModel.nodes.map((node) => node.id)), [visibleModel.nodes]);
  const activeSelectedId = selectedId !== null && nodeIds.has(selectedId) ? selectedId : null;
  const activeHoveredId = hoveredId !== null && nodeIds.has(hoveredId) ? hoveredId : null;

  useEffect(() => {
    setSelectedId((current) => (current !== null && !nodeIds.has(current) ? null : current));
    setHoveredId((current) => (current !== null && !nodeIds.has(current) ? null : current));
  }, [nodeIds]);

  const neighbors = useMemo(
    () => neighborIds(visibleModel.edges, activeSelectedId),
    [visibleModel.edges, activeSelectedId],
  );

  const flowNodes = useMemo<Node[]>(() => {
    return liveNodes.map((node): Node => {
      const base = node.data as unknown as GraphNodeData;
      const data: GraphNodeData = {
        ...base,
        selected: node.id === activeSelectedId,
        dimmed: activeSelectedId !== null && !neighbors.has(node.id),
      };
      return { ...node, data: data as unknown as Record<string, unknown> };
    });
  }, [liveNodes, activeSelectedId, neighbors]);

  // Label/highlight/dim by incidence to the hovered or selected node; never re-runs layout.
  const flowEdges = useMemo<Edge<FlowEdgeData>[]>(() => {
    return visibleModel.edges.map((edge, index) => {
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
  }, [visibleModel.edges, activeSelectedId, activeHoveredId]);

  const presentRelationships = useMemo(
    () => new Set<GraphEdgeRelationship>(visibleModel.edges.map((edge) => edge.data.relationship)),
    [visibleModel.edges],
  );

  const detail = useMemo(
    () => (activeSelectedId === null ? null : buildGraphDetail(activeSelectedId, visibleModel)),
    [activeSelectedId, visibleModel],
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
        onNodesChange={onNodesChange}
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
          <GraphArrowLegend relationships={presentRelationships} />
        </div>
      </ReactFlow>
      {detail !== null ? (
        <div className="absolute inset-y-0 right-0 z-20">
          <GraphDetailPanel
            detail={detail}
            onClose={() => setSelectedId(null)}
            onSelect={(id) => setSelectedId(id)}
          />
        </div>
      ) : null}
    </div>
  );
}

/** The shared graph canvas's sole composing component. */
export function GraphCanvas({
  entityState,
  emptyStateAction,
  hiddenKinds = EMPTY_HIDDEN_KINDS,
}: {
  entityState: EntitiesData;
  emptyStateAction?: ReactNode;
  hiddenKinds?: ReadonlySet<KnowledgeKind>;
}) {
  const model = useMemo(() => buildGraphModel(entityState), [entityState]);

  if (model.nodes.length === 0) {
    return <GraphEmptyState action={emptyStateAction} />;
  }

  return <Canvas model={model} hiddenKinds={hiddenKinds} />;
}
