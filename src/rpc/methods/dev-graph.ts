import { Type } from 'typebox';
import { Value } from 'typebox/value';

import type {
  Diagnostic,
  EdgePatch,
  ExistingGraphEdgeRef,
  ExistingGraphNodeRef,
  GraphMutationNodeRef,
  GraphMutationOp,
  MutateGraphInput,
  NodePatch,
  StructuralIllegal,
} from '../../graph/command-executor/graph-mutation-types.js';
import {
  authoredEdgeEndpointFields,
  EDGE_CATEGORIES,
  EDGE_STANCES,
  NODE_KINDS,
  parseGraphNodeCode,
} from '../../graph/index.js';
import { graphMutationProductUpdates } from '../product-updates.js';
import { createJsonRpcFailure, createJsonRpcSuccess, jsonRpcRequestId } from '../protocol.js';
import type { RpcMethodContext, RpcMethodDefinition } from './registry.js';
import { PositiveIntegerSchema } from './schemas.js';

const BasisSchema = Type.Union([Type.Literal('explicit'), Type.Literal('implicit')]);
const NodePlaneSchema = Type.Union([
  Type.Literal('intent'),
  Type.Literal('oracle'),
  Type.Literal('design'),
  Type.Literal('plan'),
]);
const NodeKindSchema = Type.Union(NODE_KINDS.map((kind) => Type.Literal(kind)));
const EdgeStanceSchema = Type.Union(EDGE_STANCES.map((stance) => Type.Literal(stance)));

const DevExistingCodeRefSchema = Type.Object(
  {
    existingCode: Type.String({
      description: 'Projected node code resolved inside params.specId only, e.g. G1 or CON2.',
    }),
  },
  { additionalProperties: false },
);

const DevCreateEdgeEndpointSchema = Type.Union([Type.String(), DevExistingCodeRefSchema]);

const DevCreateNodeOpSchema = Type.Object(
  {
    op: Type.Literal('create_node'),
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

const DevCreateEdgeOpSchemas = EDGE_CATEGORIES.map((category) => {
  const [sourceField, targetField] = authoredEdgeEndpointFields(category);
  return Type.Object(
    {
      op: Type.Literal('create_edge'),
      category: Type.Literal(category),
      [sourceField]: DevCreateEdgeEndpointSchema,
      [targetField]: DevCreateEdgeEndpointSchema,
      ...(category === 'proof' || category === 'support' ? { stance: EdgeStanceSchema } : {}),
      rationale: Type.Optional(Type.String()),
    },
    { additionalProperties: false },
  );
});

const DevNodePatchSchema = Type.Object(
  {
    title: Type.Optional(Type.String()),
    body: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    source: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    detail: Type.Optional(Type.Unknown()),
  },
  { additionalProperties: false },
);

const DevEdgePatchSchema = Type.Object(
  {
    rationale: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  },
  { additionalProperties: false },
);

const DevPatchNodeOpSchema = Type.Object(
  {
    op: Type.Literal('patch_node'),
    node: DevExistingCodeRefSchema,
    patch: DevNodePatchSchema,
  },
  { additionalProperties: false },
);

const DevPatchEdgeOpSchema = Type.Object(
  {
    op: Type.Literal('patch_edge'),
    edgeId: PositiveIntegerSchema,
    patch: DevEdgePatchSchema,
  },
  { additionalProperties: false },
);

const DevDeleteEdgeOpSchema = Type.Object(
  {
    op: Type.Literal('delete_edge'),
    edgeId: PositiveIntegerSchema,
  },
  { additionalProperties: false },
);

const DevDeleteNodeOpSchema = Type.Object(
  {
    op: Type.Literal('delete_node'),
    node: DevExistingCodeRefSchema,
    deleteIncidentEdges: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

const DevMutateGraphOpSchema = Type.Union([
  DevCreateNodeOpSchema,
  ...DevCreateEdgeOpSchemas,
  DevPatchNodeOpSchema,
  DevPatchEdgeOpSchema,
  DevDeleteEdgeOpSchema,
  DevDeleteNodeOpSchema,
]);

const DevMutateGraphParamsSchema = Type.Object(
  {
    specId: PositiveIntegerSchema,
    createBasis: Type.Optional(BasisSchema),
    ops: Type.Array(DevMutateGraphOpSchema),
  },
  { additionalProperties: false },
);

type DevNodePlane = 'intent' | 'oracle' | 'design' | 'plan';
type DevNodeKind = (typeof NODE_KINDS)[number];
type DevBasis = 'explicit' | 'implicit';
type DevCreateEdgeEndpoint = string | DevExistingCodeRef;
type DevEdgeCategory = (typeof EDGE_CATEGORIES)[number];
type DevEdgeStance = (typeof EDGE_STANCES)[number];

interface DevExistingCodeRef {
  readonly existingCode: string;
}

interface DevCreateNodeOp {
  readonly op: 'create_node';
  readonly ref: string;
  readonly plane: DevNodePlane;
  readonly kind: DevNodeKind;
  readonly title: string;
  readonly body?: string | undefined;
  readonly source?: string | undefined;
  readonly detail?: unknown;
}

interface DevCreateEdgeOp {
  readonly op: 'create_edge';
  readonly category: DevEdgeCategory;
  readonly rationale?: string | undefined;
  readonly stance?: DevEdgeStance | undefined;
  readonly [key: string]: unknown;
}

interface DevPatchNodeOp {
  readonly op: 'patch_node';
  readonly node: DevExistingCodeRef;
  readonly patch: NodePatch;
}

interface DevPatchEdgeOp {
  readonly op: 'patch_edge';
  readonly edgeId: number;
  readonly patch: EdgePatch;
}

interface DevDeleteEdgeOp {
  readonly op: 'delete_edge';
  readonly edgeId: number;
}

interface DevDeleteNodeOp {
  readonly op: 'delete_node';
  readonly node: DevExistingCodeRef;
  readonly deleteIncidentEdges?: boolean | undefined;
}

type DevMutateGraphOp =
  | DevCreateNodeOp
  | DevCreateEdgeOp
  | DevPatchNodeOp
  | DevPatchEdgeOp
  | DevDeleteEdgeOp
  | DevDeleteNodeOp;

interface DevMutateGraphParams {
  readonly specId: number;
  readonly createBasis?: DevBasis | undefined;
  readonly ops: readonly DevMutateGraphOp[];
}

const DiagnosticSchema = Type.Object(
  {
    field: Type.String(),
    message: Type.String(),
  },
  { additionalProperties: false },
);

const DevMutateGraphResultSchema = Type.Union([
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
    method: 'dev.graph.mutateGraph',
    access: 'write',
    description:
      'Dev-only local curation harness: apply projected-code mutateGraph ops to one selected spec through CommandExecutor.',
    paramsSchema: DevMutateGraphParamsSchema,
    resultSchema: DevMutateGraphResultSchema,
    examples: [
      {
        jsonrpc: '2.0',
        id: 90,
        method: 'dev.graph.mutateGraph',
        params: {
          specId: 1,
          createBasis: 'explicit',
          ops: [
            { op: 'create_node', ref: 'n1', plane: 'intent', kind: 'thesis', title: 'Curated thesis' },
            {
              op: 'create_edge',
              category: 'support',
              support: { existingCode: 'G1' },
              claim: 'n1',
              stance: 'for',
            },
            { op: 'patch_node', node: { existingCode: 'REQ1' }, patch: { body: 'Clarified body' } },
            { op: 'delete_edge', edgeId: 12 },
          ],
        },
      },
    ],
    async handle(context, request) {
      const requestId = jsonRpcRequestId(request);
      const params = parseDevMutateGraphParams(request.params);
      if (!params.ok) {
        return createJsonRpcFailure(requestId, -32602, 'Invalid params');
      }

      const graph = await context.getGraphRuntime();
      const scopedGraph = graph.forSpec(params.value.specId);
      const input = translateDevMutateGraph(params.value, {
        resolveNodeCode: scopedGraph.resolveNodeCode,
        resolveEdgeId: scopedGraph.resolveEdgeId,
      });
      const result = 'status' in input ? input : graph.commandExecutor.mutateGraph(input);

      if (result.status === 'success') {
        context.productUpdates?.publish(
          graphMutationProductUpdates({ specId: params.value.specId, lsn: result.lsn }),
        );
      }
      return createJsonRpcSuccess(requestId, result);
    },
  },
];

type DevMutateGraphParamsParseResult =
  | {
      ok: true;
      value: DevMutateGraphParams;
    }
  | { ok: false };

function parseDevMutateGraphParams(value: unknown): DevMutateGraphParamsParseResult {
  if (!Value.Check(DevMutateGraphParamsSchema, value)) return { ok: false };
  return { ok: true, value: Value.Parse(DevMutateGraphParamsSchema, value) };
}

function translateDevMutateGraph(
  params: DevMutateGraphParams,
  resolvers: {
    readonly resolveNodeCode: (code: string) => number | undefined;
    readonly resolveEdgeId: (edgeId: number) => number | undefined;
  },
): MutateGraphInput | StructuralIllegal {
  const diagnostics: Diagnostic[] = [];
  const ops: GraphMutationOp[] = [];

  for (const [index, op] of params.ops.entries()) {
    const path = `ops[${index}]`;
    switch (op.op) {
      case 'create_node':
        ops.push({
          op: 'create_node',
          ref: op.ref,
          plane: op.plane,
          kind: op.kind,
          title: op.title,
          ...(op.body === undefined ? {} : { body: op.body }),
          ...(op.source === undefined ? {} : { source: op.source }),
          ...(op.detail === undefined ? {} : { detail: op.detail }),
        });
        break;
      case 'create_edge': {
        const translated = translateCreateEdgeOp(op, path, resolvers.resolveNodeCode, diagnostics);
        if (translated) ops.push(translated);
        break;
      }
      case 'patch_node': {
        const node = normalizeExistingNodeRef(
          op.node,
          resolvers.resolveNodeCode,
          `${path}.node`,
          diagnostics,
        );
        if (node.status === 'invalid') break;
        ops.push({ op: 'patch_node', node: node.ref, patch: op.patch });
        break;
      }
      case 'patch_edge': {
        const edge = normalizeExistingEdgeRef(
          op.edgeId,
          resolvers.resolveEdgeId,
          `${path}.edgeId`,
          diagnostics,
        );
        if (edge.status === 'invalid') break;
        ops.push({ op: 'patch_edge', edge: edge.ref, patch: op.patch });
        break;
      }
      case 'delete_edge': {
        const edge = normalizeExistingEdgeRef(
          op.edgeId,
          resolvers.resolveEdgeId,
          `${path}.edgeId`,
          diagnostics,
        );
        if (edge.status === 'invalid') break;
        ops.push({ op: 'delete_edge', edge: edge.ref });
        break;
      }
      case 'delete_node': {
        const node = normalizeExistingNodeRef(
          op.node,
          resolvers.resolveNodeCode,
          `${path}.node`,
          diagnostics,
        );
        if (node.status === 'invalid') break;
        ops.push({
          op: 'delete_node',
          node: node.ref,
          ...(op.deleteIncidentEdges === undefined ? {} : { deleteIncidentEdges: op.deleteIncidentEdges }),
        });
        break;
      }
    }
  }

  if (diagnostics.length > 0) return { status: 'structural_illegal', diagnostics };
  return {
    specId: params.specId,
    ...(params.createBasis === undefined ? {} : { createBasis: params.createBasis }),
    ops,
  };
}

function translateCreateEdgeOp(
  op: DevCreateEdgeOp,
  path: string,
  resolveNodeCode: (code: string) => number | undefined,
  diagnostics: Diagnostic[],
): Extract<GraphMutationOp, { readonly op: 'create_edge' }> | undefined {
  const [sourceField, targetField] = authoredEdgeEndpointFields(op.category);
  const source = normalizeGraphMutationNodeRef(
    op[sourceField as keyof DevCreateEdgeOp] as DevCreateEdgeEndpoint,
    resolveNodeCode,
    `${path}.${sourceField}`,
    diagnostics,
  );
  const target = normalizeGraphMutationNodeRef(
    op[targetField as keyof DevCreateEdgeOp] as DevCreateEdgeEndpoint,
    resolveNodeCode,
    `${path}.${targetField}`,
    diagnostics,
  );
  if (source.status === 'invalid' || target.status === 'invalid') return undefined;

  return {
    op: 'create_edge',
    category: op.category,
    [sourceField]: source.ref,
    [targetField]: target.ref,
    ...(op.rationale === undefined ? {} : { rationale: op.rationale }),
    ...('stance' in op ? { stance: op.stance } : {}),
  } as Extract<GraphMutationOp, { readonly op: 'create_edge' }>;
}

type ValidGraphMutationNodeRef = { readonly status: 'valid'; readonly ref: GraphMutationNodeRef };
type ValidExistingNodeRef = { readonly status: 'valid'; readonly ref: ExistingGraphNodeRef };
type ValidExistingEdgeRef = { readonly status: 'valid'; readonly ref: ExistingGraphEdgeRef };
type InvalidRef = { readonly status: 'invalid' };

function normalizeGraphMutationNodeRef(
  ref: DevCreateEdgeEndpoint,
  resolveNodeCode: (code: string) => number | undefined,
  field: string,
  diagnostics: Diagnostic[],
): ValidGraphMutationNodeRef | InvalidRef {
  if (typeof ref === 'string') return { status: 'valid', ref };
  const existing = normalizeExistingNodeRef(ref, resolveNodeCode, field, diagnostics);
  if (existing.status === 'invalid') return existing;
  return { status: 'valid', ref: existing.ref };
}

function normalizeExistingNodeRef(
  ref: DevExistingCodeRef,
  resolveNodeCode: (code: string) => number | undefined,
  field: string,
  diagnostics: Diagnostic[],
): ValidExistingNodeRef | InvalidRef {
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

function normalizeExistingEdgeRef(
  edgeId: number,
  resolveEdgeId: (edgeId: number) => number | undefined,
  field: string,
  diagnostics: Diagnostic[],
): ValidExistingEdgeRef | InvalidRef {
  const resolvedEdgeId = resolveEdgeId(edgeId);
  if (resolvedEdgeId === undefined) {
    diagnostics.push({
      field,
      message: `graph edge id ${edgeId} does not resolve in the selected spec`,
    });
    return { status: 'invalid' };
  }
  return { status: 'valid', ref: { existing: resolvedEdgeId } };
}
