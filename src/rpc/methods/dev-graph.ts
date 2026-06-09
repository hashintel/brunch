import { Type, type Static } from 'typebox';
import { Value } from 'typebox/value';

import type {
  CreateGraphEdgeInput,
  CreateGraphInput,
  CreateGraphNodeInput,
  GraphMutationNodeRef,
} from '../../graph/command-executor/graph-mutation-types.js';
import { roleNamedEdgeDraftFromCreateEdgeInput } from '../../graph/command-executor/role-named-edge-draft.js';
import {
  DESIGN_KINDS,
  EDGE_CATEGORIES,
  EDGE_STANCES,
  INTENT_KINDS,
  ORACLE_KINDS,
  PLAN_KINDS,
  parseGraphNodeCode,
  type Diagnostic,
  type StructuralIllegal,
} from '../../graph/index.js';
import { graphMutationProductUpdates } from '../product-updates.js';
import { createJsonRpcFailure, createJsonRpcSuccess, jsonRpcRequestId } from '../protocol.js';
import type { RpcMethodContext, RpcMethodDefinition } from './registry.js';
import { PositiveIntegerSchema } from './schemas.js';

const ALL_KINDS = [...INTENT_KINDS, ...ORACLE_KINDS, ...DESIGN_KINDS, ...PLAN_KINDS] as const;

const BasisSchema = Type.Union([Type.Literal('explicit'), Type.Literal('implicit')]);
const NodePlaneSchema = Type.Union([
  Type.Literal('intent'),
  Type.Literal('oracle'),
  Type.Literal('design'),
  Type.Literal('plan'),
]);
const NodeKindSchema = Type.Union(ALL_KINDS.map((kind) => Type.Literal(kind)));
const EdgeCategorySchema = Type.Union(EDGE_CATEGORIES.map((category) => Type.Literal(category)));
const EdgeStanceSchema = Type.Union(EDGE_STANCES.map((stance) => Type.Literal(stance)));

const DevCommitNodeSchema = Type.Object(
  {
    ref: Type.String(),
    plane: NodePlaneSchema,
    kind: NodeKindSchema,
    title: Type.String(),
    body: Type.Optional(Type.String()),
    source: Type.Optional(Type.String()),
    detail: Type.Optional(Type.Unknown()),
  },
  { additionalProperties: false },
);

const DevEdgeRefSchema = Type.Union([
  Type.String(),
  Type.Object(
    {
      existingCode: Type.String({
        description: 'Projected node code resolved inside params.specId only, e.g. G1 or CON2.',
      }),
    },
    { additionalProperties: false },
  ),
]);

const DevCommitEdgeSchema = Type.Object(
  {
    category: EdgeCategorySchema,
    source: DevEdgeRefSchema,
    target: DevEdgeRefSchema,
    stance: Type.Optional(EdgeStanceSchema),
    rationale: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

const DevCommitGraphParamsSchema = Type.Object(
  {
    specId: PositiveIntegerSchema,
    basis: BasisSchema,
    nodes: Type.Array(DevCommitNodeSchema),
    edges: Type.Array(DevCommitEdgeSchema),
  },
  { additionalProperties: false },
);

type DevCommitGraphParams = Static<typeof DevCommitGraphParamsSchema>;

type DevEdgeRef = Static<typeof DevEdgeRefSchema>;

const DiagnosticSchema = Type.Object(
  {
    field: Type.String(),
    message: Type.String(),
  },
  { additionalProperties: false },
);

const DevCommitGraphResultSchema = Type.Union([
  Type.Object(
    {
      status: Type.Literal('success'),
      lsn: Type.Number(),
      createdNodes: Type.Record(
        Type.String(),
        Type.Object(
          {
            id: Type.Number(),
            code: Type.String(),
          },
          { additionalProperties: false },
        ),
      ),
      createdEdges: Type.Array(Type.Number()),
      updatedNodes: Type.Array(Type.Number()),
      updatedEdges: Type.Array(Type.Number()),
      deletedNodes: Type.Array(Type.Number()),
      deletedEdges: Type.Array(Type.Number()),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      status: Type.Literal('structural_illegal'),
      diagnostics: Type.Array(DiagnosticSchema),
    },
    { additionalProperties: false },
  ),
]);

export const devGraphRpcMethods: readonly RpcMethodDefinition<RpcMethodContext>[] = [
  {
    method: 'dev.graph.commitGraph',
    access: 'write',
    description:
      'Dev-only local fixture-curation harness: atomically commit an explicit-spec graph batch through CommandExecutor.',
    paramsSchema: DevCommitGraphParamsSchema,
    resultSchema: DevCommitGraphResultSchema,
    examples: [
      {
        jsonrpc: '2.0',
        id: 90,
        method: 'dev.graph.commitGraph',
        params: {
          specId: 1,
          basis: 'explicit',
          nodes: [{ ref: 'n1', plane: 'intent', kind: 'thesis', title: 'Curated thesis' }],
          edges: [{ category: 'support', source: { existingCode: 'G1' }, target: 'n1', stance: 'for' }],
        },
      },
    ],
    async handle(context, request) {
      const requestId = jsonRpcRequestId(request);
      const params = parseDevCommitGraphParams(request.params);
      if (!params.ok) {
        return createJsonRpcFailure(requestId, -32602, 'Invalid params');
      }

      const graph = await context.getGraphRuntime();
      const input = translateDevCommitGraph(params.value, graph.forSpec(params.value.specId).resolveNodeCode);
      const result =
        'status' in input
          ? input
          : graph.commandExecutor.mutateGraph({
              specId: input.specId,
              createBasis: input.basis,
              ops: [
                ...input.nodes.map((node) => ({ op: 'create_node' as const, ...node })),
                ...input.edges.map((edge) => ({
                  op: 'create_edge' as const,
                  ...roleNamedEdgeDraftFromCreateEdgeInput(edge),
                })),
              ],
            });
      if (result.status === 'success') {
        context.productUpdates?.publish(
          graphMutationProductUpdates({ specId: params.value.specId, lsn: result.lsn }),
        );
      }
      return createJsonRpcSuccess(requestId, result);
    },
  },
];

type DevCommitGraphParamsParseResult =
  | {
      ok: true;
      value: DevCommitGraphParams;
    }
  | { ok: false };

function parseDevCommitGraphParams(value: unknown): DevCommitGraphParamsParseResult {
  if (!Value.Check(DevCommitGraphParamsSchema, value)) return { ok: false };
  return { ok: true, value: Value.Parse(DevCommitGraphParamsSchema, value) };
}

function translateDevCommitGraph(
  params: DevCommitGraphParams,
  resolveNodeCode: (code: string) => number | undefined,
): CreateGraphInput | StructuralIllegal {
  const diagnostics: Diagnostic[] = [];
  const nodes: CreateGraphNodeInput[] = params.nodes.map((node) => ({
    ref: node.ref,
    plane: node.plane,
    kind: node.kind,
    title: node.title,
    body: node.body,
    source: node.source,
    detail: node.detail,
  }));
  const edges: CreateGraphEdgeInput[] = [];

  for (const [index, edge] of params.edges.entries()) {
    const source = normalizeEdgeRef(edge.source, resolveNodeCode, `edges[${index}].source`, diagnostics);
    const target = normalizeEdgeRef(edge.target, resolveNodeCode, `edges[${index}].target`, diagnostics);
    if (source.status === 'invalid' || target.status === 'invalid') continue;
    edges.push({
      category: edge.category,
      source: source.ref,
      target: target.ref,
      stance: edge.stance,
      rationale: edge.rationale,
    });
  }

  if (diagnostics.length > 0) return { status: 'structural_illegal', diagnostics };
  return { specId: params.specId, basis: params.basis, nodes, edges };
}

type NormalizedEdgeRef =
  | { readonly status: 'valid'; readonly ref: GraphMutationNodeRef }
  | { readonly status: 'invalid' };

function normalizeEdgeRef(
  ref: DevEdgeRef,
  resolveNodeCode: (code: string) => number | undefined,
  field: string,
  diagnostics: Diagnostic[],
): NormalizedEdgeRef {
  if (typeof ref === 'string') return { status: 'valid', ref };
  if (!parseGraphNodeCode(ref.existingCode)) {
    diagnostics.push({ field, message: `malformed graph node code "${ref.existingCode}"` });
    return { status: 'invalid' };
  }
  const nodeId = resolveNodeCode(ref.existingCode);
  if (nodeId === undefined) {
    diagnostics.push({
      field,
      message: `graph node code "${ref.existingCode}" does not resolve in the selected spec`,
    });
    return { status: 'invalid' };
  }
  return { status: 'valid', ref: { existing: nodeId } };
}
