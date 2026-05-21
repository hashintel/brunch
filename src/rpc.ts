import { createInterface } from "node:readline/promises"
import type { Readable, Writable } from "node:stream"

import { workspaceSnapshotFromState } from "./print-snapshot.js"
import type { WorkspaceSessionCoordinator } from "./workspace-session-coordinator.js"

interface JsonRpcRequest {
  jsonrpc: "2.0"
  id?: string | number | null
  method: string
  params?: unknown
}

interface JsonRpcSuccess {
  jsonrpc: "2.0"
  id: string | number | null
  result: unknown
}

interface JsonRpcFailure {
  jsonrpc: "2.0"
  id: string | number | null
  error: {
    code: number
    message: string
  }
}

type JsonRpcResponse = JsonRpcSuccess | JsonRpcFailure

export interface RpcHandlers {
  handle(request: unknown): Promise<JsonRpcResponse>
}

export function createRpcHandlers(options: {
  coordinator: WorkspaceSessionCoordinator
}): RpcHandlers {
  return {
    async handle(request) {
      if (!isJsonRpcRequest(request)) {
        return failure(null, -32600, "Invalid Request")
      }

      if (request.method === "workspace.snapshot") {
        if (request.params !== undefined) {
          return failure(request.id ?? null, -32602, "Invalid params")
        }
        const state = await options.coordinator.openExisting()
        return success(request.id ?? null, workspaceSnapshotFromState(state))
      }

      return failure(request.id ?? null, -32601, "Method not found")
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

    let parsed: unknown
    try {
      parsed = (JSON.parse(line) as unknown)
    } catch {
      options.output.write(
        `${JSON.stringify(failure(null, -32700, "Parse error"))}\n`,
      )
      continue
    }

    const response = await options.handlers.handle(parsed)
    options.output.write(`${JSON.stringify(response)}\n`)
  }
}

function success(id: string | number | null, result: unknown): JsonRpcSuccess {
  return { jsonrpc: "2.0", id, result }
}

function failure(
  id: string | number | null,
  code: number,
  message: string,
): JsonRpcFailure {
  return { jsonrpc: "2.0", id, error: { code, message } }
}

function isJsonRpcRequest(value: unknown): value is JsonRpcRequest {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { jsonrpc?: unknown }).jsonrpc === "2.0" &&
    typeof (value as { method?: unknown }).method === "string"
  )
}
