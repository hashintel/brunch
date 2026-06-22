/** The shared graph canvas: owns focus state (select/hover) and composes the card view, panel, and legend. */

import { ReactFlow, type Edge, type EdgeProps, type Node } from '@xyflow/react';
import { useEffect, useMemo, useState } from 'react';

import { Spinner } from '@/client/components/ui/spinner';
import type { EntitiesData } from '@/shared/api-types.js';
import type { KnowledgeKind } from '@/shared/knowledge.js';
import { buildGraphModel, type GraphModel } from '@/views/graph/buildGraphModel.js';
import { isEdgeIncident, neighborIds } from '@/views/graph/focus.js';
import { forceLayout } from '@/views/graph/forceLayout.js';
import { buildGraphDetail } from '@/views/graph/graphDetail.js';
import { GraphDetailPanel } from '@/views/graph/GraphDetailPanel.js';
import { GraphEdge } from '@/views/graph/GraphEdge.js';
import { GraphEmptyState } from '@/views/graph/GraphEmptyState.js';
import { GraphNode } from '@/views/graph/GraphNode';
import { Legend } from '@/views/graph/Legend.js';
import type { GraphEdgeRelationship, GraphNodeData } from '@/views/graph/types.js';
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
  const [positions, setPositions] = useState<Map<string, { x: number; y: number }> | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    const positioned = forceLayout({
      nodes: model.nodes,
      edges: model.edges.map((edge, index) => ({
        id: `${edge.source}->${edge.target}#${index}`,
        source: edge.source,
        target: edge.target,
        data: edge.data,
      })),
    });
    setPositions(new Map(positioned.map((node) => [node.id, node.position])));
    // A new model is a different graph; drop any stale focus.
    setSelectedId(null);
    setHoveredId(null);
  }, [model]);

  const neighbors = useMemo(() => neighborIds(model.edges, selectedId), [model.edges, selectedId]);

  const flowNodes = useMemo<Node[]>(() => {
    if (positions === null) return [];
    return model.nodes.map((node): Node => {
      const data: GraphNodeData = {
        ...node.data,
        selected: node.id === selectedId,
        dimmed: selectedId !== null && !neighbors.has(node.id),
      };
      return {
        id: node.id,
        type: 'graph',
        position: positions.get(node.id) ?? { x: 0, y: 0 },
        data: data as unknown as Record<string, unknown>,
      };
    });
  }, [model.nodes, positions, selectedId, neighbors]);

  // Label/highlight/dim by incidence to the hovered or selected node; never re-runs layout.
  const flowEdges = useMemo<Edge<FlowEdgeData>[]>(() => {
    return model.edges.map((edge, index) => {
      const incidentToSelected = isEdgeIncident(edge, selectedId);
      const incidentToHovered = isEdgeIncident(edge, hoveredId);
      return {
        id: `${edge.source}->${edge.target}#${index}`,
        source: edge.source,
        target: edge.target,
        type: 'graph',
        data: {
          relationship: edge.data.relationship,
          labelsVisible: incidentToSelected || incidentToHovered,
          selected: incidentToSelected,
          dimmed: selectedId !== null && !incidentToSelected,
        },
      };
    });
  }, [model.edges, selectedId, hoveredId]);

  const presentKinds = useMemo(
    () => new Set<KnowledgeKind>(model.nodes.map((node) => node.data.kind)),
    [model.nodes],
  );

  const detail = useMemo(
    () => (selectedId === null ? null : buildGraphDetail(selectedId, model)),
    [selectedId, model],
  );

  // The detail panel floats as a right-edge overlay rather than a flex sibling, so
  // opening it never resizes the React Flow viewport — keeping the canvas-centered
  // ZoomControl (and the layout) from shifting when a node is selected.
  return (
    <div className="relative h-full w-full">
      {positions === null ? (
        <div className="flex h-full w-full items-center justify-center" data-graph-loading="">
          <Spinner />
        </div>
      ) : (
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodeClick={(_, node) => setSelectedId((prev) => (prev === node.id ? null : node.id))}
          onNodeMouseEnter={(_, node) => setHoveredId(node.id)}
          onNodeMouseLeave={() => setHoveredId(null)}
          onPaneClick={() => setSelectedId(null)}
          fitView
        >
          <ZoomControl />
          <div className="absolute bottom-2 left-2 z-10">
            <Legend kinds={presentKinds} />
          </div>
        </ReactFlow>
      )}
      {detail !== null ? (
        <div className="absolute inset-y-0 right-0 z-20">
          <GraphDetailPanel detail={detail} onClose={() => setSelectedId(null)} />
        </div>
      ) : null}
    </div>
  );
}

/** The shared graph canvas's sole composing component. */
export function GraphCanvas({ entityState }: { entityState: EntitiesData }) {
  const model = useMemo(() => buildGraphModel(entityState), [entityState]);

  if (model.nodes.length === 0) {
    return <GraphEmptyState />;
  }

  return <Canvas model={model} />;
}
