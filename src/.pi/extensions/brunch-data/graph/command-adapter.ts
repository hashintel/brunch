/**
 * Pi tool → CommandExecutor translation seam.
 *
 * SPEC: D4-L, D20-L, D52-L, D53-L
 *
 * This module translates Pi tool parameters (flat JSON from LLM tool calls)
 * into CommandExecutor input types. It does NOT import from db/ — all graph
 * access routes through CommandExecutor and graph query readers.
 */

import type {
  Diagnostic,
  GraphMutationNodeRef,
  GraphMutationOp,
  MutateGraphInput,
  RoleNamedEdgeDraft,
  StructuralIllegal,
} from '../../../../graph/command-executor.js';
import { authoredEdgeEndpointFields } from '../../../../graph/index.js';
import { parseGraphNodeCode } from '../../../../graph/schema/nodes.js';
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
  return {
    specId,
    createBasis: params.createBasis ?? 'implicit',
    createSettlement: params.createSettlement ?? 'settled',
    ops,
  };
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
