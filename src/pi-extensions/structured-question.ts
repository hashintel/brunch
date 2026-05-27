import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent"
import { Key, matchesKey, type Component } from "@earendil-works/pi-tui"

import {
  StructuredQuestionParamsSchema,
  buildStructuredQuestionResult,
  type StructuredQuestion,
  type StructuredQuestionAnswer,
  type StructuredQuestionParams,
  type StructuredQuestionStatus,
  type StructuredQuestionToolResult,
} from "../structured-question.js"

export const STRUCTURED_QUESTION_TOOL = "brunch_structured_question"

export interface StructuredQuestionTuiResponse {
  status: Exclude<StructuredQuestionStatus, "unavailable">
  answers?: StructuredQuestionAnswer[]
}

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
  if (!ctx.hasUI || typeof ctx.ui.custom !== "function") {
    return buildStructuredQuestionResult({
      params,
      status: "unavailable",
      transport: { surface: "headless" },
      message: "Structured question UI is unavailable.",
    })
  }

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
