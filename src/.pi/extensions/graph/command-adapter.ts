/**
 * Pi tool → CommandExecutor translation seam.
 *
 * SPEC: D4-L, D20-L, D52-L, D53-L
 *
 * This module translates Pi tool parameters (flat JSON from LLM tool calls)
 * into CommandExecutor input types and formats CommandExecutor results into
 * Pi tool result content. It does NOT import from db/ — all graph access
 * routes through CommandExecutor and snapshot readers.
 */

import type {
  BatchEdgeInput,
  BatchEdgeRef,
  BatchNodeInput,
  CommitGraphInput,
  CommitGraphResult,
  CommitGraphSuccess,
  StructuralIllegal,
} from '../../../graph/command-executor.js';
import { formatGraphNodeCode, parseGraphNodeCode } from '../../../graph/schema/nodes.js';
import type { GraphOverview, NeighborhoodResult } from '../../../graph/snapshot.js';
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
  resolveGraphNodeCode: ResolveGraphNodeCode = () => undefined,
): CommitGraphInput {
  const nodes: BatchNodeInput[] = params.nodes.map((n) => ({
    ref: n.ref,
    plane: n.plane as BatchNodeInput['plane'],
    kind: n.kind,
    title: n.title,
    body: n.body,
    source: n.source,
    detail: n.detail,
  }));

  const edges: BatchEdgeInput[] = params.edges.map((e) => ({
    category: e.category,
    source: resolveEdgeRef(e.source, resolveGraphNodeCode),
    target: resolveEdgeRef(e.target, resolveGraphNodeCode),
    stance: e.stance,
    rationale: e.rationale,
  }));

  return { specId, basis: 'implicit', nodes, edges };
}

function resolveEdgeRef(
  ref: string | { readonly existingCode: string },
  resolveGraphNodeCode: ResolveGraphNodeCode,
): BatchEdgeRef {
  if (typeof ref === 'string') return ref;
  if (!parseGraphNodeCode(ref.existingCode)) {
    throw new Error(`Malformed graph node code "${ref.existingCode}"`);
  }
  const nodeId = resolveGraphNodeCode(ref.existingCode);
  if (nodeId === undefined) {
    throw new Error(`Graph node code "${ref.existingCode}" does not resolve in the selected spec`);
  }
  return { existing: nodeId };
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
  return formatDiagnostics(result);
}

function formatCommitSuccess(result: CommitGraphSuccess): string {
  const nodeEntries = Object.entries(result.nodes);
  const lines: string[] = [`Graph committed successfully (LSN ${result.lsn}).`];

  if (nodeEntries.length > 0) {
    const createdNodes = nodeEntries.map(([ref, id]) => `${ref} → ${result.nodeCodes?.[ref] ?? `#${id}`}`);
    lines.push(`Nodes created: ${createdNodes.join(', ')}`);
  }
  if (result.edges.length > 0) {
    lines.push(`Edges created: ${result.edges.map((id) => `#${id}`).join(', ')}`);
  }

  return lines.join('\n');
}

function formatDiagnostics(result: StructuralIllegal): string {
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
 * Format a GraphOverview as readable text for the agent.
 */
export function formatGraphOverview(overview: GraphOverview): string {
  if (overview.nodeCount === 0) {
    return 'The graph is empty (no nodes or edges).';
  }

  const lines: string[] = [
    `Graph overview (LSN ${overview.lsn}): ${overview.nodeCount} node(s), ${overview.edgeCount} edge(s).`,
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

/**
 * Format a NeighborhoodResult as readable text for the agent.
 */
export function formatNeighborhoodResult(result: NeighborhoodResult): string {
  if (result.status === 'not_found') {
    return 'Node not found.';
  }

  const { anchor, neighbors, edges } = result;
  const nodesById = new Map([[anchor.id, anchor], ...neighbors.map((node) => [node.id, node] as const)]);
  const lines: string[] = [
    `Neighborhood of [${formatGraphNodeCode(anchor.kind, anchor.kindOrdinal)}] ${anchor.plane}/${anchor.kind}: "${anchor.title}"`,
  ];

  if (anchor.body) {
    lines.push(`Body: ${anchor.body}`);
  }

  if (neighbors.length > 0) {
    lines.push('', 'Neighbors:');
    for (const n of neighbors) {
      lines.push(`  - [${formatGraphNodeCode(n.kind, n.kindOrdinal)}] ${n.plane}/${n.kind}: "${n.title}"`);
    }
  }

  if (edges.length > 0) {
    lines.push('', 'Edges:');
    for (const e of edges) {
      const stance = e.stance ? ` (${e.stance})` : '';
      const source = nodesById.get(e.sourceId);
      const target = nodesById.get(e.targetId);
      const sourceCode = source ? formatGraphNodeCode(source.kind, source.kindOrdinal) : `#${e.sourceId}`;
      const targetCode = target ? formatGraphNodeCode(target.kind, target.kindOrdinal) : `#${e.targetId}`;
      lines.push(`  - #${e.id}: ${sourceCode} —[${e.category}${stance}]→ ${targetCode}`);
    }
  }

  return lines.join('\n');
}
