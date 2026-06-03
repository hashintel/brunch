import type { Readable, Writable } from 'node:stream';

import { Type, type Static } from 'typebox';
import { Value } from 'typebox/value';

import type { StructuredExchangePresentDetails } from '../.pi/extensions/structured-exchange/shared/model.js';
import { isStructuredExchangePresentDetails } from '../.pi/extensions/structured-exchange/shared/recovery.js';
import { openWorkspaceGraphRuntime, type WorkspaceGraphRuntime } from '../graph/workspace-store.js';
import {
  readBrunchSessionEnvelope,
  NonLinearTranscriptError,
  type BrunchSessionEnvelope,
} from '../session/brunch-session-envelope.js';
import { projectLinearElicitationExchangeProjection } from '../session/elicitation-exchange.js';
import { projectSessionRuntimeState } from '../session/runtime-state.js';
import {
  resolveExplicitSessionProjectionTarget,
  type ExplicitSessionProjectionParams,
  type SessionProjectionTarget,
} from '../session/session-projection-reader.js';
import type {
  DefaultWorkspaceCoordinator,
  WorkspaceActivationState,
  WorkspaceSessionState,
  SpecSessionActivationCoordinator,
} from '../session/workspace-session-coordinator.js';
import {
  discoverRpcMethods,
  registryByMethod,
  type RpcMethodDefinition,
  type RpcMethodRegistry,
} from './methods/registry.js';
import { graphRpcMethods } from './methods/graph.js';
import {
  NoParamsSchema,
  NonBlankStringSchema,
  PositiveIntegerSchema,
} from './methods/schemas.js';
import { workspaceRpcMethods } from './methods/workspace.js';
import {
  createProductUpdateNotification,
  selectedSessionProductUpdates,
  type ProductUpdatePublisher,
} from './product-updates.js';
import {
  createJsonRpcFailure,
  createJsonRpcSuccess,
  isJsonRpcRequest,
  jsonRpcRequestId,
  dispatchJsonRpcMessage,
  type JsonRpcId,
  type JsonRpcResponse,
} from './protocol.js';

interface RpcMethodContext {
  readonly coordinator: DefaultWorkspaceCoordinator & SpecSessionActivationCoordinator;
  readonly cwd: string;
  readonly productUpdates?: ProductUpdatePublisher;
  readonly getGraphRuntime: () => Promise<WorkspaceGraphRuntime>;
  readonly discoveryRegistry: readonly RpcMethodDefinition<RpcMethodContext>[];
}

export interface RpcHandlers {
  handle(request: unknown): Promise<JsonRpcResponse>;
}

export function createReadOnlyRpcHandlers(options: {
  coordinator: DefaultWorkspaceCoordinator & SpecSessionActivationCoordinator;
  cwd: string;
  productUpdates?: ProductUpdatePublisher;
}): RpcHandlers {
  return createRpcHandlersForRegistry(options, READ_ONLY_RPC_METHOD_REGISTRY);
}

export function createRpcHandlers(options: {
  coordinator: DefaultWorkspaceCoordinator & SpecSessionActivationCoordinator;
  cwd: string;
  productUpdates?: ProductUpdatePublisher;
}): RpcHandlers {
  return createRpcHandlersForRegistry(options, FULL_RPC_METHOD_REGISTRY);
}

function createRpcHandlersForRegistry(
  options: {
    coordinator: DefaultWorkspaceCoordinator & SpecSessionActivationCoordinator;
    cwd: string;
    productUpdates?: ProductUpdatePublisher;
  },
  registryDefinitions: RpcMethodRegistry<RpcMethodContext>,
): RpcHandlers {
  let graphRuntime: Promise<WorkspaceGraphRuntime> | null = null;

  const getGraphRuntime = () => {
    graphRuntime ??= openWorkspaceGraphRuntime(options.cwd);
    return graphRuntime;
  };
  const context: RpcMethodContext = {
    ...options,
    getGraphRuntime,
    discoveryRegistry: registryDefinitions,
  };
  const registry = registryByMethod(registryDefinitions);

  return {
    async handle(request) {
      if (!isJsonRpcRequest(request)) {
        return createJsonRpcFailure(null, -32600, 'Invalid Request');
      }

      const requestId = jsonRpcRequestId(request);
      const definition = registry.get(request.method);
      if (definition === undefined) {
        return createJsonRpcFailure(requestId, -32601, 'Method not found');
      }

      return definition.handle(context, request);
    },
  };
}


const SessionProjectionParamsSchema = Type.Object(
  {
    sessionId: NonBlankStringSchema,
    specId: Type.Optional(PositiveIntegerSchema),
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
    agent: Type.Object({}, { additionalProperties: true }),
    mentions: Type.Object(
      {
        graphNodes: Type.Array(Type.Object({}, { additionalProperties: true })),
        files: Type.Array(Type.Object({}, { additionalProperties: true })),
      },
      { additionalProperties: false },
    ),
    world: Type.Object({}, { additionalProperties: true }),
    lifecycle: Type.Object({}, { additionalProperties: true }),
  },
  { additionalProperties: false },
);

const PendingElicitationExchangeSchema = Type.Object(
  {
    exchangeId: NonBlankStringSchema,
    lens: Type.Literal('intent'),
    mode: Type.Union([Type.Literal('text'), Type.Literal('single-select'), Type.Literal('multi-select')]),
    prompt: NonBlankStringSchema,
    details: Type.Optional(NonBlankStringSchema),
    options: Type.Array(
      Type.Object(
        {
          id: NonBlankStringSchema,
          label: NonBlankStringSchema,
          content: NonBlankStringSchema,
          rationale: Type.Optional(NonBlankStringSchema),
        },
        { additionalProperties: false },
      ),
    ),
    note: Type.Object(
      { allowed: Type.Boolean() },
      {
        additionalProperties: false,
      },
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

type ExchangeResponseParams = Static<typeof ExchangeResponseParamsSchema>;
type ExchangeResponseResult = Static<typeof ExchangeResponseResultSchema>;

const FULL_RPC_METHOD_REGISTRY: readonly RpcMethodDefinition<RpcMethodContext>[] = [
  {
    method: 'rpc.discover',
    access: 'read',
    description:
      'List the public Brunch JSON-RPC methods supported by this host with schemas and example calls.',
    paramsSchema: NoParamsSchema,
    resultSchema: Type.Object(
      { methods: Type.Array(Type.Object({}, { additionalProperties: true })) },
      { additionalProperties: false },
    ),
    examples: [{ jsonrpc: '2.0', id: 1, method: 'rpc.discover' }],
    async handle(context, request) {
      const requestId = jsonRpcRequestId(request);
      if (request.params !== undefined) {
        return createJsonRpcFailure(requestId, -32602, 'Invalid params');
      }
      return createJsonRpcSuccess(requestId, discoverRpcMethods(context.discoveryRegistry));
    },
  },
  ...workspaceRpcMethods,
  ...graphRpcMethods,
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
    paramsSchema: SessionProjectionParamsSchema,
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

const READ_ONLY_RPC_METHOD_REGISTRY = FULL_RPC_METHOD_REGISTRY.filter(
  (definition) => definition.access === 'read',
);




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
  const params: ExchangeResponseParams = Value.Parse(ExchangeResponseParamsSchema, rawParams);

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

interface AcceptedToolTextContent {
  type: 'text';
  text: string;
}

interface AcceptedToolResultMessage {
  role: 'toolResult';
  toolCallId: string;
  toolName: string;
  content: AcceptedToolTextContent[];
  details: Record<string, unknown>;
  isError: false;
  timestamp: 0;
}

type AcceptedResponse =
  | {
      ok: true;
      answer: Record<string, unknown>;
      toolResultMessage: AcceptedToolResultMessage;
    }
  | {
      ok: false;
      message: string;
    };

function acceptedResponseFromParams(
  pending: PendingElicitationExchange,
  params: ExchangeResponseParams,
): AcceptedResponse {
  if ('text' in params.answer) {
    if (pending.mode !== 'text') return invalidResponseMode();
    const details = requestDetailsBase(pending, 'request_answer');
    return {
      ok: true,
      answer: { text: params.answer.text },
      toolResultMessage: {
        ...toolResultMessageBase(pending, 'request_answer'),
        content: [{ type: 'text', text: `### Response\n\n${params.answer.text}` }],
        details: { ...details, answer: params.answer.text },
      },
    };
  }

  if ('optionId' in params.answer) {
    if (pending.mode !== 'single-select') return invalidResponseMode();
    const optionId = params.answer.optionId;
    const choice = pending.options.find((option) => option.id === optionId);
    if (!choice) return { ok: false, message: 'Invalid elicitation option' };
    const details = requestDetailsBase(pending, 'request_choice');
    if (params.note !== undefined && params.note.trim().length > 0) {
      details.comment = params.note.trim();
    }
    return {
      ok: true,
      answer: { optionId: choice.id, label: choice.label },
      toolResultMessage: {
        ...toolResultMessageBase(pending, 'request_choice'),
        content: [{ type: 'text', text: choiceResponseMarkdown([choice], params.note) }],
        details: { ...details, choice },
      },
    };
  }

  if (pending.mode !== 'multi-select') return invalidResponseMode();
  const selected = params.answer.optionIds.map((id) => pending.options.find((option) => option.id === id));
  if (selected.some((choice) => choice === undefined)) {
    return { ok: false, message: 'Invalid elicitation option' };
  }
  const choices = selected as PendingChoice[];
  if (
    choices.some((choice) => choice.id === 'other' || choice.id === 'none') &&
    (params.note === undefined || params.note.trim().length === 0)
  ) {
    return {
      ok: false,
      message: 'Elicitation response requires a comment for Other or None selections',
    };
  }
  const details = requestDetailsBase(pending, 'request_choices');
  if (params.note !== undefined && params.note.trim().length > 0) {
    details.comment = params.note.trim();
  }
  return {
    ok: true,
    answer: { optionIds: choices.map((choice) => choice.id), choices },
    toolResultMessage: {
      ...toolResultMessageBase(pending, 'request_choices'),
      content: [{ type: 'text', text: choiceResponseMarkdown(choices, params.note) }],
      details: { ...details, choices },
    },
  };
}

function invalidResponseMode(): AcceptedResponse {
  return {
    ok: false,
    message: 'Elicitation response mode does not match pending exchange',
  };
}

function requestDetailsBase(
  pending: PendingElicitationExchange,
  requestTool: 'request_answer' | 'request_choice' | 'request_choices',
): Record<string, unknown> {
  return {
    schema: 'brunch.structured_exchange.request',
    schemaVersion: 1,
    exchangeId: pending.exchangeId,
    requestTool,
    status: 'answered',
    respondsTo: {
      exchangeId: pending.exchangeId,
      presentTool: pending.mode === 'text' ? 'present_question' : 'present_options',
    },
    createdAtToolCallId: `${pending.exchangeId}:${requestTool}`,
  };
}

function toolResultMessageBase(
  pending: PendingElicitationExchange,
  requestTool: 'request_answer' | 'request_choice' | 'request_choices',
) {
  return {
    role: 'toolResult' as const,
    toolCallId: `${pending.exchangeId}:${requestTool}`,
    toolName: requestTool,
    isError: false as const,
    timestamp: 0 as const,
  };
}

function choiceResponseMarkdown(choices: Array<{ label: string }>, comment: string | undefined): string {
  const lines = ['### Response', '', ...choices.map((choice) => `- ${choice.label}`)];
  if (comment !== undefined && comment.trim().length > 0) {
    lines.push('', 'Comment:', '', `> ${comment.trim()}`);
  }
  return lines.join('\n');
}

interface PendingChoice {
  id: string;
  label: string;
  content: string;
  rationale?: string;
}

type PendingElicitationExchange = Static<typeof PendingElicitationExchangeSchema>;

function nextDeterministicElicitationExchange(completedCount: number): PendingElicitationExchange {
  const turnNumber = completedCount + 1;
  const script: PendingElicitationExchange[] = [
    {
      exchangeId: `deterministic-grounding-choice-${turnNumber}`,
      lens: 'intent',
      mode: 'single-select',
      prompt: 'Is this a new product or feature from scratch?',
      details: 'Choose the best starting context so later elicitation can ask useful follow-ups.',
      options: [
        {
          id: 'new-from-scratch',
          label: 'Yes — this is new from scratch',
          content: 'Start a new spec workspace from a blank slate.',
          rationale: 'This keeps the parity run focused on initial grounding.',
        },
        {
          id: 'existing-codebase',
          label: 'No — this builds on existing code',
          content: 'Ground the spec in existing implementation constraints.',
          rationale: 'Existing code changes what the elicitor should inspect next.',
        },
        {
          id: 'relates-to-existing-spec',
          label: 'It relates to an existing spec',
          content: 'Connect this work to a prior specification thread.',
          rationale: 'Continuity matters when prior graph intent exists.',
        },
      ],
      note: { allowed: true },
    },
    {
      exchangeId: `deterministic-grounding-text-${turnNumber}`,
      lens: 'intent',
      mode: 'text',
      prompt: 'What are we specifying?',
      details:
        "This covers the text-answer permutation in Brunch's deterministic public-RPC structured-exchange parity proof.",
      options: [],
      note: { allowed: true },
    },
    {
      exchangeId: `deterministic-grounding-multi-${turnNumber}`,
      lens: 'intent',
      mode: 'multi-select',
      prompt: 'Which proof qualities matter for this parity run?',
      details:
        'Select all qualities the deterministic structured-exchange permutation proof should preserve.',
      options: [
        {
          id: 'transcript',
          label: 'Transcript fidelity',
          content: 'Pi JSONL keeps every present/request tuple recoverable.',
          rationale: 'The transcript is the durable source of truth.',
        },
        {
          id: 'projection',
          label: 'Projection fidelity',
          content: 'Brunch projections preserve semantic option artifacts.',
          rationale: 'Public clients depend on projected structured exchange data.',
        },
        {
          id: 'other',
          label: 'Other',
          content: 'Another proof quality should be captured in the note.',
          rationale: 'Other requires a comment so the transcript stays explicit.',
        },
        {
          id: 'none',
          label: 'None',
          content: 'No additional proof qualities matter for this run.',
          rationale: 'None requires a comment to avoid silent dismissal.',
        },
      ],
      note: { allowed: true },
    },
  ];
  return script[completedCount % script.length]!;
}

function presentToolResultMessage(exchange: PendingElicitationExchange) {
  const presentTool = exchange.mode === 'text' ? 'present_question' : 'present_options';
  const requestTool =
    exchange.mode === 'text'
      ? 'request_answer'
      : exchange.mode === 'multi-select'
        ? 'request_choices'
        : 'request_choice';
  const toolCallId = `${exchange.exchangeId}:${presentTool}`;
  return {
    role: 'toolResult' as const,
    toolCallId,
    toolName: presentTool,
    content: [{ type: 'text' as const, text: presentMarkdown(exchange) }],
    details: {
      schema: 'brunch.structured_exchange.present',
      schemaVersion: 1,
      exchangeId: exchange.exchangeId,
      presentTool,
      kind: exchange.mode === 'text' ? 'question' : 'options',
      status: 'presented',
      expectedRequest: { tool: requestTool, required: true },
      createdAtToolCallId: toolCallId,
      prompt: exchange.prompt,
      details: exchange.details,
      lens: exchange.lens,
      options: exchange.options,
    },
    isError: false as const,
    timestamp: 0 as const,
  };
}

function presentMarkdown(exchange: PendingElicitationExchange): string {
  if (exchange.mode === 'text') {
    return [`## ${exchange.prompt}`, exchange.details].filter(Boolean).join('\n\n');
  }
  const lines = [`## ${exchange.prompt}`];
  if (exchange.details) lines.push('', exchange.details);
  exchange.options.forEach((option, index) => {
    lines.push('', `### ${index + 1}. ${option.content}`);
    if (option.rationale) {
      lines.push('', `**Rationale:** ${option.rationale}`);
    }
    lines.push('', `<!-- option-id: ${option.id} -->`);
  });
  return lines.join('\n');
}

function pendingExchangeFromEnvelope(envelope: BrunchSessionEnvelope): PendingElicitationExchange | null {
  const projection = projectLinearElicitationExchangeProjection(envelope);
  if (!projection.openPrompt) {
    return null;
  }

  for (const entryId of projection.openPrompt.promptEntryIds) {
    const entry = envelope.entries.find(
      (candidate) =>
        candidate.type === 'custom_message' &&
        candidate.id === entryId &&
        candidate.customType === 'brunch.elicitation_prompt' &&
        Value.Check(PendingElicitationExchangeSchema, candidate.details),
    );
    if (entry?.type === 'custom_message') {
      return Value.Parse(PendingElicitationExchangeSchema, entry.details);
    }
  }

  for (const entryId of projection.openPrompt.promptEntryIds) {
    const entry = envelope.entries.find(
      (candidate) => candidate.type === 'message' && candidate.id === entryId,
    );
    const details = structuredExchangePresentDetails(entry);
    if (!details) continue;
    const text = textContent((entry as { message: { content?: unknown } }).message.content);
    return pendingExchangeFromStructuredPresent(details, text);
  }

  return null;
}

function pendingExchangeFromStructuredPresent(
  details: StructuredExchangePresentDetails,
  markdown: string,
): PendingElicitationExchange {
  const richDetails = details as StructuredExchangePresentDetails & {
    prompt?: unknown;
    details?: unknown;
    options?: unknown;
  };
  const prompt =
    typeof richDetails.prompt === 'string'
      ? richDetails.prompt
      : (firstNonEmptyMarkdownLine(markdown) ?? markdown);
  const detailsText = typeof richDetails.details === 'string' ? richDetails.details : markdown;
  return {
    exchangeId: details.exchangeId,
    lens: 'intent',
    mode:
      details.expectedRequest?.tool === 'request_choices'
        ? 'multi-select'
        : details.presentTool === 'present_question'
          ? 'text'
          : 'single-select',
    prompt,
    ...(detailsText.length > 0 ? { details: detailsText } : {}),
    options: parsePendingOptions(richDetails.options, markdown),
    note: { allowed: true },
  };
}

function parsePendingOptions(value: unknown, markdown: string = ''): PendingChoice[] {
  if (!Array.isArray(value)) return parseMarkdownPendingOptions(markdown);
  const options = value.flatMap((option) => {
    if (typeof option !== 'object' || option === null) return [];
    const id = (option as { id?: unknown }).id;
    const label = (option as { label?: unknown }).label;
    const content = (option as { content?: unknown }).content;
    const rationale = (option as { rationale?: unknown }).rationale;
    if (typeof id !== 'string') return [];
    const optionContent =
      typeof content === 'string' ? content : typeof label === 'string' ? label : undefined;
    if (optionContent === undefined) return [];
    return [
      {
        id,
        label: typeof label === 'string' ? label : optionContent,
        content: optionContent,
        ...(typeof rationale === 'string' ? { rationale } : {}),
      },
    ];
  });
  return options.length > 0 ? options : parseMarkdownPendingOptions(markdown);
}

function parseMarkdownPendingOptions(markdown: string): PendingChoice[] {
  const options: PendingChoice[] = [];
  let pending:
    | {
        content: string;
        rationale?: string;
      }
    | undefined;

  for (const line of markdown.split('\n')) {
    const heading = /^###\s+\d+\.\s+(.+)$/.exec(line.trim());
    if (heading) {
      pending = { content: heading[1]!.trim() };
      continue;
    }

    const rationale = /^\*\*Rationale:\*\*\s+(.+)$/.exec(line.trim());
    if (rationale && pending) {
      pending.rationale = rationale[1]!.trim();
      continue;
    }

    const optionId = /<!--\s*option-id:\s*([^>]+?)\s*-->/.exec(line.trim());
    if (optionId && pending) {
      const content = pending.content;
      options.push({
        id: optionId[1]!.trim(),
        label: content,
        content,
        ...(pending.rationale === undefined ? {} : { rationale: pending.rationale }),
      });
      pending = undefined;
    }
  }

  return options;
}

function structuredExchangePresentDetails(entry: unknown): StructuredExchangePresentDetails | undefined {
  if (typeof entry !== 'object' || entry === null || (entry as { type?: unknown }).type !== 'message') {
    return undefined;
  }
  const message = (entry as { message?: unknown }).message;
  if (
    typeof message !== 'object' ||
    message === null ||
    (message as { role?: unknown }).role !== 'toolResult'
  ) {
    return undefined;
  }
  const details = (message as { details?: unknown }).details;
  return isStructuredExchangePresentDetails(details)
    ? (details as StructuredExchangePresentDetails)
    : undefined;
}

function firstNonEmptyMarkdownLine(markdown: string): string | undefined {
  return markdown
    .split('\n')
    .map((line) => line.replace(/^#+\s*/, '').trim())
    .find((line) => line.length > 0);
}

function textContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((part) =>
      typeof part === 'object' && part !== null && typeof (part as { text?: unknown }).text === 'string'
        ? (part as { text: string }).text
        : '',
    )
    .filter((text) => text.length > 0)
    .join('\n');
}

function projectPendingElicitationExchange(
  envelope: BrunchSessionEnvelope,
): Static<typeof PendingExchangeResultSchema> {
  const exchange = pendingExchangeFromEnvelope(envelope);
  if (!exchange) {
    return { status: 'idle', exchange: null };
  }
  return { status: 'pending', exchange };
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

export async function runJsonRpcLineServer(options: {
  input: Readable;
  output: Writable;
  handlers: RpcHandlers;
  productUpdates?: ProductUpdatePublisher;
}): Promise<void> {
  const unsubscribe = options.productUpdates?.subscribe((updates) => {
    options.output.write(`${JSON.stringify(createProductUpdateNotification(updates))}\n`);
  });
  let buffered = '';
  try {
    for await (const chunk of options.input) {
      buffered += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
      let newlineIndex = buffered.indexOf('\n');
      while (newlineIndex >= 0) {
        const line = buffered.slice(0, newlineIndex);
        buffered = buffered.slice(newlineIndex + 1);
        await dispatchJsonRpcLine(line, options);
        newlineIndex = buffered.indexOf('\n');
      }
    }

    if (buffered.length > 0) {
      await dispatchJsonRpcLine(buffered, options);
    }
  } finally {
    unsubscribe?.();
  }
}

async function dispatchJsonRpcLine(
  line: string,
  options: {
    output: Writable;
    handlers: RpcHandlers;
  },
): Promise<void> {
  if (line.trim().length === 0) {
    return;
  }

  const response = await dispatchJsonRpcMessage(line, options.handlers);
  options.output.write(`${JSON.stringify(response)}\n`);
}
