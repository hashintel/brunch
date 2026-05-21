import { mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import { SessionManager } from "@earendil-works/pi-coding-agent"

import {
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
