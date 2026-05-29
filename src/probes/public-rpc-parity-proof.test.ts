import { mkdtemp, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { runPublicRpcParityProof } from "./public-rpc-parity-proof.js"

describe("public Brunch RPC structured-exchange parity proof", () => {
  it("drives ten assistant-first structured exchanges from a fresh cwd", async () => {
    const report = await runPublicRpcParityProof()

    expect(report).toMatchObject({
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
    expect(report.toolCoverage).toEqual([
      "present_options",
      "present_question",
      "request_answer",
      "request_choice",
      "request_choices",
    ])
    expect(report.exchangeIds).toHaveLength(10)
    expect(new Set(report.exchangeIds).size).toBe(10)
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
      runDir: join(fixtureRoot, "runs", "public-rpc-parity", "artifact-test"),
      sessionJsonl: join(
        fixtureRoot,
        "runs",
        "public-rpc-parity",
        "artifact-test",
        "session.jsonl",
      ),
      transcriptMarkdown: join(
        fixtureRoot,
        "runs",
        "public-rpc-parity",
        "artifact-test",
        "transcript.md",
      ),
      reportJson: join(
        fixtureRoot,
        "runs",
        "public-rpc-parity",
        "artifact-test",
        "report.json",
      ),
    })
    if (artifacts === undefined) throw new Error("Expected artifact paths")

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
      mission: report.mission,
      completedTurns: 10,
      exchangeIds: report.exchangeIds,
      artifacts: report.artifacts,
    })
  })
})
