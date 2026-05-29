import { defineTool } from "@earendil-works/pi-coding-agent"
import { Type } from "typebox"

import {
  markdownEscape,
  normalizeOptionalText,
  renderMarkdownResult,
} from "./shared/markdown.js"
import {
  isRecord,
  STRUCTURED_EXCHANGE_REQUEST_SCHEMA,
  type StructuredExchangeChoice,
  type StructuredExchangeRequestDetails,
} from "./shared/model.js"

export const REQUEST_CHOICES_TOOL = "request_choices" as const

const ChoiceSchema = Type.Object({
  id: Type.String({
    description: "Stable choice id from the corresponding present_* entry.",
  }),
  label: Type.String({
    description: "Short choice label shown in the live selection UI.",
  }),
})

export const RequestChoicesParams = Type.Object({
  exchangeId: Type.String({
    description:
      "The structured exchange id from the corresponding present_options entry.",
  }),
  respondsToPresentTool: Type.Literal("present_options"),
  prompt: Type.String({
    description:
      "Short live-input prompt. Do not repeat the presented content.",
  }),
  choices: Type.Array(ChoiceSchema, {
    description: "Listed choices available for this multi-choice response.",
  }),
  allowOther: Type.Optional(
    Type.Boolean({ description: "Whether the user may choose Other." }),
  ),
  allowNone: Type.Optional(
    Type.Boolean({ description: "Whether the user may choose None." }),
  ),
  commentPrompt: Type.Optional(
    Type.String({
      description:
        "Prompt for an optional comment. Required when Other or None is selected.",
    }),
  ),
})

interface EditorChoice {
  id: string
  label?: string
}

interface EditorResponse {
  status: "answered" | "cancelled"
  choices: EditorChoice[]
  comment: string
}

function buildEditorPrefill(params: {
  prompt: string
  choices: readonly StructuredExchangeChoice[]
  allowOther?: boolean
  allowNone?: boolean
  commentPrompt?: string
}): string {
  const choices = [
    ...params.choices,
    ...(params.allowOther ? [{ id: "other", label: "Other" }] : []),
    ...(params.allowNone ? [{ id: "none", label: "None" }] : []),
  ]
  return JSON.stringify(
    {
      schema: "brunch.structured_exchange.request_choices.editor",
      schemaVersion: 1,
      prompt: params.prompt,
      mode: "multi-choice",
      choices,
      instructions: [
        "Edit only response.",
        "Set response.status to answered or cancelled.",
        "For each selected choice, include its id in response.choices.",
        "Set response.comment to a string. Other or None requires a nonblank comment.",
      ],
      commentPrompt: params.commentPrompt ?? "Optional comment",
      response: { status: "cancelled", choices: [], comment: "" },
    },
    null,
    2,
  )
}

function parseEditorResponse(value: string): EditorResponse | null {
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
    return { status: "cancelled", choices: [], comment: "" }
  }
  if (response.status !== "answered") return null
  if (!Array.isArray(response.choices)) return null
  if (typeof response.comment !== "string") return null

  const choices = response.choices.map((choice): EditorChoice | null => {
    if (!isRecord(choice) || typeof choice.id !== "string") return null
    return {
      id: choice.id,
      ...(typeof choice.label === "string" ? { label: choice.label } : {}),
    }
  })
  if (choices.some((choice) => choice === null)) return null
  return {
    status: "answered",
    choices: choices as EditorChoice[],
    comment: response.comment,
  }
}

function requestMarkdown(details: StructuredExchangeRequestDetails): string {
  if (details.status === "cancelled")
    return "### Response\n\n_User cancelled the request._"
  if (details.status === "unavailable") {
    return `### Response\n\n_${details.message ?? "Response UI unavailable."}_`
  }

  const lines = ["### Response"]
  if (details.choices && details.choices.length > 0) {
    lines.push(
      "",
      ...details.choices.map((choice) => `- ${markdownEscape(choice.label)}`),
    )
  }
  if (details.comment) lines.push("", "Comment:", "", `> ${details.comment}`)
  return lines.join("\n")
}

function unavailable(
  base: Omit<StructuredExchangeRequestDetails, "status">,
  message: string,
) {
  const details: StructuredExchangeRequestDetails = {
    ...base,
    status: "unavailable",
    message,
  }
  return {
    content: [{ type: "text" as const, text: requestMarkdown(details) }],
    details,
  }
}

function matchSelectedChoices(
  selected: readonly EditorChoice[],
  params: {
    choices: readonly StructuredExchangeChoice[]
    allowOther?: boolean
    allowNone?: boolean
  },
): StructuredExchangeChoice[] | string {
  const allowed = new Map(params.choices.map((choice) => [choice.id, choice]))
  if (params.allowOther) allowed.set("other", { id: "other", label: "Other" })
  if (params.allowNone) allowed.set("none", { id: "none", label: "None" })

  const matched: StructuredExchangeChoice[] = []
  const seen = new Set<string>()
  for (const choice of selected) {
    const known = allowed.get(choice.id)
    if (!known)
      return `request_choices received unknown choice id: ${choice.id}`
    if (seen.has(choice.id)) continue
    seen.add(choice.id)
    matched.push({ id: known.id, label: choice.label ?? known.label })
  }
  if (matched.length === 0)
    return "request_choices requires at least one choice"
  return matched
}

export const requestChoicesTool = defineTool({
  name: REQUEST_CHOICES_TOOL,
  label: "Request choices",
  description:
    "Collect one-or-more user choices as the request half of a Brunch structured exchange. Use only after the corresponding present_options tool result has displayed the offer content.",
  promptSnippet: "Request multiple choices after presenting structured options",
  promptGuidelines: [
    "Use request_choices only after the matching present_options tool.",
    "Do not repeat the present_options markdown content in request_choices parameters; reference it by exchangeId.",
    "Require a comment when the response selects Other or None.",
  ],
  parameters: RequestChoicesParams,
  executionMode: "sequential",

  async execute(toolCallId, params, _signal, _onUpdate, ctx) {
    const choices: StructuredExchangeChoice[] = params.choices.map(
      (choice) => ({
        id: choice.id,
        label: choice.label,
      }),
    )
    const base = {
      schema: STRUCTURED_EXCHANGE_REQUEST_SCHEMA,
      schemaVersion: 1 as const,
      exchangeId: params.exchangeId,
      requestTool: REQUEST_CHOICES_TOOL,
      respondsTo: {
        exchangeId: params.exchangeId,
        presentTool: params.respondsToPresentTool,
      },
      createdAtToolCallId: toolCallId,
    }

    if (!ctx.hasUI || typeof ctx.ui.editor !== "function") {
      return unavailable(base, "request_choices requires interactive UI")
    }

    const editorPrefillParams: Parameters<typeof buildEditorPrefill>[0] = {
      prompt: params.prompt,
      choices,
    }
    if (params.allowOther !== undefined)
      editorPrefillParams.allowOther = params.allowOther
    if (params.allowNone !== undefined)
      editorPrefillParams.allowNone = params.allowNone
    if (params.commentPrompt !== undefined)
      editorPrefillParams.commentPrompt = params.commentPrompt

    const edited = await ctx.ui.editor(buildEditorPrefill(editorPrefillParams))
    if (edited === undefined) {
      const details: StructuredExchangeRequestDetails = {
        ...base,
        status: "cancelled",
      }
      return {
        content: [{ type: "text" as const, text: requestMarkdown(details) }],
        details,
      }
    }

    const response = parseEditorResponse(edited)
    if (!response) {
      return unavailable(
        base,
        "request_choices editor fallback returned invalid JSON",
      )
    }
    if (response.status === "cancelled") {
      const details: StructuredExchangeRequestDetails = {
        ...base,
        status: "cancelled",
      }
      return {
        content: [{ type: "text" as const, text: requestMarkdown(details) }],
        details,
      }
    }

    const matchParams: Parameters<typeof matchSelectedChoices>[1] = { choices }
    if (params.allowOther !== undefined)
      matchParams.allowOther = params.allowOther
    if (params.allowNone !== undefined) matchParams.allowNone = params.allowNone

    const matched = matchSelectedChoices(response.choices, matchParams)
    if (typeof matched === "string") return unavailable(base, matched)

    const comment = normalizeOptionalText(response.comment)
    if (
      matched.some((choice) => choice.id === "other" || choice.id === "none") &&
      comment === undefined
    ) {
      return unavailable(
        base,
        "request_choices requires a comment for Other or None selections",
      )
    }

    const details: StructuredExchangeRequestDetails = {
      ...base,
      status: "answered",
      choices: matched,
      ...(comment !== undefined ? { comment } : {}),
    }
    return {
      content: [{ type: "text" as const, text: requestMarkdown(details) }],
      details,
    }
  },

  renderCall() {
    return renderMarkdownResult({ content: [] })
  },

  renderResult(result, _options, theme) {
    return renderMarkdownResult(result, theme)
  },
})
