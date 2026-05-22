import { mkdir, mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { PassThrough } from "node:stream"
import { describe, expect, it } from "vitest"

import { SessionManager } from "@earendil-works/pi-coding-agent"

import { createRpcHandlers, runJsonRpcLineServer } from "./rpc.js"
import { createSessionBindingData } from "./session-binding.js"
import { createWorkspaceSessionCoordinator } from "./workspace-session-coordinator.js"
import type {
  DefaultWorkspaceCoordinator,
  WorkspaceSessionState,
} from "./workspace-session-coordinator.js"

function coordinator(
  state: WorkspaceSessionState = readyState(
    "/tmp/brunch-project/.brunch/sessions/session-1.jsonl",
  ),
): DefaultWorkspaceCoordinator {
  return {
    async openDefaultWorkspace() {
      return state
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
  appendBinding(manager)
  manager.appendMessage({ role: "assistant", content: "Question" })
  manager.appendMessage({ role: "user", content: "Answer" })
  return manager.getSessionFile()!
}

async function createBranchedSessionFile(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), "brunch-rpc-branch-"))
  const manager = SessionManager.create(cwd, join(cwd, ".brunch/sessions"))
  appendBinding(manager)
  manager.appendMessage({ role: "assistant", content: "Abandoned prompt" })
  manager.appendMessage({ role: "user", content: "Abandoned answer" })
  manager.resetLeaf()
  manager.appendMessage({ role: "assistant", content: "Active prompt" })
  manager.appendMessage({ role: "user", content: "Active answer" })
  return manager.getSessionFile()!
}

async function writeExplicitSessionFixture(
  cwd: string,
  entries: readonly unknown[],
): Promise<void> {
  const sessionRoot = join(cwd, ".brunch", "sessions")
  await mkdir(sessionRoot, { recursive: true })
  await writeFile(
    join(sessionRoot, "session.jsonl"),
    entries.map((entry) => JSON.stringify(entry)).join("\n") + "\n",
  )
}

function appendBinding(manager: SessionManager): void {
  manager.appendCustomEntry(
    "brunch.session_binding",
    createSessionBindingData({
      sessionId: manager.getSessionId(),
      specId: "spec-1",
      specTitle: "Spec",
    }),
  )
}

function sessionBindingEntry(sessionId = "session-1", specId = "spec-1") {
  return {
    id: `binding-${sessionId}-${specId}`,
    type: "custom",
    parentId: null,
    customType: "brunch.session_binding",
    data: createSessionBindingData({
      sessionId,
      specId,
      specTitle: "Spec",
    }),
  }
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
    const first = await coordinatorInstance.createSetupSession({
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
    const second = await coordinatorInstance.createSetupSessionForCurrentSpec()
    if (second.status !== "ready") {
      throw new Error("expected a ready second session")
    }
    const handlers = createRpcHandlers({
      coordinator: {
        ...coordinatorInstance,
        async openDefaultWorkspace() {
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
    const workspace = await coordinatorInstance.createSetupSession({
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
        async openDefaultWorkspace() {
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

  it("validates explicit session projection against a requested spec id", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "brunch-rpc-explicit-spec-"))
    const coordinatorInstance = createWorkspaceSessionCoordinator({ cwd })
    const workspace = await coordinatorInstance.createSetupSession({
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

  it("returns a product-shaped error for explicit sessions with duplicate durable bindings", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "brunch-rpc-duplicate-binding-"))
    await writeExplicitSessionFixture(cwd, [
      { type: "session", id: "session-1", cwd },
      sessionBindingEntry(),
      sessionBindingEntry(),
    ])
    const handlers = createRpcHandlers({
      coordinator: coordinator(),
      cwd,
    })

    await expect(
      handlers.handle({
        jsonrpc: "2.0",
        id: 16,
        method: "session.elicitationExchanges",
        params: { sessionId: "session-1" },
      }),
    ).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: 16,
      error: {
        code: -32005,
        message: "Brunch session self-description is invalid",
      },
    })
  })

  it("returns a product-shaped error for explicit sessions without exactly one Pi header", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "brunch-rpc-invalid-header-"))
    await writeExplicitSessionFixture(cwd, [
      { type: "session", id: "session-1", cwd },
      { type: "session", id: "session-1", cwd },
      sessionBindingEntry(),
    ])
    const handlers = createRpcHandlers({
      coordinator: coordinator(),
      cwd,
    })

    await expect(
      handlers.handle({
        jsonrpc: "2.0",
        id: 17,
        method: "session.transcriptDisplay",
        params: { sessionId: "session-1" },
      }),
    ).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: 17,
      error: {
        code: -32005,
        message: "Brunch session self-description is invalid",
      },
    })

    const headerlessCwd = await mkdtemp(
      join(tmpdir(), "brunch-rpc-missing-header-"),
    )
    await writeExplicitSessionFixture(headerlessCwd, [sessionBindingEntry()])
    const headerlessHandlers = createRpcHandlers({
      coordinator: coordinator(),
      cwd: headerlessCwd,
    })

    await expect(
      headerlessHandlers.handle({
        jsonrpc: "2.0",
        id: 19,
        method: "session.transcriptDisplay",
        params: { sessionId: "session-1" },
      }),
    ).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: 19,
      error: {
        code: -32005,
        message: "Brunch session self-description is invalid",
      },
    })
  })

  it("returns a product-shaped error when explicit binding and Pi header session ids disagree", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "brunch-rpc-header-mismatch-"))
    await writeExplicitSessionFixture(cwd, [
      { type: "session", id: "session-header", cwd },
      sessionBindingEntry("session-binding"),
    ])
    const handlers = createRpcHandlers({
      coordinator: coordinator(),
      cwd,
    })

    await expect(
      handlers.handle({
        jsonrpc: "2.0",
        id: 18,
        method: "session.elicitationExchanges",
        params: { sessionId: "session-binding" },
      }),
    ).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: 18,
      error: {
        code: -32005,
        message: "Brunch session self-description is invalid",
      },
    })
  })

  it("returns a product-shaped error for unknown explicit sessions", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "brunch-rpc-missing-session-"))
    const coordinatorInstance = createWorkspaceSessionCoordinator({ cwd })
    await coordinatorInstance.createSetupSession({ specTitle: "Explicit spec" })
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
    const workspace = await coordinatorInstance.createSetupSession({
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
