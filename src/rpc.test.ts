import { PassThrough } from "node:stream"
import { describe, expect, it } from "vitest"

import { createRpcHandlers, runJsonRpcLineServer } from "./rpc.js"
import type { WorkspaceSessionCoordinator } from "./workspace-session-coordinator.js"

function coordinator(): WorkspaceSessionCoordinator {
  return {
    async openExisting() {
      return {
        status: "ready",
        cwd: "/tmp/brunch-project",
        spec: { id: "spec-1", title: "Alpha spec" },
        session: {
          id: "session-1",
          file: "/tmp/brunch-project/.brunch/sessions/session-1.jsonl",
          manager: {} as never,
        },
        chrome: {
          cwd: "/tmp/brunch-project",
          spec: { id: "spec-1", title: "Alpha spec" },
          phase: "elicitation",
          chatMode: "responding-to-elicitation",
        },
      }
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
