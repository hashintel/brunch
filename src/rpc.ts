import { createInterface } from "node:readline/promises"
import type { Readable, Writable } from "node:stream"

import { Type, type Static } from "typebox"
import { Value } from "typebox/value"

import {
  readBrunchSessionEnvelope,
  NonLinearTranscriptError,
  type BrunchSessionEnvelope,
} from "./brunch-session-envelope.js"
import {
  projectLinearElicitationExchangeProjection,
  projectLinearTranscriptDisplayProjection,
} from "./elicitation-exchange.js"
import {
  createJsonRpcFailure,
  createJsonRpcSuccess,
  isJsonRpcRequest,
  jsonRpcRequestId,
  dispatchJsonRpcMessage,
  type JsonRpcId,
  type JsonRpcRequest,
  type JsonRpcResponse,
} from "./json-rpc-protocol.js"
import { workspaceSnapshotFromState } from "./print-snapshot.js"
import {
  resolveExplicitSessionProjectionTarget,
  type ExplicitSessionProjectionParams,
  type SessionProjectionTarget,
} from "./session-projection-reader.js"
import type {
  DefaultWorkspaceCoordinator,
  WorkspaceActivationState,
  WorkspaceLaunchInventory,
  WorkspaceSessionState,
  SpecSessionActivationCoordinator,
  SpecSessionActivationDecision,
} from "./workspace-session-coordinator.js"

export interface RpcHandlers {
  handle(request: unknown): Promise<JsonRpcResponse>
}

export function createRpcHandlers(options: {
  coordinator: DefaultWorkspaceCoordinator & SpecSessionActivationCoordinator
  cwd: string
}): RpcHandlers {
  return {
    async handle(request) {
      if (!isJsonRpcRequest(request)) {
        return createJsonRpcFailure(null, -32600, "Invalid Request")
      }

      const requestId = jsonRpcRequestId(request)

      if (request.method === "rpc.discover") {
        if (request.params !== undefined) {
          return createJsonRpcFailure(requestId, -32602, "Invalid params")
        }
        return createJsonRpcSuccess(requestId, discoverPublicRpcMethods())
      }

      if (request.method === "workspace.snapshot") {
        if (request.params !== undefined) {
          return createJsonRpcFailure(requestId, -32602, "Invalid params")
        }
        const state = await options.coordinator.openDefaultWorkspace()
        return createJsonRpcSuccess(
          requestId,
          workspaceSnapshotFromState(state),
        )
      }

      if (request.method === "workspace.selectionState") {
        if (request.params !== undefined) {
          return createJsonRpcFailure(requestId, -32602, "Invalid params")
        }
        const [state, inventory] = await Promise.all([
          options.coordinator.openDefaultWorkspace(),
          options.coordinator.inspectWorkspace(),
        ])
        return createJsonRpcSuccess(
          requestId,
          workspaceSelectionStateFromInventory(state, inventory),
        )
      }

      if (request.method === "workspace.activate") {
        const decision = parseWorkspaceActivationParams(request.params)
        if (!decision.ok) {
          return createJsonRpcFailure(requestId, -32602, "Invalid params")
        }
        const state = await options.coordinator.activateWorkspace(
          decision.value,
        )
        return createJsonRpcSuccess(
          requestId,
          workspaceActivationSnapshotFromState(state),
        )
      }

      if (request.method === "session.elicitationExchanges") {
        return handleSessionProjection(
          requestId,
          request.params,
          options,
          projectLinearElicitationExchangeProjection,
        )
      }

      if (request.method === "session.transcriptDisplay") {
        return handleSessionProjection(
          requestId,
          request.params,
          options,
          projectLinearTranscriptDisplayProjection,
        )
      }

      return createJsonRpcFailure(requestId, -32601, "Method not found")
    },
  }
}

function workspaceSelectionStateFromInventory(
  state: WorkspaceSessionState,
  inventory: WorkspaceLaunchInventory,
): WorkspaceLaunchInventory & {
  status: WorkspaceSessionState["status"]
  requiresSelection: boolean
} {
  return {
    ...inventory,
    status: state.status,
    requiresSelection: state.status !== "ready",
  }
}

function workspaceActivationSnapshotFromState(
  state: WorkspaceActivationState,
): ReturnType<typeof workspaceSnapshotFromState> | {
  status: "cancelled"
  cwd: string
  spec: WorkspaceActivationState["chrome"]["spec"]
  chrome: {
    phase: "select_spec" | "elicitation"
    chatMode: "select-spec" | "responding-to-elicitation"
  }
} {
  if (state.status === "cancelled") {
    return {
      status: "cancelled",
      cwd: state.cwd,
      spec: state.chrome.spec,
      chrome: {
        phase: state.chrome.phase,
        chatMode: state.chrome.chatMode,
      },
    }
  }
  return workspaceSnapshotFromState(state)
}

const NonBlankStringSchema = Type.String({ minLength: 1, pattern: "\\S" })

export const SpecSessionActivationDecisionSchema = Type.Union([
  Type.Object(
    {
      action: Type.Literal("continue"),
      specId: NonBlankStringSchema,
      sessionFile: NonBlankStringSchema,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      action: Type.Literal("openSession"),
      specId: NonBlankStringSchema,
      sessionFile: NonBlankStringSchema,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      action: Type.Literal("newSession"),
      specId: NonBlankStringSchema,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      action: Type.Literal("newSpec"),
      title: NonBlankStringSchema,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      action: Type.Literal("cancel"),
    },
    { additionalProperties: false },
  ),
])

const WorkspaceActivationParamsSchema = Type.Object(
  {
    decision: SpecSessionActivationDecisionSchema,
  },
  { additionalProperties: false },
)

type WorkspaceActivationParams = Static<typeof WorkspaceActivationParamsSchema>

const NoParamsSchema = Type.Void({ description: "Omit JSON-RPC params." })

const WorkspaceSnapshotResultSchema = Type.Object(
  {
    status: Type.String(),
    cwd: Type.String(),
    spec: Type.Union([
      Type.Null(),
      Type.Object({ id: Type.String(), title: Type.String() }, {
        additionalProperties: true,
      }),
    ]),
    chrome: Type.Object({}, { additionalProperties: true }),
  },
  { additionalProperties: true },
)

const WorkspaceSelectionStateResultSchema = Type.Object(
  {
    status: Type.String(),
    requiresSelection: Type.Boolean(),
    cwd: Type.String(),
    specs: Type.Array(Type.Object({}, { additionalProperties: true })),
    unavailableSessions: Type.Array(
      Type.Object({}, { additionalProperties: true }),
    ),
  },
  { additionalProperties: true },
)

const WorkspaceActivationResultSchema = Type.Union([
  WorkspaceSnapshotResultSchema,
  Type.Object(
    {
      status: Type.Literal("cancelled"),
      cwd: Type.String(),
      spec: Type.Union([
        Type.Null(),
        Type.Object({ id: Type.String(), title: Type.String() }, {
          additionalProperties: true,
        }),
      ]),
      chrome: Type.Object(
        {
          phase: Type.Union([
            Type.Literal("select_spec"),
            Type.Literal("elicitation"),
          ]),
          chatMode: Type.Union([
            Type.Literal("select-spec"),
            Type.Literal("responding-to-elicitation"),
          ]),
        },
        { additionalProperties: false },
      ),
    },
    { additionalProperties: false },
  ),
])

const SessionProjectionParamsSchema = Type.Object(
  {
    sessionId: NonBlankStringSchema,
    specId: Type.Optional(NonBlankStringSchema),
  },
  { additionalProperties: false },
)

const ElicitationExchangesResultSchema = Type.Object(
  {
    status: Type.String(),
    exchanges: Type.Array(Type.Object({}, { additionalProperties: true })),
  },
  { additionalProperties: true },
)

const TranscriptDisplayResultSchema = Type.Object(
  {
    rows: Type.Array(Type.Object({}, { additionalProperties: true })),
  },
  { additionalProperties: true },
)

type RpcMethodDiscovery = {
  method: string
  description: string
  paramsSchema: unknown
  resultSchema: unknown
  examples: JsonRpcRequest[]
}

function discoverPublicRpcMethods(): { methods: RpcMethodDiscovery[] } {
  return { methods: PUBLIC_RPC_METHOD_DISCOVERY }
}

const PUBLIC_RPC_METHOD_DISCOVERY: RpcMethodDiscovery[] = [
  {
    method: "rpc.discover",
    description:
      "List the public Brunch JSON-RPC methods supported by this host with schemas and example calls.",
    paramsSchema: NoParamsSchema,
    resultSchema: Type.Object(
      { methods: Type.Array(Type.Object({}, { additionalProperties: true })) },
      { additionalProperties: false },
    ),
    examples: [{ jsonrpc: "2.0", id: 1, method: "rpc.discover" }],
  },
  {
    method: "workspace.snapshot",
    description:
      "Return the current Brunch workspace/spec/session snapshot for the invocation cwd without changing activation state.",
    paramsSchema: NoParamsSchema,
    resultSchema: WorkspaceSnapshotResultSchema,
    examples: [{ jsonrpc: "2.0", id: 2, method: "workspace.snapshot" }],
  },
  {
    method: "workspace.selectionState",
    description:
      "Return the product-shaped workspace inventory and whether the client must choose or create a spec/session before an agent loop can run.",
    paramsSchema: NoParamsSchema,
    resultSchema: WorkspaceSelectionStateResultSchema,
    examples: [{ jsonrpc: "2.0", id: 3, method: "workspace.selectionState" }],
  },
  {
    method: "workspace.activate",
    description:
      "Apply an explicit workspace→spec→session activation decision such as continuing, opening a session, creating a session, creating a spec, or cancelling.",
    paramsSchema: WorkspaceActivationParamsSchema,
    resultSchema: WorkspaceActivationResultSchema,
    examples: [
      {
        jsonrpc: "2.0",
        id: 4,
        method: "workspace.activate",
        params: { decision: { action: "newSpec", title: "POC spec" } },
      },
      {
        jsonrpc: "2.0",
        id: 5,
        method: "workspace.activate",
        params: {
          decision: {
            action: "openSession",
            specId: "spec-1",
            sessionFile: ".brunch/sessions/session-1.jsonl",
          },
        },
      },
    ],
  },
  {
    method: "session.elicitationExchanges",
    description:
      "Project structured elicitation exchanges from the selected or explicitly named linear Brunch session transcript.",
    paramsSchema: SessionProjectionParamsSchema,
    resultSchema: ElicitationExchangesResultSchema,
    examples: [
      {
        jsonrpc: "2.0",
        id: 6,
        method: "session.elicitationExchanges",
        params: { sessionId: "session-1", specId: "spec-1" },
      },
    ],
  },
  {
    method: "session.transcriptDisplay",
    description:
      "Project transcript display rows from the selected or explicitly named linear Brunch session transcript.",
    paramsSchema: SessionProjectionParamsSchema,
    resultSchema: TranscriptDisplayResultSchema,
    examples: [
      {
        jsonrpc: "2.0",
        id: 7,
        method: "session.transcriptDisplay",
        params: { sessionId: "session-1", specId: "spec-1" },
      },
    ],
  },
]

type WorkspaceActivationParamsParseResult = {
  ok: true
  value: SpecSessionActivationDecision
} | { ok: false }

function parseWorkspaceActivationParams(
  value: unknown,
): WorkspaceActivationParamsParseResult {
  if (!Value.Check(WorkspaceActivationParamsSchema, value)) {
    return { ok: false }
  }
  const params: WorkspaceActivationParams = Value.Parse(
    WorkspaceActivationParamsSchema,
    value,
  )
  return { ok: true, value: params.decision }
}

async function handleSessionProjection<T>(
  requestId: JsonRpcId,
  rawParams: unknown,
  options: {
    coordinator: DefaultWorkspaceCoordinator
    cwd: string
  },
  loadProjection: (envelope: BrunchSessionEnvelope) => T,
): Promise<JsonRpcResponse> {
  const params = parseSessionProjectionParams(rawParams)
  if (!params.ok) {
    return createJsonRpcFailure(requestId, -32602, "Invalid params")
  }

  const target = params.value
    ? await resolveExplicitSessionProjectionTarget(options.cwd, params.value)
    : await selectedSessionFile(
        await options.coordinator.openDefaultWorkspace(),
      )
  if (!target.ok) {
    return createJsonRpcFailure(requestId, target.code, target.message)
  }

  try {
    return createJsonRpcSuccess(requestId, loadProjection(target.envelope))
  } catch (error) {
    if (error instanceof NonLinearTranscriptError) {
      return createJsonRpcFailure(requestId, -32002, target.nonLinearMessage)
    }
    throw error
  }
}

type SessionProjectionParamsParseResult = {
  ok: true
  value: ExplicitSessionProjectionParams | null
} | { ok: false }

function parseSessionProjectionParams(
  value: unknown,
): SessionProjectionParamsParseResult {
  if (value === undefined) {
    return { ok: true, value: null }
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false }
  }

  const keys = Object.keys(value)
  if (!keys.every((key) => key === "sessionId" || key === "specId")) {
    return { ok: false }
  }

  const sessionId = (value as { sessionId?: unknown }).sessionId
  const specId = (value as { specId?: unknown }).specId
  if (
    typeof sessionId !== "string" ||
    sessionId.length === 0 ||
    (specId !== undefined &&
      (typeof specId !== "string" || specId.length === 0))
  ) {
    return { ok: false }
  }

  return {
    ok: true,
    value: specId === undefined ? { sessionId } : { sessionId, specId },
  }
}

async function selectedSessionFile(
  state: WorkspaceSessionState,
): Promise<SessionProjectionTarget> {
  if (state.status !== "ready") {
    return { ok: false, code: -32001, message: "No selected Brunch session" }
  }

  const readResult = await readBrunchSessionEnvelope(state.session.file)
  if (!readResult.ok) {
    return {
      ok: false,
      code: -32005,
      message: "Brunch session self-description is invalid",
    }
  }

  return {
    ok: true,
    envelope: readResult.envelope,
    nonLinearMessage: "Selected Brunch session transcript is non-linear",
  }
}

export async function runJsonRpcLineServer(options: {
  input: Readable
  output: Writable
  handlers: RpcHandlers
}): Promise<void> {
  const lines = createInterface({ input: options.input })
  for await (const line of lines) {
    if (line.trim().length === 0) {
      continue
    }

    const response = await dispatchJsonRpcMessage(line, options.handlers)
    options.output.write(`${JSON.stringify(response)}\n`)
  }
}
