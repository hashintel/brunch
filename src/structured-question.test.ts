import { describe, expect, it } from "vitest"
import { Value } from "typebox/value"

import {
  StructuredQuestionResultDetailsSchema,
  buildStructuredQuestionResult,
  isTerminalStructuredQuestionResultDetails,
  parseStructuredQuestionParams,
  structuredQuestionSummary,
  type StructuredQuestionAnswer,
  type StructuredQuestionParams,
} from "./structured-question.js"

const transport = { surface: "test" as const, requestId: "req-1" }

describe("structured-question result model", () => {
  it("builds self-contained text answer details and content", () => {
    const params: StructuredQuestionParams = {
      id: "q-domain",
      mode: "text",
      prompt: "What domain are we in?",
      required: true,
    }

    const result = buildStructuredQuestionResult({
      params,
      status: "answered",
      transport,
      answers: [
        { questionId: "q-domain", mode: "text", value: "Local-first devtools" },
      ],
    })

    expect(
      Value.Check(StructuredQuestionResultDetailsSchema, result.details),
    ).toBe(true)
    expect(result.details).toMatchObject({
      schema: "brunch.structured_question.result",
      schemaVersion: 1,
      status: "answered",
      mode: "text",
      prompt: "What domain are we in?",
      questions: [{ id: "q-domain", mode: "text" }],
      answers: [{ questionId: "q-domain", value: "Local-first devtools" }],
      transport,
    })
    expect(result.content).toEqual([
      {
        type: "text",
        text: "What domain are we in?: Local-first devtools",
      },
    ])
  })

  it("builds single-select details with options and optional freeform", () => {
    const params: StructuredQuestionParams = {
      id: "q-risk",
      mode: "singleSelect",
      prompt: "Which risk dominates?",
      options: [
        { id: "ux", label: "UX ambiguity", description: "User cannot choose" },
        { id: "rpc", label: "RPC mismatch" },
      ],
      allowFreeform: true,
    }

    const result = buildStructuredQuestionResult({
      params,
      status: "answered",
      transport,
      answers: [
        {
          questionId: "q-risk",
          mode: "singleSelect",
          selectedOption: { id: "rpc", label: "RPC mismatch" },
          freeform: "Editor fallback must match TUI semantics.",
        },
      ],
    })

    expect(result.details.questions[0]).toMatchObject({
      options: [
        { id: "ux", label: "UX ambiguity" },
        { id: "rpc", label: "RPC mismatch" },
      ],
      allowFreeform: true,
    })
    expect(result.details.answers[0]).toMatchObject({
      selectedOption: { id: "rpc", label: "RPC mismatch" },
      freeform: "Editor fallback must match TUI semantics.",
    })
    expect(result.content[0]?.text).toBe(
      "Which risk dominates?: RPC mismatch; freeform: Editor fallback must match TUI semantics.",
    )
  })

  it("builds multi-select details with selected option labels", () => {
    const params: StructuredQuestionParams = {
      id: "q-oracles",
      mode: "multiSelect",
      prompt: "Which oracles apply?",
      options: [
        { id: "unit", label: "Unit" },
        { id: "rpc", label: "RPC contract" },
        { id: "pty", label: "PTY smoke" },
      ],
    }

    const result = buildStructuredQuestionResult({
      params,
      status: "answered",
      transport,
      answers: [
        {
          questionId: "q-oracles",
          mode: "multiSelect",
          selectedOptions: [
            { id: "rpc", label: "RPC contract" },
            { id: "pty", label: "PTY smoke" },
          ],
        },
      ],
    })

    expect(result.details.answers[0]).toMatchObject({
      mode: "multiSelect",
      selectedOptions: [
        { id: "rpc", label: "RPC contract" },
        { id: "pty", label: "PTY smoke" },
      ],
    })
    expect(result.content[0]?.text).toBe(
      "Which oracles apply?: RPC contract, PTY smoke",
    )
  })

  it("builds questionnaire details with each prompt, option set, and answer", () => {
    const params: StructuredQuestionParams = {
      id: "q-grounding",
      mode: "questionnaire",
      prompt: "Grounding bundle",
      questions: [
        {
          id: "domain",
          mode: "text",
          prompt: "Domain?",
        },
        {
          id: "pressure",
          mode: "singleSelect",
          prompt: "Main pressure?",
          options: [
            { id: "speed", label: "Speed" },
            { id: "trust", label: "Trust" },
          ],
        },
      ],
    }
    const answers: StructuredQuestionAnswer[] = [
      { questionId: "domain", mode: "text", value: "Developer tooling" },
      {
        questionId: "pressure",
        mode: "singleSelect",
        selectedOption: { id: "trust", label: "Trust" },
      },
    ]

    const result = buildStructuredQuestionResult({
      params,
      status: "answered",
      transport,
      answers,
    })

    expect(result.details.mode).toBe("questionnaire")
    expect(result.details.questions.map((question) => question.prompt)).toEqual(
      ["Domain?", "Main pressure?"],
    )
    expect(result.details.answers).toEqual(answers)
    expect(result.content[0]?.text).toBe(
      "Domain?: Developer tooling\nMain pressure?: Trust",
    )
  })

  it("builds terminal skipped, cancelled, and unavailable details without answers", () => {
    const params = parseStructuredQuestionParams({
      id: "q-terminal",
      mode: "text",
      prompt: "Can you answer?",
    })

    for (const status of ["skipped", "cancelled", "unavailable"] as const) {
      const result = buildStructuredQuestionResult({
        params,
        status,
        transport: { surface: "headless" },
        ...(status === "unavailable" ? { message: "UI unavailable" } : {}),
      })

      expect(result.details).toMatchObject({
        status,
        answers: [],
        questions: [{ id: "q-terminal", prompt: "Can you answer?" }],
        transport: { surface: "headless" },
      })
      expect(structuredQuestionSummary(result.details)).toContain(status)
    }
  })

  it("recognizes terminal structured-question result details without matching unrelated tool output", () => {
    const params = parseStructuredQuestionParams({
      id: "q-terminal",
      mode: "text",
      prompt: "Can you answer?",
    })
    const answered = buildStructuredQuestionResult({
      params,
      status: "answered",
      answers: [{ questionId: "q-terminal", mode: "text", value: "Yes" }],
      transport,
    })
    const skipped = buildStructuredQuestionResult({
      params,
      status: "skipped",
      transport,
    })
    const cancelled = buildStructuredQuestionResult({
      params,
      status: "cancelled",
      transport,
    })
    const unavailable = buildStructuredQuestionResult({
      params,
      status: "unavailable",
      transport: { surface: "headless" },
      message: "No UI surface is available.",
    })

    expect(isTerminalStructuredQuestionResultDetails(answered.details)).toBe(
      true,
    )
    expect(isTerminalStructuredQuestionResultDetails(skipped.details)).toBe(
      true,
    )
    expect(isTerminalStructuredQuestionResultDetails(cancelled.details)).toBe(
      true,
    )
    expect(isTerminalStructuredQuestionResultDetails(unavailable.details)).toBe(
      false,
    )
    expect(
      isTerminalStructuredQuestionResultDetails({
        status: "answered",
        content: [{ type: "text", text: "ordinary tool output" }],
      }),
    ).toBe(false)
  })
})
