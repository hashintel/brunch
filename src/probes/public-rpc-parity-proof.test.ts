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
    expect(new Set(report.exchangeIds).size).toBeGreaterThanOrEqual(3)
    expect(report.transcriptDisplayRows).toBeGreaterThanOrEqual(20)
  })
})
