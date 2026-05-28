import {
  STRUCTURED_EXCHANGE_RESULT_SCHEMA,
  type StructuredExchangeAnswer,
  type StructuredExchangeMode,
  type StructuredExchangeOption,
} from "../../../../../structured-exchange.js"
import { isRecord } from "./model.js"

export interface StructuredExchangeEditorPrefillParams {
  question: string
  context?: string
  mode: Exclude<StructuredExchangeMode, "text">
  options: StructuredExchangeOption[]
}

interface StructuredExchangeEditorResponse {
  status: "answered" | "cancelled"
  answers: StructuredExchangeAnswer[]
  note: string
}

function answerSortRank(answer: StructuredExchangeAnswer): number {
  switch (answer.type) {
    case "option":
      return answer.index
    case "other":
      return Number.MAX_SAFE_INTEGER - 1
    case "text":
      return Number.MAX_SAFE_INTEGER
  }
}

function sortAnswers(
  answers: StructuredExchangeAnswer[],
): StructuredExchangeAnswer[] {
  return [...answers].sort((a, b) => answerSortRank(a) - answerSortRank(b))
}

function parseEditorAnswer(value: unknown): StructuredExchangeAnswer | null {
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

function buildLegacyResult(
  status: "answered" | "cancelled" | "unavailable",
  params: StructuredExchangeEditorPrefillParams,
  answers: StructuredExchangeAnswer[],
  note: string,
  message?: string,
) {
  const selected = answers
    .map((answer) =>
      answer.type === "option"
        ? `${answer.index}. ${answer.label}`
        : answer.type === "other"
          ? `Other: ${answer.label}`
          : answer.label,
    )
    .join("\n")
  const text =
    status === "answered"
      ? [
          `User selected:${selected ? `\n${selected}` : ""}`,
          note ? `Note: ${note}` : undefined,
        ]
          .filter(Boolean)
          .join("\n")
      : (message ?? `User ${status} the question`)

  return {
    content: [{ type: "text" as const, text }],
    details: {
      schema: STRUCTURED_EXCHANGE_RESULT_SCHEMA,
      schemaVersion: 1 as const,
      status,
      question: params.question,
      ...(params.context !== undefined ? { context: params.context } : {}),
      mode: params.mode,
      options: params.options,
      answers,
      rejectedOptions: params.options.filter(
        (option) =>
          !answers.some(
            (answer) =>
              answer.type === "option" &&
              answer.label === option.label &&
              answer.value === option.value,
          ),
      ),
      note,
      transport: { surface: "rpc-editor" as const },
      ...(message !== undefined ? { message } : {}),
    },
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
    answers: sortAnswers(answers as StructuredExchangeAnswer[]),
    note: response.note.trim(),
  }
}

export function structuredExchangeResultFromEditor(
  params: StructuredExchangeEditorPrefillParams,
  edited: string | undefined,
) {
  const response = parseStructuredExchangeEditorResponse(edited ?? "")
  if (edited === undefined || response?.status === "cancelled") {
    return buildLegacyResult(
      "cancelled",
      params,
      [],
      "",
      "User cancelled the question",
    )
  }
  if (!response) {
    return buildLegacyResult(
      "unavailable",
      params,
      [],
      "",
      "structured_exchange editor fallback returned invalid JSON",
    )
  }
  return buildLegacyResult("answered", params, response.answers, response.note)
}
