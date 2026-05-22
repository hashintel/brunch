import { mkdtemp, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { PassThrough } from "node:stream"
import { describe, expect, it } from "vitest"

import { SessionManager } from "@earendil-works/pi-coding-agent"

import { createRpcHandlers, runJsonRpcLineServer } from "./rpc.js"
import { createWorkspaceSessionCoordinator } from "./workspace-session-coordinator.js"
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

async function createBranchedSessionFile(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), "brunch-rpc-branch-"))
  const manager = SessionManager.create(cwd, join(cwd, ".brunch/sessions"))
  manager.appendMessage({ role: "assistant", content: "Abandoned prompt" })
  manager.appendMessage({ role: "user", content: "Abandoned answer" })
  manager.resetLeaf()
  manager.appendMessage({ role: "assistant", content: "Active prompt" })
  manager.appendMessage({ role: "user", content: "Active answer" })
  return manager.getSessionFile()!
}

describe("JSON-RPC handlers", () => {
  it("serves a named workspace snapshot method", async () => {
    const handlers = createRpcHandlers({
      coordinator: coordinator(),
      cwd: "/tmp/brunch-project",
    })

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
      cwd: "/tmp/brunch-project",
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

  it("returns a product-shaped error for non-linear selected sessions", async () => {
    const sessionFile = await createBranchedSessionFile()
    const handlers = createRpcHandlers({
      coordinator: coordinator(readyState(sessionFile)),
      cwd: "/tmp/brunch-project",
    })

    await expect(
      handlers.handle({
        jsonrpc: "2.0",
        id: 8,
        method: "session.elicitationExchanges",
      }),
    ).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: 8,
      error: {
        code: -32002,
        message: "Selected Brunch session transcript is non-linear",
      },
    })
  })

  it("serves session elicitation exchanges by durable session id without opening the selected workspace session", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "brunch-rpc-explicit-session-"))
    const coordinatorInstance = createWorkspaceSessionCoordinator({ cwd })
    const first = await coordinatorInstance.startOrCreate({
      specTitle: "Explicit spec",
    })
    first.session.manager.appendMessage({
      role: "assistant",
      content: "First question",
    })
    first.session.manager.appendMessage({
      role: "user",
      content: "First answer",
    })
    const second = await coordinatorInstance.createNewSessionForCurrentSpec()
    if (second.status !== "ready") {
      throw new Error("expected a ready second session")
    }
    const handlers = createRpcHandlers({
      coordinator: {
        ...coordinatorInstance,
        async openExisting() {
          throw new Error("explicit reads must not open selected session")
        },
      },
      cwd,
    })

    await expect(
      handlers.handle({
        jsonrpc: "2.0",
        id: 9,
        method: "session.elicitationExchanges",
        params: { sessionId: first.session.id },
      }),
    ).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: 9,
      result: {
        status: "ready",
        exchanges: [{ promptEntryIds: [expect.any(String)] }],
      },
    })
  })

  it("serves transcript display rows by durable session id without opening the selected workspace session", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "brunch-rpc-display-"))
    const coordinatorInstance = createWorkspaceSessionCoordinator({ cwd })
    const workspace = await coordinatorInstance.startOrCreate({
      specTitle: "Display spec",
    })
    workspace.session.manager.appendMessage({
      role: "assistant",
      content: "Display question",
    })
    workspace.session.manager.appendMessage({
      role: "user",
      content: "Display answer",
    })
    const handlers = createRpcHandlers({
      coordinator: {
        ...coordinatorInstance,
        async openExisting() {
          throw new Error("explicit reads must not open selected session")
        },
      },
      cwd,
    })

    await expect(
      handlers.handle({
        jsonrpc: "2.0",
        id: 13,
        method: "session.transcriptDisplay",
        params: { sessionId: workspace.session.id, specId: workspace.spec.id },
      }),
    ).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: 13,
      result: {
        rows: [
          { role: "assistant", text: "Display question" },
          { role: "user", text: "Display answer" },
        ],
      },
    })
  })

  it("does not parse durable session bindings inside the RPC handler module", async () => {
    const source = await readFile(new URL("./rpc.ts", import.meta.url), "utf8")

    expect(source).not.toContain("brunch.session_binding")
    expect(source).not.toContain("customType")
  })

  it("validates explicit session projection against a requested spec id", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "brunch-rpc-explicit-spec-"))
    const coordinatorInstance = createWorkspaceSessionCoordinator({ cwd })
    const workspace = await coordinatorInstance.startOrCreate({
      specTitle: "Explicit spec",
    })
    const handlers = createRpcHandlers({
      coordinator: coordinatorInstance,
      cwd,
    })

    await expect(
      handlers.handle({
        jsonrpc: "2.0",
        id: 10,
        method: "session.elicitationExchanges",
        params: { sessionId: workspace.session.id, specId: "spec-other" },
      }),
    ).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: 10,
      error: {
        code: -32003,
        message: "Brunch session does not belong to requested spec",
      },
    })
  })

  it("returns a product-shaped error for unknown explicit sessions", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "brunch-rpc-missing-session-"))
    const coordinatorInstance = createWorkspaceSessionCoordinator({ cwd })
    await coordinatorInstance.startOrCreate({ specTitle: "Explicit spec" })
    const handlers = createRpcHandlers({
      coordinator: coordinatorInstance,
      cwd,
    })

    await expect(
      handlers.handle({
        jsonrpc: "2.0",
        id: 11,
        method: "session.elicitationExchanges",
        params: { sessionId: "session-does-not-exist" },
      }),
    ).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: 11,
      error: {
        code: -32004,
        message: "Brunch session not found",
      },
    })
  })

  it("returns a product-shaped error for non-linear explicit sessions", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "brunch-rpc-explicit-branch-"))
    const coordinatorInstance = createWorkspaceSessionCoordinator({ cwd })
    const workspace = await coordinatorInstance.startOrCreate({
      specTitle: "Explicit branch spec",
    })
    const manager = SessionManager.open(workspace.session.file)
    manager.appendMessage({ role: "assistant", content: "Abandoned prompt" })
    manager.appendMessage({ role: "user", content: "Abandoned answer" })
    manager.resetLeaf()
    manager.appendMessage({ role: "assistant", content: "Active prompt" })
    const handlers = createRpcHandlers({
      coordinator: coordinatorInstance,
      cwd,
    })

    await expect(
      handlers.handle({
        jsonrpc: "2.0",
        id: 12,
        method: "session.elicitationExchanges",
        params: { sessionId: workspace.session.id },
      }),
    ).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: 12,
      error: {
        code: -32002,
        message: "Brunch session transcript is non-linear",
      },
    })
  })

  it("rejects raw file params on session elicitation exchange RPC", async () => {
    const handlers = createRpcHandlers({
      coordinator: coordinator(),
      cwd: "/tmp/brunch-project",
    })

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
      cwd: "/tmp/brunch-project",
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
    const handlers = createRpcHandlers({
      coordinator: coordinator(),
      cwd: "/tmp/brunch-project",
    })

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
    const handlers = createRpcHandlers({
      coordinator: coordinator(),
      cwd: "/tmp/brunch-project",
    })

    await expect(
      handlers.handle({ jsonrpc: "2.0", id: 2, method: "records.list" }),
    ).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: 2,
      error: { code: -32601, message: "Method not found" },
    })
  })

  it("returns parse errors over newline-delimited JSON-RPC streams", async () => {
    const input = new PassThrough()
    const output = new PassThrough()
    const chunks: string[] = []
    output.on("data", (chunk) => chunks.push(String(chunk)))

    const done = runJsonRpcLineServer({
      input,
      output,
      handlers: createRpcHandlers({
        coordinator: coordinator(),
        cwd: "/tmp/brunch-project",
      }),
    })

    input.end("not json\n")
    await done

    expect(JSON.parse(chunks.join(""))).toEqual({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: "Parse error" },
    })
  })

  it("returns internal errors for thrown newline-delimited JSON-RPC handlers", async () => {
    const input = new PassThrough()
    const output = new PassThrough()
    const chunks: string[] = []
    output.on("data", (chunk) => chunks.push(String(chunk)))

    const done = runJsonRpcLineServer({
      input,
      output,
      handlers: {
        async handle() {
          throw new Error("boom")
        },
      },
    })

    input.end(
      `${JSON.stringify({ jsonrpc: "2.0", id: 15, method: "workspace.snapshot" })}\n`,
    )
    await done

    expect(JSON.parse(chunks.join(""))).toEqual({
      jsonrpc: "2.0",
      id: 15,
      error: { code: -32603, message: "Internal error" },
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
      handlers: createRpcHandlers({
        coordinator: coordinator(),
        cwd: "/tmp/brunch-project",
      }),
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
