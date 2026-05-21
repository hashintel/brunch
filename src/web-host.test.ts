import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { SessionManager } from "@earendil-works/pi-coding-agent"

import { createWorkspaceSessionCoordinator } from "./workspace-session-coordinator.js"
import { startWebHost } from "./web-host.js"

function text(response: Response): Promise<string> {
  return response.text()
}

describe("web host", () => {
  it("serves a native Brunch HTML shell on an ephemeral port", async () => {
    const host = await startWebHost({ cwd: "/tmp/brunch-project", port: 0 })
    try {
      const response = await fetch(host.url)
      const html = await text(response)

      expect(response.status).toBe(200)
      expect(response.headers.get("content-type")).toContain("text/html")
      expect(html).toContain("Brunch")
      expect(html).not.toContain("pi-web-ui")
    } finally {
      await host.close()
    }
  })

  it("serves workspace and session JSON-RPC over WebSocket using shared handlers", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "brunch-web-rpc-"))
    const workspace = await createWorkspaceSessionCoordinator({
      cwd,
    }).startOrCreate({
      specTitle: "Web spec",
    })
    workspace.session.manager.appendMessage({
      role: "assistant",
      content: "Question",
    })
    workspace.session.manager.appendMessage({ role: "user", content: "Answer" })
    const host = await startWebHost({
      cwd,
      port: 0,
      coordinator: createWorkspaceSessionCoordinator({ cwd }),
    })
    try {
      const snapshot = await websocketRpc(host.url, {
        jsonrpc: "2.0",
        id: 1,
        method: "workspace.snapshot",
      })
      const exchanges = await websocketRpc(host.url, {
        jsonrpc: "2.0",
        id: 2,
        method: "session.elicitationExchanges",
      })

      expect(snapshot).toMatchObject({
        jsonrpc: "2.0",
        id: 1,
        result: { status: "ready", spec: { title: "Web spec" } },
      })
      expect(exchanges).toMatchObject({
        jsonrpc: "2.0",
        id: 2,
        result: {
          status: "ready",
          exchanges: [{ promptEntryIds: [expect.any(String)] }],
        },
      })
    } finally {
      await host.close()
    }
  })

  it("propagates the non-linear transcript JSON-RPC error over WebSocket", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "brunch-web-rpc-branch-"))
    const workspace = await createWorkspaceSessionCoordinator({
      cwd,
    }).startOrCreate({
      specTitle: "Branch spec",
    })
    const manager = SessionManager.open(workspace.session.file)
    manager.appendMessage({ role: "assistant", content: "Abandoned prompt" })
    manager.appendMessage({ role: "user", content: "Abandoned answer" })
    manager.resetLeaf()
    manager.appendMessage({ role: "assistant", content: "Active prompt" })
    const host = await startWebHost({
      cwd,
      port: 0,
      coordinator: createWorkspaceSessionCoordinator({ cwd }),
    })
    try {
      const response = await websocketRpc(host.url, {
        jsonrpc: "2.0",
        id: 4,
        method: "session.elicitationExchanges",
      })

      expect(response).toEqual({
        jsonrpc: "2.0",
        id: 4,
        error: {
          code: -32002,
          message: "Selected Brunch session transcript is non-linear",
        },
      })
    } finally {
      await host.close()
    }
  })

  it("does not expose product read endpoints over HTTP GET", async () => {
    const host = await startWebHost({ cwd: "/tmp/brunch-project", port: 0 })
    try {
      const response = await fetch(`${host.url}/workspace.snapshot`)

      expect(response.status).toBe(404)
    } finally {
      await host.close()
    }
  })
})

async function websocketRpc(url: string, request: unknown): Promise<unknown> {
  const wsUrl = url.replace(/^http/u, "ws") + "/rpc"
  const socket = new WebSocket(wsUrl)
  await new Promise<void>((resolve, reject) => {
    socket.addEventListener("open", () => resolve(), { once: true })
    socket.addEventListener(
      "error",
      () => reject(new Error("WebSocket failed to open")),
      { once: true },
    )
  })

  const response = new Promise<unknown>((resolve, reject) => {
    socket.addEventListener(
      "message",
      (event) => {
        resolve(JSON.parse(String(event.data)) as unknown)
      },
      { once: true },
    )
    socket.addEventListener(
      "error",
      () => reject(new Error("WebSocket error")),
      { once: true },
    )
  })
  socket.send(JSON.stringify(request))
  const parsed = await response
  socket.close()
  return parsed
}
