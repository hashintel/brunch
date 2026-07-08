import { Type, type Static, type TSchema } from 'typebox';
import { Value } from 'typebox/value';

import { projectExecuteGraph } from '../../executor/execute-projection.js';
import { listRuns, readRunDetail, readRunTraceIndex } from '../../executor/observer-read.js';
import { writePlanFile, type PlanFileWriteResult } from '../../executor/plan-file.js';
import { abandonRun } from '../../executor/run-abandon.js';
import { recommendRunReplan } from '../../executor/run-replan-recommendation.js';
import { type RunRetryEligibilityResult } from '../../executor/run-retry-eligibility.js';
import { createSupersedingRun } from '../../executor/run-supersession.js';
import { assertSafeRunId, readRunMetadata, runMetadataPath } from '../../executor/run.js';
import { executeRunProductUpdates } from '../product-updates.js';
import { createJsonRpcFailure, createJsonRpcSuccess, jsonRpcRequestId } from '../protocol.js';
import type { RpcMethodContext, RpcMethodDefinition } from './registry.js';
import { NoParamsSchema, NonBlankStringSchema, PositiveIntegerSchema } from './schemas.js';

export const UNKNOWN_RUN_ID_MESSAGE = 'Unknown runId';

const ExecuteRunParamsSchema = Type.Object({ runId: NonBlankStringSchema }, { additionalProperties: false });
const ExecuteRunTraceIndexParamsSchema = Type.Object(
  { specId: Type.Integer({ minimum: 1 }) },
  { additionalProperties: false },
);
const ExecuteModeSchema = Type.Union([Type.Literal('greenfield'), Type.Literal('brownfield')]);
const ExecuteReplanRecommendationParamsSchema = Type.Object(
  {
    runId: NonBlankStringSchema,
    specId: PositiveIntegerSchema,
    mode: Type.Optional(ExecuteModeSchema),
  },
  { additionalProperties: false },
);
const ExecuteReplanRegeneratePlanParamsSchema = Type.Object(
  {
    runId: NonBlankStringSchema,
    specId: PositiveIntegerSchema,
    mode: Type.Optional(ExecuteModeSchema),
  },
  { additionalProperties: false },
);
const ExecuteReplanStartNewRunParamsSchema = Type.Object(
  {
    previousRunId: NonBlankStringSchema,
    specId: PositiveIntegerSchema,
    runId: Type.Optional(NonBlankStringSchema),
    mode: Type.Optional(ExecuteModeSchema),
  },
  { additionalProperties: false },
);
const ExecuteReplanAbandonRunParamsSchema = Type.Object(
  {
    runId: NonBlankStringSchema,
    reason: Type.Optional(NonBlankStringSchema),
  },
  { additionalProperties: false },
);

type ExecuteReplanRegeneratePlanParams = Static<typeof ExecuteReplanRegeneratePlanParamsSchema>;

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
      sliceProgress: Type.Array(
        Type.Object(
          {
            sliceId: Type.String(),
            progress: Type.String(),
          },
          { additionalProperties: false },
        ),
      ),
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
const ExecuteReplanRecommendationResultSchema = Type.Object({}, { additionalProperties: true });
const ExecuteReplanMutationResultSchema = Type.Object({}, { additionalProperties: true });

type ExecuteReplanRegeneratePlanResult =
  | {
      readonly status: 'regenerate_not_allowed';
      readonly eligibility: RunRetryEligibilityResult;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'projection_blocked';
      readonly eligibility: RunRetryEligibilityResult;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'regenerated_plan';
      readonly eligibility: RunRetryEligibilityResult;
      readonly artifact: PlanFileWriteResult;
      readonly sideEffects: PlanFileWriteResult['sideEffects'];
    };

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
  {
    method: 'execute.replanRecommendation',
    access: 'read',
    description:
      'Return a human-readable retry/replan diagnosis and allowed action set for one executor run, without mutating run state.',
    paramsSchema: ExecuteReplanRecommendationParamsSchema,
    resultSchema: ExecuteReplanRecommendationResultSchema,
    examples: [
      {
        jsonrpc: '2.0',
        id: 23,
        method: 'execute.replanRecommendation',
        params: { runId: 'run-1', specId: 1 },
      },
    ],
    async handle(context, request) {
      const requestId = jsonRpcRequestId(request);
      const params = parseParams(ExecuteReplanRecommendationParamsSchema, request.params);
      if (!params || !safeRunId(params.runId)) {
        return createJsonRpcFailure(requestId, -32602, 'Invalid params');
      }
      if (!(await requestSpecMatchesRun(context.cwd, params.runId, params.specId))) {
        return createJsonRpcFailure(requestId, -32602, 'Invalid params');
      }
      const result = await recommendRunReplan({
        cwd: context.cwd,
        runId: params.runId,
        current: await currentProjection(context, params),
      });
      return createJsonRpcSuccess(requestId, result);
    },
  },
  {
    method: 'execute.replanRegeneratePlan',
    access: 'write',
    description:
      'Regenerate plan.yaml and provenance for a stale early executor run when current graph projection is plan-ready. Does not mutate run metadata.',
    paramsSchema: ExecuteReplanRegeneratePlanParamsSchema,
    resultSchema: ExecuteReplanMutationResultSchema,
    examples: [
      {
        jsonrpc: '2.0',
        id: 24,
        method: 'execute.replanRegeneratePlan',
        params: { runId: 'run-1', specId: 1 },
      },
    ],
    async handle(context, request) {
      const requestId = jsonRpcRequestId(request);
      const params = parseParams(ExecuteReplanRegeneratePlanParamsSchema, request.params);
      if (!params || !safeRunId(params.runId)) {
        return createJsonRpcFailure(requestId, -32602, 'Invalid params');
      }
      if (!(await requestSpecMatchesRun(context.cwd, params.runId, params.specId))) {
        return createJsonRpcFailure(requestId, -32602, 'Invalid params');
      }
      const result = await regeneratePlan(context, params);
      if (result.sideEffects.length > 0) {
        context.productUpdates?.publish(executeRunProductUpdates(params.runId));
      }
      return createJsonRpcSuccess(requestId, result);
    },
  },
  {
    method: 'execute.replanStartNewRun',
    access: 'write',
    description:
      'Create a fresh executor run that supersedes a prior run when the current plan is launch-ready. Does not mutate the prior run or execute the new run.',
    paramsSchema: ExecuteReplanStartNewRunParamsSchema,
    resultSchema: ExecuteReplanMutationResultSchema,
    examples: [
      {
        jsonrpc: '2.0',
        id: 25,
        method: 'execute.replanStartNewRun',
        params: { previousRunId: 'run-1', specId: 1 },
      },
    ],
    async handle(context, request) {
      const requestId = jsonRpcRequestId(request);
      const params = parseParams(ExecuteReplanStartNewRunParamsSchema, request.params);
      if (
        !params ||
        !safeRunId(params.previousRunId) ||
        (params.runId !== undefined && !safeRunId(params.runId))
      ) {
        return createJsonRpcFailure(requestId, -32602, 'Invalid params');
      }
      if (!(await requestSpecMatchesRun(context.cwd, params.previousRunId, params.specId))) {
        return createJsonRpcFailure(requestId, -32602, 'Invalid params');
      }
      const current = await currentProjection(context, params);
      const recommendation = await recommendRunReplan({
        cwd: context.cwd,
        runId: params.previousRunId,
        current,
      });
      if (!recommendation.allowedActions.includes('start_new_run')) {
        return createJsonRpcSuccess(requestId, {
          status: 'start_new_run_not_allowed',
          eligibility: recommendation.eligibility,
          sideEffects: [],
        });
      }
      const result = await createSupersedingRun({
        cwd: context.cwd,
        previousRunId: params.previousRunId,
        current,
        ...(params.runId ? { runId: params.runId } : {}),
      });
      if (result.sideEffects.length > 0) {
        context.productUpdates?.publish([
          ...executeRunProductUpdates(params.previousRunId),
          ...executeRunProductUpdates(result.status === 'created' ? result.runId : undefined),
        ]);
      }
      return createJsonRpcSuccess(requestId, result);
    },
  },
  {
    method: 'execute.replanAbandonRun',
    access: 'write',
    description:
      'Mark a non-terminal executor run abandoned without deleting worktree, reports, Petri, promotion, or graph state.',
    paramsSchema: ExecuteReplanAbandonRunParamsSchema,
    resultSchema: ExecuteReplanMutationResultSchema,
    examples: [
      {
        jsonrpc: '2.0',
        id: 26,
        method: 'execute.replanAbandonRun',
        params: { runId: 'run-1', reason: 'User chose to replan' },
      },
    ],
    async handle(context, request) {
      const requestId = jsonRpcRequestId(request);
      const params = parseParams(ExecuteReplanAbandonRunParamsSchema, request.params);
      if (!params || !safeRunId(params.runId)) {
        return createJsonRpcFailure(requestId, -32602, 'Invalid params');
      }
      const result = await abandonRun({
        cwd: context.cwd,
        runId: params.runId,
        ...(params.reason ? { reason: params.reason } : {}),
      });
      if (result.sideEffects.length > 0) {
        context.productUpdates?.publish(executeRunProductUpdates(params.runId));
      }
      return createJsonRpcSuccess(requestId, result);
    },
  },
];

function parseParams<Schema extends TSchema>(schema: Schema, value: unknown): Static<Schema> | undefined {
  if (!Value.Check(schema, value)) return undefined;
  return Value.Parse(schema, value) as Static<Schema>;
}

function safeRunId(runId: string): boolean {
  try {
    assertSafeRunId(runId);
    return true;
  } catch {
    return false;
  }
}

async function requestSpecMatchesRun(cwd: string, runId: string, specId: number): Promise<boolean> {
  const metadata = await readRunMetadata(runMetadataPath(cwd, runId));
  return metadata === undefined || metadata.specId === String(specId);
}

async function currentProjection(
  context: RpcMethodContext,
  params: { readonly specId: number; readonly mode?: 'greenfield' | 'brownfield' },
) {
  const graph = (await context.getGraphRuntime()).forSpec(params.specId).queryGraph(undefined, {
    visibility: 'active',
  });
  const mode = params.mode ?? 'greenfield';
  const projection = projectExecuteGraph({
    specId: params.specId,
    mode,
    graphLsn: graph.lsn,
    nodes: graph.nodes,
    edges: graph.edges,
  });
  return {
    specId: String(params.specId),
    mode,
    source: projection.source,
    checkStatus: projection.check.status,
  } as const;
}

async function regeneratePlan(
  context: RpcMethodContext,
  params: ExecuteReplanRegeneratePlanParams,
): Promise<ExecuteReplanRegeneratePlanResult> {
  const graph = (await context.getGraphRuntime()).forSpec(params.specId).queryGraph(undefined, {
    visibility: 'active',
  });
  const mode = params.mode ?? 'greenfield';
  const projection = projectExecuteGraph({
    specId: params.specId,
    mode,
    graphLsn: graph.lsn,
    nodes: graph.nodes,
    edges: graph.edges,
  });
  const current = {
    specId: String(params.specId),
    mode,
    source: projection.source,
    checkStatus: projection.check.status,
  } as const;
  const eligibility = await recommendRunReplan({ cwd: context.cwd, runId: params.runId, current }).then(
    (recommendation) => recommendation.eligibility,
  );
  if (eligibility.status !== 'replan_before_retry') {
    return { status: 'regenerate_not_allowed', eligibility, sideEffects: [] };
  }
  if (projection.check.status !== 'ok') {
    return { status: 'projection_blocked', eligibility, sideEffects: [] };
  }
  const artifact = await writePlanFile({
    cwd: context.cwd,
    preview: projection.planPreview,
    source: projection.source,
  });
  return { status: 'regenerated_plan', eligibility, artifact, sideEffects: artifact.sideEffects };
}
