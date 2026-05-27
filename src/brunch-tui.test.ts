import { userMessage } from "./test-helpers.js"
import { mkdtemp, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  SessionManager,
  type ExtensionCommandContext,
  type ExtensionContext,
  type ExtensionUIContext,
  type RegisteredCommand,
} from "@earendil-works/pi-coding-agent"

import {
  applyBrunchOfflineDefault,
  brunchResourceLoaderOptions,
  createBrunchSettingsManager,
  runBrunchTui,
} from "./brunch-tui.js"
import {
  BRUNCH_WORKSPACE_COMMAND,
  BRUNCH_WORKSPACE_SHORTCUT,
  chromeStateForWorkspace,
  createBrunchPiExtensionShell,
  registerBrunchAlternatives,
  registerBrunchOperationalModePolicy,
  runBrunchWorkspaceCommand,
  runBrunchWorkspaceAction,
} from "./pi-extensions.js"
import {
  createWorkspaceSessionCoordinator,
  verifyWorkspaceSessionStores,
  type WorkspaceLaunchInventory,
  type WorkspaceSessionReadyState,
} from "./workspace-session-coordinator.js"

describe("Brunch TUI boot", () => {
  it("gates spec selection through the coordinator before launching interactive mode", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "brunch-tui-"))
    const events: string[] = []

    await runBrunchTui({
      cwd,
      selectSpecTitle: async () => {
        events.push("select-spec")
        return "Gated spec"
      },
      launchInteractive: async ({ workspace }) => {
        events.push(`launch:${workspace.spec.title}`)
      },
    })

    expect(events).toEqual(["select-spec", "launch:Gated spec"])
    const oracle = await verifyWorkspaceSessionStores({
      cwd,
      expectedSessionCount: 1,
    })
    expect(oracle.ok).toBe(true)
    if (!oracle.ok) {
      expect(oracle.errors).toEqual([])
    }
  })

  it("runs inspect, preflight, and activation before launching interactive mode", async () => {
    const events: string[] = []
    const workspace = readyWorkspace("/tmp/project", "session-ready")

    await runBrunchTui({
      cwd: "/tmp/project",
      coordinator: {
        inspectWorkspace: async () => {
          events.push("inspect")
          return {
            cwd: "/tmp/project",
            currentSpec: workspace.spec,
            currentSessionFile: workspace.session.file,
            needsNewSpec: false,
            specs: [],
            unavailableSessions: [],
          }
        },
        activateWorkspace: async (decision) => {
          events.push(`activate:${decision.action}`)
          return workspace
        },
        bindCurrentSpecToReplacementSession: async () => workspace,
      },
      runWorkspaceDialogPreflight: async () => {
        events.push("preflight")
        return {
          action: "continue",
          specId: workspace.spec.id,
          sessionFile: workspace.session.file,
        }
      },
      launchInteractive: async ({ workspace: launched }) => {
        events.push(`launch:${launched.session.id}`)
      },
    })

    expect(events).toEqual([
      "inspect",
      "preflight",
      "activate:continue",
      "launch:session-ready",
    ])
  })

  it("does not launch interactive mode when startup preflight is cancelled", async () => {
    const events: string[] = []
    const workspace = readyWorkspace("/tmp/project", "session-ready")

    await runBrunchTui({
      cwd: "/tmp/project",
      coordinator: {
        inspectWorkspace: async () => {
          events.push("inspect")
          return {
            cwd: "/tmp/project",
            currentSpec: workspace.spec,
            currentSessionFile: workspace.session.file,
            needsNewSpec: false,
            specs: [],
            unavailableSessions: [],
          }
        },
        activateWorkspace: async () => {
          events.push("activate")
          return {
            status: "cancelled",
            cwd: "/tmp/project",
            chrome: workspace.chrome,
          }
        },
        bindCurrentSpecToReplacementSession: async () => workspace,
      },
      runWorkspaceDialogPreflight: async () => {
        events.push("preflight")
        return { action: "cancel" }
      },
      launchInteractive: async () => {
        events.push("launch")
      },
    })

    expect(events).toEqual(["inspect", "preflight", "activate"])
  })

  it("chooses a new binding-only session instead of implicitly resuming stale transcript", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "brunch-tui-"))
    const coordinator = createWorkspaceSessionCoordinator({ cwd })
    const first = await coordinator.createSetupSession({
      specTitle: "Spec One",
    })
    first.session.manager.appendMessage(userMessage("stale transcript"))
    const firstContent = await readFile(first.session.file, "utf8")
    let launchedSessionFile: string | undefined

    await runBrunchTui({
      cwd,
      coordinator,
      runWorkspaceDialogPreflight: async () => ({
        action: "newSession",
        specId: first.spec.id,
      }),
      launchInteractive: async ({ workspace }) => {
        launchedSessionFile = workspace.session.file
      },
    })

    expect(launchedSessionFile).toBeDefined()
    expect(launchedSessionFile).not.toBe(first.session.file)
    await expect(readFile(first.session.file, "utf8")).resolves.toBe(
      firstContent,
    )
    expect(await readFile(launchedSessionFile!, "utf8")).not.toContain(
      "stale transcript",
    )
  })

  it("binds replacement sessions through internal session boundary events", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "brunch-tui-"))
    const manager = SessionManager.create(cwd, join(cwd, ".brunch", "sessions"))
    const boundSessionIds: string[] = []
    const widgets = new Map<string, string[]>()
    const titles: string[] = []
    const ui: FakeExtensionUi = {
      setHeader: (_factory) => {},
      setFooter: (_factory) => {},
      setStatus: (_key, _text) => {},
      setWidget: (key: string, content: unknown) => {
        if (isStringArray(content)) {
          widgets.set(key, content)
        }
      },
      setWorkingIndicator: (_options) => {},
      setTitle: (title: string) => titles.push(title),
      notify: (_message: string, _type?: "info" | "warning" | "error") => {},
    }
    const ctx: FakeExtensionContext = { sessionManager: manager, ui }
    const sessionStart: Array<(
      event: unknown,
      ctx: FakeExtensionContext,
    ) => Promise<void>> = []
    const beforeAgentStart: Array<(
      event: unknown,
      ctx: FakeExtensionContext,
    ) => Promise<void>> = []
    const messageStart: Array<(
      event: unknown,
      ctx: FakeExtensionContext,
    ) => Promise<void>> = []

    createBrunchPiExtensionShell(
      chromeStateForWorkspace(readyWorkspace(cwd, manager.getSessionId())),
      (sessionManager) => {
        boundSessionIds.push(sessionManager.getSessionId())
      },
      { coordinator: noOpWorkspaceCoordinator(cwd) },
    )({
      on: (event: string, handler: never) => {
        if (event === "session_start") {
          sessionStart.push(handler)
        }
        if (event === "before_agent_start") {
          beforeAgentStart.push(handler)
        }
        if (event === "message_start") {
          messageStart.push(handler)
        }
      },
      registerCommand: (_name: string, _options: unknown) => {},
    } as never)

    for (const handler of sessionStart) await handler({}, ctx)
    for (const handler of beforeAgentStart) await handler({}, ctx)
    for (const handler of messageStart) {
      await handler({ type: "message_start", message: { role: "user" } }, ctx)
    }
    for (const handler of messageStart) {
      await handler(
        { type: "message_start", message: { role: "assistant" } },
        ctx,
      )
    }

    expect(boundSessionIds).toEqual([
      manager.getSessionId(),
      manager.getSessionId(),
      manager.getSessionId(),
    ])
    expect(widgets.get("brunch.chrome")?.join("\n")).toContain(
      "chat mode: responding-to-elicitation",
    )
    expect(titles).toEqual(["brunch — Spec One"])
  })

  it("registers the Brunch spec/session picker command and shortcut", async () => {
    const commands =
      new Map<string, Omit<RegisteredCommand, "name" | "sourceInfo">>()
    const shortcuts =
      new Map<string, Omit<RegisteredCommand, "name" | "sourceInfo">>()
    const registeredTools: string[] = []

    createBrunchPiExtensionShell(
      chromeStateForWorkspace(readyWorkspace("/tmp/project", "session-1")),
      undefined,
      {
        coordinator: {
          inspectWorkspace: async () => emptyInventory("/tmp/project"),
          activateWorkspace: async () =>
            readyWorkspace("/tmp/project", "session-1"),
        },
      },
    )({
      on: (_event: string, _handler: unknown) => {},
      registerCommand: (name: string, opts: unknown) =>
        commands.set(name, opts as never),
      registerShortcut: (name: string, opts: unknown) =>
        shortcuts.set(name, opts as never),
      registerTool: (tool: { name: string }) => registeredTools.push(tool.name),
      registerMessageRenderer: (_type: string) => {},
      sendMessage: (_message: unknown) => {},
      getAllTools: () =>
        ["read", "grep", "find", "ls", "bash"].map((name) => ({ name })),
      setActiveTools: (_tools: string[]) => {},
    } as never)

    expect(registeredTools).toEqual([
      "read",
      "grep",
      "find",
      "ls",
      "present_alternatives",
      "brunch_structured_question",
    ])
    expect(commands.get(BRUNCH_WORKSPACE_COMMAND)?.description).toBe(
      "Open the Brunch spec/session picker",
    )
    const retiredWorkspaceCommand = ["brunch", "workspace"].join("-")
    expect(commands.has(retiredWorkspaceCommand)).toBe(false)
    expect(shortcuts.get(BRUNCH_WORKSPACE_SHORTCUT)?.description).toBe(
      "Open the Brunch spec/session picker",
    )
    expect(shortcuts.has("ctrl+b")).toBe(false)

    const shortcutEvents: string[] = []
    const shortcut = shortcuts.get(BRUNCH_WORKSPACE_SHORTCUT)
    expect(shortcut).toBeDefined()
    const shortcutHandler = shortcut!.handler as (
      ctx: unknown,
    ) => Promise<void> | void
    await shortcutHandler({
      ui: fakeUi((method, type) => shortcutEvents.push(`${method}:${type}`)),
    })
    expect(shortcutEvents).toEqual(["notify:warning"])
  })

  it("opens the spec/session picker from the Brunch command", async () => {
    const events: string[] = []
    const target = readyWorkspace("/tmp/project", "session-target")
    const ctx = fakeCommandContext({
      currentSessionFile: "/sessions/session-old.jsonl",
      decisions: [
        {
          action: "openSession",
          specId: target.spec.id,
          sessionFile: target.session.file,
        },
      ],
      onEvent: (event) => events.push(event),
    })

    await runBrunchWorkspaceCommand(ctx, {
      inspectWorkspace: async () => {
        events.push("inspect")
        return inventoryWithWorkspace(target)
      },
      activateWorkspace: async (decision) => {
        events.push(`activate:${decision.action}`)
        return target
      },
    })

    expect(events).toEqual([
      "waitForIdle",
      "inspect",
      "custom",
      "activate:openSession",
      `switch:${target.session.file}`,
      "notify:info",
    ])
  })

  it("runs the in-session workspace switch through coordinator activation and replacement context", async () => {
    const events: string[] = []
    const customOptions: unknown[] = []
    const target = readyWorkspace("/tmp/project", "session-target")
    const replacementUi = fakeUi((method) =>
      events.push(`replacement:${method}`),
    )
    const ctx = fakeCommandContext({
      currentSessionFile: "/sessions/session-old.jsonl",
      decision: {
        action: "openSession",
        specId: target.spec.id,
        sessionFile: target.session.file,
      },
      onCustomOptions: (options) => customOptions.push(options),
      onEvent: (event) => events.push(event),
      replacementUi,
    })

    await runBrunchWorkspaceAction(ctx, {
      inspectWorkspace: async () => {
        events.push("inspect")
        return inventoryWithWorkspace(target)
      },
      activateWorkspace: async (decision) => {
        events.push(`activate:${decision.action}`)
        return target
      },
    })

    expect(events).toEqual([
      "waitForIdle",
      "inspect",
      "custom",
      "activate:openSession",
      `switch:${target.session.file}`,
      "replacement:setHeader",
      "replacement:setFooter",
      "replacement:setWidget",
      "replacement:setTitle",
      "replacement:notify",
    ])
    expect(customOptions).toEqual([
      {
        overlay: true,
        overlayOptions: {
          anchor: "center",
          width: 80,
          maxHeight: "90%",
          margin: 1,
        },
      },
    ])
  })

  it("opens the spec/session picker from shortcut contexts without waitForIdle", async () => {
    const events: string[] = []
    const target = readyWorkspace("/tmp/project", "session-target")
    const ctx = fakeCommandContext({
      currentSessionFile: "/sessions/session-old.jsonl",
      decision: {
        action: "openSession",
        specId: target.spec.id,
        sessionFile: target.session.file,
      },
      onEvent: (event) => events.push(event),
    })
    delete (ctx as Partial<ExtensionCommandContext>).waitForIdle

    await runBrunchWorkspaceAction(ctx, {
      inspectWorkspace: async () => {
        events.push("inspect")
        return inventoryWithWorkspace(target)
      },
      activateWorkspace: async (decision) => {
        events.push(`activate:${decision.action}`)
        return target
      },
    })

    expect(events).toEqual([
      "inspect",
      "custom",
      "activate:openSession",
      `switch:${target.session.file}`,
      "notify:info",
    ])
  })

  it("leaves the current session untouched when workspace switch is cancelled", async () => {
    const events: string[] = []
    const ctx = fakeCommandContext({
      currentSessionFile: "/sessions/session-old.jsonl",
      decision: { action: "cancel" },
      onEvent: (event) => events.push(event),
    })

    await runBrunchWorkspaceAction(ctx, {
      inspectWorkspace: async () => emptyInventory("/tmp/project"),
      activateWorkspace: async () => ({
        status: "cancelled",
        cwd: "/tmp/project",
        chrome: {
          cwd: "/tmp/project",
          spec: null,
          phase: "select_spec",
          chatMode: "select-spec",
        },
      }),
    })

    expect(events).toEqual(["waitForIdle", "custom", "notify:info"])
  })

  it("reports needs-human workspace switch decisions without switching sessions", async () => {
    const events: string[] = []
    const ctx = fakeCommandContext({
      currentSessionFile: "/sessions/session-old.jsonl",
      decision: {
        action: "openSession",
        specId: "missing",
        sessionFile: "/sessions/missing.jsonl",
      },
      onEvent: (event) => events.push(event),
    })

    await runBrunchWorkspaceAction(ctx, {
      inspectWorkspace: async () => emptyInventory("/tmp/project"),
      activateWorkspace: async () => ({
        status: "needs_human",
        cwd: "/tmp/project",
        reason: "Selected session is not available.",
        chrome: {
          cwd: "/tmp/project",
          spec: null,
          phase: "select_spec",
          chatMode: "select-spec",
        },
      }),
    })

    expect(events).toEqual(["waitForIdle", "custom", "notify:warning"])
  })

  it("cancels Pi branch-flow hooks with a stable user-facing reason", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "brunch-tui-"))
    const manager = SessionManager.create(cwd, join(cwd, ".brunch", "sessions"))
    const notifications: Array<{
      message: string
      type: "info" | "warning" | "error" | undefined
    }> = []
    const ctx: FakeExtensionContext = {
      sessionManager: manager,
      ui: {
        setHeader: (_factory) => {},
        setFooter: (_factory) => {},
        setStatus: (_key, _text) => {},
        setWidget: (_key: string, _content: unknown) => {},
        setWorkingIndicator: (_options) => {},
        setTitle: (_title: string) => {},
        notify: (message, type) => notifications.push({ message, type }),
      },
    }
    const handlers = new Map<string, (
      event: unknown,
      ctx: FakeExtensionContext,
    ) => unknown>()

    createBrunchPiExtensionShell(
      chromeStateForWorkspace(readyWorkspace(cwd, manager.getSessionId())),
      undefined,
      { coordinator: noOpWorkspaceCoordinator(cwd) },
    )({
      on: (
        event: string,
        handler: (event: unknown, ctx: FakeExtensionContext) => unknown,
      ) => {
        handlers.set(event, handler)
      },
      registerCommand: (_name: string, _options: unknown) => {},
    } as never)

    await expect(
      Promise.resolve(
        handlers.get("session_before_tree")?.(
          { type: "session_before_tree" },
          ctx,
        ),
      ),
    ).resolves.toEqual({ cancel: true })
    await expect(
      Promise.resolve(
        handlers.get("session_before_fork")?.(
          { type: "session_before_fork" },
          ctx,
        ),
      ),
    ).resolves.toEqual({ cancel: true })
    expect(notifications).toEqual([
      {
        message:
          "Brunch does not support Pi session branches in this POC. Use /new to continue within the selected spec.",
        type: "warning",
      },
      {
        message:
          "Brunch does not support Pi session branches in this POC. Use /new to continue within the selected spec.",
        type: "warning",
      },
    ])
  })

  it("registers alternatives cards as a transcript primitive without demo commands", async () => {
    const commands: string[] = []
    const renderers: string[] = []
    const tools = new Map<string, {
      execute: (id: string, params: never) => unknown
    }>()
    const messages: unknown[] = []

    registerBrunchAlternatives({
      registerMessageRenderer: (type: string) => renderers.push(type),
      registerTool: (tool: {
        name: string
        execute: (id: string, params: never) => unknown
      }) => tools.set(tool.name, tool),
      registerCommand: (name: string) => commands.push(name),
      sendMessage: (message: unknown) => messages.push(message),
    } as never)

    await expect(
      Promise.resolve(tools.get("present_alternatives")?.execute("tool-1", {
          headline: "Choose",
          alternatives: [{ title: "A", body: "Alpha", flavor: "accent" }],
        } as never)),
    ).resolves.toMatchObject({
      content: [{ type: "text", text: "Presented 1 alternative." }],
      details: { count: 1 },
      terminate: true,
    })

    expect(renderers).toEqual(["alternatives-card-set"])
    expect(messages).toEqual([
      {
        customType: "alternatives-card-set",
        content: "## Choose\n\n---\n\n### A\n\nAlpha",
        display: true,
        details: {
          headline: "Choose",
          alternatives: [{ title: "A", body: "Alpha", flavor: "accent" }],
        },
      },
    ])
    expect(commands).toEqual([])
  })

  it("wires the fixture graph-code mention source through the Brunch shell", async () => {
    let providerFactory: ((
      current: FakeAutocompleteProvider,
    ) => FakeAutocompleteProvider) | undefined
    const sessionStart: Array<(
      event: unknown,
      ctx: FakeExtensionContext,
    ) => Promise<void> | void> = []

    createBrunchPiExtensionShell(
      chromeStateForWorkspace(readyWorkspace("/tmp/project", "session-1")),
      undefined,
      { coordinator: noOpWorkspaceCoordinator("/tmp/project") },
    )({
      on: (event: string, handler: never) => {
        if (event === "session_start") sessionStart.push(handler)
      },
      registerCommand: (_name: string, _options: unknown) => {},
      registerShortcut: (_name: string, _options: unknown) => {},
      registerTool: (_tool: unknown) => {},
      registerMessageRenderer: (_type: string) => {},
      sendMessage: (_message: unknown) => {},
      getAllTools: () => [],
      setActiveTools: (_tools: string[]) => {},
    } as never)

    const ctx: FakeExtensionContext = {
      sessionManager: {
        getEntries: () => [],
      } as unknown as FakeExtensionContext["sessionManager"],
      ui: {
        setHeader: (_factory) => {},
        setFooter: (_factory) => {},
        setStatus: (_key, _text) => {},
        setWidget: (_key: string, _content: unknown) => {},
        setWorkingIndicator: (_options) => {},
        setTitle: (_title: string) => {},
        notify: (_message: string, _type?: "info" | "warning" | "error") => {},
        addAutocompleteProvider: (factory: typeof providerFactory) => {
          providerFactory = factory
        },
      } as FakeExtensionUi & {
        addAutocompleteProvider: (factory: typeof providerFactory) => void
      },
    }

    for (const handler of sessionStart) await handler({}, ctx)

    const fallback: FakeAutocompleteProvider = {
      getSuggestions: async () => ({ items: [], prefix: "" }),
      applyCompletion: (lines) => ({ lines, cursorLine: 0, cursorCol: 0 }),
      shouldTriggerFileCompletion: () => true,
    }
    const provider = providerFactory?.(fallback)

    await expect(
      provider?.getSuggestions(["Discuss #"], 0, 9, {} as never),
    ).resolves.toMatchObject({
      prefix: "#",
      items: expect.arrayContaining([
        expect.objectContaining({ value: "#D12" }),
      ]),
    })
  })

  it("loads the elicit operational-mode tool policy from product code", async () => {
    const events: Record<string, (event: never) => unknown> = {}
    const activeTools: string[][] = []
    const registeredTools: string[] = []

    registerBrunchOperationalModePolicy({
      registerTool: (tool: { name: string }) => registeredTools.push(tool.name),
      getAllTools: () =>
        ["read", "grep", "find", "ls", "bash", "write"].map((name) => ({
          name,
        })),
      setActiveTools: (tools: string[]) => activeTools.push(tools),
      on: (event: string, handler: (event: never) => unknown) => {
        events[event] = handler
      },
    } as never)

    expect(registeredTools).toEqual(["read", "grep", "find", "ls"])
    await events.session_start?.({} as never)
    expect(activeTools).toEqual([["read", "grep", "find", "ls"]])
    await expect(
      Promise.resolve(
        events.before_agent_start?.({ systemPrompt: "base" } as never),
      ),
    ).resolves.toMatchObject({
      systemPrompt: expect.stringContaining(
        "Brunch exposes only read-only tools: read, grep, find, ls.",
      ),
    })
    await expect(
      Promise.resolve(events.tool_call?.({ toolName: "write" } as never)),
    ).resolves.toMatchObject({ block: true })
    expect(events.user_bash?.({ command: "rm -rf ." } as never)).toMatchObject({
      result: {
        exitCode: 1,
        output: "Brunch tool policy blocks shell commands: rm -rf .",
      },
    })
  })

  it("suppresses generic Pi startup resources for the Brunch shell", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "brunch-tui-"))
    const settingsManager = createBrunchSettingsManager(cwd, cwd)
    const extension = () => {}
    const resourceOptions = brunchResourceLoaderOptions([extension])
    const env: { PI_OFFLINE?: string } = {}

    applyBrunchOfflineDefault(env)

    expect(settingsManager.getQuietStartup()).toBe(true)
    expect(resourceOptions).toEqual({
      noContextFiles: true,
      noExtensions: true,
      noPromptTemplates: true,
      noSkills: true,
      noThemes: true,
      extensionFactories: [extension],
    })
    expect(env.PI_OFFLINE).toBe("1")
  })
})

function readyWorkspace(
  cwd: string,
  sessionId: string,
): WorkspaceSessionReadyState {
  const spec = { id: "spec-1", title: "Spec One" }
  return {
    status: "ready",
    cwd,
    spec,
    session: {
      id: sessionId,
      file: `/sessions/${sessionId}.jsonl`,
      manager: {} as WorkspaceSessionReadyState["session"]["manager"],
    },
    chrome: {
      cwd,
      spec,
      phase: "elicitation",
      chatMode: "responding-to-elicitation",
    },
  }
}

function emptyInventory(cwd: string): WorkspaceLaunchInventory {
  return {
    cwd,
    currentSpec: null,
    currentSessionFile: null,
    needsNewSpec: true,
    specs: [],
    unavailableSessions: [],
  }
}

function inventoryWithWorkspace(
  workspace: WorkspaceSessionReadyState,
): WorkspaceLaunchInventory {
  return {
    cwd: workspace.cwd,
    currentSpec: workspace.spec,
    currentSessionFile: workspace.session.file,
    needsNewSpec: false,
    specs: [
      {
        spec: workspace.spec,
        sessions: [
          {
            id: workspace.session.id,
            file: workspace.session.file,
            specId: workspace.spec.id,
            specTitle: workspace.spec.title,
            available: true,
          },
        ],
      },
    ],
    unavailableSessions: [],
  }
}

function noOpWorkspaceCoordinator(cwd: string) {
  return {
    inspectWorkspace: async () => emptyInventory(cwd),
    activateWorkspace: async () => readyWorkspace(cwd, "session-1"),
  }
}

function fakeCommandContext(options: {
  currentSessionFile: string
  decision?: Awaited<ReturnType<ExtensionUIContext["custom"]>>
  decisions?: Array<Awaited<ReturnType<ExtensionUIContext["custom"]>>>
  onCustomOptions?: (customOptions: unknown) => void
  onEvent: (event: string) => void
  replacementUi?: FakeExtensionUi
}): ExtensionCommandContext {
  const ui = fakeUi((method, type) => {
    if (method === "notify") {
      options.onEvent(`notify:${type}`)
    }
  })
  const decisions = [...(options.decisions ?? [options.decision])]
  const ctx = {
    cwd: "/tmp/project",
    sessionManager: {
      getSessionFile: () => options.currentSessionFile,
    },
    ui: {
      ...ui,
      custom: async (_component: unknown, customOptions?: unknown) => {
        options.onEvent("custom")
        if (customOptions !== undefined) {
          options.onCustomOptions?.(customOptions)
        }
        return decisions.shift()
      },
    },
    waitForIdle: async () => options.onEvent("waitForIdle"),
    switchSession: async (
      sessionPath: string,
      switchOptions?: Parameters<ExtensionCommandContext["switchSession"]>[1],
    ) => {
      options.onEvent(`switch:${sessionPath}`)
      await switchOptions?.withSession?.({
        ...ctx,
        ui: options.replacementUi ?? ui,
        sessionManager: { getSessionFile: () => sessionPath },
      } as never)
      return { cancelled: false }
    },
  }
  return ctx as unknown as ExtensionCommandContext
}

function fakeUi(
  onCall: (method: string, notifyType?: "info" | "warning" | "error") => void,
): FakeExtensionUi {
  return {
    setHeader: (_factory) => onCall("setHeader"),
    setFooter: (_factory) => onCall("setFooter"),
    setStatus: (_key, _text) => onCall("setStatus"),
    setWidget: (_key, _content, _options) => onCall("setWidget"),
    setWorkingIndicator: (_options) => onCall("setWorkingIndicator"),
    setTitle: (_title) => onCall("setTitle"),
    notify: (_message, type) => onCall("notify", type),
  }
}

type FakeExtensionContext = Pick<ExtensionContext, "sessionManager"> & {
  ui: FakeExtensionUi
}

interface FakeAutocompleteItem {
  value: string
  label: string
}

interface FakeAutocompleteProvider {
  getSuggestions(
    lines: string[],
    cursorLine: number,
    cursorCol: number,
    options: never,
  ): Promise<unknown>
  applyCompletion(
    lines: string[],
    cursorLine: number,
    cursorCol: number,
    item: FakeAutocompleteItem,
    prefix: string,
  ): unknown
  shouldTriggerFileCompletion(
    lines: string[],
    cursorLine: number,
    cursorCol: number,
  ): boolean
}

type FakeExtensionUi = Pick<ExtensionUIContext, "setFooter" | "setHeader" | "setStatus" | "setWidget" | "setWorkingIndicator" | "setTitle" | "notify">

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
}
