import { Type, type Static } from 'typebox';
import { Value } from 'typebox/value';

import {
  readBrunchSessionEnvelope,
  NonLinearTranscriptError,
  type BrunchSessionEnvelope,
} from '../../session/brunch-session-envelope.js';
import { projectLinearElicitationExchangeProjection } from '../../session/elicitation-exchange.js';
import { projectSessionRuntimeState } from '../../session/runtime-state.js';
import {
  resolveExplicitSessionProjectionTarget,
  type ExplicitSessionProjectionParams,
  type SessionProjectionTarget,
} from '../../session/session-projection-reader.js';
import {
  acceptedResponseFromParams,
  nextDeterministicElicitationExchange,
  pendingExchangeFromEnvelope,
  PendingElicitationExchangeSchema,
  presentToolResultMessage,
  projectPendingElicitationExchange,
} from '../../session/structured-exchange-loop.js';
import type {
  PendingElicitationExchange,
  StructuredExchangeResponseInput,
} from '../../session/structured-exchange-loop.js';
import type {
  DefaultWorkspaceCoordinator,
  WorkspaceActivationState,
  WorkspaceSessionState,
} from '../../session/workspace-session-coordinator.js';
import { selectedSessionProductUpdates, type ProductUpdatePublisher } from '../product-updates.js';
import {
  createJsonRpcFailure,
  createJsonRpcSuccess,
  jsonRpcRequestId,
  type JsonRpcId,
  type JsonRpcResponse,
} from '../protocol.js';
import type { RpcMethodContext, RpcMethodDefinition } from './registry.js';
import {
  NoParamsSchema,
  NonBlankStringSchema,
  NonNegativeIntegerSchema,
  PositiveIntegerSchema,
} from './schemas.js';

const SessionProjectionParamsSchema = Type.Object(
  {
    sessionId: NonBlankStringSchema,
    specId: Type.Optional(PositiveIntegerSchema),
  },
  { additionalProperties: false },
);

const RuntimeStateParamsSchema = Type.Object(
  {
    sessionId: NonBlankStringSchema,
    specId: PositiveIntegerSchema,
  },
  { additionalProperties: false },
);

const SessionExchangesResultSchema = Type.Object(
  {
    status: Type.String(),
    exchanges: Type.Array(Type.Object({}, { additionalProperties: true })),
  },
  { additionalProperties: true },
);

const RuntimeStateResultSchema = Type.Object(
  {
    status: Type.Literal('ready'),
    specId: PositiveIntegerSchema,
    sessionId: NonBlankStringSchema,
    agent: Type.Object(
      {
        operationalMode: Type.Literal('elicit'),
        role: Type.Literal('elicitor'),
        strategy: Type.Union([
          Type.Literal('auto'),
          Type.Literal('step-wise-decision-tree'),
          Type.Literal('step-wise-disambiguate'),
          Type.Literal('propose-graph'),
          Type.Literal('project-graph'),
        ]),
        lens: Type.Union([
          Type.Literal('auto'),
          Type.Literal('intent'),
          Type.Literal('design'),
          Type.Literal('oracle'),
        ]),
        goal: Type.Union([
          Type.Literal('auto'),
          Type.Literal('grounding-advance'),
          Type.Literal('elicit-expand'),
          Type.Literal('commit-converge'),
          Type.Literal('capture-posture'),
        ]),
      },
      { additionalProperties: false },
    ),
    mentions: Type.Object(
      {
        graphNodes: Type.Array(
          Type.Object(
            {
              id: NonBlankStringSchema,
              handle: Type.Optional(NonBlankStringSchema),
              title: Type.Optional(NonBlankStringSchema),
              seenLsn: Type.Optional(PositiveIntegerSchema),
            },
            { additionalProperties: false },
          ),
        ),
        files: Type.Array(
          Type.Object(
            {
              path: NonBlankStringSchema,
              seenGitHead: Type.Optional(NonBlankStringSchema),
            },
            { additionalProperties: false },
          ),
        ),
      },
      { additionalProperties: false },
    ),
    world: Type.Object(
      {
        graph: Type.Object(
          {
            latestLsn: Type.Union([NonNegativeIntegerSchema, Type.Null()]),
          },
          { additionalProperties: false },
        ),
        git: Type.Object(
          {
            head: Type.Union([NonBlankStringSchema, Type.Null()]),
          },
          { additionalProperties: false },
        ),
      },
      { additionalProperties: false },
    ),
    lifecycle: Type.Object(
      {
        specOrigin: Type.Union([Type.Literal('new'), Type.Literal('existing'), Type.Null()]),
        sessionOrigin: Type.Union([Type.Literal('new'), Type.Literal('resumed'), Type.Null()]),
        sessionIndexInSpec: Type.Union([PositiveIntegerSchema, Type.Null()]),
        isFirstSessionForSpec: Type.Union([Type.Boolean(), Type.Null()]),
        isTenthSessionForSpec: Type.Union([Type.Boolean(), Type.Null()]),
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);

const TriggerExchangeResultSchema = Type.Object(
  {
    status: Type.Literal('pending'),
    exchange: PendingElicitationExchangeSchema,
  },
  { additionalProperties: false },
);

const PendingExchangeResultSchema = Type.Union([
  TriggerExchangeResultSchema,
  Type.Object(
    {
      status: Type.Literal('idle'),
      exchange: Type.Null(),
    },
    { additionalProperties: false },
  ),
]);

const ExchangeResponseParamsSchema = Type.Object(
  {
    exchangeId: NonBlankStringSchema,
    answer: Type.Union([
      Type.Object(
        { text: NonBlankStringSchema },
        {
          additionalProperties: false,
        },
      ),
      Type.Object(
        { optionId: NonBlankStringSchema },
        {
          additionalProperties: false,
        },
      ),
      Type.Object(
        { optionIds: Type.Array(NonBlankStringSchema, { minItems: 1 }) },
        { additionalProperties: false },
      ),
    ]),
    note: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

const ExchangeResponseResultSchema = Type.Object(
  {
    status: Type.Literal('accepted'),
    exchangeId: NonBlankStringSchema,
    answer: Type.Object({}, { additionalProperties: true }),
    note: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

type ExchangeResponseParams = StructuredExchangeResponseInput;
type ExchangeResponseResult = Static<typeof ExchangeResponseResultSchema>;

export const sessionRpcMethods: readonly RpcMethodDefinition<RpcMethodContext>[] = [
  {
    method: 'session.exchanges',
    access: 'read',
    description:
      'Project structured elicitation exchanges from the selected or explicitly named linear Brunch session transcript.',
    paramsSchema: SessionProjectionParamsSchema,
    resultSchema: SessionExchangesResultSchema,
    examples: [
      {
        jsonrpc: '2.0',
        id: 6,
        method: 'session.exchanges',
        params: { sessionId: 'session-1', specId: 1 },
      },
    ],
    async handle(context, request) {
      return handleSessionProjection(
        jsonRpcRequestId(request),
        request.params,
        context,
        projectLinearElicitationExchangeProjection,
      );
    },
  },
  {
    method: 'session.runtimeState',
    access: 'read',
    description:
      'Return flattened transcript-backed runtime posture, mention, world-watermark, and lifecycle state for an explicit Brunch session.',
    paramsSchema: RuntimeStateParamsSchema,
    resultSchema: RuntimeStateResultSchema,
    examples: [
      {
        jsonrpc: '2.0',
        id: 14,
        method: 'session.runtimeState',
        params: { sessionId: 'session-1', specId: 1 },
      },
    ],
    async handle(context, request) {
      return handleSessionProjection(
        jsonRpcRequestId(request),
        request.params,
        context,
        projectSessionRuntimeState,
        { requireExplicitSpec: true },
      );
    },
  },
  {
    method: 'session.triggerExchange',
    access: 'write',
    description:
      "Start or resume the selected session's deterministic structured-exchange permutation loop and return the current pending exchange.",
    paramsSchema: NoParamsSchema,
    resultSchema: TriggerExchangeResultSchema,
    examples: [{ jsonrpc: '2.0', id: 8, method: 'session.triggerExchange' }],
    async handle(context, request) {
      const requestId = jsonRpcRequestId(request);
      if (request.params !== undefined) {
        return createJsonRpcFailure(requestId, -32602, 'Invalid params');
      }
      return handleTriggerExchange(requestId, context);
    },
  },
  {
    method: 'session.pendingExchange',
    access: 'read',
    description:
      'Read the current transcript-backed pending elicitation exchange from the selected or explicitly named linear Brunch session.',
    paramsSchema: SessionProjectionParamsSchema,
    resultSchema: PendingExchangeResultSchema,
    examples: [
      { jsonrpc: '2.0', id: 9, method: 'session.pendingExchange' },
      {
        jsonrpc: '2.0',
        id: 10,
        method: 'session.pendingExchange',
        params: { sessionId: 'session-1', specId: 1 },
      },
    ],
    async handle(context, request) {
      return handleSessionProjection(
        jsonRpcRequestId(request),
        request.params,
        context,
        projectPendingElicitationExchange,
      );
    },
  },
  {
    method: 'session.submitExchangeResponse',
    access: 'write',
    description:
      "Submit a text, single-choice, or multi-choice answer for the selected session's current deterministic tuple-shaped pending structured exchange.",
    paramsSchema: ExchangeResponseParamsSchema,
    resultSchema: ExchangeResponseResultSchema,
    examples: [
      {
        jsonrpc: '2.0',
        id: 11,
        method: 'session.submitExchangeResponse',
        params: {
          exchangeId: 'deterministic-grounding-choice',
          answer: { optionId: 'new-from-scratch' },
          note: 'This is a greenfield product.',
        },
      },
    ],
    async handle(context, request) {
      return handleSubmitExchangeResponse(jsonRpcRequestId(request), request.params, context);
    },
  },
];
async function handleSessionProjection<T>(
  requestId: JsonRpcId,
  rawParams: unknown,
  options: {
    coordinator: DefaultWorkspaceCoordinator;
    cwd: string;
  },
  loadProjection: (envelope: BrunchSessionEnvelope) => T,
  policy: { requireExplicitSpec?: boolean } = {},
): Promise<JsonRpcResponse> {
  const params = parseSessionProjectionParams(rawParams);
  if (!params.ok || (policy.requireExplicitSpec && params.value?.specId === undefined)) {
    return createJsonRpcFailure(requestId, -32602, 'Invalid params');
  }

  const target = params.value
    ? await resolveExplicitSessionProjectionTarget(options.cwd, params.value)
    : await selectedSessionFile(await options.coordinator.openDefaultWorkspace());
  if (!target.ok) {
    return createJsonRpcFailure(requestId, target.code, target.message);
  }

  try {
    return createJsonRpcSuccess(requestId, loadProjection(target.envelope));
  } catch (error) {
    if (error instanceof NonLinearTranscriptError) {
      return createJsonRpcFailure(requestId, -32002, target.nonLinearMessage);
    }
    throw error;
  }
}

async function handleTriggerExchange(
  requestId: JsonRpcId,
  options: {
    coordinator: DefaultWorkspaceCoordinator;
    cwd: string;
    productUpdates?: ProductUpdatePublisher;
  },
): Promise<JsonRpcResponse> {
  const state = await options.coordinator.openDefaultWorkspace();
  if (state.status !== 'ready') {
    return createJsonRpcFailure(requestId, -32001, 'No selected Brunch session');
  }

  const existingTarget = await selectedSessionFile(state);
  if (!existingTarget.ok) {
    return createJsonRpcFailure(requestId, existingTarget.code, existingTarget.message);
  }

  const existing = pendingExchangeFromEnvelope(existingTarget.envelope);
  if (existing) {
    return createJsonRpcSuccess(requestId, {
      status: 'pending',
      exchange: existing,
    });
  }

  const exchange = nextDeterministicElicitationExchange(
    projectLinearElicitationExchangeProjection(existingTarget.envelope).exchanges.length,
  );
  const manager = state.session.manager;
  manager.appendMessage(presentToolResultMessage(exchange));
  flushSessionEntries(manager, state.session.file);

  const reloadedTarget = await selectedSessionFile(state);
  if (!reloadedTarget.ok) {
    return createJsonRpcFailure(requestId, reloadedTarget.code, reloadedTarget.message);
  }
  const reloaded = pendingExchangeFromEnvelope(reloadedTarget.envelope);

  const result = {
    status: 'pending' as const,
    exchange: reloaded ?? exchange,
  };
  publishSelectedSessionUpdates(options.productUpdates, state);
  return createJsonRpcSuccess(requestId, result);
}

async function handleSubmitExchangeResponse(
  requestId: JsonRpcId,
  rawParams: unknown,
  options: {
    coordinator: DefaultWorkspaceCoordinator;
    cwd: string;
    productUpdates?: ProductUpdatePublisher;
  },
): Promise<JsonRpcResponse> {
  if (!Value.Check(ExchangeResponseParamsSchema, rawParams)) {
    return createJsonRpcFailure(requestId, -32602, 'Invalid params');
  }
  const params = Value.Parse(ExchangeResponseParamsSchema, rawParams) as ExchangeResponseParams;

  const state = await options.coordinator.openDefaultWorkspace();
  if (state.status !== 'ready') {
    return createJsonRpcFailure(requestId, -32001, 'No selected Brunch session');
  }

  const target = await selectedSessionFile(state);
  if (!target.ok) {
    return createJsonRpcFailure(requestId, target.code, target.message);
  }

  let pending: PendingElicitationExchange | null;
  try {
    pending = pendingExchangeFromEnvelope(target.envelope);
  } catch (error) {
    if (error instanceof NonLinearTranscriptError) {
      return createJsonRpcFailure(requestId, -32002, target.nonLinearMessage);
    }
    throw error;
  }

  if (!pending) {
    return createJsonRpcFailure(requestId, -32008, 'No pending elicitation exchange');
  }

  if (params.exchangeId !== pending.exchangeId) {
    return createJsonRpcFailure(requestId, -32006, 'Pending elicitation exchange does not match request');
  }

  const accepted = acceptedResponseFromParams(pending, params);
  if (!accepted.ok) {
    return createJsonRpcFailure(requestId, -32007, accepted.message);
  }

  const result: ExchangeResponseResult = {
    status: 'accepted',
    exchangeId: pending.exchangeId,
    answer: accepted.answer,
    ...(params.note === undefined ? {} : { note: params.note }),
  };

  state.session.manager.appendMessage(accepted.toolResultMessage);
  flushSessionEntries(state.session.manager, state.session.file);

  publishSelectedSessionUpdates(options.productUpdates, state);
  return createJsonRpcSuccess(requestId, result);
}

interface FlushableSessionManager {
  _rewriteFile(): void;
  setSessionFile(file: string): void;
}

function flushSessionEntries(manager: unknown, sessionFile: string): void {
  const flushable = manager as FlushableSessionManager;
  flushable._rewriteFile();
  flushable.setSessionFile(sessionFile);
}

type SessionProjectionParamsParseResult =
  | {
      ok: true;
      value: ExplicitSessionProjectionParams | null;
    }
  | { ok: false };

function parseSessionProjectionParams(value: unknown): SessionProjectionParamsParseResult {
  if (value === undefined) {
    return { ok: true, value: null };
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ok: false };
  }

  const keys = Object.keys(value);
  if (!keys.every((key) => key === 'sessionId' || key === 'specId')) {
    return { ok: false };
  }

  const sessionId = (value as { sessionId?: unknown }).sessionId;
  const specId = (value as { specId?: unknown }).specId;
  if (
    typeof sessionId !== 'string' ||
    sessionId.length === 0 ||
    (specId !== undefined && (typeof specId !== 'number' || !Number.isInteger(specId) || specId < 1))
  ) {
    return { ok: false };
  }

  return {
    ok: true,
    value: specId === undefined ? { sessionId } : { sessionId, specId },
  };
}

async function selectedSessionFile(state: WorkspaceSessionState): Promise<SessionProjectionTarget> {
  if (state.status !== 'ready') {
    return { ok: false, code: -32001, message: 'No selected Brunch session' };
  }

  const readResult = await readBrunchSessionEnvelope(state.session.file);
  if (!readResult.ok) {
    return {
      ok: false,
      code: -32005,
      message: 'Brunch session self-description is invalid',
    };
  }

  return {
    ok: true,
    envelope: readResult.envelope,
    nonLinearMessage: 'Selected Brunch session transcript is non-linear',
  };
}

function publishSelectedSessionUpdates(
  publisher: ProductUpdatePublisher | undefined,
  state: WorkspaceActivationState | WorkspaceSessionState,
): void {
  if (!publisher || state.status !== 'ready') {
    return;
  }
  publisher.publish(
    selectedSessionProductUpdates({
      specId: state.spec.id,
      sessionId: state.session.id,
    }),
  );
}
