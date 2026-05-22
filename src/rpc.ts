import { createInterface } from "node:readline/promises"
import type { Readable, Writable } from "node:stream"

import {
  loadLinearElicitationExchangeProjection,
  NonLinearTranscriptError,
} from "./elicitation-exchange.js"
import {
  createJsonRpcFailure,
  createJsonRpcSuccess,
  isJsonRpcRequest,
  jsonRpcRequestId,
  parseJsonRpcMessage,
  type JsonRpcResponse,
} from "./json-rpc-protocol.js"
import { workspaceSnapshotFromState } from "./print-snapshot.js"
import {
  resolveExplicitSessionProjectionTarget,
  type ExplicitSessionProjectionParams,
  type SessionProjectionTarget,
} from "./session-projection-reader.js"
import type { WorkspaceSessionCoordinator } from "./workspace-session-coordinator.js"

export interface RpcHandlers {
  handle(request: unknown): Promise<JsonRpcResponse>
}

export function createRpcHandlers(options: {
  coordinator: WorkspaceSessionCoordinator
  cwd?: string
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
        const state = await options.coordinator.openExisting()
        return createJsonRpcSuccess(
          requestId,
          workspaceSnapshotFromState(state),
        )
      }

      if (request.method === "session.elicitationExchanges") {
        const params = parseSessionProjectionParams(request.params)
        if (!params.ok) {
          return createJsonRpcFailure(requestId, -32602, "Invalid params")
        }

        const target = params.value
          ? await resolveExplicitSessionProjectionTarget(
              explicitProjectionCwd(options),
              params.value,
            )
          : selectedSessionFile(await options.coordinator.openExisting())
        if (!target.ok) {
          return createJsonRpcFailure(requestId, target.code, target.message)
        }

        try {
          return createJsonRpcSuccess(
            requestId,
            await loadLinearElicitationExchangeProjection(target.file),
          )
        } catch (error) {
          if (error instanceof NonLinearTranscriptError) {
            return createJsonRpcFailure(
              requestId,
              -32002,
              target.nonLinearMessage,
            )
          }
          throw error
        }
      }

      return createJsonRpcFailure(requestId, -32601, "Method not found")
    },
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

function selectedSessionFile(
  state: Awaited<ReturnType<WorkspaceSessionCoordinator["openExisting"]>>,
): SessionProjectionTarget {
  if (state.status !== "ready") {
    return { ok: false, code: -32001, message: "No selected Brunch session" }
  }
  return {
    ok: true,
    file: state.session.file,
    nonLinearMessage: "Selected Brunch session transcript is non-linear",
  }
}

function explicitProjectionCwd(options: { cwd?: string }): string {
  if (!options.cwd) {
    throw new Error("Explicit session projection requires a workspace cwd")
  }
  return options.cwd
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

    const parsed = parseJsonRpcMessage(line)
    if (!parsed.ok) {
      options.output.write(`${JSON.stringify(parsed.response)}\n`)
      continue
    }

    const response = await options.handlers.handle(parsed.value)
    options.output.write(`${JSON.stringify(response)}\n`)
  }
}
