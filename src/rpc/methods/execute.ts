import { Type } from 'typebox';
import { Value } from 'typebox/value';

import { listRuns, readRunDetail } from '../../executor/observer-read.js';
import { createJsonRpcFailure, createJsonRpcSuccess, jsonRpcRequestId } from '../protocol.js';
import type { RpcMethodContext, RpcMethodDefinition } from './registry.js';
import { NoParamsSchema, NonBlankStringSchema } from './schemas.js';

export const UNKNOWN_RUN_ID_MESSAGE = 'Unknown runId';

const ExecuteRunParamsSchema = Type.Object({ runId: NonBlankStringSchema }, { additionalProperties: false });

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
      presence: RunPresenceSchema,
      planPath: Type.String(),
      reportsTail: Type.Array(Type.Object({ event: Type.String() }, { additionalProperties: true })),
      reportsTotal: Type.Integer({ minimum: 0 }),
    },
    { additionalProperties: false },
  ),
  Type.Object({ runId: Type.String(), unreadable: Type.Literal(true) }, { additionalProperties: false }),
]);

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
      let detail;
      try {
        detail = await readRunDetail(context.cwd, request.params.runId);
      } catch {
        // runDirPath rejects traversal-shaped ids before touching the filesystem.
        return createJsonRpcFailure(requestId, -32602, 'Invalid params');
      }
      if (detail === undefined) {
        return createJsonRpcFailure(requestId, -32011, UNKNOWN_RUN_ID_MESSAGE);
      }
      return createJsonRpcSuccess(requestId, detail);
    },
  },
];
