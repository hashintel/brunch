import { createInterface } from 'node:readline/promises';
import type { Readable, Writable } from 'node:stream';

import { Type, type Static } from 'typebox';
import { Value } from 'typebox/value';

import type { StructuredExchangePresentDetails } from '../.pi/extensions/structured-exchange/shared/model.js';
import { isStructuredExchangePresentDetails } from '../.pi/extensions/structured-exchange/shared/recovery.js';
import { workspaceSnapshotFromState } from '../print-snapshot.js';
import {
  readBrunchSessionEnvelope,
  NonLinearTranscriptError,
  type BrunchSessionEnvelope,
} from '../session/brunch-session-envelope.js';
import {
  projectLinearElicitationExchangeProjection,
  projectLinearTranscriptDisplayProjection,
} from '../session/elicitation-exchange.js';
import {
  resolveExplicitSessionProjectionTarget,
  type ExplicitSessionProjectionParams,
  type SessionProjectionTarget,
} from '../session/session-projection-reader.js';
import type {
  DefaultWorkspaceCoordinator,
  WorkspaceActivationState,
  WorkspaceLaunchInventory,
  WorkspaceSessionState,
  SpecSessionActivationCoordinator,
  SpecSessionActivationDecision,
} from '../session/workspace-session-coordinator.js';
import {
  createJsonRpcFailure,
  createJsonRpcSuccess,
  isJsonRpcRequest,
  jsonRpcRequestId,
  dispatchJsonRpcMessage,
  type JsonRpcId,
  type JsonRpcRequest,
  type JsonRpcResponse,
} from './protocol.js';

export interface RpcHandlers {
  handle(request: unknown): Promise<JsonRpcResponse>;
}

export function createRpcHandlers(options: {
  coordinator: DefaultWorkspaceCoordinator & SpecSessionActivationCoordinator;
  cwd: string;
}): RpcHandlers {
  return {
    async handle(request) {
      if (!isJsonRpcRequest(request)) {
        return createJsonRpcFailure(null, -32600, 'Invalid Request');
      }

      const requestId = jsonRpcRequestId(request);

      if (request.method === 'rpc.discover') {
        if (request.params !== undefined) {
          return createJsonRpcFailure(requestId, -32602, 'Invalid params');
        }
        return createJsonRpcSuccess(requestId, discoverPublicRpcMethods());
      }

      if (request.method === 'workspace.snapshot') {
        if (request.params !== undefined) {
          return createJsonRpcFailure(requestId, -32602, 'Invalid params');
        }
        const state = await options.coordinator.openDefaultWorkspace();
        return createJsonRpcSuccess(requestId, workspaceSnapshotFromState(state));
      }

      if (request.method === 'workspace.selectionState') {
        if (request.params !== undefined) {
          return createJsonRpcFailure(requestId, -32602, 'Invalid params');
        }
        const [state, inventory] = await Promise.all([
          options.coordinator.openDefaultWorkspace(),
          options.coordinator.inspectWorkspace(),
        ]);
        return createJsonRpcSuccess(requestId, workspaceSelectionStateFromInventory(state, inventory));
      }

      if (request.method === 'workspace.activate') {
        const decision = parseWorkspaceActivationParams(request.params);
        if (!decision.ok) {
          return createJsonRpcFailure(requestId, -32602, 'Invalid params');
        }
        const state = await options.coordinator.activateWorkspace(decision.value);
        return createJsonRpcSuccess(requestId, workspaceActivationSnapshotFromState(state));
      }

      if (request.method === 'session.startElicitation') {
        if (request.params !== undefined) {
          return createJsonRpcFailure(requestId, -32602, 'Invalid params');
        }
        return handleStartElicitation(requestId, options);
      }

      if (request.method === 'session.pendingExchange') {
        return handleSessionProjection(requestId, request.params, options, projectPendingElicitationExchange);
      }

      if (request.method === 'elicitation.respond') {
        return handleRespondToElicitation(requestId, request.params, options);
      }

      if (request.method === 'session.elicitationExchanges') {
        return handleSessionProjection(
          requestId,
          request.params,
          options,
          projectLinearElicitationExchangeProjection,
        );
      }

      if (request.method === 'session.transcriptDisplay') {
        return handleSessionProjection(
          requestId,
          request.params,
          options,
          projectLinearTranscriptDisplayProjection,
        );
      }

      return createJsonRpcFailure(requestId, -32601, 'Method not found');
    },
  };
}

function workspaceSelectionStateFromInventory(
  state: WorkspaceSessionState,
  inventory: WorkspaceLaunchInventory,
): WorkspaceLaunchInventory & {
  status: WorkspaceSessionState['status'];
  requiresSelection: boolean;
} {
  return {
    ...inventory,
    status: state.status,
    requiresSelection: state.status !== 'ready',
  };
}

function workspaceActivationSnapshotFromState(state: WorkspaceActivationState):
  | ReturnType<typeof workspaceSnapshotFromState>
  | {
      status: 'cancelled';
      cwd: string;
      spec: WorkspaceActivationState['chrome']['spec'];
      chrome: {
        phase: 'select_spec' | 'elicitation';
        chatMode: 'select-spec' | 'responding-to-elicitation';
      };
    } {
  if (state.status === 'cancelled') {
    return {
      status: 'cancelled',
      cwd: state.cwd,
      spec: state.chrome.spec,
      chrome: {
        phase: state.chrome.phase,
        chatMode: state.chrome.chatMode,
      },
    };
  }
  return workspaceSnapshotFromState(state);
}

const NonBlankStringSchema = Type.String({ minLength: 1, pattern: '\\S' });
const PositiveIntegerSchema = Type.Integer({ minimum: 1 });

export const SpecSessionActivationDecisionSchema = Type.Union([
  Type.Object(
    {
      action: Type.Literal('continue'),
      specId: PositiveIntegerSchema,
      sessionFile: NonBlankStringSchema,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      action: Type.Literal('openSession'),
      specId: PositiveIntegerSchema,
      sessionFile: NonBlankStringSchema,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      action: Type.Literal('newSession'),
      specId: PositiveIntegerSchema,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      action: Type.Literal('newSpec'),
      title: NonBlankStringSchema,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      action: Type.Literal('cancel'),
    },
    { additionalProperties: false },
  ),
]);

const WorkspaceActivationParamsSchema = Type.Object(
  {
    decision: SpecSessionActivationDecisionSchema,
  },
  { additionalProperties: false },
);

type WorkspaceActivationParams = Static<typeof WorkspaceActivationParamsSchema>;

const NoParamsSchema = Type.Void({ description: 'Omit JSON-RPC params.' });

const WorkspaceSnapshotResultSchema = Type.Object(
  {
    status: Type.String(),
    cwd: Type.String(),
    spec: Type.Union([
      Type.Null(),
      Type.Object(
        { id: Type.String(), title: Type.String() },
        {
          additionalProperties: true,
        },
      ),
    ]),
    chrome: Type.Object({}, { additionalProperties: true }),
  },
  { additionalProperties: true },
);

const WorkspaceSelectionStateResultSchema = Type.Object(
  {
    status: Type.String(),
    requiresSelection: Type.Boolean(),
    cwd: Type.String(),
    specs: Type.Array(Type.Object({}, { additionalProperties: true })),
    unavailableSessions: Type.Array(Type.Object({}, { additionalProperties: true })),
  },
  { additionalProperties: true },
);

const WorkspaceActivationResultSchema = Type.Union([
  WorkspaceSnapshotResultSchema,
  Type.Object(
    {
      status: Type.Literal('cancelled'),
      cwd: Type.String(),
      spec: Type.Union([
        Type.Null(),
        Type.Object(
          { id: Type.String(), title: Type.String() },
          {
            additionalProperties: true,
          },
        ),
      ]),
      chrome: Type.Object(
        {
          phase: Type.Union([Type.Literal('select_spec'), Type.Literal('elicitation')]),
          chatMode: Type.Union([Type.Literal('select-spec'), Type.Literal('responding-to-elicitation')]),
        },
        { additionalProperties: false },
      ),
    },
    { additionalProperties: false },
  ),
]);

const SessionProjectionParamsSchema = Type.Object(
  {
    sessionId: NonBlankStringSchema,
    specId: Type.Optional(NonBlankStringSchema),
  },
  { additionalProperties: false },
);

const ElicitationExchangesResultSchema = Type.Object(
  {
    status: Type.String(),
    exchanges: Type.Array(Type.Object({}, { additionalProperties: true })),
  },
  { additionalProperties: true },
);

const TranscriptDisplayResultSchema = Type.Object(
  {
    rows: Type.Array(Type.Object({}, { additionalProperties: true })),
  },
  { additionalProperties: true },
);

const PendingElicitationExchangeSchema = Type.Object(
  {
    exchangeId: NonBlankStringSchema,
    lens: Type.Literal('step-by-step'),
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

const StartElicitationResultSchema = Type.Object(
  {
    status: Type.Literal('pending'),
    exchange: PendingElicitationExchangeSchema,
  },
  { additionalProperties: false },
);

const PendingExchangeResultSchema = Type.Union([
  StartElicitationResultSchema,
  Type.Object(
    {
      status: Type.Literal('idle'),
      exchange: Type.Null(),
    },
    { additionalProperties: false },
  ),
]);

const ElicitationRespondParamsSchema = Type.Object(
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

const ElicitationRespondResultSchema = Type.Object(
  {
    status: Type.Literal('accepted'),
    exchangeId: NonBlankStringSchema,
    answer: Type.Object({}, { additionalProperties: true }),
    note: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

type ElicitationRespondParams = Static<typeof ElicitationRespondParamsSchema>;
type ElicitationRespondResult = Static<typeof ElicitationRespondResultSchema>;

type RpcMethodDiscovery = {
  method: string;
  description: string;
  paramsSchema: unknown;
  resultSchema: unknown;
  examples: JsonRpcRequest[];
};

function discoverPublicRpcMethods(): { methods: RpcMethodDiscovery[] } {
  return { methods: PUBLIC_RPC_METHOD_DISCOVERY };
}

const PUBLIC_RPC_METHOD_DISCOVERY: RpcMethodDiscovery[] = [
  {
    method: 'rpc.discover',
    description:
      'List the public Brunch JSON-RPC methods supported by this host with schemas and example calls.',
    paramsSchema: NoParamsSchema,
    resultSchema: Type.Object(
      { methods: Type.Array(Type.Object({}, { additionalProperties: true })) },
      { additionalProperties: false },
    ),
    examples: [{ jsonrpc: '2.0', id: 1, method: 'rpc.discover' }],
  },
  {
    method: 'workspace.snapshot',
    description:
      'Return the current Brunch workspace/spec/session snapshot for the invocation cwd without changing activation state.',
    paramsSchema: NoParamsSchema,
    resultSchema: WorkspaceSnapshotResultSchema,
    examples: [{ jsonrpc: '2.0', id: 2, method: 'workspace.snapshot' }],
  },
  {
    method: 'workspace.selectionState',
    description:
      'Return the product-shaped workspace inventory and whether the client must choose or create a spec/session before an agent loop can run.',
    paramsSchema: NoParamsSchema,
    resultSchema: WorkspaceSelectionStateResultSchema,
    examples: [{ jsonrpc: '2.0', id: 3, method: 'workspace.selectionState' }],
  },
  {
    method: 'workspace.activate',
    description:
      'Apply an explicit workspace→spec→session activation decision such as continuing, opening a session, creating a session, creating a spec, or cancelling.',
    paramsSchema: WorkspaceActivationParamsSchema,
    resultSchema: WorkspaceActivationResultSchema,
    examples: [
      {
        jsonrpc: '2.0',
        id: 4,
        method: 'workspace.activate',
        params: { decision: { action: 'newSpec', title: 'POC spec' } },
      },
      {
        jsonrpc: '2.0',
        id: 5,
        method: 'workspace.activate',
        params: {
          decision: {
            action: 'openSession',
            specId: 1,
            sessionFile: '.brunch/sessions/session-1.jsonl',
          },
        },
      },
    ],
  },
  {
    method: 'session.elicitationExchanges',
    description:
      'Project structured elicitation exchanges from the selected or explicitly named linear Brunch session transcript.',
    paramsSchema: SessionProjectionParamsSchema,
    resultSchema: ElicitationExchangesResultSchema,
    examples: [
      {
        jsonrpc: '2.0',
        id: 6,
        method: 'session.elicitationExchanges',
        params: { sessionId: 'session-1', specId: 1 },
      },
    ],
  },
  {
    method: 'session.transcriptDisplay',
    description:
      'Project transcript display rows from the selected or explicitly named linear Brunch session transcript.',
    paramsSchema: SessionProjectionParamsSchema,
    resultSchema: TranscriptDisplayResultSchema,
    examples: [
      {
        jsonrpc: '2.0',
        id: 7,
        method: 'session.transcriptDisplay',
        params: { sessionId: 'session-1', specId: 1 },
      },
    ],
  },
  {
    method: 'session.startElicitation',
    description:
      "Start or resume the selected session's deterministic structured-exchange permutation loop and return the current pending exchange.",
    paramsSchema: NoParamsSchema,
    resultSchema: StartElicitationResultSchema,
    examples: [{ jsonrpc: '2.0', id: 8, method: 'session.startElicitation' }],
  },
  {
    method: 'session.pendingExchange',
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
  },
  {
    method: 'elicitation.respond',
    description:
      "Submit a text, single-choice, or multi-choice answer for the selected session's current deterministic tuple-shaped pending structured exchange.",
    paramsSchema: ElicitationRespondParamsSchema,
    resultSchema: ElicitationRespondResultSchema,
    examples: [
      {
        jsonrpc: '2.0',
        id: 11,
        method: 'elicitation.respond',
        params: {
          exchangeId: 'deterministic-grounding-choice',
          answer: { optionId: 'new-from-scratch' },
          note: 'This is a greenfield product.',
        },
      },
    ],
  },
];

type WorkspaceActivationParamsParseResult =
  | {
      ok: true;
      value: SpecSessionActivationDecision;
    }
  | { ok: false };

function parseWorkspaceActivationParams(value: unknown): WorkspaceActivationParamsParseResult {
  if (!Value.Check(WorkspaceActivationParamsSchema, value)) {
    return { ok: false };
  }
  const params: WorkspaceActivationParams = Value.Parse(WorkspaceActivationParamsSchema, value);
  return { ok: true, value: params.decision };
}

async function handleSessionProjection<T>(
  requestId: JsonRpcId,
  rawParams: unknown,
  options: {
    coordinator: DefaultWorkspaceCoordinator;
    cwd: string;
  },
  loadProjection: (envelope: BrunchSessionEnvelope) => T,
): Promise<JsonRpcResponse> {
  const params = parseSessionProjectionParams(rawParams);
  if (!params.ok) {
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

async function handleStartElicitation(
  requestId: JsonRpcId,
  options: {
    coordinator: DefaultWorkspaceCoordinator;
    cwd: string;
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

  return createJsonRpcSuccess(requestId, {
    status: 'pending',
    exchange: reloaded ?? exchange,
  });
}

async function handleRespondToElicitation(
  requestId: JsonRpcId,
  rawParams: unknown,
  options: {
    coordinator: DefaultWorkspaceCoordinator;
    cwd: string;
  },
): Promise<JsonRpcResponse> {
  if (!Value.Check(ElicitationRespondParamsSchema, rawParams)) {
    return createJsonRpcFailure(requestId, -32602, 'Invalid params');
  }
  const params: ElicitationRespondParams = Value.Parse(ElicitationRespondParamsSchema, rawParams);

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

  const result: ElicitationRespondResult = {
    status: 'accepted',
    exchangeId: pending.exchangeId,
    answer: accepted.answer,
    ...(params.note === undefined ? {} : { note: params.note }),
  };

  state.session.manager.appendMessage(accepted.toolResultMessage);
  flushSessionEntries(state.session.manager, state.session.file);

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
  params: ElicitationRespondParams,
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
      lens: 'step-by-step',
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
      lens: 'step-by-step',
      mode: 'text',
      prompt: 'What are we specifying?',
      details:
        "This covers the text-answer permutation in Brunch's deterministic public-RPC structured-exchange parity proof.",
      options: [],
      note: { allowed: true },
    },
    {
      exchangeId: `deterministic-grounding-multi-${turnNumber}`,
      lens: 'step-by-step',
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
    lens: 'step-by-step',
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

export async function runJsonRpcLineServer(options: {
  input: Readable;
  output: Writable;
  handlers: RpcHandlers;
}): Promise<void> {
  const lines = createInterface({ input: options.input });
  for await (const line of lines) {
    if (line.trim().length === 0) {
      continue;
    }

    const response = await dispatchJsonRpcMessage(line, options.handlers);
    options.output.write(`${JSON.stringify(response)}\n`);
  }
}
