import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { PassThrough } from "node:stream"
import { describe, expect, it } from "vitest"

import { SessionManager } from "@earendil-works/pi-coding-agent"

import { createRpcHandlers, runJsonRpcLineServer } from "./rpc.js"
import type {
  WorkspaceSessionCoordinator,
  WorkspaceSessionState,
} from "./workspace-session-coordinator.js"

function coordinator(
  state: WorkspaceSessionState = readyState(
    "/tmp/brunch-project/.brunch/sessions/session-1.jsonl",
  ),
): WorkspaceSessionCoordinator {
  return {
    async openExisting() {
      return state
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

function readyState(sessionFile: string): WorkspaceSessionState {
  return {
    status: "ready",
    cwd: "/tmp/brunch-project",
    spec: { id: "spec-1", title: "Alpha spec" },
    session: {
      id: "session-1",
      file: sessionFile,
      manager: {} as never,
    },
    chrome: {
      cwd: "/tmp/brunch-project",
      spec: { id: "spec-1", title: "Alpha spec" },
      phase: "elicitation",
      chatMode: "responding-to-elicitation",
    },
  }
}

function selectSpecState(): WorkspaceSessionState {
  return {
    status: "select_spec",
    cwd: "/tmp/brunch-project",
    chrome: {
      cwd: "/tmp/brunch-project",
      spec: null,
      phase: "select_spec",
      chatMode: "select-spec",
    },
  }
}

async function createSessionFile(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), "brunch-rpc-session-"))
  const manager = SessionManager.create(cwd, join(cwd, ".brunch/sessions"))
  manager.appendMessage({ role: "assistant", content: "Question" })
  manager.appendMessage({ role: "user", content: "Answer" })
  return manager.getSessionFile()!
}

describe("JSON-RPC handlers", () => {
  it("serves a named workspace snapshot method", async () => {
    const handlers = createRpcHandlers({ coordinator: coordinator() })

    const result = await handlers.handle({
      jsonrpc: "2.0",
      id: 1,
      method: "workspace.snapshot",
    })

    expect(result).toMatchObject({
      jsonrpc: "2.0",
      id: 1,
      result: {
        status: "ready",
        spec: { id: "spec-1", title: "Alpha spec" },
        session: { id: "session-1" },
      },
    })
  })

  it("serves session elicitation exchanges from the coordinator-selected session", async () => {
    const sessionFile = await createSessionFile()
    const handlers = createRpcHandlers({
      coordinator: coordinator(readyState(sessionFile)),
    })

    await expect(
      handlers.handle({
        jsonrpc: "2.0",
        id: 3,
        method: "session.elicitationExchanges",
      }),
    ).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: 3,
      result: {
        status: "ready",
        exchanges: [{ promptEntryIds: [expect.any(String)] }],
      },
    })
  })

  it("rejects raw file params on session elicitation exchange RPC", async () => {
    const handlers = createRpcHandlers({ coordinator: coordinator() })

    await expect(
      handlers.handle({
        jsonrpc: "2.0",
        id: 4,
        method: "session.elicitationExchanges",
        params: { file: "/tmp/not-a-product-param.jsonl" },
      }),
    ).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: 4,
      error: { code: -32602, message: "Invalid params" },
    })
  })

  it("returns a product-shaped no-session error without creating a session", async () => {
    const handlers = createRpcHandlers({
      coordinator: coordinator(selectSpecState()),
    })

    await expect(
      handlers.handle({
        jsonrpc: "2.0",
        id: 5,
        method: "session.elicitationExchanges",
      }),
    ).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: 5,
      error: { code: -32001, message: "No selected Brunch session" },
    })
  })

  it("rejects invalid request id shapes", async () => {
    const handlers = createRpcHandlers({ coordinator: coordinator() })

    await expect(
      handlers.handle({
        jsonrpc: "2.0",
        id: { bad: true },
        method: "workspace.snapshot",
      }),
    ).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32600, message: "Invalid Request" },
    })
  })

  it("returns structured errors for unknown methods", async () => {
    const handlers = createRpcHandlers({ coordinator: coordinator() })

    await expect(
      handlers.handle({ jsonrpc: "2.0", id: 2, method: "records.list" }),
    ).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: 2,
      error: { code: -32601, message: "Method not found" },
    })
  })

  it("speaks newline-delimited JSON-RPC over streams", async () => {
    const input = new PassThrough()
    const output = new PassThrough()
    const chunks: string[] = []
    output.on("data", (chunk) => chunks.push(String(chunk)))

    const done = runJsonRpcLineServer({
      input,
      output,
      handlers: createRpcHandlers({ coordinator: coordinator() }),
    })

    input.end(
      `${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "workspace.snapshot" })}\n`,
    )
    await done

    expect(JSON.parse(chunks.join(""))).toMatchObject({
      jsonrpc: "2.0",
      id: 1,
      result: { status: "ready" },
    })
  })
})
