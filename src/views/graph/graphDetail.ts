/** Pure projection of the selected node into its detail-panel payload, derived from the graph model (no entity-state re-walk). */

import type { GraphModel } from '@/views/graph/buildGraphModel.js';
import type { GraphDetail, GraphNodeData } from '@/views/graph/types.js';

export function buildGraphDetail(selectedId: string, model: GraphModel): GraphDetail | null {
  const dataById = new Map<string, GraphNodeData>(model.nodes.map((node) => [node.id, node.data]));
  const self = dataById.get(selectedId);
  if (self === undefined) return null;

  const connections: GraphDetail['connections'] = [];
  for (const edge of model.edges) {
    const asSource = edge.source === selectedId;
    const asTarget = edge.target === selectedId;
    if (!asSource && !asTarget) continue;

    const other = dataById.get(asSource ? edge.target : edge.source);
    if (other === undefined) continue;

    connections.push({
      direction: asSource ? 'outgoing' : 'incoming',
      relationship: edge.data.relationship,
      otherKind: other.kind,
      otherReference: other.referenceCode,
      otherContent: other.content,
    });
  }

  return {
    kind: self.kind,
    referenceCode: self.referenceCode,
    content: self.content,
    rationale: self.rationale,
    connections,
  };
}
