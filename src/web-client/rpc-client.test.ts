import { describe, expect, it } from "vitest"

import { JsonRpcClientError, createWebSocketRpcClient } from "./rpc-client.js"

type Listener = (event: { data?: string }) => void

class FakeWebSocket {
  static instances: FakeWebSocket[] = []

  readonly sent: string[] = []
  readonly listeners = new Map<string, Listener[]>()
  closed = false

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this)
  }

  send(message: string) {
    this.sent.push(message)
  }

  close() {
    this.closed = true
  }

  addEventListener(event: string, listener: Listener) {
    const listeners = this.listeners.get(event) ?? []
    listeners.push(listener)
    this.listeners.set(event, listeners)
  }

  emit(event: string, data?: string) {
    for (const listener of this.listeners.get(event) ?? []) {
      listener({ data })
    }
  }
}

function rpcClient() {
  FakeWebSocket.instances = []
  return createWebSocketRpcClient({
    url: "ws://brunch.test/rpc",
    WebSocketImpl: FakeWebSocket,
  })
}

describe("browser WebSocket RPC client", () => {
  it("opens one persistent socket and queues requests until open", async () => {
    const client = rpcClient()
    const first = client.request("workspace.snapshot")
    const second = client.request("session.elicitationExchanges")

    expect(FakeWebSocket.instances).toHaveLength(1)
    const socket = FakeWebSocket.instances[0]!
    expect(socket.sent).toHaveLength(0)

    socket.emit("open")

    expect(socket.sent).toHaveLength(2)
    socket.emit(
      "message",
      JSON.stringify({ jsonrpc: "2.0", id: 1, result: "first" }),
    )
    socket.emit(
      "message",
      JSON.stringify({ jsonrpc: "2.0", id: 2, result: "second" }),
    )
    await expect(first).resolves.toBe("first")
    await expect(second).resolves.toBe("second")
  })

  it("resolves concurrent requests by response id, not response order", async () => {
    const client = rpcClient()
    const first = client.request("workspace.snapshot")
    const second = client.request("workspace.snapshot")
    const socket = FakeWebSocket.instances[0]!

    socket.emit("open")
    socket.emit(
      "message",
      JSON.stringify({ jsonrpc: "2.0", id: 2, result: "second" }),
    )
    socket.emit(
      "message",
      JSON.stringify({ jsonrpc: "2.0", id: 1, result: "first" }),
    )

    await expect(first).resolves.toBe("first")
    await expect(second).resolves.toBe("second")
  })

  it("rejects JSON-RPC failures with code and message", async () => {
    const client = rpcClient()
    const request = client.request("workspace.snapshot")
    const socket = FakeWebSocket.instances[0]!

    socket.emit("open")
    socket.emit(
      "message",
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        error: { code: -32603, message: "Internal error" },
      }),
    )

    await expect(request).rejects.toMatchObject({
      name: "JsonRpcClientError",
      code: -32603,
      message: "Internal error",
    } satisfies Partial<JsonRpcClientError>)
  })

  it("rejects all pending requests and later calls on malformed response frames", async () => {
    const client = rpcClient()
    const first = client.request("workspace.snapshot")
    const second = client.request("session.elicitationExchanges")
    const socket = FakeWebSocket.instances[0]!

    socket.emit("open")
    socket.emit("message", "not json")

    await expect(first).rejects.toThrow("Brunch WebSocket RPC protocol failure")
    await expect(second).rejects.toThrow(
      "Brunch WebSocket RPC protocol failure",
    )
    await expect(client.request("workspace.snapshot")).rejects.toThrow(
      "Brunch WebSocket RPC protocol failure",
    )
  })

  it("rejects all pending requests and later calls on invalid response frames", async () => {
    const client = rpcClient()
    const first = client.request("workspace.snapshot")
    const second = client.request("session.elicitationExchanges")
    const socket = FakeWebSocket.instances[0]!

    socket.emit("open")
    socket.emit(
      "message",
      JSON.stringify({ jsonrpc: "2.0", result: "missing id" }),
    )

    await expect(first).rejects.toThrow("Brunch WebSocket RPC protocol failure")
    await expect(second).rejects.toThrow(
      "Brunch WebSocket RPC protocol failure",
    )
    await expect(client.request("workspace.snapshot")).rejects.toThrow(
      "Brunch WebSocket RPC protocol failure",
    )
  })

  it("rejects all pending requests and later calls on unknown response IDs", async () => {
    const client = rpcClient()
    const first = client.request("workspace.snapshot")
    const second = client.request("session.elicitationExchanges")
    const socket = FakeWebSocket.instances[0]!

    socket.emit("open")
    socket.emit(
      "message",
      JSON.stringify({ jsonrpc: "2.0", id: 999, result: "unknown" }),
    )

    await expect(first).rejects.toThrow("Brunch WebSocket RPC protocol failure")
    await expect(second).rejects.toThrow(
      "Brunch WebSocket RPC protocol failure",
    )
    await expect(client.request("workspace.snapshot")).rejects.toThrow(
      "Brunch WebSocket RPC protocol failure",
    )
  })

  it("rejects all pending requests on socket close", async () => {
    const client = rpcClient()
    const first = client.request("workspace.snapshot")
    const second = client.request("session.elicitationExchanges")
    const socket = FakeWebSocket.instances[0]!

    socket.emit("open")
    socket.emit("close")

    await expect(first).rejects.toThrow(
      "Brunch WebSocket RPC connection closed",
    )
    await expect(second).rejects.toThrow(
      "Brunch WebSocket RPC connection closed",
    )
  })

  it("treats socket errors as terminal connection failures", async () => {
    const client = rpcClient()
    const first = client.request("workspace.snapshot")
    const second = client.request("session.elicitationExchanges")
    const socket = FakeWebSocket.instances[0]!

    socket.emit("open")
    socket.emit("error")
    socket.emit("close")

    await expect(first).rejects.toThrow(
      "Brunch WebSocket RPC connection failed",
    )
    await expect(second).rejects.toThrow(
      "Brunch WebSocket RPC connection failed",
    )
    await expect(client.request("workspace.snapshot")).rejects.toThrow(
      "Brunch WebSocket RPC connection failed",
    )
  })

  it("exposes close and rejects later requests", async () => {
    const client = rpcClient()
    const pending = client.request("workspace.snapshot")
    const socket = FakeWebSocket.instances[0]!
    socket.emit("open")

    client.close()

    expect(socket.closed).toBe(true)
    await expect(pending).rejects.toThrow("Brunch WebSocket RPC client closed")
    await expect(client.request("workspace.snapshot")).rejects.toThrow(
      "Brunch WebSocket RPC client closed",
    )
  })
})
