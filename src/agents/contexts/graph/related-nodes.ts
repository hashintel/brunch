import type { NodeNeighborhood } from '../../../graph/queries.js';
import { formatGraphNodeCode } from '../../../graph/schema/nodes.js';

export interface RelatedNodesResult {
  readonly status: 'success' | 'not_found';
  readonly anchors?: readonly NodeNeighborhood[];
}

export function formatRelatedNodesResult(result: RelatedNodesResult): string {
  if (result.status === 'not_found') return 'One or more anchor nodes were not found in the selected spec.';

  const anchors = result.anchors ?? [];
  const found = anchors.filter(
    (anchor): anchor is Extract<NodeNeighborhood, { status: 'found' }> => anchor.status === 'found',
  );
  const related = new Map(found.flatMap((anchor) => anchor.related.map((node) => [node.id, node] as const)));
  const edges = found.flatMap((anchor) => anchor.edges);
  const nodesById = new Map([...found.map((anchor) => [anchor.node.id, anchor.node] as const), ...related]);
  const lines = [
    `Related nodes: ${related.size} node(s), ${edges.length} edge(s).`,
    `Anchors: ${found.map((anchor) => `[${formatGraphNodeCode(anchor.node.kind, anchor.node.kindOrdinal)}] ${anchor.node.title}`).join(', ')}`,
  ];

  if (related.size === 0) {
    lines.push('Related: none');
  } else {
    lines.push('Related:');
    for (const node of related.values()) {
      lines.push(
        `  - [${formatGraphNodeCode(node.kind, node.kindOrdinal)}] ${node.plane}/${node.kind}: "${node.title}"`,
      );
    }
  }

  if (edges.length === 0) {
    lines.push('Edges: none');
  } else {
    lines.push('Edges:');
    const anchorIds = new Set(found.map((anchor) => anchor.node.id));
    for (const edge of edges) {
      const source = nodesById.get(edge.sourceId);
      const target = nodesById.get(edge.targetId);
      const sourceCode = source ? formatGraphNodeCode(source.kind, source.kindOrdinal) : `#${edge.sourceId}`;
      const targetCode = target ? formatGraphNodeCode(target.kind, target.kindOrdinal) : `#${edge.targetId}`;
      const direction = anchorIds.has(edge.sourceId)
        ? 'outgoing'
        : anchorIds.has(edge.targetId)
          ? 'incoming'
          : 'lateral';
      lines.push(`  - ${sourceCode} -[${edge.category}/${direction}]-> ${targetCode}`);
    }
  }

  return lines.join('\n');
}
