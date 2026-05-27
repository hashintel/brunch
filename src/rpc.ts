import { createInterface } from "node:readline/promises"
import type { Readable, Writable } from "node:stream"

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
  coordinator: DefaultWorkspaceCoordinator & Partial<SpecSessionActivationCoordinator>
  cwd: string
}): RpcHandlers {
  return {
    async handle(request) {
      if (!isJsonRpcRequest(request)) {
        return createJsonRpcFailure(null, -32600, "Invalid Request")
      }

      const requestId = jsonRpcRequestId(request)

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
        if (!options.coordinator.inspectWorkspace) {
          return createJsonRpcFailure(requestId, -32603, "Internal error")
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
        if (!options.coordinator.activateWorkspace) {
          return createJsonRpcFailure(requestId, -32603, "Internal error")
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

type WorkspaceActivationParamsParseResult = {
  ok: true
  value: SpecSessionActivationDecision
} | { ok: false }

function parseWorkspaceActivationParams(
  value: unknown,
): WorkspaceActivationParamsParseResult {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false }
  }
  const decision = (value as { decision?: unknown }).decision
  if (
    typeof decision !== "object" ||
    decision === null ||
    Array.isArray(decision)
  ) {
    return { ok: false }
  }
  const action = (decision as { action?: unknown }).action
  if (action === "cancel") return { ok: true, value: { action } }
  if (action === "newSpec") {
    const title = (decision as { title?: unknown }).title
    return typeof title === "string" && title.trim().length > 0
      ? { ok: true, value: { action, title } }
      : { ok: false }
  }
  if (action === "newSession") {
    const specId = (decision as { specId?: unknown }).specId
    return typeof specId === "string" && specId.length > 0
      ? { ok: true, value: { action, specId } }
      : { ok: false }
  }
  if (action === "continue" || action === "openSession") {
    const specId = (decision as { specId?: unknown }).specId
    const sessionFile = (decision as { sessionFile?: unknown }).sessionFile
    return typeof specId === "string" &&
      specId.length > 0 &&
      typeof sessionFile === "string" &&
      sessionFile.length > 0
      ? { ok: true, value: { action, specId, sessionFile } }
      : { ok: false }
  }
  return { ok: false }
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
