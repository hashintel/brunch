export type JsonRpcId = string | number | null

export interface JsonRpcRequest {
  jsonrpc: "2.0"
  id?: JsonRpcId
  method: string
  params?: unknown
}

export interface JsonRpcSuccess<T = unknown> {
  jsonrpc: "2.0"
  id: JsonRpcId
  result: T
}

export interface JsonRpcFailure {
  jsonrpc: "2.0"
  id: JsonRpcId
  error: {
    code: number
    message: string
  }
}

export type JsonRpcResponse<T = unknown> = JsonRpcSuccess<T> | JsonRpcFailure

export type JsonRpcParseResult = {
  ok: true
  value: unknown
} | {
  ok: false
  response: JsonRpcFailure
}

export function createJsonRpcSuccess<T>(
  id: JsonRpcId,
  result: T,
): JsonRpcSuccess<T> {
  return { jsonrpc: "2.0", id, result }
}

export function createJsonRpcFailure(
  id: JsonRpcId,
  code: number,
  message: string,
): JsonRpcFailure {
  return { jsonrpc: "2.0", id, error: { code, message } }
}

export function createJsonRpcParseError(): JsonRpcFailure {
  return createJsonRpcFailure(null, -32700, "Parse error")
}

export function parseJsonRpcMessage(message: string): JsonRpcParseResult {
  try {
    return { ok: true, value: JSON.parse(message) as unknown }
  } catch {
    return { ok: false, response: createJsonRpcParseError() }
  }
}

export function jsonRpcRequestId(request: JsonRpcRequest): JsonRpcId {
  return request.id ?? null
}

export function isJsonRpcRequest(value: unknown): value is JsonRpcRequest {
  if (
    typeof value !== "object" ||
    value === null ||
    (value as { jsonrpc?: unknown }).jsonrpc !== "2.0" ||
    typeof (value as { method?: unknown }).method !== "string"
  ) {
    return false
  }

  const id = (value as { id?: unknown }).id
  return (
    id === undefined ||
    id === null ||
    typeof id === "string" ||
    typeof id === "number"
  )
}
