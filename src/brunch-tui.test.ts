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
  formatChromeWidgetLines,
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

  it("passes coordinator chrome state to the persistent chrome widget", async () => {
    const lines = formatChromeWidgetLines({
      cwd: "/tmp/project",
      spec: { id: "spec-1", title: "Spec One" },
      phase: "elicitation",
      chatMode: "responding-to-elicitation",
    })

    expect(lines.join("\n")).toContain("cwd: /tmp/project")
    expect(lines.join("\n")).toContain("spec: Spec One")
    expect(lines.join("\n")).toContain("phase: elicitation")
    expect(lines.join("\n")).toContain("chat: responding-to-elicitation")
  })

  it("binds replacement sessions through internal session boundary events", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "brunch-tui-"))
    const manager = SessionManager.create(cwd, join(cwd, ".brunch", "sessions"))
    const boundSessionIds: string[] = []
    const widgets = new Map<string, string[]>()
    const ui: FakeExtensionUi = {
      setWidget: (key: string, content: unknown) => {
        if (isStringArray(content)) {
          widgets.set(key, content)
        }
      },
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
        setWidget: (_key: string, _content: unknown) => {},
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

type FakeExtensionContext = Pick<ExtensionContext, "sessionManager"> & {
  ui: FakeExtensionUi
}

type FakeExtensionUi = Pick<ExtensionUIContext, "setWidget" | "setTitle" | "notify">

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
}
