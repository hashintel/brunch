/**
 * Pure projection from the project-wide entity state into the graph node/edge
 * model. Mirrors exactly what the structured list view renders: one node per
 * knowledge item across all eight kinds and one edge per relationship across
 * all five relationship types, with each node's degree computed as the count
 * of incident edges (incoming and outgoing).
 */
import type { EntitiesData } from '@/shared/api-types.js';
import { knowledgeKindRegistry } from '@/shared/knowledge.js';

import type { GraphEdgeData, GraphNodeData, GraphNodeKind } from './types.js';

/** A node in the graph model, keyed by `${kind}:${id}`. */
export interface GraphNode {
  id: string;
  data: GraphNodeData;
}

/** An edge in the graph model, wired between node ids. */
export interface GraphEdge {
  source: string;
  target: string;
  data: GraphEdgeData;
}

/** The complete node/edge projection of an entity state. */
export interface GraphModel {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

function nodeId(kind: GraphNodeKind, id: number): string {
  return `${kind}:${id}`;
}

export function buildGraphModel(entityState: EntitiesData): GraphModel {
  const nodesById = new Map<string, GraphNode>();
  const nodes: GraphNode[] = [];

  for (const entry of knowledgeKindRegistry) {
    for (const item of entityState[entry.collectionKey]) {
      const node: GraphNode = {
        id: nodeId(entry.kind, item.id),
        data: {
          kind: entry.kind,
          degree: 0,
          selected: false,
          dimmed: false,
        },
      };
      nodes.push(node);
      nodesById.set(node.id, node);
    }
  }

  const edges: GraphEdge[] = [];

  for (const rel of entityState.relationships) {
    const source = nodeId(rel.source.kind, rel.source.id);
    const target = nodeId(rel.target.kind, rel.target.id);

    edges.push({
      source,
      target,
      data: { relationship: rel.type },
    });

    const sourceNode = nodesById.get(source);
    if (sourceNode) sourceNode.data.degree += 1;
    const targetNode = nodesById.get(target);
    if (targetNode) targetNode.data.degree += 1;
  }

  return { nodes, edges };
}
