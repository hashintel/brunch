import { Type } from 'typebox';
import { Value } from 'typebox/value';

import { listRuns, readRunDetail, readRunTraceIndex } from '../../executor/observer-read.js';
import { assertSafeRunId } from '../../executor/run.js';
import { createJsonRpcFailure, createJsonRpcSuccess, jsonRpcRequestId } from '../protocol.js';
import type { RpcMethodContext, RpcMethodDefinition } from './registry.js';
import { NoParamsSchema, NonBlankStringSchema } from './schemas.js';

export const UNKNOWN_RUN_ID_MESSAGE = 'Unknown runId';

const ExecuteRunParamsSchema = Type.Object({ runId: NonBlankStringSchema }, { additionalProperties: false });
const ExecuteRunTraceIndexParamsSchema = Type.Object(
  { specId: Type.Integer({ minimum: 1 }) },
  { additionalProperties: false },
);

const RunPresenceSchema = Type.Object(
  {
    worktree: Type.Boolean(),
    reports: Type.Boolean(),
    petri: Type.Boolean(),
    promotion: Type.Boolean(),
  },
  { additionalProperties: false },
);

const RunListEntrySchema = Type.Union([
  Type.Object(
    {
      runId: Type.String(),
      specId: Type.String(),
      status: Type.String(),
      activeSliceId: Type.Optional(Type.String()),
      completedSliceIds: Type.Optional(Type.Array(Type.String())),
      supersedesRunId: Type.Optional(Type.String()),
      abandonedAt: Type.Optional(Type.String()),
      abandonReason: Type.Optional(Type.String()),
      presence: RunPresenceSchema,
    },
    { additionalProperties: false },
  ),
  Type.Object({ runId: Type.String(), unreadable: Type.Literal(true) }, { additionalProperties: false }),
]);

const ExecuteRunsResultSchema = Type.Object(
  { runs: Type.Array(RunListEntrySchema) },
  { additionalProperties: false },
);

const ExecuteRunResultSchema = Type.Union([
  Type.Object(
    {
      runId: Type.String(),
      specId: Type.String(),
      status: Type.String(),
      activeSliceId: Type.Optional(Type.String()),
      completedSliceIds: Type.Optional(Type.Array(Type.String())),
      supersedesRunId: Type.Optional(Type.String()),
      abandonedAt: Type.Optional(Type.String()),
      abandonReason: Type.Optional(Type.String()),
      presence: RunPresenceSchema,
      planPath: Type.String(),
      reportsTail: Type.Array(Type.Object({ event: Type.String() }, { additionalProperties: true })),
      reportsTotal: Type.Integer({ minimum: 0 }),
      agentStreamTail: Type.Array(
        Type.Object(
          {
            event: Type.Literal('agent_stream'),
            runId: Type.String(),
            epicId: Type.String(),
            sliceId: Type.String(),
            sequence: Type.Integer({ minimum: 0 }),
            kind: Type.Union([Type.Literal('status'), Type.Literal('message'), Type.Literal('tool')]),
            message: Type.String(),
          },
          { additionalProperties: false },
        ),
      ),
      agentStreamTotal: Type.Integer({ minimum: 0 }),
      verifyStreamTail: Type.Array(
        Type.Object(
          {
            event: Type.Literal('verify_stream'),
            runId: Type.String(),
            epicId: Type.String(),
            sliceId: Type.String(),
            sequence: Type.Integer({ minimum: 0 }),
            kind: Type.Union([Type.Literal('status'), Type.Literal('stdout'), Type.Literal('stderr')]),
            message: Type.String(),
          },
          { additionalProperties: false },
        ),
      ),
      verifyStreamTotal: Type.Integer({ minimum: 0 }),
      requirements: Type.Array(
        Type.Object(
          {
            requirementId: Type.String(),
            content: Type.String(),
            status: Type.Union([
              Type.Literal('unmapped'),
              Type.Literal('pending'),
              Type.Literal('running'),
              Type.Literal('failed'),
              Type.Literal('missing_verification'),
              Type.Literal('unverified'),
              Type.Literal('passed'),
            ]),
            sliceIds: Type.Array(Type.String()),
            completedSliceIds: Type.Array(Type.String()),
            failedSliceIds: Type.Array(Type.String()),
            missingVerificationSliceIds: Type.Array(Type.String()),
            criterionIds: Type.Array(Type.String()),
          },
          { additionalProperties: false },
        ),
      ),
      petriNet: Type.Optional(Type.Unknown({ description: 'Raw petrinaut/net.json when present.' })),
    },
    { additionalProperties: false },
  ),
  Type.Object({ runId: Type.String(), unreadable: Type.Literal(true) }, { additionalProperties: false }),
]);

const RunTraceEntrySchema = Type.Object(
  {
    nodeCode: Type.String(),
    runId: Type.String(),
    specId: Type.String(),
    runStatus: Type.String(),
    sliceIds: Type.Array(Type.String()),
    failedSliceIds: Type.Array(Type.String()),
    completedSliceIds: Type.Array(Type.String()),
  },
  { additionalProperties: false },
);

const ExecuteRunTraceIndexResultSchema = Type.Object(
  { traces: Type.Array(RunTraceEntrySchema) },
  { additionalProperties: false },
);

export const executeRpcMethods: readonly RpcMethodDefinition<RpcMethodContext>[] = [
  {
    method: 'execute.runs',
    access: 'read',
    description:
      'List executor run bundles under .brunch/cook/runs with recorded status and artifact-presence flags; torn run metadata is marked unreadable, never an error.',
    paramsSchema: NoParamsSchema,
    resultSchema: ExecuteRunsResultSchema,
    examples: [{ jsonrpc: '2.0', id: 20, method: 'execute.runs' }],
    async handle(context, request) {
      const requestId = jsonRpcRequestId(request);
      if (request.params !== undefined) {
        return createJsonRpcFailure(requestId, -32602, 'Invalid params');
      }
      return createJsonRpcSuccess(requestId, { runs: await listRuns(context.cwd) });
    },
  },
  {
    method: 'execute.run',
    access: 'read',
    description:
      'Return one executor run projection: recorded run.json snapshot, artifact-presence flags, and the reports.jsonl event tail (events lead the metadata snapshot by design).',
    paramsSchema: ExecuteRunParamsSchema,
    resultSchema: ExecuteRunResultSchema,
    examples: [{ jsonrpc: '2.0', id: 21, method: 'execute.run', params: { runId: 'run-1' } }],
    async handle(context, request) {
      const requestId = jsonRpcRequestId(request);
      if (!Value.Check(ExecuteRunParamsSchema, request.params)) {
        return createJsonRpcFailure(requestId, -32602, 'Invalid params');
      }
      try {
        assertSafeRunId(request.params.runId);
      } catch {
        return createJsonRpcFailure(requestId, -32602, 'Invalid params');
      }
      const detail = await readRunDetail(context.cwd, request.params.runId);
      if (detail === undefined) {
        return createJsonRpcFailure(requestId, -32011, UNKNOWN_RUN_ID_MESSAGE);
      }
      return createJsonRpcSuccess(requestId, detail);
    },
  },
  {
    method: 'execute.runTraceIndex',
    access: 'read',
    description:
      'Return graph-node-to-run traceability for one spec, derived from run plans and reports without exposing run artifact paths.',
    paramsSchema: ExecuteRunTraceIndexParamsSchema,
    resultSchema: ExecuteRunTraceIndexResultSchema,
    examples: [{ jsonrpc: '2.0', id: 22, method: 'execute.runTraceIndex', params: { specId: 1 } }],
    async handle(context, request) {
      const requestId = jsonRpcRequestId(request);
      if (!Value.Check(ExecuteRunTraceIndexParamsSchema, request.params)) {
        return createJsonRpcFailure(requestId, -32602, 'Invalid params');
      }
      return createJsonRpcSuccess(
        requestId,
        await readRunTraceIndex(context.cwd, String(request.params.specId)),
      );
    },
  },
];
