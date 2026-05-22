import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"
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
        const params = parseSessionProjectionParams(request.params)
        if (!params.ok) {
          return createJsonRpcFailure(requestId, -32602, "Invalid params")
        }

        const state = await options.coordinator.openExisting()
        const target = params.value
          ? await findBoundSessionFile(state.cwd, params.value)
          : selectedSessionFile(state)
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

type SessionProjectionParams = {
  sessionId: string
  specId?: string
}

type SessionProjectionTarget = {
  ok: true
  file: string
  nonLinearMessage: string
} | {
  ok: false
  code: number
  message: string
}

type SessionProjectionParamsParseResult = {
  ok: true
  value: SessionProjectionParams | null
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

async function findBoundSessionFile(
  cwd: string,
  params: SessionProjectionParams,
): Promise<SessionProjectionTarget> {
  const files = await listSessionFiles(cwd)
  for (const file of files) {
    const binding = await readSessionBinding(file)
    if (!binding || binding.sessionId !== params.sessionId) {
      continue
    }
    if (params.specId && binding.specId !== params.specId) {
      return {
        ok: false,
        code: -32003,
        message: "Brunch session does not belong to requested spec",
      }
    }
    return {
      ok: true,
      file,
      nonLinearMessage: "Brunch session transcript is non-linear",
    }
  }

  return { ok: false, code: -32004, message: "Brunch session not found" }
}

async function listSessionFiles(cwd: string): Promise<string[]> {
  try {
    const entries = await readdir(join(cwd, ".brunch", "sessions"), {
      withFileTypes: true,
    })
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".jsonl"))
      .map((entry) => join(cwd, ".brunch", "sessions", entry.name))
      .sort()
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return []
    }
    throw error
  }
}

async function readSessionBinding(
  file: string,
): Promise<SessionProjectionParams | null> {
  const lines = (await readFile(file, "utf8"))
    .split("\n")
    .filter((line) => line.trim().length > 0)
  for (const line of lines) {
    const entry = JSON.parse(line) as unknown
    if (isSessionBindingEntry(entry)) {
      return entry.data
    }
  }
  return null
}

type SessionBindingEntry = {
  data: {
    sessionId: string
    specId: string
  }
}

function isSessionBindingEntry(value: unknown): value is SessionBindingEntry {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: unknown }).type === "custom" &&
    (value as { customType?: unknown }).customType ===
      "brunch.session_binding" &&
    typeof (value as { data?: { sessionId?: unknown } }).data?.sessionId ===
      "string" &&
    typeof (value as { data?: { specId?: unknown } }).data?.specId === "string"
  )
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
