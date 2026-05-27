import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { SessionManager } from "@earendil-works/pi-coding-agent"

import {
  BRUNCH_AGENT_RUNTIME_STATE_CUSTOM_TYPE,
  DEFAULT_BRUNCH_AGENT_STATE,
  appendBrunchAgentRuntimeInit,
  appendBrunchAgentRuntimeSwitch,
  projectBrunchAgentState,
  registerBrunchOperationalModePolicy,
  type BrunchAgentState,
  type BrunchAgentStateEntryData,
} from "./operational-mode.js"

function runtimeEntry(
  state: BrunchAgentState,
  data: Record<string, unknown> = {},
) {
  return {
    type: "custom",
    customType: BRUNCH_AGENT_RUNTIME_STATE_CUSTOM_TYPE,
    data: {
      schemaVersion: 1,
      reason: "switch",
      state,
      source: "user",
      ...data,
    },
  }
}

class FakeRuntimeStateSessionManager {
  entries: Array<{
    type: "custom"
    customType: string
    data: BrunchAgentStateEntryData
  }> = []

  getEntries() {
    return this.entries
  }

  appendCustomEntry(customType: string, data: BrunchAgentStateEntryData) {
    this.entries.push({ type: "custom", customType, data })
    return `entry-${this.entries.length}`
  }
}

describe("Brunch agent runtime-state projection", () => {
  it("projects the deterministic elicit/elicitor default when no runtime entries exist", () => {
    expect(projectBrunchAgentState([])).toMatchObject({
      ...DEFAULT_BRUNCH_AGENT_STATE,
      operationalModeDefinition: {
        id: "elicit",
        defaultRole: "elicitor",
        toolPolicyId: "elicit-read-only",
      },
      agentRoleDefinition: {
        id: "elicitor",
        operationalMode: "elicit",
        defaultStrategy: DEFAULT_BRUNCH_AGENT_STATE.agentStrategy,
        defaultLens: DEFAULT_BRUNCH_AGENT_STATE.agentLens,
      },
    })
  })

  it("uses the last valid runtime-state snapshot without mutating earlier transcript entries", () => {
    const first = runtimeEntry(DEFAULT_BRUNCH_AGENT_STATE)
    const latestState: BrunchAgentState = {
      schemaVersion: 1,
      operationalMode: "elicit",
      agentRole: "elicitor",
      agentStrategy: "disambiguate-via-examples",
      agentLens: "disambiguate-via-examples",
    }
    const latest = runtimeEntry(latestState)

    expect(projectBrunchAgentState([first, latest])).toMatchObject(latestState)
    expect(first.data.state).toEqual(DEFAULT_BRUNCH_AGENT_STATE)
  })

  it("ignores malformed and invalid runtime entries instead of guessing", () => {
    const valid = runtimeEntry(DEFAULT_BRUNCH_AGENT_STATE)
    const invalidCombination = runtimeEntry({
      schemaVersion: 1,
      operationalMode: "elicit",
      agentRole: "elicitor",
      agentStrategy: "not-a-strategy",
      agentLens: "step-by-step",
    } as unknown as BrunchAgentState)
    const malformed = {
      type: "custom",
      customType: BRUNCH_AGENT_RUNTIME_STATE_CUSTOM_TYPE,
      data: { schemaVersion: 1, reason: "switch", source: "user" },
    }

    expect(
      projectBrunchAgentState([valid, invalidCombination, malformed]),
    ).toMatchObject(DEFAULT_BRUNCH_AGENT_STATE)
  })

  it("applies resolved elicit state to active tools, prompt, and blockers", async () => {
    const latestState: BrunchAgentState = {
      schemaVersion: 1,
      operationalMode: "elicit",
      agentRole: "elicitor",
      agentStrategy: "disambiguate-via-examples",
      agentLens: "disambiguate-via-examples",
    }
    const events: Record<string, (event: never, ctx?: never) => unknown> = {}
    const activeTools: string[][] = []

    registerBrunchOperationalModePolicy({
      registerTool: (_tool: { name: string }) => {},
      getAllTools: () =>
        ["read", "grep", "find", "ls", "bash", "edit", "write"].map((name) => ({
          name,
        })),
      setActiveTools: (tools: string[]) => activeTools.push(tools),
      on: (event: string, handler: (event: never, ctx?: never) => unknown) => {
        events[event] = handler
      },
    } as never)

    const promptResult = await Promise.resolve(
      events.before_agent_start?.({ systemPrompt: "base" } as never, {
        sessionManager: {
          getEntries: () => [runtimeEntry(latestState)],
        },
      } as never),
    )

    expect(activeTools).toEqual([["read", "grep", "find", "ls"]])
    expect(promptResult).toMatchObject({
      systemPrompt: expect.stringContaining("Operational mode: elicit."),
    })
    expect(promptResult).toMatchObject({
      systemPrompt: expect.stringContaining("Agent role: elicitor."),
    })
    expect(promptResult).toMatchObject({
      systemPrompt: expect.stringContaining(
        "Agent strategy: disambiguate-via-examples.",
      ),
    })
    expect(promptResult).toMatchObject({
      systemPrompt: expect.stringContaining(
        "Brunch exposes only read-only tools: read, grep, find, ls.",
      ),
    })
    await expect(
      Promise.resolve(events.tool_call?.({ toolName: "write" } as never)),
    ).resolves.toMatchObject({
      block: true,
      reason: expect.stringContaining('Brunch tool policy blocks "write"'),
    })
    expect(events.user_bash?.({ command: "rm -rf ." } as never)).toMatchObject({
      result: {
        exitCode: 1,
        output: "Brunch tool policy blocks shell commands: rm -rf .",
      },
    })
  })

  it("appends init only when the transcript has no valid runtime state", () => {
    const manager = new FakeRuntimeStateSessionManager()

    expect(appendBrunchAgentRuntimeInit(manager)).toBe("entry-1")
    expect(appendBrunchAgentRuntimeInit(manager)).toBeUndefined()
    expect(manager.entries).toHaveLength(1)
    expect(manager.entries[0]?.data).toEqual({
      schemaVersion: 1,
      reason: "init",
      state: DEFAULT_BRUNCH_AGENT_STATE,
      source: "extension",
    })
  })

  it("appends validated runtime switches as full state snapshots", () => {
    const manager = new FakeRuntimeStateSessionManager()
    appendBrunchAgentRuntimeInit(manager)
    const latestState: BrunchAgentState = {
      schemaVersion: 1,
      operationalMode: "elicit",
      agentRole: "elicitor",
      agentStrategy: "disambiguate-via-examples",
      agentLens: "disambiguate-via-examples",
    }

    expect(appendBrunchAgentRuntimeSwitch(manager, latestState, "user")).toBe(
      "entry-2",
    )

    expect(manager.entries[1]?.data).toEqual({
      schemaVersion: 1,
      reason: "switch",
      state: latestState,
      previous: DEFAULT_BRUNCH_AGENT_STATE,
      source: "user",
    })
    expect(projectBrunchAgentState(manager.getEntries())).toMatchObject(
      latestState,
    )
  })

  it("rejects invalid runtime switch combinations before appending", () => {
    const manager = new FakeRuntimeStateSessionManager()

    expect(() =>
      appendBrunchAgentRuntimeSwitch(manager, {
        schemaVersion: 1,
        operationalMode: "elicit",
        agentRole: "elicitor",
        agentStrategy: "not-a-strategy",
        agentLens: "step-by-step",
      } as unknown as BrunchAgentState),
    ).toThrow("Invalid BrunchAgentState runtime selection.")
    expect(manager.entries).toEqual([])
  })

  it("appends runtime init from the extension session-start hook", async () => {
    const manager = new FakeRuntimeStateSessionManager()
    const events: Record<string, (event: never, ctx?: never) => unknown> = {}

    registerBrunchOperationalModePolicy({
      registerTool: (_tool: { name: string }) => {},
      getAllTools: () => ["read"].map((name) => ({ name })),
      setActiveTools: (_tools: string[]) => {},
      on: (event: string, handler: (event: never, ctx?: never) => unknown) => {
        events[event] = handler
      },
    } as never)

    await events.session_start?.({} as never, {
      sessionManager: manager,
    } as never)

    expect(manager.entries[0]?.data.reason).toBe("init")
  })

  it("reprojects runtime-state snapshots after Pi JSONL reload", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "brunch-agent-state-"))
    const sessionDir = join(cwd, ".brunch", "sessions")
    const manager = SessionManager.create(cwd, sessionDir)
    const latestState: BrunchAgentState = {
      schemaVersion: 1,
      operationalMode: "elicit",
      agentRole: "elicitor",
      agentStrategy: "disambiguate-via-examples",
      agentLens: "disambiguate-via-examples",
    }

    manager.appendCustomEntry(BRUNCH_AGENT_RUNTIME_STATE_CUSTOM_TYPE, {
      schemaVersion: 1,
      reason: "init",
      state: DEFAULT_BRUNCH_AGENT_STATE,
      source: "extension",
    })
    manager.appendMessage({
      role: "assistant",
      content: [{ type: "text", text: "runtime initialized" }],
      api: "test",
      provider: "test",
      model: "test",
      usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          total: 0,
        },
      },
      stopReason: "stop",
      timestamp: Date.now(),
    } as never)
    manager.appendCustomEntry(BRUNCH_AGENT_RUNTIME_STATE_CUSTOM_TYPE, {
      schemaVersion: 1,
      reason: "switch",
      state: latestState,
      previous: DEFAULT_BRUNCH_AGENT_STATE,
      source: "user",
    })

    const reloaded = SessionManager.open(manager.getSessionFile()!, sessionDir)

    expect(projectBrunchAgentState(reloaded.getEntries())).toMatchObject(
      latestState,
    )
  })
})
