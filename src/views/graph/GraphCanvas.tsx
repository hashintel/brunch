/**
 * The shared graph canvas — the sole writer of the canvas wiring file.
 *
 * Composes the card-based graph view by:
 *
 *   - registering the `GraphNode` card and the `GraphEdge` renderer with React
 *     Flow,
 *   - mounting the `EdgeLabelToggle` control whose global edge-label state lives
 *     here (backed by the `?edgeLabels` URL param) and is threaded to every
 *     edge,
 *   - running `forceLayout` to convergence so cards appear at their settled
 *     positions with no entrance motion — a spinner covers the synchronous
 *     compute, and
 *   - always showing each card's text (reference code + name) regardless of the
 *     edge-label toggle.
 */

import { useSearch } from '@tanstack/react-router';
import { MiniMap, ReactFlow, type Edge, type EdgeProps, type Node } from '@xyflow/react';
import { useEffect, useMemo, useState } from 'react';

import { Spinner } from '@/client/components/ui/spinner';
import type { EntitiesData } from '@/shared/api-types.js';
import { knowledgeKindRegistry } from '@/shared/knowledge.js';
import { buildGraphModel, type GraphModel } from '@/views/graph/buildGraphModel.js';
import { EdgeLabelToggle, EDGE_LABELS_PARAM, parseEdgeLabelsVisible } from '@/views/graph/EdgeLabelToggle';
import { forceLayout } from '@/views/graph/forceLayout.js';
import { GraphEdge } from '@/views/graph/GraphEdge.js';
import { GraphEmptyState } from '@/views/graph/GraphEmptyState.js';
import { GraphNode } from '@/views/graph/GraphNode';
import type { GraphEdgeRelationship, GraphNodeData } from '@/views/graph/types.js';

import '@xyflow/react/dist/style.css';

interface FlowEdgeData extends Record<string, unknown> {
  relationship: GraphEdgeRelationship;
  labelsVisible: boolean;
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
    />
  );
}

const nodeTypes = { graph: GraphNode };
const edgeTypes = { graph: GraphFlowEdge };

/** Per-node card text (reference code, name, rationale), keyed by node id. */
interface CardText {
  referenceCode: string;
  content: string;
  rationale: string;
}

/** Map every node id (`${kind}:${id}`) to its card text from the entity state. */
function cardTextById(entityState: EntitiesData): Map<string, CardText> {
  const byId = new Map<string, CardText>();
  for (const entry of knowledgeKindRegistry) {
    for (const item of entityState[entry.collectionKey]) {
      byId.set(`${entry.kind}:${item.id}`, {
        referenceCode: item.referenceCode ?? '',
        content: item.content,
        rationale: 'rationale' in item && item.rationale !== null ? item.rationale : '',
      });
    }
  }
  return byId;
}

/**
 * Inner canvas: receives a non-empty model, computes the force layout once and
 * renders the React Flow surface with the card renderers and edge labels
 * threaded from the canvas's global toggle state.
 */
function Canvas({ model, cardText }: { model: GraphModel; cardText: Map<string, CardText> }) {
  const [positions, setPositions] = useState<Map<string, { x: number; y: number }> | null>(null);

  const search = useSearch({ strict: false }) as { [EDGE_LABELS_PARAM]?: string };
  const labelsVisible = parseEdgeLabelsVisible(search[EDGE_LABELS_PARAM]);

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

  const flowNodes = useMemo<Node[]>(() => {
    if (positions === null) return [];
    return model.nodes.map((node): Node => {
      const text = cardText.get(node.id);
      const data: GraphNodeData = {
        ...node.data,
        referenceCode: text?.referenceCode ?? '',
        content: text?.content ?? '',
        rationale: text?.rationale ?? '',
      };
      return {
        id: node.id,
        type: 'graph',
        position: positions.get(node.id) ?? { x: 0, y: 0 },
        data: data as unknown as Record<string, unknown>,
      };
    });
  }, [model.nodes, positions, cardText]);

  // Toggling edge labels re-threads edge data without disturbing the settled
  // node positions (layout only re-runs when the model changes).
  const flowEdges = useMemo<Edge<FlowEdgeData>[]>(() => {
    return model.edges.map((edge, index) => ({
      id: `${edge.source}->${edge.target}#${index}`,
      source: edge.source,
      target: edge.target,
      type: 'graph',
      data: {
        relationship: edge.data.relationship,
        labelsVisible,
      },
    }));
  }, [model.edges, labelsVisible]);

  return (
    <div className="relative h-full w-full" style={{ width: '100%', height: '100%' }}>
      <div className="absolute top-2 right-2 z-10">
        <EdgeLabelToggle />
      </div>
      {positions === null ? (
        <div className="flex h-full w-full items-center justify-center" data-graph-loading="">
          <Spinner />
        </div>
      ) : (
        <ReactFlow nodes={flowNodes} edges={flowEdges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} fitView>
          <MiniMap />
        </ReactFlow>
      )}
    </div>
  );
}

/** The shared graph canvas's sole composing component. */
export function GraphCanvas({ entityState }: { entityState: EntitiesData }) {
  const model = useMemo(() => buildGraphModel(entityState), [entityState]);
  const cardText = useMemo(() => cardTextById(entityState), [entityState]);

  if (model.nodes.length === 0) {
    return <GraphEmptyState />;
  }

  return <Canvas model={model} cardText={cardText} />;
}
