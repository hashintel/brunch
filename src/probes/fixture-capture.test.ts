import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import {
  createWorkspaceSessionCoordinator,
  type WorkspaceSessionCoordinator,
} from "../workspace-session-coordinator.js"
import { loadLinearElicitationExchangeProjection } from "../elicitation-exchange.js"
import { assistantMessage, userMessage } from "../test-helpers.js"
import {
  captureDeterministicBriefRuns,
  captureFixtureRun,
} from "./fixture-capture.js"

describe("fixture capture", () => {
  it("captures the coordinator-selected session without injecting a test coordinator", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "brunch-fixture-real-"))
    const workspace = await createWorkspaceSessionCoordinator({
      cwd,
    }).createSetupSession({
      specTitle: "Fixture spec",
    })
    workspace.session.manager.appendMessage(
      assistantMessage("Real selected question"),
    )
    workspace.session.manager.appendMessage(userMessage("Real selected answer"))

    const result = await captureFixtureRun({
      cwd,
      briefId: "brief-001",
      runId: "run-001",
      timestamp: "2026-05-21T00:00:00.000Z",
    })

    const copiedJsonl = await readFile(result.jsonlFile, "utf8")
    const metadata = JSON.parse(await readFile(result.metaFile, "utf8")) as {
      session: {
        id: string
        sourceFile: string
      }
      projectionSummary: {
        status: string
        exchangeCount: number
      }
    }

    expect(copiedJsonl).toContain("Real selected question")
    expect(copiedJsonl).toContain("Real selected answer")
    expect(metadata.session.id).toBe(workspace.session.id)
    expect(metadata.session.sourceFile).toBe(workspace.session.file)
    expect(metadata.projectionSummary).toMatchObject({
      status: "ready",
      exchangeCount: 1,
    })
  })

  it("reports Brunch's package version, not the caller project's version", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "brunch-fixture-package-"))
    await writeFile(
      join(cwd, "package.json"),
      `${JSON.stringify({ name: "caller-project", version: "9.9.9" })}\n`,
    )
    const workspace = await createWorkspaceSessionCoordinator({
      cwd,
    }).createSetupSession({
      specTitle: "Fixture spec",
    })
    workspace.session.manager.appendMessage(assistantMessage("Question"))
    workspace.session.manager.appendMessage(userMessage("Answer"))

    const result = await captureFixtureRun({
      cwd,
      briefId: "brief-001",
      runId: "run-001",
      timestamp: "2026-05-21T00:00:00.000Z",
    })

    const metadata = JSON.parse(await readFile(result.metaFile, "utf8")) as {
      brunchVersion: string
      timestamp: string
    }

    expect(metadata.brunchVersion).toBe("0.0.0")
    expect(metadata.brunchVersion).not.toBe("9.9.9")
    expect(metadata.timestamp).toBe("2026-05-21T00:00:00.000Z")
  })

  it("captures a deterministic JSONL and metadata bundle through RPC", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "brunch-fixture-"))
    const workspace = await createWorkspaceSessionCoordinator({
      cwd,
    }).createSetupSession({
      specTitle: "Fixture spec",
    })
    workspace.session.manager.appendMessage(assistantMessage("Question"))
    workspace.session.manager.appendMessage(userMessage("Answer"))

    const coordinator: WorkspaceSessionCoordinator = {
      ...createWorkspaceSessionCoordinator({ cwd }),
      async openDefaultWorkspace() {
        return workspace
      },
    }

    const result = await captureFixtureRun({
      cwd,
      briefId: "brief-001",
      runId: "run-001",
      timestamp: "2026-05-21T00:00:00.000Z",
      coordinator,
    })

    expect(result.runDir).toBe(join(cwd, ".fixtures", "brief-001", "run-001"))
    expect(JSON.parse(await readFile(result.metaFile, "utf8"))).toMatchObject({
      schemaVersion: 1,
      briefId: "brief-001",
      runId: "run-001",
      timestamp: "2026-05-21T00:00:00.000Z",
      brunchVersion: "0.0.0",
      session: {
        id: expect.any(String),
        sourceFile: expect.stringContaining(".brunch/sessions"),
      },
      driver: {
        mode: "scripted-deterministic",
      },
      projectionSummary: {
        status: "ready",
        exchangeCount: 1,
        openPrompt: false,
      },
      artifacts: {
        jsonl: "run-001.jsonl",
        graph: { status: "deferred" },
        coherence: { status: "deferred" },
      },
    })
    expect(await readFile(result.jsonlFile, "utf8")).toContain(
      '"role":"assistant"',
    )
  })

  it("replays captured brief bundles through exchange projection", async () => {
    for (const briefId of ["brief-001", "brief-002", "brief-003"]) {
      const runId = "scripted-001"
      const runDir = join(".fixtures", briefId, runId)
      const metadata = JSON.parse(
        await readFile(join(runDir, `${runId}.meta.json`), "utf8"),
      ) as {
        briefId: string
        runId: string
        projectionSummary: {
          status: string
          exchangeCount: number
          openPrompt: boolean
        }
      }
      const projection = await loadLinearElicitationExchangeProjection(
        join(runDir, `${runId}.jsonl`),
      )

      expect(metadata.briefId).toBe(briefId)
      expect(metadata.runId).toBe(runId)
      expect({
        status: projection.status,
        exchangeCount: projection.exchanges.length,
        openPrompt: projection.openPrompt !== null,
      }).toEqual(metadata.projectionSummary)
    }
  })

  it("captures deterministic runs for the first three briefs", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "brunch-fixture-driver-"))

    const results = await captureDeterministicBriefRuns({
      cwd,
      briefsDir: ".fixtures/briefs",
      runId: "scripted-001",
      timestamp: "2026-05-21T00:00:00.000Z",
    })

    expect(results).toHaveLength(3)
    const seenSpecIds = new Set<string>()
    const expectedTitlesByBriefId = new Map([
      ["brief-001", "Team knowledge cards"],
      ["brief-002", "Approval workflow for vendor invoices"],
      ["brief-003", "Project dashboard rollups"],
    ])

    for (const result of results) {
      const metadata = JSON.parse(await readFile(result.metaFile, "utf8")) as {
        briefId: string
        runId: string
        driver: { mode: string }
        session: { id: string }
        projectionSummary: {
          status: string
          exchangeCount: number
          openPrompt: boolean
        }
        artifacts: {
          jsonl: string
          graph: { status: string }
          coherence: { status: string }
        }
      }
      const jsonl = await readJsonl(result.jsonlFile)
      const binding = singleSessionBinding(jsonl)
      const expectedTitle = expectedTitlesByBriefId.get(metadata.briefId)

      expect(metadata.runId).toBe("scripted-001")
      expect(metadata.driver.mode).toBe("scripted-deterministic")
      expect(metadata.session.id).toEqual(expect.any(String))
      expect(metadata.projectionSummary).toEqual({
        status: "ready",
        exchangeCount: 1,
        openPrompt: false,
      })
      expect(metadata.artifacts).toEqual({
        jsonl: "scripted-001.jsonl",
        graph: { status: "deferred" },
        coherence: { status: "deferred" },
      })
      expect(expectedTitle).toBeDefined()
      expect(binding.data.specTitle).toBe(expectedTitle)
      expect(jsonl.map((entry) => JSON.stringify(entry)).join("\n")).toContain(
        metadata.briefId,
      )
      expect(seenSpecIds.has(binding.data.specId)).toBe(false)
      seenSpecIds.add(binding.data.specId)
    }
  })
})

async function readJsonl(file: string): Promise<unknown[]> {
  return (await readFile(file, "utf8"))
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as unknown)
}

interface SessionBindingProjection {
  data: {
    specId: string
    specTitle: string
  }
}

function singleSessionBinding(entries: unknown[]): SessionBindingProjection {
  const bindings = entries.filter(
    (entry): entry is SessionBindingProjection =>
      typeof entry === "object" &&
      entry !== null &&
      (entry as { customType?: unknown }).customType ===
        "brunch.session_binding" &&
      typeof (entry as { data?: { specId?: unknown } }).data?.specId ===
        "string" &&
      typeof (entry as { data?: { specTitle?: unknown } }).data?.specTitle ===
        "string",
  )
  expect(bindings).toHaveLength(1)
  return bindings[0]!
}
