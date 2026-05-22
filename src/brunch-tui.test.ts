import { mkdtemp, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  SessionManager,
  type ExtensionContext,
  type ExtensionUIContext,
} from "@earendil-works/pi-coding-agent"

import {
  createBrunchChromeExtension,
  formatBrunchChromeFooterLines,
  formatBrunchChromeHeaderLines,
  formatChromeWidgetLines,
  renderBrunchChrome,
  runBrunchTui,
} from "./brunch-tui.js"
import { verifyWorkspaceSessionStores } from "./workspace-session-coordinator.js"

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
      streaming: true,
    }

    expect(formatBrunchChromeHeaderLines(state).join("\n")).toContain(
      "Spec One",
    )
    expect(formatChromeWidgetLines(state).join("\n")).toContain(
      "lens: problem-framing",
    )
    expect(formatChromeWidgetLines(state).join("\n")).toContain("needs: 3")
    expect(formatBrunchChromeFooterLines(state).join("\n")).toContain(
      "observer: running",
    )
    expect(formatBrunchChromeFooterLines(state).join("\n")).toContain(
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
      streaming: false,
    })

    expect(calls.map((call) => call.method)).toEqual([
      "setHeader",
      "setFooter",
      "setStatus",
      "setWidget",
      "setWorkingIndicator",
      "setTitle",
    ])
    expect(calls.find((call) => call.method === "setStatus")?.args).toEqual([
      "brunch.chrome",
      "Brunch · elicitation · no active lens · coherent · needs 0",
    ])
    expect(calls.find((call) => call.method === "setWidget")?.args).toEqual([
      "brunch.chrome",
      [
        "cwd: /tmp/project",
        "spec: Spec One  session: session-1  stage: idle",
        "lens: none  coherence: coherent  needs: 0",
        "observer: idle  reviewer: idle  reconciler: idle",
      ],
      { placement: "aboveEditor" },
    ])
  })

  it("binds replacement sessions through internal session boundary events", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "brunch-tui-"))
    const manager = SessionManager.create(cwd, join(cwd, ".brunch", "sessions"))
    const boundSessionIds: string[] = []
    const widgets = new Map<string, string[]>()
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
      setTitle: (_title: string) => {},
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
      {
        cwd,
        spec: { id: "spec-1", title: "Spec One" },
        phase: "elicitation",
        chatMode: "responding-to-elicitation",
      },
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
    expect(widgets.get("brunch.chrome")?.join("\n")).toContain("Spec One")
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

    createBrunchChromeExtension({
      cwd,
      spec: { id: "spec-1", title: "Spec One" },
      phase: "elicitation",
      chatMode: "responding-to-elicitation",
    })({
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

  it("keeps session creation and binding out of the TUI boot adapter", async () => {
    const source = await readFile(
      new URL("./brunch-tui.ts", import.meta.url),
      "utf8",
    )

    expect(source).not.toContain("SessionManager.create")
    expect(source).not.toContain("appendCustomEntry")
    expect(source).not.toContain("brunch.session_binding")
  })
})

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
