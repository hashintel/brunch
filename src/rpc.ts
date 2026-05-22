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
  WorkspaceSessionState,
} from "./workspace-session-coordinator.js"

export interface RpcHandlers {
  handle(request: unknown): Promise<JsonRpcResponse>
}

export function createRpcHandlers(options: {
  coordinator: DefaultWorkspaceCoordinator
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
