import type { GraphEdge, NodeNeighborhood } from '../../../../graph/index.js';
import type { EdgeEndpoint } from '../../../../graph/policy/category-policy.js';
import { relationFromAnchor, type EdgeRelation } from '../../../../graph/projection/direction.js';
import { edgeLabel } from '../../../../graph/projection/labels.js';
import { formatGraphNodeCode, type GraphNode } from '../../../../graph/schema/nodes.js';

export interface RelatedNodesResult {
  readonly status: 'success' | 'not_found';
  readonly anchors?: readonly NodeNeighborhood[];
}

const SECTION_ORDER: readonly EdgeRelation[] = ['upstream', 'downstream', 'lateral'];

const SECTION_HEADING: Record<EdgeRelation, string> = {
  upstream: 'upstream nodes',
  downstream: 'downstream nodes',
  lateral: 'lateral nodes',
};

const SECTION_GLOSS: Record<EdgeRelation, string> = {
  upstream: 'review anchors if these change',
  downstream: 'reconcile these if anchors change',
  lateral: 'cross-check with anchors if either changes',
};

interface ProjectedRelatedEdge {
  readonly relation: EdgeRelation;
  readonly label: string;
  readonly code: string;
  readonly title: string;
  readonly hard: boolean;
}

export function formatRelatedNodesResult(result: RelatedNodesResult): string {
  if (result.status === 'not_found') return 'One or more anchor nodes were not found in the selected spec.';

  const anchors = result.anchors ?? [];
  const found = anchors.filter(
    (anchor): anchor is Extract<NodeNeighborhood, { status: 'found' }> => anchor.status === 'found',
  );
  const related = new Map(found.flatMap((anchor) => anchor.related.map((node) => [node.id, node] as const)));
  const edges = found.flatMap((anchor) => anchor.edges);
  const nodesById = new Map<number, GraphNode>([
    ...found.map((anchor) => [anchor.node.id, anchor.node] as const),
    ...related,
  ]);
  const projected = projectRelatedEdges(found, edges, nodesById);
  const lines = [
    `Related nodes: ${related.size} node(s), ${projected.length} relation(s).`,
    `Anchors: ${found.map((anchor) => `${formatNode(anchor.node)} ${anchor.node.title}`).join(', ')}`,
  ];

  if (projected.length === 0) {
    lines.push('', 'No relations.');
  } else {
    for (const relation of SECTION_ORDER) {
      const inSection = projected.filter((edge) => edge.relation === relation);
      if (inSection.length === 0) continue;
      lines.push('', `${SECTION_HEADING[relation]} (${inSection.length}) — ${SECTION_GLOSS[relation]}`);
      lines.push(...inSection.map(formatEdge));
    }
  }

  return lines.join('\n');
}

function projectRelatedEdges(
  anchors: readonly Extract<NodeNeighborhood, { status: 'found' }>[],
  edges: readonly GraphEdge[],
  nodesById: ReadonlyMap<number, GraphNode>,
): readonly ProjectedRelatedEdge[] {
  const anchorIds = new Set(anchors.map((anchor) => anchor.node.id));
  const projected: ProjectedRelatedEdge[] = [];
  const seen = new Set<string>();

  for (const edge of edges) {
    const anchorRole = anchorRoleForEdge(edge, anchorIds);
    if (!anchorRole) continue;
    const otherId = anchorRole === 'source' ? edge.targetId : edge.sourceId;
    if (anchorIds.has(otherId)) continue;

    const dedupeKey = `${edge.category}|${edge.stance ?? 'none'}|${anchorRole}|${otherId}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const { relation, strength } = relationFromAnchor(edge.category, anchorRole);
    const source = nodesById.get(edge.sourceId);
    const target = nodesById.get(edge.targetId);
    const other = nodesById.get(otherId);
    projected.push({
      relation,
      label: edgeLabel({
        category: edge.category,
        anchorRole,
        stance: edge.stance,
        sourceKind: source?.kind,
        targetKind: target?.kind,
      }),
      code: other ? formatNode(other) : 'missing endpoint',
      title: other?.title ?? 'missing endpoint',
      hard: relation === 'downstream' && strength === 'cascade',
    });
  }

  return projected;
}

function anchorRoleForEdge(edge: GraphEdge, anchorIds: ReadonlySet<number>): EdgeEndpoint | undefined {
  if (anchorIds.has(edge.sourceId)) return 'source';
  if (anchorIds.has(edge.targetId)) return 'target';
  return undefined;
}

function formatEdge(edge: ProjectedRelatedEdge): string {
  return `- ${edge.label} ${edge.code}: ${edge.title}${edge.hard ? ' {hard}' : ''}`;
}

function formatNode(node: GraphNode): string {
  return formatGraphNodeCode(node.kind, node.kindOrdinal);
}
