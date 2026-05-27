import { Type, type Static } from "typebox"
import { Value } from "typebox/value"

const NonBlankStringSchema = Type.String({ minLength: 1, pattern: "\\S" })

export const StructuredQuestionOptionSchema = Type.Object(
  {
    id: NonBlankStringSchema,
    label: NonBlankStringSchema,
    description: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
)

const TextQuestionSchema = Type.Object(
  {
    id: NonBlankStringSchema,
    mode: Type.Literal("text"),
    prompt: NonBlankStringSchema,
    required: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
)

const SingleSelectQuestionSchema = Type.Object(
  {
    id: NonBlankStringSchema,
    mode: Type.Literal("singleSelect"),
    prompt: NonBlankStringSchema,
    options: Type.Array(StructuredQuestionOptionSchema, { minItems: 1 }),
    allowFreeform: Type.Optional(Type.Boolean()),
    required: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
)

const MultiSelectQuestionSchema = Type.Object(
  {
    id: NonBlankStringSchema,
    mode: Type.Literal("multiSelect"),
    prompt: NonBlankStringSchema,
    options: Type.Array(StructuredQuestionOptionSchema, { minItems: 1 }),
    allowFreeform: Type.Optional(Type.Boolean()),
    required: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
)

export const StructuredQuestionSchema = Type.Union([
  TextQuestionSchema,
  SingleSelectQuestionSchema,
  MultiSelectQuestionSchema,
])

export const StructuredQuestionParamsSchema = Type.Union([
  TextQuestionSchema,
  SingleSelectQuestionSchema,
  MultiSelectQuestionSchema,
  Type.Object(
    {
      id: NonBlankStringSchema,
      mode: Type.Literal("questionnaire"),
      prompt: NonBlankStringSchema,
      questions: Type.Array(StructuredQuestionSchema, { minItems: 1 }),
    },
    { additionalProperties: false },
  ),
])

const SelectedOptionSchema = Type.Object(
  {
    id: NonBlankStringSchema,
    label: NonBlankStringSchema,
  },
  { additionalProperties: false },
)

const TextAnswerSchema = Type.Object(
  {
    questionId: NonBlankStringSchema,
    mode: Type.Literal("text"),
    value: Type.String(),
  },
  { additionalProperties: false },
)

const SingleSelectAnswerSchema = Type.Object(
  {
    questionId: NonBlankStringSchema,
    mode: Type.Literal("singleSelect"),
    selectedOption: Type.Optional(SelectedOptionSchema),
    freeform: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
)

const MultiSelectAnswerSchema = Type.Object(
  {
    questionId: NonBlankStringSchema,
    mode: Type.Literal("multiSelect"),
    selectedOptions: Type.Array(SelectedOptionSchema),
    freeform: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
)

export const StructuredQuestionAnswerSchema = Type.Union([
  TextAnswerSchema,
  SingleSelectAnswerSchema,
  MultiSelectAnswerSchema,
])

export const StructuredQuestionTransportSchema = Type.Object(
  {
    surface: Type.Union([
      Type.Literal("tui-custom"),
      Type.Literal("rpc-editor"),
      Type.Literal("rpc-dialog"),
      Type.Literal("headless"),
      Type.Literal("test"),
    ]),
    requestId: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
)

export const StructuredQuestionResultDetailsSchema = Type.Object(
  {
    schema: Type.Literal("brunch.structured_question.result"),
    schemaVersion: Type.Literal(1),
    status: Type.Union([
      Type.Literal("answered"),
      Type.Literal("skipped"),
      Type.Literal("cancelled"),
      Type.Literal("unavailable"),
    ]),
    mode: Type.Union([
      Type.Literal("text"),
      Type.Literal("singleSelect"),
      Type.Literal("multiSelect"),
      Type.Literal("questionnaire"),
    ]),
    prompt: NonBlankStringSchema,
    questions: Type.Array(StructuredQuestionSchema, { minItems: 1 }),
    answers: Type.Array(StructuredQuestionAnswerSchema),
    transport: StructuredQuestionTransportSchema,
    message: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
)

export type StructuredQuestionParams = Static<typeof StructuredQuestionParamsSchema>
export type StructuredQuestion = Static<typeof StructuredQuestionSchema>
export type StructuredQuestionAnswer = Static<typeof StructuredQuestionAnswerSchema>
export type StructuredQuestionTransport = Static<typeof StructuredQuestionTransportSchema>
export type StructuredQuestionResultDetails = Static<typeof StructuredQuestionResultDetailsSchema>
export type StructuredQuestionStatus = StructuredQuestionResultDetails["status"]

export interface StructuredQuestionContentPart {
  type: "text"
  text: string
}

export interface StructuredQuestionToolResult {
  content: StructuredQuestionContentPart[]
  details: StructuredQuestionResultDetails
}

export function parseStructuredQuestionParams(
  value: unknown,
): StructuredQuestionParams {
  return Value.Parse(StructuredQuestionParamsSchema, value)
}

export function isTerminalStructuredQuestionResultDetails(
  value: unknown,
): value is StructuredQuestionResultDetails {
  if (!Value.Check(StructuredQuestionResultDetailsSchema, value)) {
    return false
  }
  return (
    value.status === "answered" ||
    value.status === "skipped" ||
    value.status === "cancelled"
  )
}

export function buildStructuredQuestionResult(input: {
  params: StructuredQuestionParams
  status: StructuredQuestionStatus
  answers?: StructuredQuestionAnswer[]
  transport: StructuredQuestionTransport
  message?: string
}): StructuredQuestionToolResult {
  const details = Value.Parse(StructuredQuestionResultDetailsSchema, {
    schema: "brunch.structured_question.result",
    schemaVersion: 1,
    status: input.status,
    mode: input.params.mode,
    prompt: input.params.prompt,
    questions: questionsFromParams(input.params),
    answers: input.answers ?? [],
    transport: input.transport,
    ...(input.message ? { message: input.message } : {}),
  })
  return {
    content: structuredQuestionContent(details),
    details,
  }
}

export function structuredQuestionContent(
  details: StructuredQuestionResultDetails,
): StructuredQuestionContentPart[] {
  return [{ type: "text", text: structuredQuestionSummary(details) }]
}

export function structuredQuestionSummary(
  details: StructuredQuestionResultDetails,
): string {
  if (details.status !== "answered") {
    return details.message
      ? `Structured question ${details.status}: ${details.message}`
      : `Structured question ${details.status}.`
  }

  if (details.answers.length === 0) return "Structured question answered."

  const lines = details.answers.map((answer) => {
    const question = details.questions.find(
      (candidate) => candidate.id === answer.questionId,
    )
    const label = question ? question.prompt : answer.questionId
    return `${label}: ${formatAnswer(answer)}`
  })
  return lines.join("\n")
}

function questionsFromParams(
  params: StructuredQuestionParams,
): StructuredQuestion[] {
  if (params.mode === "questionnaire") return params.questions
  return [params]
}

function formatAnswer(answer: StructuredQuestionAnswer): string {
  if (answer.mode === "text") return answer.value || "(empty response)"
  if (answer.mode === "singleSelect") {
    const selected = answer.selectedOption?.label
    const freeform = answer.freeform ? `freeform: ${answer.freeform}` : null
    return [selected, freeform].filter(Boolean).join("; ") || "(no selection)"
  }
  const selected = answer.selectedOptions
    .map((option) => option.label)
    .join(", ")
  const freeform = answer.freeform ? `freeform: ${answer.freeform}` : null
  return (
    [selected || null, freeform].filter(Boolean).join("; ") || "(no selections)"
  )
}
