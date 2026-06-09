/**
 * Pi tool → CommandExecutor translation seam.
 *
 * SPEC: D4-L, D20-L, D52-L, D53-L
 *
 * This module translates Pi tool parameters (flat JSON from LLM tool calls)
 * into CommandExecutor input types and formats CommandExecutor results into
 * Pi tool result content. It does NOT import from db/ — all graph access
 * routes through CommandExecutor and graph query readers.
 */

import type {
  BatchEdgeInput,
  BatchEdgeRef,
  BatchNodeInput,
  CommitGraphInput,
  CommitGraphResult,
  CommitGraphSuccess,
  Diagnostic,
  StructuralIllegal,
} from '../../../graph/command-executor.js';
import type { GraphSlice, NodeNeighborhood } from '../../../graph/queries.js';
import { formatGraphNodeCode, parseGraphNodeCode } from '../../../graph/schema/nodes.js';
import type { ToolCommitGraphParams } from './tool-schemas.js';

export type ResolveGraphNodeCode = (code: string) => number | undefined;

/**
 * Translate Pi tool params into a CommandExecutor CommitGraphInput.
 *
 * The translation is thin — structural validation happens in the CommandExecutor.
 * `specId` is injected by the registrar from the selected session/spec context
 * so the agent-facing tool schema never asks the LLM for a workspace-global
 * graph target (D61-L).
 */
export function translateCommitGraph(
  params: ToolCommitGraphParams,
  specId: number,
  resolveGraphNodeCode: ResolveGraphNodeCode,
): CommitGraphInput | StructuralIllegal {
  const nodes: BatchNodeInput[] = params.nodes.map((n) => ({
    ref: n.ref,
    plane: n.plane as BatchNodeInput['plane'],
    kind: n.kind,
    title: n.title,
    body: n.body,
    source: n.source,
    detail: n.detail,
  }));

  const diagnostics: Diagnostic[] = [];
  const edges: BatchEdgeInput[] = [];
  for (const [index, e] of params.edges.entries()) {
    const source = normalizeEdgeRef(e.source, resolveGraphNodeCode, `edges[${index}].source`, diagnostics);
    const target = normalizeEdgeRef(e.target, resolveGraphNodeCode, `edges[${index}].target`, diagnostics);
    if (source.status === 'invalid' || target.status === 'invalid') continue;
    edges.push({
      category: e.category,
      source: source.ref,
      target: target.ref,
      stance: e.stance,
      rationale: e.rationale,
    });
  }

  if (diagnostics.length > 0) return { status: 'structural_illegal', diagnostics };
  return { specId, basis: 'implicit', nodes, edges };
}

type EdgeRefNormalization =
  | { readonly status: 'valid'; readonly ref: BatchEdgeRef }
  | { readonly status: 'invalid' };

function normalizeEdgeRef(
  ref: string | { readonly existingCode: string },
  resolveGraphNodeCode: ResolveGraphNodeCode,
  field: string,
  diagnostics: Diagnostic[],
): EdgeRefNormalization {
  if (typeof ref === 'string') return { status: 'valid', ref };
  if (!parseGraphNodeCode(ref.existingCode)) {
    diagnostics.push({ field, message: `malformed graph node code "${ref.existingCode}"` });
    return { status: 'invalid' };
  }
  const nodeId = resolveGraphNodeCode(ref.existingCode);
  if (nodeId === undefined) {
    diagnostics.push({
      field,
      message: `graph node code "${ref.existingCode}" does not resolve in the selected spec`,
    });
    return { status: 'invalid' };
  }
  return { status: 'valid', ref: { existing: nodeId } };
}

// ---------------------------------------------------------------------------
// Result formatting
// ---------------------------------------------------------------------------

/**
 * Format a CommitGraphResult as Pi tool result text content.
 *
 * On success: human-readable summary with created ids.
 * On structural_illegal: diagnostic listing for agent self-correction.
 */
export function formatCommitGraphResult(result: CommitGraphResult): string {
  if (result.status === 'success') {
    return formatCommitSuccess(result);
  }
  return formatStructuralIllegal(result);
}

function formatCommitSuccess(result: CommitGraphSuccess): string {
  const nodeEntries = Object.entries(result.createdNodes);
  const lines: string[] = [`Graph committed successfully (LSN ${result.lsn}).`];

  if (nodeEntries.length > 0) {
    const createdNodes = nodeEntries.map(([ref, node]) => `${ref} → ${node.code}`);
    lines.push(`Nodes created: ${createdNodes.join(', ')}`);
  }
  if (result.edges.length > 0) {
    lines.push(`Edges created: ${result.edges.map((id) => `#${id}`).join(', ')}`);
  }

  return lines.join('\n');
}

export function formatStructuralIllegal(result: StructuralIllegal): string {
  const lines: string[] = [
    'STRUCTURAL_ILLEGAL: The batch was rejected. Fix the following issues and retry:',
    '',
  ];

  for (const d of result.diagnostics) {
    lines.push(`- ${d.field}: ${d.message}`);
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// read-graph: overview formatting
// ---------------------------------------------------------------------------

/**
 * Format a GraphSlice as readable text for the agent.
 */
export function formatGraphOverview(overview: GraphSlice, heading = 'Graph overview'): string {
  if (overview.nodes.length === 0) {
    return `${heading}: empty (no nodes or edges).`;
  }

  const lines: string[] = [
    `${heading} (LSN ${overview.lsn}): ${overview.nodes.length} node(s), ${overview.edges.length} edge(s).`,
    '',
  ];
  const nodesById = new Map(overview.nodes.map((node) => [node.id, node]));

  for (const node of overview.nodes) {
    const detail = node.detail ? ` [has detail]` : '';
    lines.push(
      `- [${formatGraphNodeCode(node.kind, node.kindOrdinal)}] ${node.plane}/${node.kind}: "${node.title}"${detail}`,
    );
  }

  if (overview.edges.length > 0) {
    lines.push('');
    for (const edge of overview.edges) {
      const stance = edge.stance ? ` (${edge.stance})` : '';
      const source = nodesById.get(edge.sourceId);
      const target = nodesById.get(edge.targetId);
      const sourceCode = source ? formatGraphNodeCode(source.kind, source.kindOrdinal) : `#${edge.sourceId}`;
      const targetCode = target ? formatGraphNodeCode(target.kind, target.kindOrdinal) : `#${edge.targetId}`;
      lines.push(`- Edge #${edge.id}: ${sourceCode} —[${edge.category}${stance}]→ ${targetCode}`);
    }
  }

  return lines.join('\n');
}

export interface RelatedNodesResult {
  readonly status: 'success' | 'not_found';
  readonly anchors?: readonly NodeNeighborhood[];
}

export function formatRelatedNodesResult(result: RelatedNodesResult): string {
  if (result.status === 'not_found') {
    return 'One or more anchor nodes were not found in the selected spec.';
  }

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
