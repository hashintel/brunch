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
  Diagnostic,
  GraphMutationNodeRef,
  GraphMutationOp,
  MutateGraphInput,
  MutateGraphResult,
  MutateGraphSuccess,
  RoleNamedEdgeDraft,
  StructuralIllegal,
} from '../../../graph/command-executor.js';
import type { GraphSlice, NodeNeighborhood } from '../../../graph/queries.js';
import { formatGraphNodeCode, parseGraphNodeCode } from '../../../graph/schema/nodes.js';
import type { ToolMutateGraphParams } from './tool-schemas.js';

export type ResolveGraphNodeCode = (code: string) => number | undefined;

/**
 * Translate Pi tool params into a CommandExecutor MutateGraphInput.
 *
 * The translation is thin — structural validation happens in the CommandExecutor.
 * `specId` is injected by the registrar from the selected session/spec context
 * so the agent-facing tool schema never asks the LLM for a workspace-global
 * graph target (D61-L).
 */
export function translateMutateGraph(
  params: ToolMutateGraphParams,
  specId: number,
  resolveGraphNodeCode: ResolveGraphNodeCode,
): MutateGraphInput | StructuralIllegal {
  const diagnostics: Diagnostic[] = [];
  const ops: GraphMutationOp[] = [];
  for (const [index, op] of params.ops.entries()) {
    if (op.op === 'create_node') {
      ops.push({
        op: 'create_node',
        ref: op.ref,
        plane: op.plane,
        kind: op.kind,
        title: op.title,
        body: op.body,
        source: op.source,
        detail: op.detail,
      });
      continue;
    }

    const draft = normalizeRoleNamedEdgeDraftOp(op, index, resolveGraphNodeCode, diagnostics);
    if (draft === undefined) continue;
    ops.push({ op: 'create_edge', ...draft });
  }

  if (diagnostics.length > 0) return { status: 'structural_illegal', diagnostics };
  return { specId, createBasis: params.createBasis ?? 'implicit', ops };
}

function normalizeRoleNamedEdgeDraftOp(
  op: Extract<ToolMutateGraphParams['ops'][number], { readonly op: 'create_edge' }>,
  index: number,
  resolveGraphNodeCode: ResolveGraphNodeCode,
  diagnostics: Diagnostic[],
): RoleNamedEdgeDraft | undefined {
  const resolve = (field: string, ref: string | { readonly existingCode: string }) =>
    normalizeEdgeRef(ref, resolveGraphNodeCode, `ops[${index}].${field}`, diagnostics);

  switch (op.category) {
    case 'dependency': {
      const dependency = resolve('dependency', op.dependency);
      const dependent = resolve('dependent', op.dependent);
      if (dependency.status === 'invalid' || dependent.status === 'invalid') return undefined;
      return {
        category: 'dependency',
        dependency: dependency.ref,
        dependent: dependent.ref,
        rationale: op.rationale,
      };
    }
    case 'proof': {
      const oracle = resolve('oracle', op.oracle);
      const claim = resolve('claim', op.claim);
      if (oracle.status === 'invalid' || claim.status === 'invalid') return undefined;
      return {
        category: 'proof',
        oracle: oracle.ref,
        claim: claim.ref,
        stance: op.stance,
        rationale: op.rationale,
      };
    }
    case 'support': {
      const support = resolve('support', op.support);
      const claim = resolve('claim', op.claim);
      if (support.status === 'invalid' || claim.status === 'invalid') return undefined;
      return {
        category: 'support',
        support: support.ref,
        claim: claim.ref,
        stance: op.stance,
        rationale: op.rationale,
      };
    }
    case 'realization': {
      const abstract = resolve('abstract', op.abstract);
      const concrete = resolve('concrete', op.concrete);
      if (abstract.status === 'invalid' || concrete.status === 'invalid') return undefined;
      return {
        category: 'realization',
        abstract: abstract.ref,
        concrete: concrete.ref,
        rationale: op.rationale,
      };
    }
    case 'boundary': {
      const boundary = resolve('boundary', op.boundary);
      const subject = resolve('subject', op.subject);
      if (boundary.status === 'invalid' || subject.status === 'invalid') return undefined;
      return { category: 'boundary', boundary: boundary.ref, subject: subject.ref, rationale: op.rationale };
    }
    case 'composition': {
      const whole = resolve('whole', op.whole);
      const part = resolve('part', op.part);
      if (whole.status === 'invalid' || part.status === 'invalid') return undefined;
      return { category: 'composition', whole: whole.ref, part: part.ref, rationale: op.rationale };
    }
    case 'association': {
      const a = resolve('a', op.a);
      const b = resolve('b', op.b);
      if (a.status === 'invalid' || b.status === 'invalid') return undefined;
      return { category: 'association', a: a.ref, b: b.ref, rationale: op.rationale };
    }
    case 'supersession': {
      const successor = resolve('successor', op.successor);
      const predecessor = resolve('predecessor', op.predecessor);
      if (successor.status === 'invalid' || predecessor.status === 'invalid') return undefined;
      return {
        category: 'supersession',
        successor: successor.ref,
        predecessor: predecessor.ref,
        rationale: op.rationale,
      };
    }
  }
}

type EdgeRefNormalization =
  | { readonly status: 'valid'; readonly ref: GraphMutationNodeRef }
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
 * Format a MutateGraphResult as Pi tool result text content.
 *
 * On success: human-readable summary with created ids.
 * On structural_illegal: diagnostic listing for agent self-correction.
 */
export function formatMutateGraphResult(result: MutateGraphResult): string {
  if (result.status === 'success') {
    return formatCommitSuccess(result);
  }
  return formatStructuralIllegal(result);
}

function formatCommitSuccess(result: MutateGraphSuccess): string {
  const nodeEntries = Object.entries(result.createdNodes);
  const lines: string[] = [`Graph mutated successfully (LSN ${result.lsn}).`];

  if (nodeEntries.length > 0) {
    const createdNodes = nodeEntries.map(([ref, node]) => `${ref} → ${node.code}`);
    lines.push(`Nodes created: ${createdNodes.join(', ')}`);
  }
  if (result.createdEdges.length > 0) {
    lines.push(`Edges created: ${result.createdEdges.map((id) => `#${id}`).join(', ')}`);
  }
  if (result.updatedNodes.length > 0)
    lines.push(`Nodes updated: ${result.updatedNodes.map((id) => `#${id}`).join(', ')}`);
  if (result.updatedEdges.length > 0)
    lines.push(`Edges updated: ${result.updatedEdges.map((id) => `#${id}`).join(', ')}`);
  if (result.deletedNodes.length > 0)
    lines.push(`Nodes deleted: ${result.deletedNodes.map((id) => `#${id}`).join(', ')}`);
  if (result.deletedEdges.length > 0)
    lines.push(`Edges deleted: ${result.deletedEdges.map((id) => `#${id}`).join(', ')}`);

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
