import { mkdtempSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  SessionManager,
  type CustomMessageEntry,
  type SessionEntry,
  type SessionMessageEntry,
} from "@earendil-works/pi-coding-agent"

import {
  loadLinearElicitationExchangeProjection,
  type ElicitationExchangeProjection,
} from "./elicitation-exchange.js"
import { isSessionBindingEntry } from "./session-binding.js"

const M1_FIXTURE_IDS = ["brief-001", "brief-002", "brief-003"] as const
const M1_RUN_ID = "scripted-001"

interface PersistedSessionFixture {
  file: string
  manager: SessionManager
}

interface M1FixtureMeta {
  briefId: string
  runId: string
  session: {
    id: string
    sourceFile: string
  }
  projectionSummary: {
    status: ElicitationExchangeProjection["status"]
    exchangeCount: number
    openPrompt: boolean
  }
  artifacts: {
    jsonl: string
    graph: { status: "deferred" }
    coherence: { status: "deferred" }
  }
}

interface M1Brief {
  id: string
  title: string
}

interface M1FixtureBundle {
  bundleDir: string
  jsonlPath: string
  meta: M1FixtureMeta
  brief: M1Brief
}

describe("Pi JSONL transcript viability", () => {
  it("jsonl raw user assistant payload survival", async () => {
    const { file, manager } = createPersistedSession()
    const userContent = [
      { type: "text" as const, text: "Describe this image" },
      {
        type: "image" as const,
        image: "data:image/png;base64,ZmFrZQ==",
        mimeType: "image/png",
      },
    ]
    const assistantContent = [
      { type: "text" as const, text: "Here is a structured answer." },
    ]

    manager.appendMessage({ role: "user", content: userContent })
    manager.appendMessage({ role: "assistant", content: assistantContent })

    const reloaded = SessionManager.open(file)
    const messages = reloaded.getEntries().filter(isMessageEntry)

    expect(messages.map((entry) => entry.message)).toEqual([
      { role: "user", content: userContent },
      { role: "assistant", content: assistantContent },
    ])
  })

  it("jsonl custom entry survival matrix", async () => {
    const { file, manager } = createPersistedSession()
    const customEntries = [
      ["brunch.lens_switch", { lens: "verification-design", reason: "test" }],
      [
        "brunch.mention",
        { entityId: "node-1", snapshottedLsn: 7, title: "Known node" },
      ],
      [
        "brunch.mention_staleness_hint",
        { entityId: "node-1", seenLsn: 7, currentLsn: 9 },
      ],
      [
        "brunch.continuity",
        {
          lastSeenLsn: 9,
          interestSet: ["node-1", "node-2"],
          compactionAnchorIds: ["anchor-1"],
        },
      ],
    ] as const

    for (const [customType, data] of customEntries) {
      manager.appendCustomEntry(customType, data)
    }
    flushPreAssistantEntries(manager)

    const reloaded = SessionManager.open(file)
    const customByType = new Map(
      reloaded
        .getEntries()
        .filter(isCustomEntry)
        .map((entry) => [entry.customType, entry.data]),
    )

    for (const [customType, data] of customEntries) {
      expect(customByType.get(customType)).toEqual(data)
    }
  })

  it("jsonl custom message survival matrix", async () => {
    const { file, manager } = createPersistedSession()
    const worldUpdate = {
      changedSinceLsn: 11,
      items: [{ id: "node-1", lsn: 12, title: "Updated node" }],
    }
    const sideTaskResult = {
      taskId: "side-task-1",
      status: "succeeded",
      summary: "Found related risk.",
    }
    const structuredPrompt = {
      promptId: "prompt-1",
      kind: "radio",
      choices: ["A", "B"],
    }

    manager.appendCustomMessageEntry(
      "worldUpdate",
      "Node node-1 changed since your last turn.",
      true,
      worldUpdate,
    )
    manager.appendCustomMessageEntry(
      "brunch.side_task_result",
      [{ type: "text", text: "Side task result: Found related risk." }],
      false,
      sideTaskResult,
    )
    manager.appendCustomMessageEntry(
      "brunch.elicitation_prompt",
      "Choose the better framing.",
      true,
      structuredPrompt,
    )
    flushPreAssistantEntries(manager)

    const reloaded = SessionManager.open(file)
    const customMessages = reloaded.getEntries().filter(isCustomMessageEntry)

    expect(customMessages).toEqual([
      expect.objectContaining({
        customType: "worldUpdate",
        content: "Node node-1 changed since your last turn.",
        display: true,
        details: worldUpdate,
      }),
      expect.objectContaining({
        customType: "brunch.side_task_result",
        content: [
          { type: "text", text: "Side task result: Found related risk." },
        ],
        display: false,
        details: sideTaskResult,
      }),
      expect.objectContaining({
        customType: "brunch.elicitation_prompt",
        content: "Choose the better framing.",
        display: true,
        details: structuredPrompt,
      }),
    ])
  })

  it("jsonl custom messages re-enter pi context", async () => {
    const { file, manager } = createPersistedSession()
    manager.appendCustomMessageEntry(
      "worldUpdate",
      "World update: node-1 changed.",
      true,
      { changedSinceLsn: 3 },
    )
    manager.appendCustomEntry("brunch.lens_switch", { lens: "observer" })
    manager.appendCustomMessageEntry(
      "brunch.side_task_result",
      "Side task completed.",
      false,
      { taskId: "task-1" },
    )
    flushPreAssistantEntries(manager)

    const contextMessages = SessionManager.open(file)
      .buildSessionContext()
      .messages.filter((message) => message.role === "custom")

    expect(contextMessages).toEqual([
      expect.objectContaining({
        role: "custom",
        customType: "worldUpdate",
        content: "World update: node-1 changed.",
      }),
      expect.objectContaining({
        role: "custom",
        customType: "brunch.side_task_result",
        content: "Side task completed.",
      }),
    ])
  })

  it("jsonl continuity metadata survival", async () => {
    const { file, manager } = createPersistedSession()
    const anchorEntryId = manager.appendMessage({
      role: "assistant",
      content: "Anchor before compaction",
    })
    const continuity = {
      lastSeenLsn: 42,
      interestSet: ["node-a", "node-b"],
      compactionAnchors: [{ entryId: anchorEntryId, graphNodeId: "node-a" }],
    }

    manager.appendCustomEntry("brunch.continuity", continuity)
    manager.appendCompaction("Compacted summary", anchorEntryId, 1_234, {
      brunch: { continuity },
    })
    flushPreAssistantEntries(manager)

    const reloaded = SessionManager.open(file)
    const customContinuity = reloaded
      .getEntries()
      .filter(isCustomEntry)
      .find((entry) => entry.customType === "brunch.continuity")
    const compaction = reloaded
      .getEntries()
      .find((entry) => entry.type === "compaction")

    expect(customContinuity?.data).toEqual(continuity)
    expect(compaction).toMatchObject({
      details: { brunch: { continuity } },
    })
  })

  it("jsonl structured elicitation survival", async () => {
    const { file, manager } = createPersistedSession()
    const promptDetails = {
      promptId: "prompt-1",
      surface: "checkbox",
      choices: ["fast", "safe"],
    }
    const responseData = {
      promptId: "prompt-1",
      selected: ["safe"],
      freeform: "Prefer safety.",
    }

    manager.appendCustomMessageEntry(
      "brunch.elicitation_prompt",
      "Select priorities.",
      true,
      promptDetails,
    )
    manager.appendMessage({ role: "user", content: "I choose safety." })
    manager.appendCustomEntry("brunch.elicitation_response", responseData)
    flushPreAssistantEntries(manager)

    const reloadedEntries = SessionManager.open(file).getEntries()
    const structuredPrompt = reloadedEntries.find(
      (entry) =>
        isCustomMessageEntry(entry) &&
        entry.customType === "brunch.elicitation_prompt",
    )
    const ordinaryUser = reloadedEntries.find(
      (entry) => isMessageEntry(entry) && entry.message.role === "user",
    )
    const structuredResponse = reloadedEntries.find(
      (entry) =>
        isCustomEntry(entry) &&
        entry.customType === "brunch.elicitation_response",
    )

    expect(structuredPrompt).toMatchObject({
      type: "custom_message",
      details: promptDetails,
    })
    expect(ordinaryUser).toMatchObject({
      type: "message",
      message: { role: "user", content: "I choose safety." },
    })
    expect(structuredResponse).toMatchObject({
      type: "custom",
      data: responseData,
    })
  })
})

describe("M1 fixture JSONL replay parity", () => {
  it("m1 fixture bundles reload for transcript parity", async () => {
    for (const briefId of M1_FIXTURE_IDS) {
      const bundle = await loadM1FixtureBundle(briefId)
      const reloaded = SessionManager.open(
        bundle.jsonlPath,
        undefined,
        process.cwd(),
      )

      expect(reloaded.getHeader()).toMatchObject({ id: bundle.meta.session.id })
      expect(reloaded.getEntries()).not.toHaveLength(0)
      expect(bundle.meta.artifacts.jsonl).toBe(`${M1_RUN_ID}.jsonl`)
    }
  })

  it("m1 fixture bundle metadata matches reprojected exchanges", async () => {
    for (const briefId of M1_FIXTURE_IDS) {
      const bundle = await loadM1FixtureBundle(briefId)
      const projection = await loadLinearElicitationExchangeProjection(
        bundle.jsonlPath,
      )

      expect(summaryForProjection(projection)).toEqual(
        bundle.meta.projectionSummary,
      )
    }
  })

  it("m1 fixture bundle bindings match briefs", async () => {
    for (const briefId of M1_FIXTURE_IDS) {
      const bundle = await loadM1FixtureBundle(briefId)
      const bindings = SessionManager.open(
        bundle.jsonlPath,
        undefined,
        process.cwd(),
      )
        .getEntries()
        .filter(isSessionBindingEntry)

      expect(bindings).toHaveLength(1)
      expect(bindings[0]?.data).toMatchObject({
        sessionId: bundle.meta.session.id,
        specTitle: bundle.brief.title,
      })
    }
  })

  it("m1 fixture metadata treats source file as provenance only", async () => {
    for (const briefId of M1_FIXTURE_IDS) {
      const bundle = await loadM1FixtureBundle(briefId)

      expect(bundle.meta.session.sourceFile).toMatch(/^\//u)
      expect(bundle.jsonlPath).toBe(
        join(bundle.bundleDir, bundle.meta.artifacts.jsonl),
      )
      expect(bundle.jsonlPath).not.toBe(bundle.meta.session.sourceFile)
    }
  })
})

async function loadM1FixtureBundle(
  briefId: typeof M1_FIXTURE_IDS[number],
): Promise<M1FixtureBundle> {
  const bundleDir = join(".brunch-fixtures", briefId, M1_RUN_ID)
  const metaPath = join(bundleDir, `${M1_RUN_ID}.meta.json`)
  const meta = JSON.parse(await readFile(metaPath, "utf8")) as M1FixtureMeta
  const jsonlPath = join(dirname(metaPath), meta.artifacts.jsonl)
  const briefPath = join(
    ".brunch-fixtures",
    "briefs",
    `${briefId}-${briefSlug(briefId)}.json`,
  )
  const brief = JSON.parse(await readFile(briefPath, "utf8")) as M1Brief
  return { bundleDir, jsonlPath, meta, brief }
}

function briefSlug(briefId: typeof M1_FIXTURE_IDS[number]): string {
  return {
    "brief-001": "identity-reference",
    "brief-002": "state-lifecycle",
    "brief-003": "derived-views",
  }[briefId]
}

function summaryForProjection(
  projection: ElicitationExchangeProjection,
): M1FixtureMeta["projectionSummary"] {
  return {
    status: projection.status,
    exchangeCount: projection.exchanges.length,
    openPrompt: projection.openPrompt !== null,
  }
}

function createPersistedSession(): PersistedSessionFixture {
  const cwd = mkdtempSync(join(tmpdir(), "brunch-jsonl-"))
  const manager = SessionManager.create(cwd, join(cwd, ".brunch/sessions"))
  const file = manager.getSessionFile()
  if (!file) {
    throw new Error("Expected persisted session file")
  }
  return { file, manager }
}

function flushPreAssistantEntries(manager: SessionManager): void {
  manager.appendMessage({ role: "assistant", content: "Persistence sentinel" })
}

function isMessageEntry(entry: SessionEntry): entry is SessionMessageEntry {
  return entry.type === "message"
}

function isCustomEntry(entry: SessionEntry): entry is CustomEntry {
  return entry.type === "custom"
}

function isCustomMessageEntry(
  entry: SessionEntry,
): entry is CustomMessageEntry {
  return entry.type === "custom_message"
}
