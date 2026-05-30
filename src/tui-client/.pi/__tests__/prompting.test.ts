import { readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import { composeBrunchPrompt } from "../context/compose-brunch-prompt.js"
import {
  DEFAULT_BRUNCH_AGENT_STATE,
  type BrunchAgentState,
} from "../extensions/operational-mode.js"
import { registerBrunchPrompting } from "../extensions/prompting.js"
import { createBrunchPiExtensionShell } from "../../pi-extension-shell.js"

function runtimeEntry(state: BrunchAgentState) {
  return {
    type: "custom",
    customType: "brunch.agent_runtime_state",
    data: {
      schemaVersion: 1,
      reason: "switch",
      state,
      source: "user",
    },
  }
}

describe("Brunch prompt-pack topology", () => {
  it("composes deterministic private prompt packs in stable order", () => {
    const result = composeBrunchPrompt({
      operationalMode: "elicit",
      agentRole: "elicitor",
      agentStrategy: "step-by-step",
      agentLens: "step-by-step",
      activeTools: ["read", "grep", "present_options"],
    })

    expect(result.packIds).toEqual([
      "brunch-base",
      "elicit",
      "elicitor",
      "structured-exchange",
      "candidate-proposals",
      "capture-analysis",
    ])
    expect(result.prompt).toContain("[Brunch agent state]")
    expect(result.prompt).toContain("Operational mode: elicit.")
    expect(result.prompt).toContain("Agent role: elicitor.")
    expect(result.prompt).toContain(
      "Brunch exposes only elicit-safe tools: read, grep, present_options.",
    )
    expect(result.prompt.indexOf("# Brunch base")).toBeLessThan(
      result.prompt.indexOf("# Operational mode: elicit"),
    )
    expect(result.prompt.indexOf("# Structured exchanges")).toBeLessThan(
      result.prompt.indexOf("# Candidate proposals"),
    )
    expect(result.prompt).toContain(
      "Request outcomes are an exactly-one property-presence union",
    )
    expect(result.prompt).toContain(
      "`graph_refs` are per-candidate and strictly existing graph node references",
    )
    expect(result.prompt).toContain(
      "Capture is transcript-native analysis, not graph mutation.",
    )
    expect(result.prompt).not.toContain("CommandExecutor result shapes")
  })

  it("appends composed Brunch prompting from runtime-state projection", async () => {
    const latestState: BrunchAgentState = {
      ...DEFAULT_BRUNCH_AGENT_STATE,
      agentStrategy: "disambiguate-via-examples",
      agentLens: "disambiguate-via-examples",
    }
    const events: Record<string, (event: never, ctx?: never) => unknown> = {}

    registerBrunchPrompting({
      on: (event: string, handler: (event: never, ctx?: never) => unknown) => {
        events[event] = handler
      },
      getAllTools: () =>
        ["read", "grep", "bash", "write", "present_options"].map((name) => ({
          name,
        })),
    } as never)

    const result = await Promise.resolve(
      events.before_agent_start?.({ systemPrompt: "base" } as never, {
        sessionManager: {
          getEntries: () => [runtimeEntry(latestState)],
        },
      } as never),
    )

    expect(result).toMatchObject({
      systemPrompt: expect.stringContaining("base\n\n[Brunch agent state]"),
    })
    expect(result).toMatchObject({
      systemPrompt: expect.stringContaining(
        "Agent strategy: disambiguate-via-examples.",
      ),
    })
    expect(result).toMatchObject({
      systemPrompt: expect.stringContaining(
        "Brunch exposes only elicit-safe tools: read, grep, present_options.",
      ),
    })
  })

  it("is registered by the explicit shell after operational-mode policy", async () => {
    const eventNames: string[] = []

    await createBrunchPiExtensionShell(
      {
        cwd: "/tmp/brunch",
        chatMode: "interactive",
        phase: "ready",
        spec: { id: "spec-1", title: "Spec" },
        session: { id: "session-1", label: "Session" },
      },
      undefined,
      {
        coordinator: {} as never,
        graphMentionSource: { listMentionCandidates: () => [] },
      },
    )({
      on: (eventName: string) => eventNames.push(eventName),
      registerTool() {},
      registerCommand() {},
      registerShortcut() {},
      registerMessageRenderer() {},
      sendMessage() {},
      getAllTools: () => ["read", "bash", "write"].map((name) => ({ name })),
      setActiveTools() {},
    } as never)

    const operationalToolPolicyIndex = eventNames.indexOf("tool_call")
    const userBashPolicyIndex = eventNames.indexOf("user_bash")
    const promptingIndex = eventNames.indexOf(
      "before_agent_start",
      userBashPolicyIndex + 1,
    )
    const nextBeforeAgentStartIndex = eventNames.indexOf(
      "before_agent_start",
      promptingIndex + 1,
    )

    expect(operationalToolPolicyIndex).toBeGreaterThan(-1)
    expect(userBashPolicyIndex).toBeGreaterThan(operationalToolPolicyIndex)
    expect(promptingIndex).toBeGreaterThan(userBashPolicyIndex)
    expect(promptingIndex).toBeLessThan(nextBeforeAgentStartIndex)
  })

  it("does not expose private prompt packs through Pi resource discovery", async () => {
    const [promptingSource, composerSource] = await Promise.all([
      readFile(
        join(projectRoot(), "src/tui-client/.pi/extensions/prompting.ts"),
        "utf8",
      ),
      readFile(
        join(
          projectRoot(),
          "src/tui-client/.pi/context/compose-brunch-prompt.ts",
        ),
        "utf8",
      ),
    ])

    expect(promptingSource).not.toContain("resources_discover")
    expect(promptingSource).not.toContain("promptPaths")
    expect(composerSource).not.toContain("resources_discover")
    expect(composerSource).not.toContain("promptPaths")
  })
})

function projectRoot(): string {
  return dirname(
    dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url))))),
  )
}
