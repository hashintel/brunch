import { request } from "node:http"
import { mkdir, mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { SessionManager } from "@earendil-works/pi-coding-agent"

import {
  createWorkspaceSessionCoordinator,
  type WorkspaceSessionCoordinator,
} from "./workspace-session-coordinator.js"
import { startWebHost } from "./web-host.js"

function text(response: Response): Promise<string> {
  return response.text()
}

async function rawGet(url: string, path: string): Promise<Response> {
  const base = new URL(url)
  return new Promise((resolve, reject) => {
    const req = request(
      {
        hostname: base.hostname,
        port: base.port,
        method: "GET",
        path,
      },
      (res) => {
        const chunks: Uint8Array[] = []
        res.on("data", (chunk: Uint8Array) => chunks.push(chunk))
        res.on("end", () => {
          resolve(
            new Response(Buffer.concat(chunks), {
              status: res.statusCode,
              headers: res.headers as Record<string, string>,
            }),
          )
        })
      },
    )
    req.on("error", reject)
    req.end()
  })
}

async function builtWebAssets(): Promise<string> {
  const assetRoot = await mkdtemp(join(tmpdir(), "brunch-web-assets-"))
  await mkdir(join(assetRoot, "assets"))
  await writeFile(
    join(assetRoot, "index.html"),
    '<!doctype html><title>Brunch</title><main id="root" data-built-shell="true"></main><script type="module" src="/assets/brunch-web.js"></script>',
  )
  await writeFile(
    join(assetRoot, "assets", "brunch-web.js"),
    "console.log('built web')",
  )
  return assetRoot
}

describe("web host", () => {
  it("serves built Vite index.html as the native Brunch HTML shell", async () => {
    const assetRoot = await builtWebAssets()
    const host = await startWebHost({
      cwd: "/tmp/brunch-project",
      port: 0,
      webAssetRoot: assetRoot,
    })
    try {
      const response = await fetch(host.url)
      const html = await text(response)

      expect(response.status).toBe(200)
      expect(response.headers.get("content-type")).toContain("text/html")
      expect(html).toContain('data-built-shell="true"')
      expect(html).toContain("/assets/brunch-web.js")
      expect(html).not.toContain("pi-web-ui")
    } finally {
      await host.close()
    }
  })

  it("serves built Vite JavaScript assets", async () => {
    const assetRoot = await builtWebAssets()
    const host = await startWebHost({
      cwd: "/tmp/brunch-project",
      port: 0,
      webAssetRoot: assetRoot,
    })
    try {
      const response = await fetch(`${host.url}/assets/brunch-web.js`)
      const body = await text(response)

      expect(response.status).toBe(200)
      expect(response.headers.get("content-type")).toContain("text/javascript")
      expect(body).toContain("console.log('built web')")
    } finally {
      await host.close()
    }
  })

  it("rejects asset traversal without reading outside the web asset root", async () => {
    const assetRoot = await builtWebAssets()
    await writeFile(join(assetRoot, "secret.txt"), "outside asset root")
    const host = await startWebHost({
      cwd: "/tmp/brunch-project",
      port: 0,
      webAssetRoot: assetRoot,
    })
    try {
      const traversal = await rawGet(host.url, "/assets/../secret.txt")
      const encodedTraversal = await rawGet(
        host.url,
        "/assets/%2e%2e/secret.txt",
      )
      const absoluteLike = await rawGet(host.url, "/assets/%2Ftmp/secret.txt")

      expect(traversal.status).toBe(404)
      expect(await text(traversal)).not.toContain("outside asset root")
      expect(encodedTraversal.status).toBe(404)
      expect(await text(encodedTraversal)).not.toContain("outside asset root")
      expect(absoluteLike.status).toBe(404)
    } finally {
      await host.close()
    }
  })

  it("returns an explicit build-web error when the web bundle is missing", async () => {
    const assetRoot = await mkdtemp(
      join(tmpdir(), "brunch-web-assets-missing-"),
    )
    const host = await startWebHost({
      cwd: "/tmp/brunch-project",
      port: 0,
      webAssetRoot: assetRoot,
    })
    try {
      const response = await fetch(host.url)
      const body = await text(response)

      expect(response.status).toBe(500)
      expect(body).toContain("npm run build:web")
    } finally {
      await host.close()
    }
  })

  it("serves a native Brunch HTML shell on an ephemeral port", async () => {
    const assetRoot = await builtWebAssets()
    const host = await startWebHost({
      cwd: "/tmp/brunch-project",
      port: 0,
      webAssetRoot: assetRoot,
    })
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

  it("serves explicit session projection over WebSocket", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "brunch-web-rpc-explicit-"))
    const coordinator = createWorkspaceSessionCoordinator({ cwd })
    const first = await coordinator.startOrCreate({
      specTitle: "Explicit web spec",
    })
    first.session.manager.appendMessage({
      role: "assistant",
      content: "First question",
    })
    first.session.manager.appendMessage({
      role: "user",
      content: "First answer",
    })
    await coordinator.createNewSessionForCurrentSpec()
    const host = await startWebHost({
      cwd,
      port: 0,
      coordinator: createWorkspaceSessionCoordinator({ cwd }),
    })
    try {
      const response = await websocketRpc(host.url, {
        jsonrpc: "2.0",
        id: 14,
        method: "session.elicitationExchanges",
        params: { sessionId: first.session.id, specId: first.spec.id },
      })
      const display = await websocketRpc(host.url, {
        jsonrpc: "2.0",
        id: 15,
        method: "session.transcriptDisplay",
        params: { sessionId: first.session.id, specId: first.spec.id },
      })

      expect(response).toMatchObject({
        jsonrpc: "2.0",
        id: 14,
        result: {
          status: "ready",
          exchanges: [{ promptEntryIds: [expect.any(String)] }],
        },
      })
      expect(display).toMatchObject({
        jsonrpc: "2.0",
        id: 15,
        result: {
          rows: [
            { role: "assistant", text: "First question" },
            { role: "user", text: "First answer" },
          ],
        },
      })
    } finally {
      await host.close()
    }
  })

  it("multiplexes two JSON-RPC requests over one WebSocket", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "brunch-web-rpc-multiplex-"))
    await createWorkspaceSessionCoordinator({ cwd }).startOrCreate({
      specTitle: "Multiplex spec",
    })
    const host = await startWebHost({
      cwd,
      port: 0,
      coordinator: createWorkspaceSessionCoordinator({ cwd }),
    })
    try {
      const responses = await websocketRpcBatch(host.url, [
        { jsonrpc: "2.0", id: 10, method: "workspace.snapshot" },
        { jsonrpc: "2.0", id: 11, method: "workspace.snapshot" },
      ])

      expect(responses).toHaveLength(2)
      expect(responses).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ jsonrpc: "2.0", id: 10 }),
          expect.objectContaining({ jsonrpc: "2.0", id: 11 }),
        ]),
      )
    } finally {
      await host.close()
    }
  })

  it("returns a parse error for malformed WebSocket JSON without killing the host", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "brunch-web-rpc-malformed-"))
    await createWorkspaceSessionCoordinator({ cwd }).startOrCreate({
      specTitle: "Malformed spec",
    })
    const host = await startWebHost({
      cwd,
      port: 0,
      coordinator: createWorkspaceSessionCoordinator({ cwd }),
    })
    try {
      const response = await websocketRaw(host.url, "not json")

      expect(response).toEqual({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error" },
      })
      await expect(
        websocketRpc(host.url, {
          jsonrpc: "2.0",
          id: 12,
          method: "workspace.snapshot",
        }),
      ).resolves.toMatchObject({ jsonrpc: "2.0", id: 12 })
    } finally {
      await host.close()
    }
  })

  it("returns an internal error for WebSocket handler failures", async () => {
    const host = await startWebHost({
      cwd: "/tmp/brunch-project",
      port: 0,
      coordinator: throwingCoordinator(),
    })
    try {
      const response = await websocketRpc(host.url, {
        jsonrpc: "2.0",
        id: 13,
        method: "workspace.snapshot",
      })

      expect(response).toEqual({
        jsonrpc: "2.0",
        id: 13,
        error: { code: -32603, message: "Internal error" },
      })
    } finally {
      await host.close()
    }
  })

  it("rejects non-rpc WebSocket upgrade paths", async () => {
    const host = await startWebHost({
      cwd: "/tmp/brunch-project",
      port: 0,
      coordinator: throwingCoordinator(),
    })
    try {
      await expect(
        openWebSocket(`${host.url.replace(/^http/u, "ws")}/not-rpc`),
      ).rejects.toThrow("WebSocket failed to open")
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
  const [response] = await websocketRpcBatch(url, [request])
  return response
}

async function websocketRpcBatch(
  url: string,
  requests: readonly unknown[],
): Promise<unknown[]> {
  const socket = await openWebSocket(`${url.replace(/^http/u, "ws")}/rpc`)
  const responses: unknown[] = []
  try {
    const done = new Promise<unknown[]>((resolve, reject) => {
      socket.addEventListener("message", (event) => {
        responses.push(JSON.parse(String(event.data)) as unknown)
        if (responses.length === requests.length) {
          resolve(responses)
        }
      })
      socket.addEventListener(
        "error",
        () => reject(new Error("WebSocket error")),
        { once: true },
      )
    })
    for (const request of requests) {
      socket.send(JSON.stringify(request))
    }
    return await done
  } finally {
    socket.close()
  }
}

async function websocketRaw(url: string, message: string): Promise<unknown> {
  const socket = await openWebSocket(`${url.replace(/^http/u, "ws")}/rpc`)
  try {
    const response = new Promise<unknown>((resolve, reject) => {
      socket.addEventListener(
        "message",
        (event) => resolve(JSON.parse(String(event.data)) as unknown),
        { once: true },
      )
      socket.addEventListener(
        "error",
        () => reject(new Error("WebSocket error")),
        { once: true },
      )
    })
    socket.send(message)
    return await response
  } finally {
    socket.close()
  }
}

function openWebSocket(url: string): Promise<WebSocket> {
  const socket = new WebSocket(url)
  return new Promise<WebSocket>((resolve, reject) => {
    socket.addEventListener("open", () => resolve(socket), { once: true })
    socket.addEventListener(
      "error",
      () => reject(new Error("WebSocket failed to open")),
      { once: true },
    )
  })
}

function throwingCoordinator(): WorkspaceSessionCoordinator {
  return {
    async openExisting() {
      throw new Error("boom")
    },
    async startOrCreate() {
      throw new Error("not used")
    },
    async createNewSessionForCurrentSpec() {
      throw new Error("not used")
    },
    async bindCurrentSpecToSession() {
      throw new Error("not used")
    },
    async deriveChromeState() {
      throw new Error("not used")
    },
  }
}
