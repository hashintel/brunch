import { mkdtemp, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, dirname, join } from "node:path"

import { describe, expect, it } from "vitest"

import { runPublicRpcParityProof } from "./public-rpc-parity-proof.js"

describe("public Brunch RPC structured-exchange parity proof", () => {
  it("drives ten assistant-first structured exchanges from a fresh cwd", async () => {
    const report = await runPublicRpcParityProof()

    expect(report).toMatchObject({
      schemaVersion: 1,
      probeId: "public-rpc-parity",
      runId: expect.any(String),
      generatedAt: expect.any(String),
      mission: expect.stringContaining("public JSON-RPC only"),
      evaluationFocus: expect.stringContaining(
        "tuple transcript/projection parity",
      ),
      maxTurnBudget: 10,
      completedTurns: 10,
      friction: [],
      specId: expect.any(String),
      sessionId: expect.any(String),
    })
    expect(Date.parse(report.generatedAt)).not.toBeNaN()
    expect(report.toolCoverage).toEqual([
      "present_options",
      "present_question",
      "request_answer",
      "request_choice",
      "request_choices",
    ])
    expect(report.exchangeIds).toHaveLength(10)
    expect(new Set(report.exchangeIds).size).toBe(10)
    expect(report.artifacts).toBeUndefined()
    expect(report.transcriptDisplayRows).toBeGreaterThanOrEqual(20)
  })

  it("writes a reviewable artifact bundle when given a fixture root", async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), "brunch-fixtures-"))

    const report = await runPublicRpcParityProof({
      fixtureRoot,
      runId: "artifact-test",
    })

    const artifacts = report.artifacts
    expect(artifacts).toEqual({
      runDir: join(fixtureRoot, "runs", "public-rpc-parity", report.runId),
      sessionJsonl: join(
        fixtureRoot,
        "runs",
        "public-rpc-parity",
        report.runId,
        "session.jsonl",
      ),
      transcriptMarkdown: join(
        fixtureRoot,
        "runs",
        "public-rpc-parity",
        report.runId,
        "transcript.md",
      ),
      reportJson: join(
        fixtureRoot,
        "runs",
        "public-rpc-parity",
        report.runId,
        "report.json",
      ),
    })
    if (artifacts === undefined) throw new Error("Expected artifact paths")

    expect(
      artifacts.runDir.endsWith(join("runs", report.probeId, report.runId)),
    ).toBe(true)
    expect(basename(artifacts.runDir)).toBe(report.runId)
    expect(basename(dirname(artifacts.runDir))).toBe(report.probeId)

    const sessionJsonl = await readFile(artifacts.sessionJsonl, "utf8")
    const transcript = await readFile(artifacts.transcriptMarkdown, "utf8")
    const persistedReport = JSON.parse(
      await readFile(artifacts.reportJson, "utf8"),
    ) as typeof report

    expect(sessionJsonl).toContain('"toolName":"present_options"')
    expect(transcript).toContain("# Transcript — session.jsonl")
    expect(transcript).toContain("## Exchange")
    expect(transcript).toContain("— prompt (present_")
    expect(transcript).toContain("— response (request_")
    expect(persistedReport).toMatchObject({
      schemaVersion: 1,
      probeId: "public-rpc-parity",
      runId: report.runId,
      generatedAt: report.generatedAt,
      mission: report.mission,
      completedTurns: 10,
      exchangeIds: report.exchangeIds,
      artifacts: report.artifacts,
    })
    expect(persistedReport.exchangeIds).toEqual(report.exchangeIds)
    expect(persistedReport.exchangeIds).toHaveLength(10)
    expect(new Set(persistedReport.exchangeIds).size).toBe(10)
    for (const exchangeId of persistedReport.exchangeIds) {
      expect(sessionJsonl).toContain(exchangeId)
      expect(transcript).toContain(exchangeId)
    }
  })
})
