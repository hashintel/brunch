/**
 * The spatial graph canvas — the sole composing component for the graph view.
 *
 * Builds the node/edge model (buildGraphModel) and runs the force layout
 * (forceLayout) to settled positions *before* the first React Flow paint, so
 * nodes appear at rest rather than flying in. While that synchronous layout is
 * being computed a brief spinner is shown. Once positions are ready it renders
 * React Flow wired with the GraphNode and GraphEdge custom renderers, pan/zoom
 * and a minimap, and uses useGraphSelection to emphasise a clicked node and its
 * neighbours. An empty spec is delegated to GraphEmptyState.
 */

import { MiniMap, ReactFlow, type Edge, type EdgeProps, type Node } from '@xyflow/react';
import { useEffect, useMemo, useState } from 'react';

import { Spinner } from '@/client/components/ui/spinner';
import type { EntitiesData } from '@/shared/api-types.js';

import { buildGraphModel, type GraphModel } from './buildGraphModel.js';
import { forceLayout } from './forceLayout.js';
import { GraphEdge } from './GraphEdge.js';
import { GraphEmptyState } from './GraphEmptyState.js';
import { GraphNode } from './GraphNode.js';
import type { GraphEdgeRelationship } from './types.js';
import { useGraphSelection } from './useGraphSelection.js';

import '@xyflow/react/dist/style.css';

interface FlowEdgeData extends Record<string, unknown> {
  relationship: GraphEdgeRelationship;
  dimmed: boolean;
  selectedEdge: boolean;
}

/** Adapts a React Flow edge into the standalone GraphEdge renderer. */
function GraphFlowEdge({ sourceX, sourceY, targetX, targetY, data }: EdgeProps<Edge<FlowEdgeData>>) {
  if (data === undefined) return null;
  return (
    <GraphEdge
      relationship={data.relationship}
      source={{ x: sourceX, y: sourceY }}
      target={{ x: targetX, y: targetY }}
      selected={data.selectedEdge}
      dimmed={data.dimmed}
    />
  );
}

const nodeTypes = { graph: GraphNode };
const edgeTypes = { graph: GraphFlowEdge };

/**
 * Inner canvas: receives a non-empty model, computes the force layout once and
 * renders the React Flow surface with selection emphasis.
 */
function GraphCanvas({ model }: { model: GraphModel }) {
  const [positions, setPositions] = useState<Map<string, { x: number; y: number }> | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
  }, [model]);

  const emphasised = useGraphSelection(model, selectedId);

  const flowNodes = useMemo<Node[]>(() => {
    if (positions === null) return [];
    return emphasised.nodes.map((node) => ({
      id: node.id,
      type: 'graph',
      position: positions.get(node.id) ?? { x: 0, y: 0 },
      data: { ...node.data },
    }));
  }, [emphasised.nodes, positions]);

  const flowEdges = useMemo<Edge<FlowEdgeData>[]>(() => {
    return emphasised.edges.map((edge, index) => {
      const incident = edge.source === selectedId || edge.target === selectedId;
      return {
        id: `${edge.source}->${edge.target}#${index}`,
        source: edge.source,
        target: edge.target,
        type: 'graph',
        data: {
          relationship: edge.data.relationship,
          dimmed: selectedId !== null && !incident,
          selectedEdge: incident,
        },
      };
    });
  }, [emphasised.edges, selectedId]);

  if (positions === null) {
    return (
      <div className="flex h-full w-full items-center justify-center" data-graph-loading="">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="h-full w-full" style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={(_event, node) => setSelectedId(node.id)}
        onPaneClick={() => setSelectedId(null)}
        fitView
      >
        <MiniMap />
      </ReactFlow>
    </div>
  );
}

/** The graph view's sole composing component. */
export function SpatialGraph({ entityState }: { entityState: EntitiesData }) {
  const model = useMemo(() => buildGraphModel(entityState), [entityState]);

  if (model.nodes.length === 0) {
    return <GraphEmptyState />;
  }

  return <GraphCanvas model={model} />;
}
