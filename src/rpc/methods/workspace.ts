import { Type, type Static } from 'typebox';
import { Value } from 'typebox/value';

import { workspaceSnapshotFromState } from '../../print-snapshot.js';
import type {
  SpecSessionActivationDecision,
  WorkspaceActivationState,
  WorkspaceLaunchInventory,
  WorkspaceSessionState,
} from '../../session/workspace-session-coordinator.js';
import { selectedSessionProductUpdates } from '../product-updates.js';
import { createJsonRpcFailure, createJsonRpcSuccess, jsonRpcRequestId } from '../protocol.js';
import type { RpcMethodContext, RpcMethodDefinition } from './registry.js';
import { NoParamsSchema, NonBlankStringSchema, PositiveIntegerSchema } from './schemas.js';

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
  Type.Object({ action: Type.Literal('cancel') }, { additionalProperties: false }),
]);

const WorkspaceActivationParamsSchema = Type.Object(
  {
    decision: SpecSessionActivationDecisionSchema,
  },
  { additionalProperties: false },
);

type WorkspaceActivationParams = Static<typeof WorkspaceActivationParamsSchema>;

const WorkspaceSnapshotResultSchema = Type.Object(
  {
    status: Type.String(),
    cwd: Type.String(),
    spec: Type.Union([Type.Null(), Type.Object({}, { additionalProperties: true })]),
    session: Type.Optional(Type.Union([Type.Null(), Type.Object({}, { additionalProperties: true })])),
    chrome: Type.Object({}, { additionalProperties: true }),
  },
  { additionalProperties: true },
);

const WorkspaceSelectionStateResultSchema = Type.Object(
  {
    status: Type.String(),
    requiresSelection: Type.Boolean(),
    specs: Type.Array(Type.Object({}, { additionalProperties: true })),
    sessions: Type.Array(Type.Object({}, { additionalProperties: true })),
  },
  { additionalProperties: true },
);

const WorkspaceActivationResultSchema = Type.Union([
  Type.Object(
    {
      status: Type.Literal('ready'),
      spec: Type.Object({}, { additionalProperties: true }),
      session: Type.Object({}, { additionalProperties: true }),
      chrome: Type.Object({}, { additionalProperties: true }),
    },
    { additionalProperties: true },
  ),
  Type.Object(
    {
      status: Type.Literal('cancelled'),
      chrome: Type.Object({}, { additionalProperties: true }),
    },
    { additionalProperties: true },
  ),
]);

export const workspaceRpcMethods: readonly RpcMethodDefinition<RpcMethodContext>[] = [
  {
    method: 'workspace.snapshot',
    access: 'read',
    description:
      'Return the current Brunch workspace/spec/session snapshot for the invocation cwd without changing activation state.',
    paramsSchema: NoParamsSchema,
    resultSchema: WorkspaceSnapshotResultSchema,
    examples: [{ jsonrpc: '2.0', id: 2, method: 'workspace.snapshot' }],
    async handle(context, request) {
      const requestId = jsonRpcRequestId(request);
      if (request.params !== undefined) {
        return createJsonRpcFailure(requestId, -32602, 'Invalid params');
      }
      const state = await context.coordinator.openDefaultWorkspace();
      return createJsonRpcSuccess(requestId, workspaceSnapshotFromState(state));
    },
  },
  {
    method: 'workspace.selectionState',
    access: 'read',
    description:
      'Return the product-shaped workspace inventory and whether the client must choose or create a spec/session before an agent loop can run.',
    paramsSchema: NoParamsSchema,
    resultSchema: WorkspaceSelectionStateResultSchema,
    examples: [{ jsonrpc: '2.0', id: 3, method: 'workspace.selectionState' }],
    async handle(context, request) {
      const requestId = jsonRpcRequestId(request);
      if (request.params !== undefined) {
        return createJsonRpcFailure(requestId, -32602, 'Invalid params');
      }
      const [state, inventory] = await Promise.all([
        context.coordinator.openDefaultWorkspace(),
        context.coordinator.inspectWorkspace(),
      ]);
      return createJsonRpcSuccess(requestId, workspaceSelectionStateFromInventory(state, inventory));
    },
  },
  {
    method: 'workspace.activate',
    access: 'write',
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
    async handle(context, request) {
      const requestId = jsonRpcRequestId(request);
      const decision = parseWorkspaceActivationParams(request.params);
      if (!decision.ok) {
        return createJsonRpcFailure(requestId, -32602, 'Invalid params');
      }
      const state = await context.coordinator.activateWorkspace(decision.value);
      const response = workspaceActivationSnapshotFromState(state);
      if (context.productUpdates && state.status === 'ready') {
        context.productUpdates.publish(
          selectedSessionProductUpdates({ specId: state.spec.id, sessionId: state.session.id }),
        );
      }
      return createJsonRpcSuccess(requestId, response);
    },
  },
];

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

function workspaceActivationSnapshotFromState(state: WorkspaceActivationState) {
  if (state.status === 'cancelled') {
    return {
      status: 'cancelled' as const,
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
