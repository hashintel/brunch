/** The shared graph canvas: owns focus + kind-visibility state and composes the card view, panel, and kind filter. */

import { ReactFlow, type Edge, type EdgeProps, type Node } from '@xyflow/react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { buildGraphModel, type GraphModel } from '@/client/components/graph/buildGraphModel.js';
import { isEdgeIncident, neighborIds } from '@/client/components/graph/focus.js';
import { GraphArrowLegend } from '@/client/components/graph/GraphArrowLegend.js';
import { buildGraphDetail } from '@/client/components/graph/graphDetail.js';
import { GraphDetailPanel } from '@/client/components/graph/GraphDetailPanel.js';
import { GraphEdge } from '@/client/components/graph/GraphEdge.js';
import { GraphEmptyState } from '@/client/components/graph/GraphEmptyState.js';
import { GraphNode } from '@/client/components/graph/GraphNode';
import type { GraphEdgeRelationship, GraphNodeData } from '@/client/components/graph/types.js';
import { useForceLayout } from '@/client/components/graph/useForceLayout.js';
import { ZoomControl } from '@/client/components/graph/ZoomControl';
import type { EntitiesData } from '@/shared/api-types.js';
import type { KnowledgeKind } from '@/shared/knowledge.js';

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
const HIGHLIGHT_MS = 1200;

/** A request to momentarily flash every node of a kind; `nonce` re-triggers repeat picks. */
export interface KindHighlight {
  kind: KnowledgeKind;
  nonce: number;
}

/** Inner canvas: lays out once, then renders the surface with focus-driven dimming and incident labels. */
function Canvas({
  model,
  hiddenKinds,
  highlight,
}: {
  model: GraphModel;
  hiddenKinds: ReadonlySet<KnowledgeKind>;
  highlight: KindHighlight | null;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [highlightedKind, setHighlightedKind] = useState<KnowledgeKind | null>(null);

  useEffect(() => {
    if (highlight === null) return;
    setHighlightedKind(highlight.kind);
    const timer = setTimeout(() => setHighlightedKind(null), HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [highlight]);

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
        highlighted: highlightedKind !== null && base.kind === highlightedKind,
      };
      return { ...node, data: data as unknown as Record<string, unknown> };
    });
  }, [liveNodes, activeSelectedId, neighbors, highlightedKind]);

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
        minZoom={0.1}
        maxZoom={2}
        fitView
        fitViewOptions={{ maxZoom: 1 }}
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
  highlight = null,
}: {
  entityState: EntitiesData;
  emptyStateAction?: ReactNode;
  hiddenKinds?: ReadonlySet<KnowledgeKind>;
  highlight?: KindHighlight | null;
}) {
  const model = useMemo(() => buildGraphModel(entityState), [entityState]);

  if (model.nodes.length === 0) {
    return <GraphEmptyState action={emptyStateAction} />;
  }

  return <Canvas model={model} hiddenKinds={hiddenKinds} highlight={highlight} />;
}
