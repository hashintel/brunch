/** The shared graph canvas: owns focus + kind-visibility state and composes the card view, panel, and kind filter. */

import { ReactFlow, type Edge, type EdgeProps, type Node } from '@xyflow/react';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { buildGraphModel, type GraphModel } from '@/client/components/graph/buildGraphModel.js';
import { isEdgeIncident, neighborIds } from '@/client/components/graph/focus.js';
import { GraphArrowLegend } from '@/client/components/graph/GraphArrowLegend.js';
import { buildGraphDetail } from '@/client/components/graph/graphDetail.js';
import { GraphDetailPanel } from '@/client/components/graph/GraphDetailPanel.js';
import { GraphEdge } from '@/client/components/graph/GraphEdge.js';
import { GraphEmptyState } from '@/client/components/graph/GraphEmptyState.js';
import type { LayoutMode } from '@/client/components/graph/graphForces.js';
import { GraphLayoutToggle } from '@/client/components/graph/GraphLayoutToggle.js';
import { GraphNode } from '@/client/components/graph/GraphNode';
import { GraphNodeActionsProvider } from '@/client/components/graph/graphNodeActions';
import { useGraphPositions } from '@/client/components/graph/graphPositions.js';
import { parseNodeId } from '@/client/components/graph/nodeId';
import type { GraphEdgeRelationship, GraphNodeData } from '@/client/components/graph/types.js';
import { useForceLayout } from '@/client/components/graph/useForceLayout.js';
import { useSelection } from '@/client/components/graph/useSelection';
import { ZoomControl } from '@/client/components/graph/ZoomControl';
import { usePatchList } from '@/client/components/patch-list-host';
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
  persistKey,
}: {
  model: GraphModel;
  hiddenKinds: ReadonlySet<KnowledgeKind>;
  highlight: KindHighlight | null;
  persistKey: string;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [highlightedKind, setHighlightedKind] = useState<KnowledgeKind | null>(null);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('force');
  const positions = useGraphPositions(persistKey);
  const patchList = usePatchList();

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

  const nodeIds = useMemo(() => new Set(visibleModel.nodes.map((node) => node.id)), [visibleModel.nodes]);
  const selection = useSelection(nodeIds);
  const nodeActions = useMemo(() => ({ requestEdit: selection.edit }), [selection.edit]);

  const {
    nodes: liveNodes,
    onNodesChange,
    onNodeDragStart,
    onNodeDrag,
    onNodeDragStop,
  } = useForceLayout(visibleModel, layoutMode, positions.overridesFor);

  const activeHoveredId = hoveredId !== null && nodeIds.has(hoveredId) ? hoveredId : null;

  useEffect(() => {
    setHoveredId((current) => (current !== null && !nodeIds.has(current) ? null : current));
  }, [nodeIds]);

  const neighbors = useMemo(
    () => neighborIds(visibleModel.edges, selection.selectedId),
    [visibleModel.edges, selection.selectedId],
  );

  const flowNodes = useMemo<Node[]>(() => {
    return liveNodes.map((node): Node => {
      const base = node.data as unknown as GraphNodeData;
      const data: GraphNodeData = {
        ...base,
        selected: node.id === selection.selectedId,
        dimmed: selection.selectedId !== null && !neighbors.has(node.id),
        highlighted: highlightedKind !== null && base.kind === highlightedKind,
      };
      return { ...node, data: data as unknown as Record<string, unknown> };
    });
  }, [liveNodes, selection.selectedId, neighbors, highlightedKind]);

  // Label/highlight/dim by incidence to the hovered or selected node; never re-runs layout.
  const flowEdges = useMemo<Edge<FlowEdgeData>[]>(() => {
    return visibleModel.edges.map((edge, index) => {
      const incidentToSelected = isEdgeIncident(edge, selection.selectedId);
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
          dimmed: selection.selectedId !== null && !incidentToSelected,
        },
      };
    });
  }, [visibleModel.edges, selection.selectedId, activeHoveredId]);

  const presentRelationships = useMemo(
    () => new Set<GraphEdgeRelationship>(visibleModel.edges.map((edge) => edge.data.relationship)),
    [visibleModel.edges],
  );

  const detail = useMemo(
    () => (selection.selectedId === null ? null : buildGraphDetail(selection.selectedId, visibleModel)),
    [selection.selectedId, visibleModel],
  );

  const saveEdit = useCallback(
    (newContent: string) => {
      selection.cancelEdit();
      if (patchList === null || detail === null || selection.selectedId === null) return;
      const itemId = parseNodeId(selection.selectedId).id;
      patchList.stage({
        kind: 'edit',
        producerChatId: null,
        anchor: { kind: detail.kind, itemId },
        anchorReferenceCode: detail.referenceCode,
        summary: `Edit ${detail.referenceCode}`,
        currentContent: detail.content,
        newContent,
      });
    },
    [patchList, detail, selection],
  );

  // The detail panel floats as a right-edge overlay rather than a flex sibling, so
  // opening it never resizes the React Flow viewport — keeping the canvas-centered
  // ZoomControl (and the layout) from shifting when a node is selected.
  return (
    <div className="relative h-full w-full">
      <GraphNodeActionsProvider value={nodeActions}>
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onNodeClick={(_, node) => selection.toggle(node.id)}
          onNodeMouseEnter={(_, node) => setHoveredId(node.id)}
          onNodeMouseLeave={() => setHoveredId(null)}
          onPaneClick={selection.clear}
          onNodeDragStart={(_, node) => onNodeDragStart(node.id)}
          onNodeDrag={(_, node) => onNodeDrag(node.id, node.position)}
          onNodeDragStop={(_, node) => {
            onNodeDragStop(node.id);
            // Force mode self-heals, so only the manual modes have a placement worth keeping.
            if (layoutMode !== 'force') positions.save(layoutMode, node.id, node.position);
          }}
          nodesDraggable
          nodesConnectable={false}
          minZoom={0.1}
          maxZoom={2}
          fitView
          fitViewOptions={{ maxZoom: 1 }}
        >
          <ZoomControl />
          <div className="absolute top-2 left-2 z-10">
            <GraphLayoutToggle mode={layoutMode} onChange={setLayoutMode} />
          </div>
          <div className="absolute bottom-2 left-2 z-10">
            <GraphArrowLegend relationships={presentRelationships} />
          </div>
        </ReactFlow>
      </GraphNodeActionsProvider>
      {detail !== null ? (
        <div className="absolute inset-y-0 right-0 z-20">
          <GraphDetailPanel
            key={selection.selectedId}
            detail={detail}
            editing={selection.editing}
            onClose={selection.clear}
            onSelect={selection.select}
            onStartEdit={() => selection.selectedId !== null && selection.edit(selection.selectedId)}
            onCancelEdit={selection.cancelEdit}
            onSave={saveEdit}
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
  persistKey = 'default',
}: {
  entityState: EntitiesData;
  emptyStateAction?: ReactNode;
  hiddenKinds?: ReadonlySet<KnowledgeKind>;
  highlight?: KindHighlight | null;
  /** Stable graph identity (e.g. specification id) that scopes locally-saved node positions. */
  persistKey?: string;
}) {
  const model = useMemo(() => buildGraphModel(entityState), [entityState]);

  if (model.nodes.length === 0) {
    return <GraphEmptyState action={emptyStateAction} />;
  }

  return <Canvas model={model} hiddenKinds={hiddenKinds} highlight={highlight} persistKey={persistKey} />;
}
