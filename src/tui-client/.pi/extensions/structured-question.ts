import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent"
import { Key, matchesKey, type Component } from "@earendil-works/pi-tui"
import { Type } from "typebox"
import { Value } from "typebox/value"

import {
  StructuredQuestionAnswerSchema,
  StructuredQuestionParamsSchema,
  buildStructuredQuestionResult,
  type StructuredQuestion,
  type StructuredQuestionAnswer,
  type StructuredQuestionParams,
  type StructuredQuestionStatus,
  type StructuredQuestionToolResult,
} from "../../../structured-question.js"

export const STRUCTURED_QUESTION_TOOL = "brunch_structured_question"

export interface StructuredQuestionTuiResponse {
  status: Exclude<StructuredQuestionStatus, "unavailable">
  answers?: StructuredQuestionAnswer[]
}

const StructuredQuestionModeSchema = Type.Union([
  Type.Literal("text"),
  Type.Literal("singleSelect"),
  Type.Literal("multiSelect"),
  Type.Literal("questionnaire"),
])

const StructuredQuestionEditorResponseSchema = Type.Object(
  {
    status: Type.Union([
      Type.Literal("answered"),
      Type.Literal("skipped"),
      Type.Literal("cancelled"),
    ]),
    answers: Type.Optional(Type.Array(StructuredQuestionAnswerSchema)),
  },
  { additionalProperties: false },
)

const StructuredQuestionEditorPayloadSchema = Type.Object(
  {
    schema: Type.Literal("brunch.structured_question.editor"),
    schemaVersion: Type.Literal(1),
    mode: StructuredQuestionModeSchema,
    prompt: Type.String(),
    instructions: Type.Array(Type.String()),
    params: StructuredQuestionParamsSchema,
    response: StructuredQuestionEditorResponseSchema,
  },
  { additionalProperties: false },
)

export function registerBrunchStructuredQuestion(pi: ExtensionAPI): void {
  if (typeof (pi as Partial<ExtensionAPI>).registerTool !== "function") {
    return
  }
  pi.registerTool({
    name: STRUCTURED_QUESTION_TOOL,
    label: "Structured question",
    description:
      "Ask the user a Brunch structured question and persist a self-contained structured result.",
    parameters: StructuredQuestionParamsSchema,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      return answerStructuredQuestionWithTui(params, ctx)
    },
  })
}

export async function answerStructuredQuestionWithTui(
  params: StructuredQuestionParams,
  ctx: Pick<ExtensionContext, "hasUI" | "ui">,
): Promise<StructuredQuestionToolResult> {
  if (!ctx.hasUI) {
    return unavailableStructuredQuestionResult(params)
  }

  if (typeof ctx.ui.custom === "function") {
    const response = await ctx.ui.custom<StructuredQuestionTuiResponse>(
      (_tui, _theme, _keybindings, done) =>
        createStructuredQuestionTuiComponent(params, done),
    )

    return buildStructuredQuestionResult({
      params,
      status: response.status,
      answers: response.status === "answered" ? (response.answers ?? []) : [],
      transport: { surface: "tui-custom" },
    })
  }

  if (typeof ctx.ui.editor === "function") {
    const edited = await ctx.ui.editor(
      "Answer structured question as JSON",
      buildStructuredQuestionEditorPrefill(params),
    )
    return structuredQuestionResultFromEditor(params, edited)
  }

  return unavailableStructuredQuestionResult(params)
}

export function buildStructuredQuestionEditorPrefill(
  params: StructuredQuestionParams,
): string {
  return `${JSON.stringify(
    Value.Parse(StructuredQuestionEditorPayloadSchema, {
      schema: "brunch.structured_question.editor",
      schemaVersion: 1,
      mode: params.mode,
      prompt: params.prompt,
      instructions: [
        "Edit response.status to answered, skipped, or cancelled.",
        "For answered responses, fill response.answers using the question ids and answer shapes shown by params.",
        "Do not change schema, schemaVersion, params, prompt, or mode.",
      ],
      params,
      response: { status: "skipped" },
    }),
    null,
    2,
  )}\n`
}

export function parseStructuredQuestionEditorResponse(
  edited: string | undefined,
): StructuredQuestionTuiResponse | null {
  if (edited === undefined) return { status: "cancelled" }
  try {
    const payload = Value.Parse(
      StructuredQuestionEditorPayloadSchema,
      JSON.parse(edited),
    )
    return payload.response
  } catch {
    return null
  }
}

export function structuredQuestionResultFromEditor(
  params: StructuredQuestionParams,
  edited: string | undefined,
): StructuredQuestionToolResult {
  const response = parseStructuredQuestionEditorResponse(edited)
  if (!response) {
    return buildStructuredQuestionResult({
      params,
      status: "unavailable",
      transport: { surface: "rpc-editor" },
      message:
        "Structured question editor response was invalid JSON or failed schema validation.",
    })
  }
  return buildStructuredQuestionResult({
    params,
    status: response.status,
    answers: response.status === "answered" ? (response.answers ?? []) : [],
    transport: { surface: "rpc-editor" },
  })
}

function unavailableStructuredQuestionResult(
  params: StructuredQuestionParams,
): StructuredQuestionToolResult {
  return buildStructuredQuestionResult({
    params,
    status: "unavailable",
    transport: { surface: "headless" },
    message: "Structured question UI is unavailable.",
  })
}

export function createStructuredQuestionTuiComponent(
  params: StructuredQuestionParams,
  done: (response: StructuredQuestionTuiResponse) => void,
): Component {
  return new StructuredQuestionTuiComponent(params, done)
}

class StructuredQuestionTuiComponent implements Component {
  readonly #params: StructuredQuestionParams
  readonly #questions: StructuredQuestion[]
  readonly #done: (response: StructuredQuestionTuiResponse) => void
  #questionIndex = 0
  #optionIndex = 0
  #text = ""
  #selectedOptionIds = new Set<string>()
  #answers: StructuredQuestionAnswer[] = []

  constructor(
    params: StructuredQuestionParams,
    done: (response: StructuredQuestionTuiResponse) => void,
  ) {
    this.#params = params
    this.#questions =
      params.mode === "questionnaire" ? params.questions : [params]
    this.#done = done
  }

  handleInput(data: string): void {
    const question = this.#currentQuestion()
    if (!question) return

    if (matchesKey(data, Key.escape)) {
      this.#done({ status: "cancelled" })
      return
    }

    if (question.mode === "text") {
      this.#handleTextInput(data, question)
      return
    }

    if (matchesKey(data, Key.up)) {
      this.#optionIndex = Math.max(0, this.#optionIndex - 1)
      return
    }
    if (matchesKey(data, Key.down)) {
      this.#optionIndex = Math.min(
        question.options.length - 1,
        this.#optionIndex + 1,
      )
      return
    }

    if (question.mode === "multiSelect" && data === " ") {
      const option = question.options[this.#optionIndex]
      if (!option) return
      if (this.#selectedOptionIds.has(option.id)) {
        this.#selectedOptionIds.delete(option.id)
      } else {
        this.#selectedOptionIds.add(option.id)
      }
      return
    }

    if (matchesKey(data, Key.enter)) {
      if (question.mode === "singleSelect") {
        const option = question.options[this.#optionIndex]
        if (!option) return
        this.#completeAnswer({
          questionId: question.id,
          mode: "singleSelect",
          selectedOption: { id: option.id, label: option.label },
        })
        return
      }
      const selectedOptions = question.options
        .filter((option) => this.#selectedOptionIds.has(option.id))
        .map((option) => ({ id: option.id, label: option.label }))
      if (selectedOptions.length === 0 && question.required !== false) return
      this.#completeAnswer({
        questionId: question.id,
        mode: "multiSelect",
        selectedOptions,
      })
    }
  }

  render(_width: number): string[] {
    const question = this.#currentQuestion()
    if (!question) return ["Structured question"]
    const prefix =
      this.#params.mode === "questionnaire"
        ? `Question ${this.#questionIndex + 1}/${this.#questions.length}: `
        : ""
    const lines = [`${prefix}${question.prompt}`]
    if (question.mode === "text") {
      lines.push(`› ${this.#text}`)
      lines.push("Enter submit • Esc cancel")
      return lines
    }
    for (const [index, option] of question.options.entries()) {
      const cursor = index === this.#optionIndex ? "›" : " "
      const checked =
        question.mode === "multiSelect"
          ? this.#selectedOptionIds.has(option.id)
            ? "[x]"
            : "[ ]"
          : `${index + 1}.`
      lines.push(`${cursor} ${checked} ${option.label}`)
      if (option.description) lines.push(`    ${option.description}`)
    }
    lines.push(
      question.mode === "multiSelect"
        ? "Space toggle • Enter submit • Esc cancel"
        : "↑↓ navigate • Enter select • Esc cancel",
    )
    return lines
  }

  invalidate(): void {}

  #handleTextInput(data: string, question: StructuredQuestion): void {
    if (matchesKey(data, Key.backspace)) {
      this.#text = this.#text.slice(0, -1)
      return
    }
    if (matchesKey(data, Key.enter)) {
      const value = this.#text.trim()
      if (!value && question.required !== false) return
      this.#completeAnswer({ questionId: question.id, mode: "text", value })
      return
    }
    if (data.length === 1 && data >= " " && data !== "\u007f") {
      this.#text += data
    }
  }

  #completeAnswer(answer: StructuredQuestionAnswer): void {
    if (this.#params.mode !== "questionnaire") {
      this.#done({ status: "answered", answers: [answer] })
      return
    }
    this.#answers.push(answer)
    if (this.#questionIndex < this.#questions.length - 1) {
      this.#questionIndex += 1
      this.#optionIndex = 0
      this.#text = ""
      this.#selectedOptionIds.clear()
      return
    }
    this.#done({ status: "answered", answers: this.#answers })
  }

  #currentQuestion(): StructuredQuestion | undefined {
    return this.#questions[this.#questionIndex]
  }
}
