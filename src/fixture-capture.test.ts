import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import type { WorkspaceSessionCoordinator } from "./workspace-session-coordinator.js"
import { createWorkspaceSessionCoordinator } from "./workspace-session-coordinator.js"
import { captureFixtureRun } from "./fixture-capture.js"

describe("fixture capture", () => {
  it("captures the coordinator-selected session without injecting a test coordinator", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "brunch-fixture-real-"))
    const workspace = await createWorkspaceSessionCoordinator({
      cwd,
    }).startOrCreate({
      specTitle: "Fixture spec",
    })
    workspace.session.manager.appendMessage({
      role: "assistant",
      content: "Real selected question",
    })
    workspace.session.manager.appendMessage({
      role: "user",
      content: "Real selected answer",
    })

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
    }).startOrCreate({
      specTitle: "Fixture spec",
    })
    workspace.session.manager.appendMessage({
      role: "assistant",
      content: "Question",
    })
    workspace.session.manager.appendMessage({ role: "user", content: "Answer" })

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
    }).startOrCreate({
      specTitle: "Fixture spec",
    })
    workspace.session.manager.appendMessage({
      role: "assistant",
      content: "Question",
    })
    workspace.session.manager.appendMessage({ role: "user", content: "Answer" })

    const coordinator: WorkspaceSessionCoordinator = {
      async openExisting() {
        return workspace
      },
      async startOrCreate() {
        return workspace
      },
      async createNewSessionForCurrentSpec() {
        return workspace
      },
      async bindCurrentSpecToSession() {
        return workspace
      },
      async deriveChromeState() {
        return workspace.chrome
      },
    }

    const result = await captureFixtureRun({
      cwd,
      briefId: "brief-001",
      runId: "run-001",
      timestamp: "2026-05-21T00:00:00.000Z",
      coordinator,
    })

    expect(result.runDir).toBe(
      join(cwd, ".brunch-fixtures", "brief-001", "run-001"),
    )
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
      projectionSummary: {
        status: "ready",
        exchangeCount: 1,
        openPrompt: false,
      },
      artifacts: {
        jsonl: "run-001.jsonl",
      },
    })
    expect(await readFile(result.jsonlFile, "utf8")).toContain(
      '"role":"assistant"',
    )
  })
})
