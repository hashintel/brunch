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
  chromeStateForWorkspace,
  createBrunchChromeExtension,
  formatBrunchChromeHeaderLines,
  formatBrunchStatus,
  formatChromeWidgetLines,
  renderBrunchChrome,
  runBrunchWorkspaceCommand,
} from "./pi-extensions/brunch/index.js"
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
      runWorkspaceSwitchPreflight: async () => {
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
      runWorkspaceSwitchPreflight: async () => {
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
    first.session.manager.appendMessage({
      role: "user",
      content: "stale transcript",
    })
    const firstContent = await readFile(first.session.file, "utf8")
    let launchedSessionFile: string | undefined

    await runBrunchTui({
      cwd,
      coordinator,
      runWorkspaceSwitchPreflight: async () => ({
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

  it("passes activated session state into chrome instead of fabricating unbound", async () => {
    const state = chromeStateForWorkspace(
      readyWorkspace("/tmp/project", "session-real"),
    )

    expect(formatBrunchChromeHeaderLines(state).join("\n")).toContain(
      "session-real",
    )
  })

  it("formats Brunch chrome from one product-state snapshot", async () => {
    const state = {
      cwd: "/tmp/project",
      spec: { id: "spec-1", title: "Spec One" },
      session: { id: "session-1", label: "Interview #1" },
      phase: "elicitation" as const,
      stage: "observer-review" as const,
      chatMode: "responding-to-elicitation" as const,
      activeLens: "problem-framing",
      coherenceVerdict: "needs_review" as const,
      observerStatus: "running" as const,
      reviewerStatus: "queued" as const,
      reconcilerStatus: "idle" as const,
      reconciliationNeedCount: 3,
      latestEstablishmentOfferSummary:
        "Recommended lens: problem-framing; missing constraints.",
    }

    expect(formatBrunchChromeHeaderLines(state).join("\n")).toContain(
      "Spec One",
    )
    expect(formatChromeWidgetLines(state).join("\n")).toContain(
      "lens: problem-framing",
    )
    expect(formatBrunchStatus(state)).toBe(
      "Brunch · elicitation · needs_review · needs 3",
    )
    expect(formatChromeWidgetLines(state).join("\n")).toContain(
      "offer: Recommended lens: problem-framing; missing constraints.",
    )
  })

  it("renders Brunch chrome through one wrapper over Pi UI calls", async () => {
    const calls: FakeUiCall[] = []
    const ui: FakeExtensionUi = {
      setHeader: (...args: unknown[]) =>
        calls.push({ method: "setHeader", args }),
      setFooter: (...args: unknown[]) =>
        calls.push({ method: "setFooter", args }),
      setStatus: (...args: unknown[]) =>
        calls.push({ method: "setStatus", args }),
      setWidget: (...args: unknown[]) =>
        calls.push({ method: "setWidget", args }),
      setWorkingIndicator: (...args: unknown[]) =>
        calls.push({ method: "setWorkingIndicator", args }),
      setTitle: (...args: unknown[]) =>
        calls.push({ method: "setTitle", args }),
      notify: (_message: string, _type?: "info" | "warning" | "error") => {},
    }

    renderBrunchChrome(ui, {
      cwd: "/tmp/project",
      spec: { id: "spec-1", title: "Spec One" },
      session: { id: "session-1" },
      phase: "elicitation",
      stage: "idle",
      chatMode: "responding-to-elicitation",
      activeLens: null,
      coherenceVerdict: "coherent",
      observerStatus: "idle",
      reviewerStatus: "idle",
      reconcilerStatus: "idle",
      reconciliationNeedCount: 0,
      latestEstablishmentOfferSummary: null,
    })

    expect(calls.map((call) => call.method)).toEqual([
      "setHeader",
      "setFooter",
      "setStatus",
      "setWidget",
      "setWorkingIndicator",
      "setTitle",
    ])
    expect(calls.find((call) => call.method === "setFooter")?.args).toEqual([
      undefined,
    ])
    expect(calls.find((call) => call.method === "setStatus")?.args).toEqual([
      "brunch.chrome",
      "Brunch · elicitation · coherent · needs 0",
    ])
    expect(calls.find((call) => call.method === "setWidget")?.args).toEqual([
      "brunch.chrome",
      [
        "cwd: /tmp/project",
        "chat mode: responding-to-elicitation  stage: idle",
        "lens: none",
        "workers: observer idle · reviewer idle · reconciler idle",
      ],
      { placement: "aboveEditor" },
    ])
    expect(
      calls.find((call) => call.method === "setWorkingIndicator")?.args,
    ).toEqual([undefined])
    expect(calls.find((call) => call.method === "setTitle")?.args).toEqual([
      "brunch — Spec One",
    ])
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
    let sessionStart: ((
      event: unknown,
      ctx: FakeExtensionContext,
    ) => Promise<void>) | undefined
    let beforeAgentStart: ((
      event: unknown,
      ctx: FakeExtensionContext,
    ) => Promise<void>) | undefined
    let messageStart: ((
      event: unknown,
      ctx: FakeExtensionContext,
    ) => Promise<void>) | undefined

    createBrunchChromeExtension(
      chromeStateForWorkspace(readyWorkspace(cwd, manager.getSessionId())),
      (sessionManager) => {
        boundSessionIds.push(sessionManager.getSessionId())
      },
    )({
      on: (event: string, handler: typeof sessionStart) => {
        if (event === "session_start") {
          sessionStart = handler
        }
        if (event === "before_agent_start") {
          beforeAgentStart = handler
        }
        if (event === "message_start") {
          messageStart = handler
        }
      },
    } as never)

    await sessionStart?.({}, ctx)
    await beforeAgentStart?.({}, ctx)
    await messageStart?.(
      { type: "message_start", message: { role: "user" } },
      ctx,
    )
    await messageStart?.(
      { type: "message_start", message: { role: "assistant" } },
      ctx,
    )

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

  it("registers a Brunch-owned workspace switch command", async () => {
    const commands =
      new Map<string, Omit<RegisteredCommand, "name" | "sourceInfo">>()

    createBrunchChromeExtension(
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
      registerCommand: (name, options) => commands.set(name, options),
    } as never)

    expect(commands.get(BRUNCH_WORKSPACE_COMMAND)?.description).toBe(
      "Switch Brunch spec/session workspace",
    )
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
      "replacement:setHeader",
      "replacement:setFooter",
      "replacement:setStatus",
      "replacement:setWidget",
      "replacement:setWorkingIndicator",
      "replacement:setTitle",
      "replacement:notify",
    ])
    expect(customOptions).toEqual([])
  })

  it("leaves the current session untouched when workspace switch is cancelled", async () => {
    const events: string[] = []
    const ctx = fakeCommandContext({
      currentSessionFile: "/sessions/session-old.jsonl",
      decision: { action: "cancel" },
      onEvent: (event) => events.push(event),
    })

    await runBrunchWorkspaceCommand(ctx, {
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

    await runBrunchWorkspaceCommand(ctx, {
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

    createBrunchChromeExtension(
      chromeStateForWorkspace(readyWorkspace(cwd, manager.getSessionId())),
    )({
      on: (
        event: string,
        handler: (event: unknown, ctx: FakeExtensionContext) => unknown,
      ) => {
        handlers.set(event, handler)
      },
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

function fakeCommandContext(options: {
  currentSessionFile: string
  decision: Awaited<ReturnType<ExtensionUIContext["custom"]>>
  onCustomOptions?: (customOptions: unknown) => void
  onEvent: (event: string) => void
  replacementUi?: FakeExtensionUi
}): ExtensionCommandContext {
  const ui = fakeUi((method, type) => {
    if (method === "notify") {
      options.onEvent(`notify:${type}`)
    }
  })
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
        return options.decision
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
      } as ExtensionCommandContext)
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

interface FakeUiCall {
  method: string
  args: unknown[]
}

type FakeExtensionContext = Pick<ExtensionContext, "sessionManager"> & {
  ui: FakeExtensionUi
}

type FakeExtensionUi = Pick<ExtensionUIContext, "setFooter" | "setHeader" | "setStatus" | "setWidget" | "setWorkingIndicator" | "setTitle" | "notify">

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
}
