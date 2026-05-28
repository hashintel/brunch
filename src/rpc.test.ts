import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { PassThrough } from "node:stream"
import { describe, expect, it } from "vitest"

import { SessionManager } from "@earendil-works/pi-coding-agent"

import { Value } from "typebox/value"

import { createRpcHandlers, runJsonRpcLineServer } from "./rpc.js"
import { createSessionBindingData } from "./session-binding.js"
import { createWorkspaceSessionCoordinator } from "./workspace-session-coordinator.js"
import { assistantMessage, userMessage } from "./test-helpers.js"
import type {
  DefaultWorkspaceCoordinator,
  WorkspaceActivationState,
  WorkspaceLaunchInventory,
  WorkspaceSessionReadyState,
  WorkspaceSessionState,
  SpecSessionActivationCoordinator,
  SpecSessionActivationDecision,
} from "./workspace-session-coordinator.js"

function coordinator(
  state: WorkspaceSessionState = readyState(
    "/tmp/brunch-project/.brunch/sessions/session-1.jsonl",
  ),
): DefaultWorkspaceCoordinator & SpecSessionActivationCoordinator {
  const inventory = launchInventory()
  return {
    async openDefaultWorkspace() {
      return state
    },
    async inspectWorkspace() {
      return inventory
    },
    async activateWorkspace(
      decision: SpecSessionActivationDecision,
    ): Promise<WorkspaceActivationState> {
      if (decision.action === "cancel") return cancelledState()
      return readyState("/tmp/brunch-project/.brunch/sessions/session-1.jsonl")
    },
  }
}

function launchInventory(): WorkspaceLaunchInventory {
  return {
    cwd: "/tmp/brunch-project",
    currentSpec: { id: "spec-1", title: "Alpha spec" },
    currentSessionFile: "/tmp/brunch-project/.brunch/sessions/session-1.jsonl",
    needsNewSpec: false,
    specs: [
      {
        spec: { id: "spec-1", title: "Alpha spec" },
        sessions: [
          {
            id: "session-1",
            file: "/tmp/brunch-project/.brunch/sessions/session-1.jsonl",
            specId: "spec-1",
            specTitle: "Alpha spec",
            available: true,
          },
        ],
      },
    ],
    unavailableSessions: [
      {
        file: "/tmp/missing.jsonl",
        reason: "missing_header",
        available: false,
      },
    ],
  }
}

function cancelledState(): WorkspaceActivationState {
  return {
    status: "cancelled",
    cwd: "/tmp/brunch-project",
    chrome: {
      cwd: "/tmp/brunch-project",
      spec: { id: "spec-1", title: "Alpha spec" },
      phase: "elicitation",
      chatMode: "responding-to-elicitation",
    },
  }
}

function readyState(sessionFile: string): WorkspaceSessionReadyState {
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
  manager.appendMessage(assistantMessage("Question"))
  manager.appendMessage(userMessage("Answer"))
  return manager.getSessionFile()!
}

async function createBranchedSessionFile(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), "brunch-rpc-branch-"))
  const manager = SessionManager.create(cwd, join(cwd, ".brunch/sessions"))
  appendBinding(manager)
  manager.appendMessage(assistantMessage("Abandoned prompt"))
  manager.appendMessage(userMessage("Abandoned answer"))
  manager.resetLeaf()
  manager.appendMessage(assistantMessage("Active prompt"))
  manager.appendMessage(userMessage("Active answer"))
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
  it("discovers the current public Brunch JSON-RPC surface", async () => {
    const handlers = createRpcHandlers({
      coordinator: coordinator(),
      cwd: "/tmp/brunch-project",
    })

    const response = await handlers.handle({
      jsonrpc: "2.0",
      id: 30,
      method: "rpc.discover",
    })

    expect(response).toMatchObject({ jsonrpc: "2.0", id: 30 })
    if (!("result" in response)) throw new Error("expected success response")

    const methods = (response.result as {
      methods: Array<{
        method: string
        description: string
        paramsSchema: unknown
        resultSchema: unknown
        examples: Array<Record<string, unknown>>
      }>
    }).methods
    expect(methods.map((entry) => entry.method).sort()).toEqual([
      "elicitation.respond",
      "rpc.discover",
      "session.elicitationExchanges",
      "session.pendingExchange",
      "session.startElicitation",
      "session.transcriptDisplay",
      "workspace.activate",
      "workspace.selectionState",
      "workspace.snapshot",
    ])

    const discoveredNames = new Set(methods.map((entry) => entry.method))
    for (const entry of methods) {
      expect(entry.description).toEqual(expect.any(String))
      expect(entry.description.length).toBeGreaterThan(10)
      expect(entry.paramsSchema).toEqual(expect.any(Object))
      expect(entry.resultSchema).toEqual(expect.any(Object))
      expect(entry.examples.length).toBeGreaterThanOrEqual(1)
      for (const example of entry.examples) {
        expect(example).toMatchObject({ jsonrpc: "2.0", method: entry.method })
        expect(discoveredNames.has(String(example.method))).toBe(true)
      }
    }
  })

  it("rejects params on method discovery", async () => {
    const handlers = createRpcHandlers({
      coordinator: coordinator(),
      cwd: "/tmp/brunch-project",
    })

    await expect(
      handlers.handle({
        jsonrpc: "2.0",
        id: 31,
        method: "rpc.discover",
        params: {},
      }),
    ).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: 31,
      error: { code: -32602, message: "Invalid params" },
    })
  })

  it("keeps discovery product-shaped and exposes workspace activation variants", async () => {
    const handlers = createRpcHandlers({
      coordinator: coordinator(),
      cwd: "/tmp/brunch-project",
    })

    const response = await handlers.handle({
      jsonrpc: "2.0",
      id: 32,
      method: "rpc.discover",
    })
    if (!("result" in response)) throw new Error("expected success response")

    const result = response.result as {
      methods: Array<{
        method: string
        paramsSchema: unknown
        examples: unknown[]
      }>
    }
    const methods = result.methods
    const discoveryJson = JSON.stringify(result)
    expect(discoveryJson).not.toContain("get_commands")
    expect(discoveryJson).not.toContain("get_state")
    expect(discoveryJson).not.toContain('"method":"prompt"')
    expect(discoveryJson).not.toContain("/brunch")

    const activation = methods.find(
      (entry) => entry.method === "workspace.activate",
    )
    expect(activation).toBeDefined()
    const activationSchema = JSON.stringify(activation?.paramsSchema)
    for (const action of [
      "continue",
      "openSession",
      "newSession",
      "newSpec",
      "cancel",
    ]) {
      expect(activationSchema).toContain(action)
    }
  })

  it("serves discovery examples that are valid JSON-RPC requests for advertised methods", async () => {
    const handlers = createRpcHandlers({
      coordinator: coordinator(),
      cwd: "/tmp/brunch-project",
    })

    const response = await handlers.handle({
      jsonrpc: "2.0",
      id: 33,
      method: "rpc.discover",
    })
    if (!("result" in response)) throw new Error("expected success response")

    const methods = (response.result as {
      methods: Array<{
        method: string
        examples: unknown[]
      }>
    }).methods
    const discoveredNames = new Set(methods.map((entry) => entry.method))
    const exampleRequestSchema = {
      type: "object",
      properties: {
        jsonrpc: { const: "2.0" },
        id: {
          anyOf: [{ type: "string" }, { type: "number" }, { type: "null" }],
        },
        method: { type: "string" },
        params: {},
      },
      required: ["jsonrpc", "method"],
      additionalProperties: false,
    }

    for (const entry of methods) {
      for (const example of entry.examples) {
        expect(Value.Check(exampleRequestSchema, example)).toBe(true)
        expect(
          discoveredNames.has((example as { method: string }).method),
        ).toBe(true)
      }
    }
  })

  it("serves structured workspace selection state without invoking the TUI picker", async () => {
    const handlers = createRpcHandlers({
      coordinator: coordinator(selectSpecState()),
      cwd: "/tmp/brunch-project",
    })

    await expect(
      handlers.handle({
        jsonrpc: "2.0",
        id: 20,
        method: "workspace.selectionState",
      }),
    ).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: 20,
      result: {
        status: "select_spec",
        requiresSelection: true,
        cwd: "/tmp/brunch-project",
        currentSpec: { id: "spec-1", title: "Alpha spec" },
        currentSessionFile:
          "/tmp/brunch-project/.brunch/sessions/session-1.jsonl",
        specs: [{ spec: { id: "spec-1" }, sessions: [{ id: "session-1" }] }],
        unavailableSessions: [{ reason: "missing_header" }],
      },
    })
  })

  it("activates valid spec/session decisions and returns serializable product snapshots", async () => {
    const decisions: SpecSessionActivationDecision[] = []
    const handlers = createRpcHandlers({
      cwd: "/tmp/brunch-project",
      coordinator: {
        ...coordinator(),
        async activateWorkspace(decision): Promise<WorkspaceActivationState> {
          decisions.push(decision)
          return decision.action === "cancel"
            ? cancelledState()
            : readyState("/tmp/brunch-project/.brunch/sessions/session-1.jsonl")
        },
      },
    })

    const validDecisions: SpecSessionActivationDecision[] = [
      { action: "cancel" },
      { action: "newSpec", title: "New spec" },
      { action: "newSession", specId: "spec-1" },
      {
        action: "continue",
        specId: "spec-1",
        sessionFile: "session-1.jsonl",
      },
      {
        action: "openSession",
        specId: "spec-1",
        sessionFile: "session-2.jsonl",
      },
    ]

    for (const [index, decision] of validDecisions.entries()) {
      await expect(
        handlers.handle({
          jsonrpc: "2.0",
          id: 21 + index,
          method: "workspace.activate",
          params: { decision },
        }),
      ).resolves.toMatchObject({
        jsonrpc: "2.0",
        id: 21 + index,
        result:
          decision.action === "cancel"
            ? { status: "cancelled", spec: { id: "spec-1" } }
            : {
                status: "ready",
                spec: { id: "spec-1" },
                session: { id: "session-1" },
              },
      })
      expect(decisions).toHaveLength(index + 1)
      expect(decisions[index]).toEqual(decision)
    }
  })

  it("rejects invalid workspace activation params", async () => {
    const handlers = createRpcHandlers({
      coordinator: coordinator(),
      cwd: "/tmp/brunch-project",
    })

    await expect(
      handlers.handle({
        jsonrpc: "2.0",
        id: 22,
        method: "workspace.activate",
        params: { decision: { action: "openSession", specId: "spec-1" } },
      }),
    ).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: 22,
      error: { code: -32602, message: "Invalid params" },
    })
  })

  it("keeps RPC initial selection independent from TUI picker imports", async () => {
    const source = await readFile(new URL("./rpc.ts", import.meta.url), "utf8")

    expect(source).not.toContain("workspace-dialog")
    expect(source).not.toContain("createWorkspaceDialogComponent")
    expect(source).not.toContain("structured-exchange")
  })

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

  it("starts a deterministic assistant-first elicitation prompt for the selected session", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "brunch-rpc-start-"))
    const coordinatorInstance = createWorkspaceSessionCoordinator({ cwd })
    const workspace = await coordinatorInstance.createSetupSession({
      specTitle: "Start spec",
    })
    const handlers = createRpcHandlers({
      coordinator: coordinatorInstance,
      cwd,
    })

    const start = await handlers.handle({
      jsonrpc: "2.0",
      id: 40,
      method: "session.startElicitation",
    })

    expect(start).toMatchObject({
      jsonrpc: "2.0",
      id: 40,
      result: {
        status: "pending",
        exchange: {
          exchangeId: expect.any(String),
          lens: "step-by-step",
          mode: "single-select",
          prompt: expect.stringContaining("new product or feature"),
          options: expect.arrayContaining([
            expect.objectContaining({ id: "new-from-scratch" }),
          ]),
          note: { allowed: true },
        },
      },
    })
    const exchangeId = (start as {
      result: { exchange: { exchangeId: string } }
    }).result.exchange.exchangeId

    const exchanges = await handlers.handle({
      jsonrpc: "2.0",
      id: 41,
      method: "session.elicitationExchanges",
    })
    expect(exchanges).toMatchObject({
      jsonrpc: "2.0",
      id: 41,
      result: { status: "open_prompt", openPrompt: expect.any(Object) },
    })

    const display = await handlers.handle({
      jsonrpc: "2.0",
      id: 42,
      method: "session.transcriptDisplay",
    })
    expect(display).toMatchObject({
      jsonrpc: "2.0",
      id: 42,
      result: {
        rows: [
          {
            role: "prompt",
            text: expect.stringContaining("new product or feature"),
          },
        ],
      },
    })

    const sessionText = await readFile(workspace.session.file, "utf8")
    expect(sessionText).toContain("brunch.elicitation_prompt")
    expect(sessionText).toContain(exchangeId)
    expect(sessionText).toContain('"lens":"step-by-step"')
  })

  it("reads the selected pending elicitation exchange from transcript truth", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "brunch-rpc-pending-"))
    const coordinatorInstance = createWorkspaceSessionCoordinator({ cwd })
    await coordinatorInstance.createSetupSession({
      specTitle: "Pending spec",
    })
    const handlers = createRpcHandlers({
      coordinator: coordinatorInstance,
      cwd,
    })

    const start = await handlers.handle({
      jsonrpc: "2.0",
      id: 46,
      method: "session.startElicitation",
    })
    const pending = await handlers.handle({
      jsonrpc: "2.0",
      id: 47,
      method: "session.pendingExchange",
    })

    expect(pending).toMatchObject({
      jsonrpc: "2.0",
      id: 47,
      result: {
        status: "pending",
        exchange: {
          exchangeId: (start as {
            result: { exchange: { exchangeId: string } }
          }).result.exchange.exchangeId,
          prompt: expect.stringContaining("new product or feature"),
          lens: "step-by-step",
          note: { allowed: true },
        },
      },
    })
  })

  it("reads an explicit pending exchange without opening the selected workspace session", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "brunch-rpc-explicit-pending-"))
    const coordinatorInstance = createWorkspaceSessionCoordinator({ cwd })
    const workspace = await coordinatorInstance.createSetupSession({
      specTitle: "Explicit pending spec",
    })
    const startHandlers = createRpcHandlers({
      coordinator: coordinatorInstance,
      cwd,
    })
    await startHandlers.handle({
      jsonrpc: "2.0",
      id: 48,
      method: "session.startElicitation",
    })

    const handlers = createRpcHandlers({
      coordinator: {
        ...coordinatorInstance,
        async openDefaultWorkspace() {
          throw new Error(
            "explicit pending reads must not open selected session",
          )
        },
      },
      cwd,
    })

    await expect(
      handlers.handle({
        jsonrpc: "2.0",
        id: 49,
        method: "session.pendingExchange",
        params: { sessionId: workspace.session.id, specId: workspace.spec.id },
      }),
    ).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: 49,
      result: {
        status: "pending",
        exchange: { exchangeId: "deterministic-grounding-1" },
      },
    })
  })

  it("reports idle pending state when the selected session has no open prompt", async () => {
    const sessionFile = await createSessionFile()
    const handlers = createRpcHandlers({
      coordinator: coordinator(readyState(sessionFile)),
      cwd: "/tmp/brunch-project",
    })

    await expect(
      handlers.handle({
        jsonrpc: "2.0",
        id: 50,
        method: "session.pendingExchange",
      }),
    ).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: 50,
      result: { status: "idle", exchange: null },
    })
  })

  it("returns a product-shaped no-session error when reading pending without a selected session", async () => {
    const handlers = createRpcHandlers({
      coordinator: coordinator(selectSpecState()),
      cwd: "/tmp/brunch-project",
    })

    await expect(
      handlers.handle({
        jsonrpc: "2.0",
        id: 51,
        method: "session.pendingExchange",
      }),
    ).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: 51,
      error: { code: -32001, message: "No selected Brunch session" },
    })
  })

  it("returns product-shaped non-linear errors when reading pending exchanges", async () => {
    const sessionFile = await createBranchedSessionFile()
    const handlers = createRpcHandlers({
      coordinator: coordinator(readyState(sessionFile)),
      cwd: "/tmp/brunch-project",
    })

    await expect(
      handlers.handle({
        jsonrpc: "2.0",
        id: 52,
        method: "session.pendingExchange",
      }),
    ).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: 52,
      error: {
        code: -32002,
        message: "Selected Brunch session transcript is non-linear",
      },
    })
  })

  it("responds to the deterministic listed-option exchange and closes the projection", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "brunch-rpc-respond-"))
    const coordinatorInstance = createWorkspaceSessionCoordinator({ cwd })
    const workspace = await coordinatorInstance.createSetupSession({
      specTitle: "Respond spec",
    })
    const handlers = createRpcHandlers({
      coordinator: coordinatorInstance,
      cwd,
    })

    const start = await handlers.handle({
      jsonrpc: "2.0",
      id: 53,
      method: "session.startElicitation",
    })
    const exchangeId = (start as {
      result: { exchange: { exchangeId: string } }
    }).result.exchange.exchangeId

    const response = await handlers.handle({
      jsonrpc: "2.0",
      id: 54,
      method: "elicitation.respond",
      params: {
        exchangeId,
        answer: { optionId: "new-from-scratch" },
        note: "This is a greenfield product.",
      },
    })

    expect(response).toMatchObject({
      jsonrpc: "2.0",
      id: 54,
      result: {
        status: "accepted",
        exchangeId,
        answer: {
          optionId: "new-from-scratch",
          label: "Yes — this is new from scratch",
        },
        note: "This is a greenfield product.",
      },
    })

    await expect(
      handlers.handle({
        jsonrpc: "2.0",
        id: 55,
        method: "session.pendingExchange",
      }),
    ).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: 55,
      result: { status: "idle", exchange: null },
    })

    await expect(
      handlers.handle({
        jsonrpc: "2.0",
        id: 56,
        method: "session.elicitationExchanges",
      }),
    ).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: 56,
      result: {
        status: "ready",
        exchanges: [
          {
            promptEntryIds: [expect.any(String)],
            responseEntryIds: [expect.any(String), expect.any(String)],
          },
        ],
      },
    })

    await expect(
      handlers.handle({
        jsonrpc: "2.0",
        id: 57,
        method: "session.transcriptDisplay",
      }),
    ).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: 57,
      result: {
        rows: [
          {
            role: "prompt",
            text: expect.stringContaining("new product or feature"),
          },
          {
            role: "user",
            text: expect.stringContaining("Yes — this is new from scratch"),
          },
        ],
      },
    })

    const sessionText = await readFile(workspace.session.file, "utf8")
    expect(sessionText).toContain("brunch.elicitation_response")
    expect(sessionText).toContain("This is a greenfield product.")
  })

  it("rejects mismatched elicitation response ids without appending transcript entries", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "brunch-rpc-respond-bad-id-"))
    const coordinatorInstance = createWorkspaceSessionCoordinator({ cwd })
    const workspace = await coordinatorInstance.createSetupSession({
      specTitle: "Bad id spec",
    })
    const handlers = createRpcHandlers({
      coordinator: coordinatorInstance,
      cwd,
    })
    await handlers.handle({
      jsonrpc: "2.0",
      id: 58,
      method: "session.startElicitation",
    })
    const before = await readFile(workspace.session.file, "utf8")

    await expect(
      handlers.handle({
        jsonrpc: "2.0",
        id: 59,
        method: "elicitation.respond",
        params: {
          exchangeId: "not-current",
          answer: { optionId: "new-from-scratch" },
        },
      }),
    ).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: 59,
      error: {
        code: -32006,
        message: "Pending elicitation exchange does not match request",
      },
    })
    await expect(readFile(workspace.session.file, "utf8")).resolves.toBe(before)
  })

  it("rejects unknown elicitation option ids without appending transcript entries", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "brunch-rpc-respond-bad-option-"))
    const coordinatorInstance = createWorkspaceSessionCoordinator({ cwd })
    const workspace = await coordinatorInstance.createSetupSession({
      specTitle: "Bad option spec",
    })
    const handlers = createRpcHandlers({
      coordinator: coordinatorInstance,
      cwd,
    })
    const start = await handlers.handle({
      jsonrpc: "2.0",
      id: 60,
      method: "session.startElicitation",
    })
    const exchangeId = (start as {
      result: { exchange: { exchangeId: string } }
    }).result.exchange.exchangeId
    const before = await readFile(workspace.session.file, "utf8")

    await expect(
      handlers.handle({
        jsonrpc: "2.0",
        id: 61,
        method: "elicitation.respond",
        params: { exchangeId, answer: { optionId: "missing-option" } },
      }),
    ).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: 61,
      error: { code: -32007, message: "Invalid elicitation option" },
    })
    await expect(readFile(workspace.session.file, "utf8")).resolves.toBe(before)
  })

  it("guards duplicate elicitation responses without appending transcript entries", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "brunch-rpc-respond-duplicate-"))
    const coordinatorInstance = createWorkspaceSessionCoordinator({ cwd })
    const workspace = await coordinatorInstance.createSetupSession({
      specTitle: "Duplicate spec",
    })
    const handlers = createRpcHandlers({
      coordinator: coordinatorInstance,
      cwd,
    })
    const start = await handlers.handle({
      jsonrpc: "2.0",
      id: 62,
      method: "session.startElicitation",
    })
    const exchangeId = (start as {
      result: { exchange: { exchangeId: string } }
    }).result.exchange.exchangeId
    await handlers.handle({
      jsonrpc: "2.0",
      id: 63,
      method: "elicitation.respond",
      params: { exchangeId, answer: { optionId: "existing-codebase" } },
    })
    const before = await readFile(workspace.session.file, "utf8")

    await expect(
      handlers.handle({
        jsonrpc: "2.0",
        id: 64,
        method: "elicitation.respond",
        params: { exchangeId, answer: { optionId: "existing-codebase" } },
      }),
    ).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: 64,
      error: { code: -32008, message: "No pending elicitation exchange" },
    })
    await expect(readFile(workspace.session.file, "utf8")).resolves.toBe(before)
  })

  it("resumes an open deterministic elicitation prompt without duplicating transcript entries", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "brunch-rpc-resume-"))
    const coordinatorInstance = createWorkspaceSessionCoordinator({ cwd })
    const workspace = await coordinatorInstance.createSetupSession({
      specTitle: "Resume spec",
    })
    const handlers = createRpcHandlers({
      coordinator: coordinatorInstance,
      cwd,
    })

    const first = await handlers.handle({
      jsonrpc: "2.0",
      id: 43,
      method: "session.startElicitation",
    })
    const before = await readFile(workspace.session.file, "utf8")

    const second = await handlers.handle({
      jsonrpc: "2.0",
      id: 44,
      method: "session.startElicitation",
    })
    const after = await readFile(workspace.session.file, "utf8")

    expect(second).toMatchObject({
      jsonrpc: "2.0",
      id: 44,
      result: {
        status: "pending",
        exchange: {
          exchangeId: (first as {
            result: { exchange: { exchangeId: string } }
          }).result.exchange.exchangeId,
        },
      },
    })
    expect(after).toBe(before)
  })

  it("returns a product-shaped no-session error when starting elicitation without a selected session", async () => {
    const handlers = createRpcHandlers({
      coordinator: coordinator(selectSpecState()),
      cwd: "/tmp/brunch-project",
    })

    await expect(
      handlers.handle({
        jsonrpc: "2.0",
        id: 45,
        method: "session.startElicitation",
      }),
    ).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: 45,
      error: { code: -32001, message: "No selected Brunch session" },
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
    first.session.manager.appendMessage(assistantMessage("First question"))
    first.session.manager.appendMessage(userMessage("First answer"))
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
    workspace.session.manager.appendMessage(
      assistantMessage("Display question"),
    )
    workspace.session.manager.appendMessage(userMessage("Display answer"))
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
    manager.appendMessage(assistantMessage("Abandoned prompt"))
    manager.appendMessage(userMessage("Abandoned answer"))
    manager.resetLeaf()
    manager.appendMessage(assistantMessage("Active prompt"))
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
