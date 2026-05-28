import { describe, expect, it } from "vitest"

import { runStructuredExchangeOrderingProof } from "./structured-exchange-ordering-proof.js"

describe("structured-exchange ordering proof", () => {
  it("runs same-assistant-message present_options before request_choice with sequential tools", async () => {
    const proof = await runStructuredExchangeOrderingProof()

    expect(proof.scenario).toMatchObject({
      mission:
        "Prove same-assistant-message present/request structured-exchange ordering.",
      evaluationFocus:
        "Verify sequential present_options persists before request_choice opens response UI.",
      maxTurns: 1,
    })
    expect(proof.verdict).toEqual({
      presentResultBeforeRequestUi: true,
      jsonlPresentBeforeRequest: true,
    })
    expect(proof.eventOrder).toEqual([
      "present_options:start",
      "present_options:end",
      "ui:select",
      "request_choice:start",
      "ui:input",
      "request_choice:end",
    ])
    expect(proof.jsonlToolResultOrder).toEqual([
      "present_options",
      "request_choice",
    ])
    expect(proof.presentDetails).toMatchObject({
      schema: "brunch.structured_exchange.present",
      exchangeId: "ordering-proof",
      presentTool: "present_options",
      expectedRequest: { tool: "request_choice", required: true },
    })
    expect(proof.requestDetails).toMatchObject({
      schema: "brunch.structured_exchange.request",
      exchangeId: "ordering-proof",
      requestTool: "request_choice",
      status: "answered",
      respondsTo: {
        exchangeId: "ordering-proof",
        presentTool: "present_options",
      },
      choice: { id: "tui", label: "Move under src/tui-client" },
      comment: "Sequential ordering looks safe for the next parity proof.",
    })
  }, 20_000)
})
