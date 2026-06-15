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
import { authoredEdgeEndpointFields } from '../../../graph/index.js';
import type { NodeNeighborhood } from '../../../graph/queries.js';
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
  const [sourceField, targetField] = authoredEdgeEndpointFields(op.category);
  const source = normalizeEdgeRef(
    op[sourceField as keyof typeof op] as string | { readonly existingCode: string },
    resolveGraphNodeCode,
    `ops[${index}].${sourceField}`,
    diagnostics,
  );
  const target = normalizeEdgeRef(
    op[targetField as keyof typeof op] as string | { readonly existingCode: string },
    resolveGraphNodeCode,
    `ops[${index}].${targetField}`,
    diagnostics,
  );
  if (source.status === 'invalid' || target.status === 'invalid') return undefined;

  return {
    category: op.category,
    [sourceField]: source.ref,
    [targetField]: target.ref,
    ...(op.rationale === undefined ? {} : { rationale: op.rationale }),
    ...('stance' in op ? { stance: op.stance } : {}),
  } as RoleNamedEdgeDraft;
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
