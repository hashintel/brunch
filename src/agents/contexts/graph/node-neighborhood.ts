/**
 * Formats selected-spec node neighborhoods into model-facing text.
 *
 * Edges are projected from the anchor's perspective: grouped by the
 * reconciliation-impact axis (upstream / downstream / lateral) and labelled
 * with direction-aware semantic phrasing. Raw categories and endpoint roles
 * never reach context. See src/graph/projection/.
 */

import type { GraphEdge, NodeNeighborhood } from '../../../graph/index.js';
import type { EdgeEndpoint } from '../../../graph/policy/category-policy.js';
import { relationFromAnchor, type EdgeRelation } from '../../../graph/projection/direction.js';
import { edgeLabel } from '../../../graph/projection/labels.js';
import { formatGraphNodeCode, type GraphNode } from '../../../graph/schema/nodes.js';

export interface RenderNodeNeighborhoodOptions {
  readonly maxExpandedEdges?: number;
}

const DEFAULT_MAX_EXPANDED_EDGES = 12;

const SECTION_ORDER: readonly EdgeRelation[] = ['upstream', 'downstream', 'lateral'];

const SECTION_HEADING: Record<EdgeRelation, string> = {
  upstream: 'upstream nodes',
  downstream: 'downstream nodes',
  lateral: 'lateral nodes',
};

const SECTION_GLOSS: Record<EdgeRelation, string> = {
  upstream: 'review anchor if these change',
  downstream: 'reconcile these if anchor changes',
  lateral: 'cross-check with anchor if either changes',
};

interface ProjectedEdge {
  readonly relation: EdgeRelation;
  readonly label: string;
  readonly code: string;
  readonly title: string;
  readonly hard: boolean;
}

interface AmbientRelations {
  readonly count: number;
  readonly codes: readonly string[];
}

export function formatNeighborhood(
  result: NodeNeighborhood,
  options: RenderNodeNeighborhoodOptions = {},
): string {
  if (result.status === 'not_found') {
    return 'Node not found in selected spec.';
  }

  const maxExpandedEdges = options.maxExpandedEdges ?? DEFAULT_MAX_EXPANDED_EDGES;
  const nodesById = new Map<number, GraphNode>([
    [result.node.id, result.node],
    ...result.related.map((node) => [node.id, node] as const),
  ]);

  const lines = ['anchor node', `- ${formatNode(result.node)}: ${result.node.title}`];
  if (result.node.body) {
    lines.push(`body: ${result.node.body}`);
  }

  const { projected, ambient } = projectEdges(result, nodesById);

  if (projected.length === 0) {
    lines.push('', 'No relations.');
  } else {
    for (const relation of SECTION_ORDER) {
      const inSection = projected.filter((edge) => edge.relation === relation);
      if (inSection.length === 0) continue;
      lines.push('', `${SECTION_HEADING[relation]} (${inSection.length}) — ${SECTION_GLOSS[relation]}`);
      if (inSection.length > maxExpandedEdges) {
        lines.push(...formatCompactEdges(inSection));
      } else {
        lines.push(...inSection.map(formatFullEdge));
      }
    }
  }

  if (ambient.count > 0) {
    const suffix = ambient.codes.length > 0 ? `: ${ambient.codes.join(', ')}` : '';
    lines.push('', `+${ambient.count} more relations among neighbors${suffix}`);
  }

  return lines.join('\n');
}

function projectEdges(
  result: Extract<NodeNeighborhood, { status: 'found' }>,
  nodesById: ReadonlyMap<number, GraphNode>,
): { readonly projected: readonly ProjectedEdge[]; readonly ambient: AmbientRelations } {
  const anchorId = result.node.id;
  const projected: ProjectedEdge[] = [];
  const seen = new Set<string>();
  const directNeighborIds = collectDirectNeighborIds(result.edges, anchorId);
  const ambientCodes: string[] = [];
  const seenAmbientCodes = new Set<string>();
  let ambientCount = 0;

  for (const edge of result.edges) {
    if (edge.sourceId !== anchorId && edge.targetId !== anchorId) {
      ambientCount++;
      collectAmbientCodes(edge, nodesById, directNeighborIds, seenAmbientCodes, ambientCodes);
      continue;
    }
    const anchorRole: EdgeEndpoint = edge.sourceId === anchorId ? 'source' : 'target';
    const otherId = anchorRole === 'source' ? edge.targetId : edge.sourceId;

    const dedupeKey = `${edge.category}|${edge.stance ?? 'none'}|${otherId}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const { relation, strength } = relationFromAnchor(edge.category, anchorRole);
    const source = nodesById.get(edge.sourceId);
    const target = nodesById.get(edge.targetId);
    const label = edgeLabel({
      category: edge.category,
      anchorRole,
      stance: edge.stance,
      sourceKind: source?.kind,
      targetKind: target?.kind,
    });

    const other = nodesById.get(otherId);
    projected.push({
      relation,
      label,
      code: formatNodeFallback(otherId, other),
      title: other?.title ?? 'missing endpoint',
      hard: relation === 'downstream' && strength === 'cascade',
    });
  }

  return { projected, ambient: { count: ambientCount, codes: ambientCodes } };
}

function formatFullEdge(edge: ProjectedEdge): string {
  return `- ${edge.label} ${edge.code}: ${edge.title}${edge.hard ? ' {hard}' : ''}`;
}

function formatCompactEdges(edges: readonly ProjectedEdge[]): string[] {
  const groups = new Map<string, { readonly codes: string[]; hard: boolean }>();
  for (const edge of edges) {
    const group = groups.get(edge.label);
    if (group) {
      group.codes.push(edge.code);
      group.hard ||= edge.hard;
    } else {
      groups.set(edge.label, { codes: [edge.code], hard: edge.hard });
    }
  }
  return [...groups.entries()].map(
    ([label, group]) => `- ${label}: ${group.codes.join(', ')}${group.hard ? ' {hard}' : ''}`,
  );
}

function collectDirectNeighborIds(edges: readonly GraphEdge[], anchorId: number): ReadonlySet<number> {
  const directNeighborIds = new Set<number>();
  for (const edge of edges) {
    if (edge.sourceId === anchorId) directNeighborIds.add(edge.targetId);
    if (edge.targetId === anchorId) directNeighborIds.add(edge.sourceId);
  }
  return directNeighborIds;
}

function collectAmbientCodes(
  edge: GraphEdge,
  nodesById: ReadonlyMap<number, GraphNode>,
  directNeighborIds: ReadonlySet<number>,
  seenCodes: Set<string>,
  codes: string[],
): void {
  for (const nodeId of [edge.sourceId, edge.targetId]) {
    if (directNeighborIds.has(nodeId)) continue;
    const node = nodesById.get(nodeId);
    if (!node) continue;
    const code = formatNode(node);
    if (seenCodes.has(code)) continue;
    seenCodes.add(code);
    codes.push(code);
  }
}

function formatNode(node: GraphNode): string {
  return formatGraphNodeCode(node.kind, node.kindOrdinal);
}

function formatNodeFallback(id: number, node: GraphNode | undefined): string {
  if (node) return formatNode(node);
  return `#${id}`;
}
