import { Type, type Static } from 'typebox';
import { Value } from 'typebox/value';

import { createJsonRpcFailure, createJsonRpcSuccess, jsonRpcRequestId } from '../protocol.js';
import type { RpcMethodContext, RpcMethodDefinition } from './registry.js';
import { PositiveIntegerSchema } from './schemas.js';

const GraphOverviewParamsSchema = Type.Object(
  {
    specId: PositiveIntegerSchema,
  },
  { additionalProperties: false },
);

type GraphOverviewParams = Static<typeof GraphOverviewParamsSchema>;

const GraphNodeNeighborhoodParamsSchema = Type.Object(
  {
    specId: PositiveIntegerSchema,
    nodeId: PositiveIntegerSchema,
    hops: Type.Optional(PositiveIntegerSchema),
  },
  { additionalProperties: false },
);

type GraphNodeNeighborhoodParams = Static<typeof GraphNodeNeighborhoodParamsSchema>;

const GraphNodeResultSchema = Type.Object({}, { additionalProperties: true });
const GraphEdgeResultSchema = Type.Object({}, { additionalProperties: true });

const GraphOverviewResultSchema = Type.Object(
  {
    nodes: Type.Array(GraphNodeResultSchema),
    edges: Type.Array(GraphEdgeResultSchema),
    lsn: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);

const GraphNodeNeighborhoodResultSchema = Type.Union([
  Type.Object(
    {
      selector: Type.Object({}, { additionalProperties: true }),
      status: Type.Literal('found'),
      node: GraphNodeResultSchema,
      related: Type.Array(GraphNodeResultSchema),
      edges: Type.Array(GraphEdgeResultSchema),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      selector: Type.Object({}, { additionalProperties: true }),
      status: Type.Literal('not_found'),
      related: Type.Array(GraphNodeResultSchema),
      edges: Type.Array(GraphEdgeResultSchema),
    },
    { additionalProperties: false },
  ),
]);

export const graphRpcMethods: readonly RpcMethodDefinition<RpcMethodContext>[] = [
  {
    method: 'graph.overview',
    access: 'read',
    description: 'Return the canonical selected-spec graph slice with nodes, edges, and current graph LSN.',
    paramsSchema: GraphOverviewParamsSchema,
    resultSchema: GraphOverviewResultSchema,
    examples: [
      {
        jsonrpc: '2.0',
        id: 12,
        method: 'graph.overview',
        params: { specId: 1 },
      },
    ],
    async handle(context, request) {
      const requestId = jsonRpcRequestId(request);
      const params = parseGraphOverviewParams(request.params);
      if (!params.ok) {
        return createJsonRpcFailure(requestId, -32602, 'Invalid params');
      }
      const graph = await context.getGraphRuntime();
      const result = graph.forSpec(params.value.specId).queryGraph();
      return createJsonRpcSuccess(requestId, result);
    },
  },
  {
    method: 'graph.nodeNeighborhood',
    access: 'read',
    description:
      'Return a focused same-spec graph neighborhood around one node, or not_found when the node is absent from that spec.',
    paramsSchema: GraphNodeNeighborhoodParamsSchema,
    resultSchema: GraphNodeNeighborhoodResultSchema,
    examples: [
      {
        jsonrpc: '2.0',
        id: 13,
        method: 'graph.nodeNeighborhood',
        params: { specId: 1, nodeId: 10, hops: 1 },
      },
    ],
    async handle(context, request) {
      const requestId = jsonRpcRequestId(request);
      const params = parseGraphNodeNeighborhoodParams(request.params);
      if (!params.ok) {
        return createJsonRpcFailure(requestId, -32602, 'Invalid params');
      }
      const graph = await context.getGraphRuntime();
      const [result] = graph
        .forSpec(params.value.specId)
        .getNodes(
          [{ id: params.value.nodeId }],
          params.value.hops === undefined ? undefined : { hops: params.value.hops },
        );
      return createJsonRpcSuccess(
        requestId,
        result ?? { selector: { id: params.value.nodeId }, status: 'not_found', related: [], edges: [] },
      );
    },
  },
];

type GraphOverviewParamsParseResult =
  | {
      ok: true;
      value: GraphOverviewParams;
    }
  | { ok: false };

function parseGraphOverviewParams(value: unknown): GraphOverviewParamsParseResult {
  if (!Value.Check(GraphOverviewParamsSchema, value)) {
    return { ok: false };
  }
  return { ok: true, value: Value.Parse(GraphOverviewParamsSchema, value) };
}

type GraphNodeNeighborhoodParamsParseResult =
  | {
      ok: true;
      value: GraphNodeNeighborhoodParams;
    }
  | { ok: false };

function parseGraphNodeNeighborhoodParams(value: unknown): GraphNodeNeighborhoodParamsParseResult {
  if (!Value.Check(GraphNodeNeighborhoodParamsSchema, value)) {
    return { ok: false };
  }
  return { ok: true, value: Value.Parse(GraphNodeNeighborhoodParamsSchema, value) };
}
