import { describe, expect, it } from "vitest"

import {
  STRUCTURED_QUESTION_TOOL,
  answerStructuredQuestionWithTui,
  createStructuredQuestionTuiComponent,
  registerBrunchStructuredQuestion,
  type StructuredQuestionTuiResponse,
} from "./structured-question.js"
import type { StructuredQuestionParams } from "../structured-question.js"

describe("Brunch structured-question TUI adapter", () => {
  it("registers a structured-question tool", () => {
    const tools: Array<{ name: string }> = []

    registerBrunchStructuredQuestion({
      registerTool: (tool: { name: string }) => tools.push({ name: tool.name }),
    } as never)

    expect(tools).toEqual([{ name: STRUCTURED_QUESTION_TOOL }])
  })

  it("returns unavailable details when rich UI is missing", async () => {
    const result = await answerStructuredQuestionWithTui(textParams(), {
      hasUI: false,
      ui: {} as never,
    })

    expect(result.details).toMatchObject({
      status: "unavailable",
      transport: { surface: "headless" },
      answers: [],
    })
    expect(result.content[0]?.text).toContain("unavailable")
  })

  it("uses ctx.ui.custom and the shared result builder for text answers", async () => {
    const result = await answerStructuredQuestionWithTui(
      textParams(),
      fakeContext({
        status: "answered",
        answers: [
          { questionId: "q-text", mode: "text", value: "A typed answer" },
        ],
      }),
    )

    expect(result.details).toMatchObject({
      status: "answered",
      mode: "text",
      answers: [{ value: "A typed answer" }],
      transport: { surface: "tui-custom" },
    })
    expect(result.content[0]?.text).toBe("Say something: A typed answer")
  })

  it("uses ctx.ui.custom and the shared result builder for single and multi select answers", async () => {
    const single = await answerStructuredQuestionWithTui(
      singleParams(),
      fakeContext({
        status: "answered",
        answers: [
          {
            questionId: "q-single",
            mode: "singleSelect",
            selectedOption: { id: "b", label: "Beta" },
          },
        ],
      }),
    )
    const multi = await answerStructuredQuestionWithTui(
      multiParams(),
      fakeContext({
        status: "answered",
        answers: [
          {
            questionId: "q-multi",
            mode: "multiSelect",
            selectedOptions: [
              { id: "a", label: "Alpha" },
              { id: "b", label: "Beta" },
            ],
          },
        ],
      }),
    )

    expect(single.details.answers[0]).toMatchObject({
      selectedOption: { id: "b", label: "Beta" },
    })
    expect(multi.details.answers[0]).toMatchObject({
      selectedOptions: [
        { id: "a", label: "Alpha" },
        { id: "b", label: "Beta" },
      ],
    })
  })

  it("keeps required empty text answers in the input-replacing component", () => {
    const decisions: StructuredQuestionTuiResponse[] = []
    const component = createStructuredQuestionTuiComponent(
      textParams(),
      (response) => decisions.push(response),
    )

    component.handleInput?.("\r")
    expect(decisions).toEqual([])

    for (const char of "Done") component.handleInput?.(char)
    component.handleInput?.("\r")

    expect(decisions).toEqual([
      {
        status: "answered",
        answers: [{ questionId: "q-text", mode: "text", value: "Done" }],
      },
    ])
  })

  it("supports questionnaire answers through the input-replacing component", () => {
    const decisions: StructuredQuestionTuiResponse[] = []
    const component = createStructuredQuestionTuiComponent(
      questionnaireParams(),
      (response) => decisions.push(response),
    )

    for (const char of "Domain") component.handleInput?.(char)
    component.handleInput?.("\r")
    component.handleInput?.("\r")

    expect(decisions).toEqual([
      {
        status: "answered",
        answers: [
          { questionId: "q-domain", mode: "text", value: "Domain" },
          {
            questionId: "q-risk",
            mode: "singleSelect",
            selectedOption: { id: "a", label: "Alpha" },
          },
        ],
      },
    ])
  })
})

function fakeContext(response: StructuredQuestionTuiResponse) {
  return {
    hasUI: true,
    ui: {
      custom: async () => response,
    },
  } as never
}

function textParams(): StructuredQuestionParams {
  return {
    id: "q-text",
    mode: "text",
    prompt: "Say something",
  }
}

function singleParams(): StructuredQuestionParams {
  return {
    id: "q-single",
    mode: "singleSelect",
    prompt: "Pick one",
    options: [
      { id: "a", label: "Alpha" },
      { id: "b", label: "Beta" },
    ],
  }
}

function multiParams(): StructuredQuestionParams {
  return {
    id: "q-multi",
    mode: "multiSelect",
    prompt: "Pick many",
    options: [
      { id: "a", label: "Alpha" },
      { id: "b", label: "Beta" },
    ],
  }
}

function questionnaireParams(): StructuredQuestionParams {
  return {
    id: "q-all",
    mode: "questionnaire",
    prompt: "Questionnaire",
    questions: [
      { id: "q-domain", mode: "text", prompt: "Domain" },
      {
        id: "q-risk",
        mode: "singleSelect",
        prompt: "Risk",
        options: [{ id: "a", label: "Alpha" }],
      },
    ],
  }
}
