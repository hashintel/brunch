import { describe, expect, it } from "vitest"

import {
  createJsonRpcFailure,
  createJsonRpcParseError,
  createJsonRpcSuccess,
  isJsonRpcRequest,
  parseJsonRpcMessage,
} from "./json-rpc-protocol.js"

describe("JSON-RPC protocol helpers", () => {
  it("recognizes valid request IDs and rejects invalid request shapes", () => {
    expect(
      isJsonRpcRequest({
        jsonrpc: "2.0",
        id: "abc",
        method: "workspace.snapshot",
      }),
    ).toBe(true)
    expect(
      isJsonRpcRequest({ jsonrpc: "2.0", id: 1, method: "workspace.snapshot" }),
    ).toBe(true)
    expect(
      isJsonRpcRequest({
        jsonrpc: "2.0",
        id: null,
        method: "workspace.snapshot",
      }),
    ).toBe(true)
    expect(
      isJsonRpcRequest({
        jsonrpc: "2.0",
        id: { bad: true },
        method: "workspace.snapshot",
      }),
    ).toBe(false)
    expect(isJsonRpcRequest({ jsonrpc: "2.0", id: 1 })).toBe(false)
  })

  it("creates success, failure, method-not-found, and parse-error responses", () => {
    expect(createJsonRpcSuccess(1, { ok: true })).toEqual({
      jsonrpc: "2.0",
      id: 1,
      result: { ok: true },
    })
    expect(
      createJsonRpcFailure("request-1", -32601, "Method not found"),
    ).toEqual({
      jsonrpc: "2.0",
      id: "request-1",
      error: { code: -32601, message: "Method not found" },
    })
    expect(createJsonRpcParseError()).toEqual({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: "Parse error" },
    })
  })

  it("parses protocol messages without attaching product semantics", () => {
    expect(
      parseJsonRpcMessage(
        '{"jsonrpc":"2.0","id":1,"method":"workspace.snapshot"}',
      ),
    ).toEqual({
      ok: true,
      value: { jsonrpc: "2.0", id: 1, method: "workspace.snapshot" },
    })
    expect(parseJsonRpcMessage("not json")).toEqual({
      ok: false,
      response: createJsonRpcParseError(),
    })
  })
})
