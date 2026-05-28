import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"
import {
  type Component,
  Editor,
  type EditorTheme,
  Key,
  Markdown,
  type MarkdownTheme,
  Text,
  matchesKey,
  truncateToWidth,
  wrapTextWithAnsi,
} from "@earendil-works/pi-tui"
import { Type } from "typebox"

interface AskOption {
  label: string
  value: string
  description?: string
}

interface DisplayOption extends AskOption {
  id: string
  index?: number
  isOther?: boolean
  isSubmit?: boolean
}

interface TextAnswer {
  type: "text"
  label: string
  value: string
}

interface OptionAnswer {
  type: "option"
  label: string
  value: string
  index: number
}

interface OtherAnswer {
  type: "other"
  label: string
  value: string
}

type AskAnswer = TextAnswer | OptionAnswer | OtherAnswer
type AskUserQuestionStatus = "answered" | "cancelled" | "unavailable"
type AskUserQuestionMode = "text" | "single-select" | "multi-select"

interface AskUserQuestionResultDetails {
  status: AskUserQuestionStatus
  question: string
  context?: string
  mode: AskUserQuestionMode
  answers: AskAnswer[]
  note?: string
  message?: string
}

interface OptionAnswerResult {
  answers: AskAnswer[]
  note: string
}

interface StructuredExchangeEditorPrefillParams {
  question: string
  context?: string
  mode: Exclude<AskUserQuestionMode, "text">
  options: AskOption[]
}

interface StructuredExchangeEditorResponse {
  status: "answered" | "cancelled"
  answers: AskAnswer[]
  note: string
}

const OptionSchema = Type.Object({
  label: Type.String({
    description:
      'Display label for the option. If you recommend an option, place it first and append "(Recommended)" to the label.',
  }),
  value: Type.Optional(
    Type.String({
      description:
        "Optional machine-readable value returned for the option. Defaults to the label.",
    }),
  ),
  description: Type.Optional(
    Type.String({
      description: "Optional extra detail shown below the option.",
    }),
  ),
})

const AskUserQuestionParams = Type.Object({
  question: Type.String({
    description:
      "The single question to ask the user. Ask exactly one question per tool call.",
  }),
  details: Type.Optional(
    Type.String({
      description:
        "Optional extra context or instructions shown under the question.",
    }),
  ),
  options: Type.Optional(
    Type.Array(OptionSchema, {
      description:
        "Optional multiple-choice options. Omit or pass an empty array for free-form text input. Users will always be able to choose Other and type a custom answer when options are provided.",
    }),
  ),
  multiSelect: Type.Optional(
    Type.Boolean({
      description:
        "Set to true to allow multiple answers to be selected for a question.",
    }),
  ),
})

function normalizeOptions(
  options: Array<{
    label: string
    value?: string
    description?: string
  }> | undefined,
): AskOption[] {
  return (options || [])
    .map((option) => {
      const normalized: AskOption = {
        label: option.label.trim(),
        value: option.value?.trim() || option.label.trim(),
      }
      const description = option.description?.trim()
      if (description) normalized.description = description
      return normalized
    })
    .filter((option) => option.label.length > 0)
}

function getOtherLabel(options: AskOption[]): string {
  return options.some((option) => option.label.toLowerCase() === "other")
    ? "Other (custom)"
    : "Other"
}

function createEditorTheme(theme: {
  fg(color: string, text: string): string
}): EditorTheme {
  return {
    borderColor: (s) => theme.fg("accent", s),
    selectList: {
      selectedPrefix: (text) => theme.fg("accent", text),
      selectedText: (text) => theme.fg("accent", text),
      description: (text) => theme.fg("muted", text),
      scrollInfo: (text) => theme.fg("dim", text),
      noMatch: (text) => theme.fg("warning", text),
    },
  }
}

function createPromptMarkdownTheme(theme: {
  fg(color: string, text: string): string
  bold?: (text: string) => string
  italic?: (text: string) => string
  underline?: (text: string) => string
  strikethrough?: (text: string) => string
}): MarkdownTheme {
  const fg = (color: string) => (text: string) => theme.fg(color, text)
  const identity = (text: string) => text
  return {
    heading: fg("mdHeading"),
    link: fg("mdLink"),
    linkUrl: fg("mdLinkUrl"),
    code: fg("mdCode"),
    codeBlock: fg("mdCodeBlock"),
    codeBlockBorder: fg("mdCodeBlockBorder"),
    quote: fg("mdQuote"),
    quoteBorder: fg("mdQuoteBorder"),
    hr: fg("mdHr"),
    listBullet: fg("mdListBullet"),
    bold: theme.bold ?? identity,
    italic: theme.italic ?? identity,
    underline: theme.underline ?? identity,
    strikethrough: theme.strikethrough ?? identity,
    highlightCode: (code: string) => code.split("\n").map(fg("mdCodeBlock")),
  }
}

function formatAnswerForModel(answer: AskAnswer): string {
  switch (answer.type) {
    case "text":
      return answer.label
    case "other":
      return `Other: ${answer.label}`
    case "option":
      return `${answer.index}. ${answer.label}`
  }
}

function answerSortRank(answer: AskAnswer): number {
  switch (answer.type) {
    case "option":
      return answer.index
    case "other":
      return Number.MAX_SAFE_INTEGER - 1
    case "text":
      return Number.MAX_SAFE_INTEGER
  }
}

function sortAnswers(answers: AskAnswer[]): AskAnswer[] {
  return [...answers].sort((a, b) => answerSortRank(a) - answerSortRank(b))
}

function addWrapped(
  lines: string[],
  text: string,
  width: number,
  indent = "",
): void {
  const contentWidth = Math.max(1, width - indent.length)
  for (const line of wrapTextWithAnsi(text, contentWidth)) {
    lines.push(truncateToWidth(`${indent}${line}`, width))
  }
}

function buildQuestionMarkdown(
  question: string,
  context: string | undefined,
): string {
  const sections = [`## Question\n\n${question}`]

  if (context) {
    sections.unshift(context)
  }

  return sections.join("\n\n---\n\n")
}

function optionMatchesAnswer(option: AskOption, answer: AskAnswer): boolean {
  if (answer.type !== "option") return false
  return option.label === answer.label && option.value === answer.value
}

function pickerTopBorder(theme: any, width: number): string {
  return theme.fg("accent", "─".repeat(width))
}

function pickerBottomBorder(theme: any, width: number): string {
  return theme.fg("accent", "─".repeat(width))
}

class PromptQuestionComponent implements Component {
  private markdown: Markdown

  constructor(
    private text: string,
    markdownTheme: MarkdownTheme,
  ) {
    this.markdown = new Markdown(text, 0, 0, markdownTheme)
  }

  setText(text: string): void {
    this.text = text
    this.markdown.setText(text)
  }

  invalidate(): void {
    this.markdown.invalidate()
  }

  render(width: number): string[] {
    return this.markdown.render(width)
  }
}

function buildStructuredResult(
  status: AskUserQuestionStatus,
  question: string,
  mode: AskUserQuestionMode,
  answers: AskAnswer[],
  context?: string,
  message?: string,
  note?: string,
): AskUserQuestionResultDetails {
  const result: AskUserQuestionResultDetails = {
    status,
    question,
    mode,
    answers,
  }
  if (context !== undefined) result.context = context
  if (note !== undefined) result.note = note
  if (message !== undefined) result.message = message
  return result
}

function cancelledResult(
  question: string,
  mode: AskUserQuestionMode,
  context?: string,
) {
  const message = "User cancelled the question"
  return {
    content: [{ type: "text" as const, text: message }],
    details: buildStructuredResult(
      "cancelled",
      question,
      mode,
      [],
      context,
      message,
    ),
  }
}

function unavailableResult(
  question: string,
  mode: AskUserQuestionMode,
  message: string,
  context?: string,
) {
  return {
    content: [{ type: "text" as const, text: message }],
    details: buildStructuredResult(
      "unavailable",
      question,
      mode,
      [],
      context,
      message,
    ),
  }
}

function buildResult(
  question: string,
  context: string | undefined,
  mode: AskUserQuestionMode,
  answers: AskAnswer[],
  note?: string,
) {
  let text: string
  if (mode === "text") {
    const answer = answers[0]
    text =
      answer && answer.label.trim().length > 0
        ? `User answered: ${answer.label}`
        : "User submitted an empty response"
  } else if (mode === "single-select") {
    text = `User selected: ${formatAnswerForModel(answers[0]!)} `
  } else {
    text = `User selected:\n${answers.map((answer) => `- ${formatAnswerForModel(answer)}`).join("\n")}`
  }

  if (note) {
    text = `${text.trim()}\nNote: ${note}`
  }

  return {
    content: [{ type: "text" as const, text: text.trim() }],
    details: buildStructuredResult(
      "answered",
      question,
      mode,
      answers,
      context,
      undefined,
      note,
    ),
  }
}

export function buildStructuredExchangeEditorPrefill(
  params: StructuredExchangeEditorPrefillParams,
): string {
  const payload: Record<string, unknown> = {
    schema: "brunch.structured_exchange.editor",
    schemaVersion: 1,
    question: params.question,
    mode: params.mode,
    options: params.options.map((option, index) => ({
      index: index + 1,
      label: option.label,
      value: option.value,
      ...(option.description ? { description: option.description } : {}),
    })),
    instructions: [
      "Edit only response.",
      'For a selected listed option, add an answer like {"type":"option","label":"Alpha","value":"alpha","index":1}.',
      'For Other, add an answer like {"type":"other","label":"Custom answer","value":"Custom answer"}.',
      'Set response.note to a string. Use "" when there is no additional note.',
    ],
    response: { status: "cancelled", answers: [], note: "" },
  }
  if (params.context !== undefined) payload.context = params.context
  return JSON.stringify(payload, null, 2)
}

export function parseStructuredExchangeEditorResponse(
  value: string,
): StructuredExchangeEditorResponse | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    return null
  }

  if (!isRecord(parsed)) return null
  const response = parsed.response
  if (!isRecord(response)) return null

  if (response.status === "cancelled") {
    return { status: "cancelled", answers: [], note: "" }
  }
  if (response.status !== "answered") return null
  if (!Array.isArray(response.answers)) return null
  if (typeof response.note !== "string") return null

  const answers = response.answers.map(parseEditorAnswer)
  if (answers.some((answer) => answer === null)) return null
  return {
    status: "answered",
    answers: sortAnswers(answers as AskAnswer[]),
    note: response.note.trim(),
  }
}

function parseEditorAnswer(value: unknown): AskAnswer | null {
  if (!isRecord(value)) return null

  if (value.type === "option") {
    if (
      typeof value.label !== "string" ||
      typeof value.value !== "string" ||
      typeof value.index !== "number" ||
      !Number.isInteger(value.index) ||
      value.index < 1
    ) {
      return null
    }
    return {
      type: "option",
      label: value.label,
      value: value.value,
      index: value.index,
    }
  }

  if (value.type === "other") {
    if (typeof value.label !== "string" || typeof value.value !== "string") {
      return null
    }
    return { type: "other", label: value.label, value: value.value }
  }

  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

async function askOptionsWithEditor(
  ctx: any,
  question: string,
  context: string | undefined,
  mode: Exclude<AskUserQuestionMode, "text">,
  options: AskOption[],
): Promise<OptionAnswerResult | null | "invalid"> {
  if (typeof ctx.ui.editor !== "function") return "invalid"
  const prefillParams: StructuredExchangeEditorPrefillParams = {
    question,
    mode,
    options,
  }
  if (context !== undefined) prefillParams.context = context
  const edited = await ctx.ui.editor(
    buildStructuredExchangeEditorPrefill(prefillParams),
  )
  if (edited === undefined) return null

  const response = parseStructuredExchangeEditorResponse(edited)
  if (!response) return "invalid"
  if (response.status === "cancelled") return null

  if (mode === "single-select" && response.answers.length !== 1) {
    return "invalid"
  }
  if (mode === "multi-select" && response.answers.length === 0) {
    return "invalid"
  }
  return { answers: response.answers, note: response.note }
}

async function askSingleChoice(
  ctx: any,
  _question: string,
  _context: string | undefined,
  options: AskOption[],
): Promise<OptionAnswerResult | null> {
  const otherLabel = getOtherLabel(options)
  const allOptions: DisplayOption[] = [
    ...options.map((option, index) => ({
      ...option,
      id: `option:${index}`,
      index: index + 1,
    })),
    { id: "other", label: otherLabel, value: "__other__", isOther: true },
  ]

  return ctx.ui.custom(
    (
      tui: any,
      theme: any,
      _kb: any,
      done: (result: OptionAnswerResult | null) => void,
    ) => {
      let optionIndex = 0
      let editMode = false
      let noteMode = false
      let selectedAnswer: AskAnswer | undefined
      let cachedLines: string[] | undefined
      const editor = new Editor(tui, createEditorTheme(theme))
      const noteEditor = new Editor(tui, createEditorTheme(theme))

      editor.onSubmit = (value) => {
        const trimmed = value.trim()
        if (!trimmed) return
        selectedAnswer = { type: "other", label: trimmed, value: trimmed }
        editMode = false
        noteMode = true
        noteEditor.setText("")
        refresh()
      }

      noteEditor.onSubmit = (value) => {
        if (!selectedAnswer) return
        done({ answers: [selectedAnswer], note: value.trim() })
      }

      function refresh() {
        cachedLines = undefined
        tui.requestRender()
      }

      function handleInput(data: string) {
        if (noteMode) {
          if (matchesKey(data, Key.escape)) {
            noteMode = false
            noteEditor.setText("")
            refresh()
            return
          }
          noteEditor.handleInput(data)
          refresh()
          return
        }

        if (editMode) {
          if (matchesKey(data, Key.escape)) {
            editMode = false
            editor.setText("")
            refresh()
            return
          }
          editor.handleInput(data)
          refresh()
          return
        }

        if (matchesKey(data, Key.up)) {
          optionIndex = Math.max(0, optionIndex - 1)
          refresh()
          return
        }
        if (matchesKey(data, Key.down)) {
          optionIndex = Math.min(allOptions.length - 1, optionIndex + 1)
          refresh()
          return
        }
        if (matchesKey(data, Key.enter)) {
          const selected = allOptions[optionIndex]!
          if (selected.isOther) {
            editMode = true
            editor.setText("")
            refresh()
            return
          }
          selectedAnswer = {
            type: "option",
            label: selected.label,
            value: selected.value,
            index: selected.index!,
          }
          noteMode = true
          noteEditor.setText("")
          refresh()
          return
        }
        if (matchesKey(data, Key.escape)) {
          done(null)
        }
      }

      function render(width: number): string[] {
        if (cachedLines) return cachedLines

        const lines: string[] = []
        const add = (text: string) => lines.push(truncateToWidth(text, width))

        add(pickerTopBorder(theme, width))

        if (noteMode) {
          add(theme.fg("success", " Answer selected"))
          if (selectedAnswer) {
            add(` ${formatAnswerForModel(selectedAnswer)}`)
          }
          lines.push("")
          add(theme.fg("muted", " Optional note:"))
          for (const line of noteEditor.render(Math.max(1, width - 2))) {
            add(` ${line}`)
          }
          lines.push("")
          add(theme.fg("dim", " Enter to submit • Esc to go back"))
          add(pickerBottomBorder(theme, width))
          cachedLines = lines
          return lines
        }

        for (let i = 0; i < allOptions.length; i++) {
          const option = allOptions[i]!
          const selected = i === optionIndex
          const prefix = selected ? theme.fg("accent", "> ") : "  "
          const label = option.isOther
            ? option.label
            : `${option.index}. ${option.label}`
          const styled = selected
            ? theme.fg("accent", label)
            : theme.fg("text", label)
          add(`${prefix}${styled}`)
          if (option.description) {
            const descriptionPrefix = selected ? theme.fg("accent", "│ ") : "  "
            addWrapped(
              lines,
              theme.fg("muted", option.description),
              width,
              descriptionPrefix,
            )
          }
        }

        if (editMode) {
          lines.push("")
          add(theme.fg("muted", " Write your custom answer:"))
          for (const line of editor.render(Math.max(1, width - 2))) {
            add(` ${line}`)
          }
          lines.push("")
          add(theme.fg("dim", " Enter to submit • Esc to go back"))
        } else {
          lines.push("")
          add(theme.fg("dim", " ↑↓ navigate • Enter select • Esc cancel"))
        }

        add(pickerBottomBorder(theme, width))
        cachedLines = lines
        return lines
      }

      return {
        render,
        invalidate: () => {
          cachedLines = undefined
        },
        handleInput,
      }
    },
  )
}

async function askMultiChoice(
  ctx: any,
  _question: string,
  _context: string | undefined,
  options: AskOption[],
): Promise<OptionAnswerResult | null> {
  const otherLabel = getOtherLabel(options)
  const choiceItems: DisplayOption[] = options.map((option, index) => ({
    ...option,
    id: `option:${index}`,
    index: index + 1,
  }))
  const submitItem: DisplayOption = {
    id: "submit",
    label: "Submit",
    value: "__submit__",
    isSubmit: true,
  }
  const allItems: DisplayOption[] = [
    ...choiceItems,
    { id: "other", label: otherLabel, value: "__other__", isOther: true },
    submitItem,
  ]

  return ctx.ui.custom(
    (
      tui: any,
      theme: any,
      _kb: any,
      done: (result: OptionAnswerResult | null) => void,
    ) => {
      let optionIndex = 0
      let editMode = false
      let noteMode = false
      let cachedLines: string[] | undefined
      const selected = new Map<string, AskAnswer>()
      const editor = new Editor(tui, createEditorTheme(theme))
      const noteEditor = new Editor(tui, createEditorTheme(theme))

      editor.onSubmit = (value) => {
        const trimmed = value.trim()
        if (!trimmed) return
        selected.set("other", { type: "other", label: trimmed, value: trimmed })
        editMode = false
        refresh()
      }

      noteEditor.onSubmit = (value) => {
        done({
          answers: sortAnswers(Array.from(selected.values())),
          note: value.trim(),
        })
      }

      function refresh() {
        cachedLines = undefined
        tui.requestRender()
      }

      function toggleOption(item: DisplayOption) {
        if (selected.has(item.id)) {
          selected.delete(item.id)
        } else {
          selected.set(item.id, {
            type: "option",
            label: item.label,
            value: item.value,
            index: item.index!,
          })
        }
        refresh()
      }

      function handleInput(data: string) {
        if (noteMode) {
          if (matchesKey(data, Key.escape)) {
            noteMode = false
            noteEditor.setText("")
            refresh()
            return
          }
          noteEditor.handleInput(data)
          refresh()
          return
        }

        if (editMode) {
          if (matchesKey(data, Key.escape)) {
            editMode = false
            editor.setText(selected.get("other")?.label || "")
            refresh()
            return
          }
          editor.handleInput(data)
          refresh()
          return
        }

        if (matchesKey(data, Key.up)) {
          optionIndex = Math.max(0, optionIndex - 1)
          refresh()
          return
        }
        if (matchesKey(data, Key.down)) {
          optionIndex = Math.min(allItems.length - 1, optionIndex + 1)
          refresh()
          return
        }

        const current = allItems[optionIndex]!
        if (matchesKey(data, Key.space)) {
          if (current.isSubmit) return
          if (current.isOther) {
            if (selected.has("other")) {
              selected.delete("other")
              refresh()
            } else {
              editMode = true
              editor.setText("")
              refresh()
            }
            return
          }
          toggleOption(current)
          return
        }

        if (matchesKey(data, Key.enter)) {
          if (current.isSubmit) {
            if (selected.size > 0) {
              noteMode = true
              noteEditor.setText("")
              refresh()
            }
            return
          }
          if (current.isOther) {
            editMode = true
            editor.setText(selected.get("other")?.label || "")
            refresh()
            return
          }
          toggleOption(current)
          return
        }

        if (matchesKey(data, Key.escape)) {
          done(null)
        }
      }

      function render(width: number): string[] {
        if (cachedLines) return cachedLines

        const lines: string[] = []
        const add = (text: string) => lines.push(truncateToWidth(text, width))

        add(pickerTopBorder(theme, width))

        if (noteMode) {
          add(theme.fg("success", ` ${selected.size} answer(s) selected`))
          for (const answer of sortAnswers(Array.from(selected.values()))) {
            add(` ${formatAnswerForModel(answer)}`)
          }
          lines.push("")
          add(theme.fg("muted", " Optional note:"))
          for (const line of noteEditor.render(Math.max(1, width - 2))) {
            add(` ${line}`)
          }
          lines.push("")
          add(theme.fg("dim", " Enter to submit • Esc to go back"))
          add(pickerBottomBorder(theme, width))
          cachedLines = lines
          return lines
        }

        for (let i = 0; i < allItems.length; i++) {
          const item = allItems[i]!
          const isFocused = i === optionIndex
          const prefix = isFocused ? theme.fg("accent", "> ") : "  "

          if (item.isSubmit) {
            const label =
              selected.size > 0
                ? `✓ ${item.label} (${selected.size} selected)`
                : `○ ${item.label}`
            const styled = isFocused
              ? theme.fg("accent", label)
              : theme.fg(selected.size > 0 ? "success" : "dim", label)
            add(`${prefix}${styled}`)
            continue
          }

          if (item.isOther) {
            const other = selected.get("other")
            const marker = other ? "[x]" : "[ ]"
            const suffix = other ? ` — ${other.label}` : ""
            const styled = isFocused
              ? theme.fg("accent", `${marker} ${item.label}${suffix}`)
              : theme.fg(
                  other ? "success" : "text",
                  `${marker} ${item.label}${suffix}`,
                )
            add(`${prefix}${styled}`)
            continue
          }

          const checked = selected.has(item.id)
          const marker = checked ? "[x]" : "[ ]"
          const label = `${marker} ${item.index}. ${item.label}`
          const styled = isFocused
            ? theme.fg("accent", label)
            : theme.fg(checked ? "success" : "text", label)
          add(`${prefix}${styled}`)
          if (item.description) {
            const descriptionPrefix = isFocused
              ? theme.fg("accent", "│ ")
              : "  "
            addWrapped(
              lines,
              theme.fg("muted", item.description),
              width,
              descriptionPrefix,
            )
          }
        }

        if (editMode) {
          lines.push("")
          add(theme.fg("muted", " Write your custom answer:"))
          for (const line of editor.render(Math.max(1, width - 2))) {
            add(` ${line}`)
          }
          lines.push("")
          add(theme.fg("dim", " Enter to save • Esc to go back"))
        } else {
          lines.push("")
          if (selected.size === 0) {
            add(
              theme.fg(
                "warning",
                " Select at least one answer before submitting.",
              ),
            )
          }
          add(
            theme.fg(
              "dim",
              " ↑↓ navigate • Space toggle • Enter edit/submit • Esc cancel",
            ),
          )
        }

        add(pickerBottomBorder(theme, width))
        cachedLines = lines
        return lines
      }

      return {
        render,
        invalidate: () => {
          cachedLines = undefined
        },
        handleInput,
      }
    },
  )
}

let uiLock: Promise<void> = Promise.resolve()

function withUILock<T>(fn: () => Promise<T>): Promise<T> {
  const previous = uiLock
  let release: (() => void) | undefined
  uiLock = new Promise<void>((resolve) => {
    release = resolve
  })
  return previous.then(fn).finally(() => release?.())
}

export default function askUserQuestion(pi: ExtensionAPI) {
  pi.registerTool({
    name: "ask_user_question",
    label: "ask_user_question",
    renderShell: "self",
    description:
      "Ask the user a single question and pause execution until they answer. Use this when requirements are ambiguous, user preferences are needed, a decision would materially affect implementation, or you need confirmation before proceeding. Ask exactly one question per tool call, and prefer multiple separate tool calls over bundling unrelated questions together.",
    promptSnippet:
      "Ask exactly one clarifying, preference, confirmation, or decision question before continuing.",
    promptGuidelines: [
      "Use ask_user_question when a user decision would materially affect the next step.",
      "Ask exactly one question per ask_user_question tool call.",
      "Use ask_user_question with multiSelect: true only when multiple answers to the same question are valid.",
      'ask_user_question always lets the user select "Other" when options are provided.',
    ],
    parameters: AskUserQuestionParams,

    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const options = normalizeOptions(params.options)
      const context = params.details?.trim() || undefined
      const mode: AskUserQuestionMode =
        options.length === 0
          ? "text"
          : params.multiSelect
            ? "multi-select"
            : "single-select"

      if (signal?.aborted) {
        return cancelledResult(params.question, mode, context)
      }

      if (!ctx.hasUI) {
        return unavailableResult(
          params.question,
          mode,
          "ask_user_question requires interactive mode UI",
          context,
        )
      }

      return withUILock(async () => {
        if (mode === "text") {
          const answer = await ctx.ui.editor("Answer the question shown above")
          if (answer === undefined) {
            return cancelledResult(params.question, mode, context)
          }
          const trimmed = answer.trim()
          return buildResult(params.question, context, mode, [
            { type: "text", label: trimmed, value: trimmed },
          ])
        }

        if (mode === "single-select") {
          const result =
            typeof ctx.ui.custom === "function"
              ? await askSingleChoice(ctx, params.question, context, options)
              : await askOptionsWithEditor(
                  ctx,
                  params.question,
                  context,
                  mode,
                  options,
                )
          if (result === "invalid") {
            return unavailableResult(
              params.question,
              mode,
              "ask_user_question editor fallback returned invalid JSON",
              context,
            )
          }
          if (!result) {
            return cancelledResult(params.question, mode, context)
          }
          return buildResult(
            params.question,
            context,
            mode,
            result.answers,
            result.note,
          )
        }

        const result =
          typeof ctx.ui.custom === "function"
            ? await askMultiChoice(ctx, params.question, context, options)
            : await askOptionsWithEditor(
                ctx,
                params.question,
                context,
                mode,
                options,
              )
        if (result === "invalid") {
          return unavailableResult(
            params.question,
            mode,
            "ask_user_question editor fallback returned invalid JSON",
            context,
          )
        }
        if (!result) {
          return cancelledResult(params.question, mode, context)
        }
        return buildResult(
          params.question,
          context,
          mode,
          result.answers,
          result.note,
        )
      })
    },

    renderCall(args, _theme, context) {
      if (!context.argsComplete) {
        return new Text("", 0, 0)
      }
      const text = buildQuestionMarkdown(
        args.question,
        args.details?.trim() || undefined,
      )
      const prompt =
        context.lastComponent instanceof PromptQuestionComponent
          ? context.lastComponent
          : undefined
      if (prompt) {
        prompt.setText(text)
        return prompt
      }
      return new PromptQuestionComponent(
        text,
        createPromptMarkdownTheme(_theme),
      )
    },

    renderResult(result, _options, theme, context) {
      const details = result.details as AskUserQuestionResultDetails | undefined
      if (!details) {
        const first = result.content[0]
        return new Text(first?.type === "text" ? first.text : "", 0, 0)
      }

      if (details.status === "cancelled") {
        return new Text(
          theme.fg("warning", details.message || "Cancelled"),
          0,
          0,
        )
      }

      if (details.status === "unavailable") {
        return new Text(
          theme.fg(
            "warning",
            details.message || "ask_user_question unavailable",
          ),
          0,
          0,
        )
      }

      const selectedLines = details.answers.map((answer) => {
        switch (answer.type) {
          case "text":
            return `${theme.fg("success", "✓ Selected: ")}${theme.fg("accent", answer.label || "(empty response)")}`
          case "other":
            return `${theme.fg("success", "✓ Selected: ")}${theme.fg("muted", "Other: ")}${theme.fg("accent", answer.label)}`
          case "option":
            return `${theme.fg("success", "✓ Selected: ")}${theme.fg("accent", `${answer.index}. ${answer.label}`)}`
        }
      })
      const optionArgs = context?.args as { options?: AskOption[] } | undefined
      const options = normalizeOptions(optionArgs?.options)
      const rejectedLines = options.flatMap((option, index) =>
        details.answers.some((answer) => optionMatchesAnswer(option, answer))
          ? []
          : [theme.fg("dim", `○ Rejected: ${index + 1}. ${option.label}`)],
      )

      const noteLines =
        details.note && details.note.length > 0
          ? [
              `${theme.fg("muted", "Note: ")}${theme.fg("accent", details.note)}`,
            ]
          : []

      return new Text(
        [...selectedLines, ...rejectedLines, ...noteLines].join("\n"),
        0,
        0,
      )
    },
  })
}
