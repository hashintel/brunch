import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { PassThrough } from "node:stream"

import { describe, expect, it } from "vitest"

import { SessionManager } from "@earendil-works/pi-coding-agent"

import { runBrunchCli } from "./brunch.js"
import type { WorkspaceSessionCoordinator } from "./workspace-session-coordinator.js"

function coordinator(sessionFile?: string): WorkspaceSessionCoordinator {
  return {
    async openExisting() {
      return {
        ...(sessionFile
          ? {
              status: "ready" as const,
              spec: { id: "spec-1", title: "Alpha spec" },
              session: {
                id: "session-1",
                file: sessionFile,
                manager: {} as never,
              },
              chrome: {
                cwd: "/tmp/brunch-project",
                spec: { id: "spec-1", title: "Alpha spec" },
                phase: "elicitation" as const,
                chatMode: "responding-to-elicitation" as const,
              },
            }
          : {
              status: "select_spec" as const,
              chrome: {
                cwd: "/tmp/brunch-project",
                spec: null,
                phase: "select_spec" as const,
                chatMode: "select-spec" as const,
              },
            }),
        cwd: "/tmp/brunch-project",
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

  it("routes --mode rpc session projection through the coordinator-selected session", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "brunch-cli-rpc-"))
    const manager = SessionManager.create(cwd, join(cwd, ".brunch/sessions"))
    manager.appendMessage({ role: "assistant", content: "Question" })
    manager.appendMessage({ role: "user", content: "Answer" })
    const stdin = new PassThrough()
    const stdout = new PassThrough()
    const chunks: string[] = []
    stdout.on("data", (chunk) => chunks.push(String(chunk)))

    stdin.end(
      `${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "session.elicitationExchanges" })}\n`,
    )

    const code = await runBrunchCli({
      argv: ["--mode=rpc"],
      cwd: "/tmp/brunch-project",
      coordinator: coordinator(manager.getSessionFile()!),
      stdin,
      stdout,
    })

    expect(code).toBe(0)
    expect(JSON.parse(chunks.join(""))).toMatchObject({
      jsonrpc: "2.0",
      id: 2,
      result: {
        status: "ready",
        exchanges: [{ promptEntryIds: [expect.any(String)] }],
      },
    })
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
