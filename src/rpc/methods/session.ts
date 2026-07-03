import { Type, type Static } from 'typebox';
import { Value } from 'typebox/value';

import { zReviewSetDetailsPayload, type ReviewSetDetailsPayload } from '../../exchanges/schemas/index.js';
import type { ReviewSetProposalPayload } from '../../graph/review-set.js';
import type { WorkspaceGraphRuntime } from '../../graph/workspace-store.js';
import { projectSessionRuntimeState } from '../../projections/session/runtime-state.js';
import {
  readBrunchSessionEnvelope,
  NonLinearTranscriptError,
  type BrunchSessionEnvelope,
} from '../../session/brunch-session-envelope.js';
import { projectLinearSessionExchangeProjection } from '../../session/exchange-projection.js';
import { flushSessionManagerToFile } from '../../session/flush-session-manager.js';
import { mentionEntry, resolveMentionFacts } from '../../session/mention-ledger.js';
import { originateAssistantTurn } from '../../session/originate-assistant-turn.js';
import {
  resolveExplicitSessionProjectionTarget,
  type ExplicitSessionProjectionParams,
  type SessionProjectionTarget,
} from '../../session/session-projection-reader.js';
import {
  acceptedResponseFromParams,
  pendingExchangeFromEnvelope,
  PendingStructuredExchangeSchema,
  projectPendingStructuredExchange,
} from '../../session/structured-exchange-loop.js';
import type {
  PendingStructuredExchange,
  StructuredExchangeResponseInput,
} from '../../session/structured-exchange-loop.js';
import { renderWorkspaceOverviewContext } from '../../session/workspace-overview-context.js';
import type {
  DefaultWorkspaceCoordinator,
  WorkspaceActivationState,
  WorkspaceSessionState,
} from '../../session/workspace-session-coordinator.js';
import {
  graphMutationProductUpdates,
  selectedSessionProductUpdates,
  type ProductUpdatePublisher,
} from '../product-updates.js';
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

const PendingExchangeResultSchema = Type.Union([
  Type.Object(
    {
      status: Type.Literal('pending'),
      exchange: PendingStructuredExchangeSchema,
    },
    { additionalProperties: false },
  ),
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
      Type.Object(
        {
          review: Type.Object(
            {
              decision: Type.Union([
                Type.Literal('approve'),
                Type.Literal('request_changes'),
                Type.Literal('reject'),
              ]),
              comment: Type.Optional(Type.String()),
            },
            { additionalProperties: false },
          ),
        },
        { additionalProperties: false },
      ),
    ]),
    note: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

const ExchangeResponseReviewResultSchema = Type.Union([
  Type.Object(
    {
      status: Type.Literal('approved'),
      lsn: PositiveIntegerSchema,
      createdNodes: Type.Object({}, { additionalProperties: true }),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      status: Type.Union([Type.Literal('request_changes'), Type.Literal('rejected')]),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      status: Type.Literal('structural_illegal'),
      diagnostics: Type.Array(Type.Object({}, { additionalProperties: true })),
    },
    { additionalProperties: false },
  ),
]);

const ExchangeResponseResultSchema = Type.Object(
  {
    status: Type.Literal('accepted'),
    exchangeId: NonBlankStringSchema,
    answer: Type.Object({}, { additionalProperties: true }),
    review: Type.Optional(ExchangeResponseReviewResultSchema),
    note: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

const SubmitMessageParamsSchema = Type.Object(
  {
    text: NonBlankStringSchema,
    interruption: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

const SubmitMessageResultSchema = Type.Object(
  {
    status: Type.Literal('accepted'),
    messageId: NonBlankStringSchema,
    text: NonBlankStringSchema,
    interruption: Type.Boolean(),
  },
  { additionalProperties: false },
);

type ExchangeResponseParams = StructuredExchangeResponseInput;
type ExchangeResponseResult = Static<typeof ExchangeResponseResultSchema>;
type SubmitMessageParams = Static<typeof SubmitMessageParamsSchema>;
type SubmitMessageResult = Static<typeof SubmitMessageResultSchema>;

export const sessionRpcMethods: readonly RpcMethodDefinition<RpcMethodContext>[] = [
  {
    method: 'session.exchanges',
    access: 'read',
    description:
      'Project session exchanges from the selected or explicitly named linear Brunch session transcript.',
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
        projectLinearSessionExchangeProjection,
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
      'Kick the selected session: seed origination context and report pending-exchange state. Pending exchanges exist only when the assistant has created one (D49-L/D78-L revised 2026-06-12); the product mints no deterministic exchange.',
    paramsSchema: NoParamsSchema,
    resultSchema: PendingExchangeResultSchema,
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
      'Read the current transcript-backed pending structured exchange from the selected or explicitly named linear Brunch session.',
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
        projectPendingStructuredExchange,
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
  {
    method: 'session.submitMessage',
    access: 'write',
    description:
      'Append an ordinary user message to the selected session, or record an explicit interruption while a structured exchange is pending.',
    paramsSchema: SubmitMessageParamsSchema,
    resultSchema: SubmitMessageResultSchema,
    examples: [
      {
        jsonrpc: '2.0',
        id: 12,
        method: 'session.submitMessage',
        params: {
          text: 'Please add this to the transcript for the next capture sweep.',
        },
      },
    ],
    async handle(context, request) {
      return handleSubmitMessage(jsonRpcRequestId(request), request.params, context);
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
    getGraphRuntime: () => Promise<WorkspaceGraphRuntime>;
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

  const specReads = (await options.getGraphRuntime()).forSpec(existingTarget.envelope.binding.specId);
  const manager = state.session.manager;
  // Kick surface (D49-L revised 2026-06-12): origination seeds context; the
  // product mints no exchange. A pending exchange exists only when the
  // assistant has created one — in transports without a live agent session
  // this legitimately reports idle.
  originateAssistantTurn({
    specId: existingTarget.envelope.binding.specId,
    reads: specReads,
    entries: existingTarget.envelope.entries,
    resumeOrigin: 'manual_trigger',
    workspaceContext: await renderWorkspaceOverviewContext(options.cwd),
    manager,
  });
  flushSessionManagerToFile(manager, state.session.file);

  const reloadedTarget = await selectedSessionFile(state);
  if (!reloadedTarget.ok) {
    return createJsonRpcFailure(requestId, reloadedTarget.code, reloadedTarget.message);
  }
  const reloaded = pendingExchangeFromEnvelope(reloadedTarget.envelope);

  const result = reloaded
    ? { status: 'pending' as const, exchange: reloaded }
    : { status: 'idle' as const, exchange: null };
  publishSelectedSessionUpdates(options.productUpdates, state);
  return createJsonRpcSuccess(requestId, result);
}

async function handleSubmitMessage(
  requestId: JsonRpcId,
  rawParams: unknown,
  options: {
    coordinator: DefaultWorkspaceCoordinator;
    cwd: string;
    productUpdates?: ProductUpdatePublisher;
    getGraphRuntime: () => Promise<WorkspaceGraphRuntime>;
  },
): Promise<JsonRpcResponse> {
  if (!Value.Check(SubmitMessageParamsSchema, rawParams)) {
    return createJsonRpcFailure(requestId, -32602, 'Invalid params');
  }
  const params = Value.Parse(SubmitMessageParamsSchema, rawParams) as SubmitMessageParams;

  const state = await options.coordinator.openDefaultWorkspace();
  if (state.status !== 'ready') {
    return createJsonRpcFailure(requestId, -32001, 'No selected Brunch session');
  }

  const target = await selectedSessionFile(state);
  if (!target.ok) {
    return createJsonRpcFailure(requestId, target.code, target.message);
  }

  let pending: PendingStructuredExchange | null;
  try {
    pending = pendingExchangeFromEnvelope(target.envelope);
  } catch (error) {
    if (error instanceof NonLinearTranscriptError) {
      return createJsonRpcFailure(requestId, -32002, target.nonLinearMessage);
    }
    throw error;
  }

  if (pending && params.interruption !== true) {
    return createJsonRpcFailure(
      requestId,
      -32009,
      'Pending structured exchange requires session.submitExchangeResponse unless this message is an explicit interruption',
    );
  }

  const messageId =
    params.interruption === true
      ? state.session.manager.appendCustomMessageEntry('brunch.session_interruption', params.text, true, {
          interruption: true,
        })
      : state.session.manager.appendMessage(ordinaryUserMessage(params.text));
  flushSessionManagerToFile(state.session.manager, state.session.file);

  if (params.interruption !== true) {
    const graph = await options.getGraphRuntime();
    for (const fact of resolveMentionFacts({
      text: params.text,
      specId: target.envelope.binding.specId,
      graph,
    })) {
      state.session.manager.appendCustomEntry('brunch.mention', mentionEntry(fact).data);
    }
    flushSessionManagerToFile(state.session.manager, state.session.file);
  }

  const result: SubmitMessageResult = {
    status: 'accepted',
    messageId,
    text: params.text,
    interruption: params.interruption === true,
  };

  publishSelectedSessionUpdates(options.productUpdates, state, target.envelope.binding.specId);
  return createJsonRpcSuccess(requestId, result);
}

async function handleSubmitExchangeResponse(
  requestId: JsonRpcId,
  rawParams: unknown,
  options: {
    coordinator: DefaultWorkspaceCoordinator;
    cwd: string;
    productUpdates?: ProductUpdatePublisher;
    getGraphRuntime: () => Promise<WorkspaceGraphRuntime>;
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

  let pending: PendingStructuredExchange | null;
  try {
    pending = pendingExchangeFromEnvelope(target.envelope);
  } catch (error) {
    if (error instanceof NonLinearTranscriptError) {
      return createJsonRpcFailure(requestId, -32002, target.nonLinearMessage);
    }
    throw error;
  }

  if (!pending) {
    return createJsonRpcFailure(requestId, -32008, 'No pending structured exchange');
  }

  if (params.exchangeId !== pending.exchangeId) {
    return createJsonRpcFailure(requestId, -32006, 'Pending structured exchange does not match request');
  }

  const accepted = acceptedResponseFromParams(pending, params);
  if (!accepted.ok) {
    return createJsonRpcFailure(requestId, -32007, accepted.message);
  }

  const graph = await options.getGraphRuntime();
  const review = reviewResultForAcceptedResponse({
    pending,
    acceptedAnswer: accepted.answer,
    specId: target.envelope.binding.specId,
    proposalEntryId: projectLinearSessionExchangeProjection(target.envelope).openPrompt?.promptEntryIds[0],
    commandExecutor: graph.commandExecutor,
  });
  if (review?.status === 'structural_illegal') {
    const result: ExchangeResponseResult = {
      status: 'accepted',
      exchangeId: pending.exchangeId,
      answer: accepted.answer,
      review,
      ...(params.note === undefined ? {} : { note: params.note }),
    };
    return createJsonRpcSuccess(requestId, result);
  }

  const result: ExchangeResponseResult = {
    status: 'accepted',
    exchangeId: pending.exchangeId,
    answer: accepted.answer,
    ...(review === undefined ? {} : { review }),
    ...(params.note === undefined ? {} : { note: params.note }),
  };

  // Call first, then result — the synthetic pair keeps the transcript
  // provider-legal (an orphan tool_result is a real-provider 400).
  state.session.manager.appendMessage(accepted.toolCallMessage);
  state.session.manager.appendMessage(accepted.toolResultMessage);
  flushSessionManagerToFile(state.session.manager, state.session.file);

  publishSelectedSessionUpdates(options.productUpdates, state, target.envelope.binding.specId);
  const mutationLsn = review?.status === 'approved' ? review.lsn : null;
  if (mutationLsn !== null) {
    options.productUpdates?.publish(
      graphMutationProductUpdates({ specId: target.envelope.binding.specId, lsn: mutationLsn }),
    );
  }
  return createJsonRpcSuccess(requestId, result);
}

function ordinaryUserMessage(text: string) {
  return {
    role: 'user' as const,
    content: text,
    timestamp: 0 as const,
  };
}

type SessionProjectionParamsParseResult =
  | {
      ok: true;
      value: ExplicitSessionProjectionParams | null;
    }
  | { ok: false };

function reviewResultForAcceptedResponse(options: {
  readonly pending: PendingStructuredExchange;
  readonly acceptedAnswer: Record<string, unknown>;
  readonly specId: number;
  readonly proposalEntryId?: string | undefined;
  readonly commandExecutor: WorkspaceGraphRuntime['commandExecutor'];
}):
  | {
      readonly status: 'approved';
      readonly lsn: number;
      readonly createdNodes: Record<string, unknown>;
    }
  | { readonly status: 'request_changes' | 'rejected' }
  | { readonly status: 'structural_illegal'; readonly diagnostics: Record<string, unknown>[] }
  | undefined {
  const review = (options.acceptedAnswer as { review?: unknown }).review;
  if (typeof review !== 'object' || review === null) return undefined;
  if (options.pending.mode !== 'review' || options.pending.reviewSet === undefined) {
    return {
      status: 'structural_illegal',
      diagnostics: [{ field: 'review', message: 'no pending review set' }],
    };
  }

  const decision = (review as { decision?: unknown }).decision;
  if (decision === 'request_changes') return { status: 'request_changes' };
  if (decision === 'reject') return { status: 'rejected' };
  if (decision !== 'approve') {
    return {
      status: 'structural_illegal',
      diagnostics: [{ field: 'review.decision', message: 'invalid review decision' }],
    };
  }

  const parsedReviewSet = zReviewSetDetailsPayload.safeParse(options.pending.reviewSet);
  if (!parsedReviewSet.success) {
    return {
      status: 'structural_illegal',
      diagnostics: parsedReviewSet.error.issues.map((issue) => ({
        field: issue.path.length > 0 ? issue.path.join('.') : 'reviewSet',
        message: issue.message,
      })),
    };
  }

  const accepted = options.commandExecutor.acceptReviewSet({
    specId: options.specId,
    proposalEntryId: options.proposalEntryId,
    payload: reviewSetProposalPayloadFromDetails({
      exchangeId: options.pending.exchangeId,
      heading: options.pending.prompt,
      body: options.pending.details,
      reviewSet: parsedReviewSet.data,
    }),
  });
  if (accepted.status === 'structural_illegal') {
    return {
      status: 'structural_illegal',
      diagnostics: accepted.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    };
  }
  return {
    status: 'approved',
    lsn: accepted.lsn,
    createdNodes: accepted.createdNodes,
  };
}

function reviewSetProposalPayloadFromDetails(input: {
  readonly exchangeId: string;
  readonly heading: string;
  readonly body?: string | undefined;
  readonly reviewSet: ReviewSetDetailsPayload;
}): ReviewSetProposalPayload {
  const narrative = input.body?.trim() || input.heading.trim();
  return {
    schemaVersion: 1,
    lens: 'intent',
    epistemicStatus: 'asserted',
    grounding: {
      summary: narrative,
      support: [`present_review_set:${input.exchangeId}`],
    },
    pitch: {
      title: input.heading.trim(),
      narrative,
    },
    entityDrafts: input.reviewSet.nodes.map((draft) => ({
      draftId: draft.draft_id,
      proposedCode: draft.proposed_code,
      plane: draft.plane,
      kind: draft.kind,
      title: draft.title,
      ...(draft.body !== undefined ? { body: draft.body } : {}),
      ...(draft.detail !== undefined ? { detail: draft.detail } : {}),
    })),
    edgeDrafts: input.reviewSet.edges.map(reviewSetEdgeDraftFromDetails),
  };
}

type ReviewSetDetailsEdgeDraft = ReviewSetDetailsPayload['edges'][number];
type ReviewSetDetailsEndpointRef = Extract<
  ReviewSetDetailsEdgeDraft,
  { category: 'dependency' }
>['dependency'];

function endpointRefFromDetails(value: ReviewSetDetailsEndpointRef) {
  if ('draft_id' in value) return { draftId: value.draft_id };
  return { existingCode: value.existing_code };
}

function reviewSetEdgeDraftFromDetails(
  draft: ReviewSetDetailsEdgeDraft,
): ReviewSetProposalPayload['edgeDrafts'][number] {
  switch (draft.category) {
    case 'dependency':
      return {
        category: draft.category,
        dependency: endpointRefFromDetails(draft.dependency),
        dependent: endpointRefFromDetails(draft.dependent),
        ...(draft.rationale !== undefined ? { rationale: draft.rationale } : {}),
      };
    case 'witness':
      return {
        category: draft.category,
        oracle: endpointRefFromDetails(draft.oracle),
        claim: endpointRefFromDetails(draft.claim),
        stance: draft.stance,
        ...(draft.rationale !== undefined ? { rationale: draft.rationale } : {}),
      };
    case 'rationale':
      return {
        category: draft.category,
        support: endpointRefFromDetails(draft.support),
        claim: endpointRefFromDetails(draft.claim),
        stance: draft.stance,
        ...(draft.rationale !== undefined ? { rationale: draft.rationale } : {}),
      };
    case 'realization':
      return {
        category: draft.category,
        abstract: endpointRefFromDetails(draft.abstract),
        concrete: endpointRefFromDetails(draft.concrete),
        ...(draft.rationale !== undefined ? { rationale: draft.rationale } : {}),
      };
    case 'refinement':
      return {
        category: draft.category,
        abstract: endpointRefFromDetails(draft.abstract),
        concrete: endpointRefFromDetails(draft.concrete),
        ...(draft.rationale !== undefined ? { rationale: draft.rationale } : {}),
      };
    case 'exclusion':
      return {
        category: draft.category,
        boundary: endpointRefFromDetails(draft.boundary),
        subject: endpointRefFromDetails(draft.subject),
        ...(draft.rationale !== undefined ? { rationale: draft.rationale } : {}),
      };
    case 'composition':
      return {
        category: draft.category,
        whole: endpointRefFromDetails(draft.whole),
        part: endpointRefFromDetails(draft.part),
        ...(draft.rationale !== undefined ? { rationale: draft.rationale } : {}),
      };
    case 'cross_reference':
      return {
        category: draft.category,
        a: endpointRefFromDetails(draft.a),
        b: endpointRefFromDetails(draft.b),
        ...(draft.rationale !== undefined ? { rationale: draft.rationale } : {}),
      };
    case 'supersession':
      return {
        category: draft.category,
        successor: endpointRefFromDetails(draft.successor),
        predecessor: endpointRefFromDetails(draft.predecessor),
        ...(draft.rationale !== undefined ? { rationale: draft.rationale } : {}),
      };
  }
}

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
  bindingSpecId?: number,
): void {
  if (!publisher || state.status !== 'ready') {
    return;
  }
  publisher.publish(
    selectedSessionProductUpdates({
      specId: bindingSpecId ?? state.spec.id,
      sessionId: state.session.id,
    }),
  );
}
