import { mkdtemp, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { SessionManager } from "@earendil-works/pi-coding-agent"

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
    const ui = new FakeExtensionUi()
    let sessionStart: ((
      event: unknown,
      ctx: FakeSessionStartContext,
    ) => Promise<void>) | undefined
    let beforeAgentStart: ((
      event: unknown,
      ctx: FakeSessionStartContext,
    ) => Promise<void>) | undefined
    let messageStart: ((
      event: unknown,
      ctx: FakeSessionStartContext,
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

    await sessionStart?.({}, { sessionManager: manager, ui })
    await beforeAgentStart?.({}, { sessionManager: manager, ui })
    await messageStart?.({ type: "message_start", message: { role: "user" } }, {
      sessionManager: manager,
      ui,
    })
    await messageStart?.(
      { type: "message_start", message: { role: "assistant" } },
      { sessionManager: manager, ui },
    )

    expect(boundSessionIds).toEqual([
      manager.getSessionId(),
      manager.getSessionId(),
      manager.getSessionId(),
    ])
    expect(ui.widgets.get("brunch.chrome")?.join("\n")).toContain("Spec One")
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

interface FakeSessionStartContext {
  sessionManager: SessionManager
  ui: FakeExtensionUi
}

class FakeExtensionUi {
  readonly widgets = new Map<string, string[]>()

  setWidget(key: string, content: string[]): void {
    this.widgets.set(key, content)
  }

  setTitle(_title: string): void {}
}
