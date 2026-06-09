/**
 * Formats selected-spec node neighborhoods into model-facing text.
 *
 * Edges are projected from the anchor's perspective: grouped by the
 * reconciliation-impact axis (upstream / downstream / lateral) and labelled
 * with direction-aware semantic phrasing. Raw categories and endpoint roles
 * never reach context. See src/graph/projection/.
 */

import type { NodeNeighborhood } from '../../graph/index.js';
import type { EdgeEndpoint } from '../../graph/policy/category-policy.js';
import { relationFromAnchor, type EdgeRelation } from '../../graph/projection/direction.js';
import { edgeLabel } from '../../graph/projection/labels.js';
import { formatGraphNodeCode, type GraphNode } from '../../graph/schema/nodes.js';
import { markdownBullet } from '../markdown.js';

export interface RenderNodeNeighborhoodOptions {
  readonly maxEdges?: number;
}

const DEFAULT_MAX_EDGES = 12;

const SECTION_ORDER: readonly EdgeRelation[] = ['upstream', 'downstream', 'lateral'];

const SECTION_HEADING: Record<EdgeRelation, string> = {
  upstream: 'upstream (review anchor if these change)',
  downstream: 'downstream (reconcile if anchor changes)',
  lateral: 'lateral (related)',
};

interface ProjectedEdge {
  readonly relation: EdgeRelation;
  readonly text: string;
}

export function formatNeighborhood(
  result: NodeNeighborhood,
  options: RenderNodeNeighborhoodOptions = {},
): string {
  if (result.status === 'not_found') {
    return '[Selected-spec node context]\n- node: not found in selected spec';
  }

  const maxEdges = options.maxEdges ?? DEFAULT_MAX_EDGES;
  const nodesById = new Map<number, GraphNode>([
    [result.node.id, result.node],
    ...result.related.map((node) => [node.id, node] as const),
  ]);

  const lines = [
    '[Selected-spec node context]',
    markdownBullet(
      `anchor: [${formatGraphNodeCode(result.node.kind, result.node.kindOrdinal)}] ${result.node.plane}/${result.node.kind}: ${result.node.title}`,
    ),
  ];
  if (result.node.body) {
    lines.push(markdownBullet(`anchor body: ${truncate(result.node.body, 180)}`));
  }

  const { projected, ambient } = projectEdges(result, nodesById);

  if (projected.length === 0) {
    lines.push(markdownBullet('relations: none'));
  } else {
    const shown = projected.slice(0, maxEdges);
    for (const relation of SECTION_ORDER) {
      const inSection = shown.filter((edge) => edge.relation === relation);
      if (inSection.length === 0) continue;
      lines.push(markdownBullet(`${SECTION_HEADING[relation]}:`));
      for (const edge of inSection) {
        lines.push(`  ${markdownBullet(edge.text)}`);
      }
    }
    const omitted = projected.length - shown.length;
    if (omitted > 0) {
      lines.push(markdownBullet(`…${omitted} more relation(s) omitted`));
    }
  }

  if (ambient > 0) {
    lines.push(markdownBullet(`(+${ambient} edge(s) among neighbors, not incident on anchor)`));
  }

  return lines.join('\n');
}

function projectEdges(
  result: Extract<NodeNeighborhood, { status: 'found' }>,
  nodesById: ReadonlyMap<number, GraphNode>,
): { readonly projected: readonly ProjectedEdge[]; readonly ambient: number } {
  const anchorId = result.node.id;
  const projected: ProjectedEdge[] = [];
  const seen = new Set<string>();
  let ambient = 0;

  for (const edge of result.edges) {
    if (edge.sourceId !== anchorId && edge.targetId !== anchorId) {
      ambient++;
      continue;
    }
    const anchorRole: EdgeEndpoint = edge.sourceId === anchorId ? 'source' : 'target';
    const otherId = anchorRole === 'source' ? edge.targetId : edge.sourceId;

    const dedupeKey = `${edge.category}|${otherId}`;
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
    const strengthTag = relation === 'downstream' ? ` {${strength === 'cascade' ? 'hard' : 'soft'}}` : '';
    projected.push({
      relation,
      text: `${label} ${formatNeighbor(otherId, other)}${strengthTag}`,
    });
  }

  return { projected, ambient };
}

function formatNeighbor(id: number, node: GraphNode | undefined): string {
  if (!node) return `#${id}`;
  return `[${formatGraphNodeCode(node.kind, node.kindOrdinal)}] ${node.plane}/${node.kind}: ${truncate(node.title, 90)}`;
}

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}…`;
}
