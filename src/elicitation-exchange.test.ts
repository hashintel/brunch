import { mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import { SessionManager } from "@earendil-works/pi-coding-agent"

import {
  loadActiveBranchTranscriptEntries,
  loadJsonlTranscriptEntries,
  projectElicitationExchanges,
} from "./elicitation-exchange.js"

const assistant = {
  id: "a1",
  type: "message",
  message: { role: "assistant", content: "Pick one" },
}
const structuredPrompt = {
  id: "p1",
  type: "custom",
  customType: "brunch.elicitation_prompt",
  data: { choices: ["A", "B"] },
}
const toolResult = {
  id: "t1",
  type: "message",
  message: {
    role: "toolResult",
    toolCallId: "call-1",
    toolName: "read",
    content: [{ type: "text", text: "tool output" }],
    isError: false,
  },
}
const user = {
  id: "u1",
  type: "message",
  message: { role: "user", content: "A" },
}
const structuredResponse = {
  id: "r1",
  type: "custom",
  customType: "brunch.elicitation_response",
  data: { choice: "A" },
}

describe("elicitation exchange projection", () => {
  it("projects assistant prompt spans and user response spans with stable ranges", () => {
    const exchanges = projectElicitationExchanges([
      { id: "s1", type: "session" },
      assistant,
      structuredPrompt,
      user,
      {
        id: "a2",
        type: "message",
        message: { role: "assistant", content: "Why?" },
      },
      {
        id: "u2",
        type: "message",
        message: { role: "user", content: "Because" },
      },
    ])

    expect(exchanges).toEqual({
      status: "ready",
      exchanges: [
        {
          promptRange: { start: "a1", end: "p1" },
          responseRange: { start: "u1", end: "u1" },
          promptEntryIds: ["a1", "p1"],
          responseEntryIds: ["u1"],
        },
        {
          promptRange: { start: "a2", end: "a2" },
          responseRange: { start: "u2", end: "u2" },
          promptEntryIds: ["a2"],
          responseEntryIds: ["u2"],
        },
      ],
      openPrompt: null,
    })
  })

  it("includes structured response entries on the response side", () => {
    const projection = projectElicitationExchanges([
      assistant,
      user,
      structuredResponse,
    ])

    expect(projection.exchanges[0]?.responseEntryIds).toEqual(["u1", "r1"])
    expect(projection.exchanges[0]?.responseRange).toEqual({
      start: "u1",
      end: "r1",
    })
  })

  it("includes Pi toolResult messages on the prompt side", () => {
    const projection = projectElicitationExchanges([
      assistant,
      toolResult,
      user,
    ])

    expect(projection.exchanges[0]?.promptEntryIds).toEqual(["a1", "t1"])
    expect(projection.exchanges[0]?.promptRange).toEqual({
      start: "a1",
      end: "t1",
    })
  })

  it("returns an explicit empty/open shape for incomplete transcripts", () => {
    expect(projectElicitationExchanges([])).toEqual({
      status: "empty",
      exchanges: [],
      openPrompt: null,
    })

    expect(projectElicitationExchanges([assistant])).toEqual({
      status: "open_prompt",
      exchanges: [],
      openPrompt: {
        promptRange: { start: "a1", end: "a1" },
        promptEntryIds: ["a1"],
      },
    })
  })

  it("ignores orphan user responses before a prompt", () => {
    const projection = projectElicitationExchanges([
      user,
      {
        id: "a2",
        type: "message",
        message: { role: "assistant", content: "Later prompt" },
      },
    ])

    expect(projection).toEqual({
      status: "open_prompt",
      exchanges: [],
      openPrompt: {
        promptRange: { start: "a2", end: "a2" },
        promptEntryIds: ["a2"],
      },
    })
  })

  it("projects a real SessionManager JSONL assistant/user transcript", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "brunch-pi-jsonl-"))
    const manager = SessionManager.create(cwd, join(cwd, ".brunch/sessions"))
    manager.appendMessage({ role: "assistant", content: "Question" })
    manager.appendMessage({ role: "user", content: "Answer" })

    const entries = await loadJsonlTranscriptEntries(manager.getSessionFile()!)
    const projection = projectElicitationExchanges(entries)

    expect(projection.status).toBe("ready")
    expect(projection.exchanges).toHaveLength(1)
    expect(projection.exchanges[0]?.promptEntryIds[0]).toEqual(
      expect.any(String),
    )
    expect(projection.exchanges[0]?.responseEntryIds[0]).toEqual(
      expect.any(String),
    )
  })

  it("jsonl active branch projection excludes abandoned exchange", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "brunch-pi-branch-"))
    const manager = SessionManager.create(cwd, join(cwd, ".brunch/sessions"))
    const abandonedPromptId = manager.appendMessage({
      role: "assistant",
      content: "Abandoned prompt",
    })
    const abandonedResponseId = manager.appendMessage({
      role: "user",
      content: "Abandoned answer",
    })
    manager.resetLeaf()
    const activePromptId = manager.appendMessage({
      role: "assistant",
      content: "Active prompt",
    })
    const activeResponseId = manager.appendMessage({
      role: "user",
      content: "Active answer",
    })

    const fileLinearProjection = projectElicitationExchanges(
      await loadJsonlTranscriptEntries(manager.getSessionFile()!),
    )
    const activeBranchProjection = projectElicitationExchanges(
      loadActiveBranchTranscriptEntries(manager.getSessionFile()!, { cwd }),
    )

    expect(
      fileLinearProjection.exchanges.map(
        (exchange) => exchange.responseEntryIds,
      ),
    ).toEqual([[abandonedResponseId], [activeResponseId]])
    expect(activeBranchProjection.exchanges).toHaveLength(1)
    expect(activeBranchProjection.exchanges[0]?.promptEntryIds).toEqual([
      activePromptId,
    ])
    expect(activeBranchProjection.exchanges[0]?.responseEntryIds).toEqual([
      activeResponseId,
    ])
    expect(
      activeBranchProjection.exchanges.some((exchange) =>
        exchange.promptEntryIds.includes(abandonedPromptId),
      ),
    ).toBe(false)
  })

  it("jsonl active branch projection preserves selected exchange", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "brunch-pi-branch-"))
    const manager = SessionManager.create(cwd, join(cwd, ".brunch/sessions"))
    const sharedPromptId = manager.appendMessage({
      role: "assistant",
      content: "Choose a path",
    })
    manager.appendMessage({ role: "user", content: "Old path" })
    manager.branch(sharedPromptId)
    const selectedResponseId = manager.appendMessage({
      role: "user",
      content: "Selected path",
    })

    const activeBranchProjection = projectElicitationExchanges(
      loadActiveBranchTranscriptEntries(manager.getSessionFile()!, { cwd }),
    )

    expect(activeBranchProjection).toMatchObject({
      status: "ready",
      exchanges: [
        {
          promptRange: { start: sharedPromptId, end: sharedPromptId },
          responseRange: { start: selectedResponseId, end: selectedResponseId },
          promptEntryIds: [sharedPromptId],
          responseEntryIds: [selectedResponseId],
        },
      ],
      openPrompt: null,
    })
  })

  it("jsonl active branch custom messages enter context only once", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "brunch-pi-branch-"))
    const manager = SessionManager.create(cwd, join(cwd, ".brunch/sessions"))
    const abandonedPromptId = manager.appendCustomMessageEntry(
      "brunch.elicitation_prompt",
      "Abandoned custom prompt",
      true,
      { promptId: "abandoned" },
    )
    manager.appendMessage({ role: "user", content: "Abandoned answer" })
    manager.resetLeaf()
    const activePromptId = manager.appendCustomMessageEntry(
      "brunch.elicitation_prompt",
      "Active custom prompt",
      true,
      { promptId: "active" },
    )
    manager.appendMessage({ role: "user", content: "Active answer" })
    manager.appendMessage({
      role: "assistant",
      content: "Persistence sentinel",
    })

    const reloaded = SessionManager.open(
      manager.getSessionFile()!,
      undefined,
      cwd,
    )
    const activeBranch = loadActiveBranchTranscriptEntries(
      manager.getSessionFile()!,
      {
        cwd,
      },
    )
    const projection = projectElicitationExchanges(activeBranch)
    const contextMessages = reloaded
      .buildSessionContext()
      .messages.filter((message) => message.role === "custom")

    expect(projection.exchanges[0]?.promptEntryIds).toEqual([activePromptId])
    expect(projection.exchanges[0]?.promptEntryIds).not.toContain(
      abandonedPromptId,
    )
    expect(contextMessages).toHaveLength(1)
    expect(contextMessages[0]).toMatchObject({
      role: "custom",
      customType: "brunch.elicitation_prompt",
      content: "Active custom prompt",
    })
  })

  it("loads newline-delimited Pi transcript entries from disk", async () => {
    const dir = await mkdtemp(join(tmpdir(), "brunch-jsonl-"))
    const file = join(dir, "session.jsonl")
    await writeFile(
      file,
      `${JSON.stringify(assistant)}\n${JSON.stringify(user)}\n`,
    )

    const entries = await loadJsonlTranscriptEntries(file)

    expect(projectElicitationExchanges(entries).exchanges).toHaveLength(1)
  })
})
