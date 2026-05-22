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
import type { WorkspaceSessionCoordinator } from "./workspace-session-coordinator.js"

export interface RpcHandlers {
  handle(request: unknown): Promise<JsonRpcResponse>
}

export function createRpcHandlers(options: {
  coordinator: WorkspaceSessionCoordinator
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
        if (request.params !== undefined) {
          return createJsonRpcFailure(requestId, -32602, "Invalid params")
        }

        const state = await options.coordinator.openExisting()
        if (state.status !== "ready") {
          return createJsonRpcFailure(
            requestId,
            -32001,
            "No selected Brunch session",
          )
        }

        try {
          return createJsonRpcSuccess(
            requestId,
            await loadLinearElicitationExchangeProjection(state.session.file),
          )
        } catch (error) {
          if (error instanceof NonLinearTranscriptError) {
            return createJsonRpcFailure(
              requestId,
              -32002,
              "Selected Brunch session transcript is non-linear",
            )
          }
          throw error
        }
      }

      return createJsonRpcFailure(requestId, -32601, "Method not found")
    },
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

    const parsed = parseJsonRpcMessage(line)
    if (!parsed.ok) {
      options.output.write(`${JSON.stringify(parsed.response)}\n`)
      continue
    }

    const response = await options.handlers.handle(parsed.value)
    options.output.write(`${JSON.stringify(response)}\n`)
  }
}
