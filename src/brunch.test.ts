import { PassThrough } from "node:stream"

import { describe, expect, it } from "vitest"

import { runBrunchCli } from "./brunch.js"
import type { WorkspaceSessionCoordinator } from "./workspace-session-coordinator.js"

function coordinator(): WorkspaceSessionCoordinator {
  return {
    async openExisting() {
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
    },
    async startOrCreate() {
      throw new Error("print must not create a session")
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

describe("Brunch CLI dispatch", () => {
  it("routes --mode print through the coordinator snapshot and exits", async () => {
    let output = ""

    const code = await runBrunchCli({
      argv: ["--mode", "print"],
      cwd: "/tmp/brunch-project",
      coordinator: coordinator(),
      stdout: (chunk) => {
        output += chunk
      },
    })

    expect(code).toBe(0)
    expect(output).toContain("status: select_spec")
    expect(output).toContain("spec: <none>")
  })

  it("routes --mode rpc through the named JSON-RPC stdio adapter", async () => {
    const stdin = new PassThrough()
    const stdout = new PassThrough()
    const chunks: string[] = []
    stdout.on("data", (chunk) => chunks.push(String(chunk)))

    stdin.end(
      `${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "workspace.snapshot" })}\n`,
    )

    const code = await runBrunchCli({
      argv: ["--mode=rpc"],
      cwd: "/tmp/brunch-project",
      coordinator: coordinator(),
      stdin,
      stdout,
    })

    expect(code).toBe(0)
    expect(JSON.parse(chunks.join(""))).toMatchObject({
      jsonrpc: "2.0",
      id: 1,
      result: { status: "select_spec" },
    })
  })
})
