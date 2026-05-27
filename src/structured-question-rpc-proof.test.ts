import { describe, expect, it } from "vitest"

import { runStructuredQuestionRpcProof } from "./structured-question-rpc-proof.js"

describe("structured-question RPC proof", () => {
  it("round-trips an editor fallback through Pi RPC extension UI", async () => {
    const proof = await runStructuredQuestionRpcProof()

    expect(proof.editorRequest).toMatchObject({
      type: "extension_ui_request",
      method: "editor",
      title: "Answer structured question as JSON",
    })
    expect(JSON.parse(proof.editorRequest.prefill ?? "{}")).toMatchObject({
      schema: "brunch.structured_question.editor",
      schemaVersion: 1,
      response: { status: "skipped" },
      params: {
        id: "q-rpc-proof",
        mode: "text",
        prompt: "What did the RPC proof answer?",
      },
    })
    expect(proof.details).toMatchObject({
      schema: "brunch.structured_question.result",
      schemaVersion: 1,
      status: "answered",
      mode: "text",
      prompt: "What did the RPC proof answer?",
      questions: [
        {
          id: "q-rpc-proof",
          mode: "text",
          prompt: "What did the RPC proof answer?",
        },
      ],
      answers: [
        {
          questionId: "q-rpc-proof",
          mode: "text",
          value: "RPC editor fallback works",
        },
      ],
      transport: { surface: "rpc-editor" },
    })
    expect(proof.sessionFile).toContain(".brunch/sessions")
  }, 20_000)
})
