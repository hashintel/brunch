import { describe, expect, it } from "vitest"

import registerStructuredExchange, {
  PRESENT_OPTIONS_TOOL,
  REQUEST_CHOICE_TOOL,
  REQUEST_CHOICES_TOOL,
} from "../extensions/structured-exchange/index.js"
import {
  findIncompleteStructuredExchangePresents,
  isStructuredExchangePresentDetails,
  isStructuredExchangeRequestDetails,
} from "../extensions/structured-exchange/shared/recovery.js"

interface ToolTextContent {
  type: "text"
  text: string
}

interface ToolExecutionResult {
  content: ToolTextContent[]
  details: any
}

interface RegisteredTool {
  name: string
  executionMode?: string
  execute: (
    toolCallId: string,
    params: Record<string, unknown>,
    signal: AbortSignal | undefined,
    onUpdate: unknown,
    ctx: unknown,
  ) => Promise<ToolExecutionResult>
  renderResult: (
    result: ToolExecutionResult,
    options: unknown,
    theme: FakeTheme,
    context?: unknown,
  ) => { render?: (width: number) => string[] }
}

interface FakeTheme {
  fg: (_color: string, text: string) => string
  bold?: (text: string) => string
}

const theme: FakeTheme = {
  fg: (_color, text) => text,
  bold: (text) => text,
}

function registeredTools(): Map<string, RegisteredTool> {
  const tools = new Map<string, RegisteredTool>()
  registerStructuredExchange({
    registerTool(tool: RegisteredTool) {
      tools.set(tool.name, tool)
    },
  } as never)
  return tools
}

describe("structured exchange present/request tools", () => {
  it("registers implemented present/request tools as sequential", () => {
    const tools = registeredTools()

    expect([...tools.keys()]).toEqual([
      "present_question",
      PRESENT_OPTIONS_TOOL,
      "request_answer",
      REQUEST_CHOICE_TOOL,
      REQUEST_CHOICES_TOOL,
    ])
    expect(tools.get(PRESENT_OPTIONS_TOOL)?.executionMode).toBe("sequential")
    expect(tools.get(REQUEST_CHOICE_TOOL)?.executionMode).toBe("sequential")
    expect(tools.get(REQUEST_CHOICES_TOOL)?.executionMode).toBe("sequential")
  })

  it("persists a present_options result as markdown content plus recoverable details", async () => {
    const present = registeredTools().get(PRESENT_OPTIONS_TOOL)
    if (!present) throw new Error("present_options was not registered")

    const result = await present.execute(
      "present-call-1",
      {
        exchangeId: "shell-location",
        heading: "Where should the shell live?",
        body: "Choose the module boundary for Brunch Pi extensions.",
        options: [
          {
            id: "root",
            content: "Keep src/pi-extensions.ts",
            rationale: "Smallest diff.",
          },
          {
            id: "tui",
            content: "Move under src/tui-client",
            rationale: "Clearer ownership.",
          },
        ],
        expectedRequestTool: REQUEST_CHOICE_TOOL,
      },
      undefined,
      undefined,
      {} as never,
    )

    expect(result.content[0]?.text).toContain("## Where should the shell live?")
    expect(result.content[0]?.text).toContain("Clearer ownership.")
    expect(isStructuredExchangePresentDetails(result.details)).toBe(true)
    expect(result.details).toMatchObject({
      exchangeId: "shell-location",
      presentTool: PRESENT_OPTIONS_TOOL,
      kind: "options",
      status: "presented",
      expectedRequest: { tool: REQUEST_CHOICE_TOOL, required: true },
      createdAtToolCallId: "present-call-1",
    })

    const rendered = result.content[0]
      ? present.renderResult(result, {}, theme).render?.(80).join("\n")
      : ""
    expect(rendered).toContain("Where should the shell live?")
    expect(rendered).toContain("Move under src/tui-client")
  })

  it("persists a request_choice response without repeating the presented content", async () => {
    const request = registeredTools().get(REQUEST_CHOICE_TOOL)
    if (!request) throw new Error("request_choice was not registered")

    const result = await request.execute(
      "request-call-1",
      {
        exchangeId: "shell-location",
        respondsToPresentTool: PRESENT_OPTIONS_TOOL,
        prompt: "Select one option.",
        choices: [
          { id: "root", label: "Keep src/pi-extensions.ts" },
          { id: "tui", label: "Move under src/tui-client" },
        ],
        allowOther: false,
        commentPrompt: "Optional comment",
      },
      undefined,
      undefined,
      {
        hasUI: true,
        ui: {
          select: async () => "Move under src/tui-client",
          input: async () => "Aligns ownership with /reload iteration.",
        },
      } as never,
    )

    expect(result.content[0]?.text).toContain("### Response")
    expect(result.content[0]?.text).toContain("Move under src/tui-client")
    expect(result.content[0]?.text).not.toContain("Clearer ownership")
    expect(isStructuredExchangeRequestDetails(result.details)).toBe(true)
    expect(result.details).toMatchObject({
      exchangeId: "shell-location",
      requestTool: REQUEST_CHOICE_TOOL,
      status: "answered",
      respondsTo: {
        exchangeId: "shell-location",
        presentTool: PRESENT_OPTIONS_TOOL,
      },
      choice: { id: "tui", label: "Move under src/tui-client" },
      comment: "Aligns ownership with /reload iteration.",
    })
  })

  it("persists a request_choices response through the editor fallback", async () => {
    const request = registeredTools().get(REQUEST_CHOICES_TOOL)
    if (!request) throw new Error("request_choices was not registered")

    const result = await request.execute(
      "request-choices-call-1",
      {
        exchangeId: "priorities",
        respondsToPresentTool: PRESENT_OPTIONS_TOOL,
        prompt: "Select all priorities.",
        choices: [
          { id: "speed", label: "Move quickly" },
          { id: "safety", label: "Keep the transcript safe" },
        ],
        allowOther: true,
        commentPrompt: "Optional comment",
      },
      undefined,
      undefined,
      {
        hasUI: true,
        ui: {
          editor: async (prefill: string) => {
            const payload = JSON.parse(prefill)
            payload.response = {
              status: "answered",
              choices: [
                { id: "speed", label: "Move quickly" },
                { id: "other", label: "Other" },
              ],
              comment: "Also keep the proof deterministic.",
            }
            return JSON.stringify(payload)
          },
        },
      } as never,
    )

    expect(result.content[0]?.text).toContain("### Response")
    expect(result.content[0]?.text).toContain("Move quickly")
    expect(result.content[0]?.text).toContain("Other")
    expect(result.content[0]?.text).toContain(
      "Also keep the proof deterministic.",
    )
    expect(isStructuredExchangeRequestDetails(result.details)).toBe(true)
    expect(result.details).toMatchObject({
      schema: "brunch.structured_exchange.request",
      exchangeId: "priorities",
      requestTool: REQUEST_CHOICES_TOOL,
      status: "answered",
      respondsTo: {
        exchangeId: "priorities",
        presentTool: PRESENT_OPTIONS_TOOL,
      },
      choices: [
        { id: "speed", label: "Move quickly" },
        { id: "other", label: "Other" },
      ],
      comment: "Also keep the proof deterministic.",
      createdAtToolCallId: "request-choices-call-1",
    })
  })

  it("rejects request_choices other/none selections without a comment", async () => {
    const request = registeredTools().get(REQUEST_CHOICES_TOOL)
    if (!request) throw new Error("request_choices was not registered")

    const result = await request.execute(
      "request-choices-call-2",
      {
        exchangeId: "priorities",
        respondsToPresentTool: PRESENT_OPTIONS_TOOL,
        prompt: "Select all priorities.",
        choices: [{ id: "speed", label: "Move quickly" }],
        allowOther: true,
        allowNone: true,
      },
      undefined,
      undefined,
      {
        hasUI: true,
        ui: {
          editor: async (prefill: string) => {
            const payload = JSON.parse(prefill)
            payload.response = {
              status: "answered",
              choices: [{ id: "none", label: "None" }],
              comment: "   ",
            }
            return JSON.stringify(payload)
          },
        },
      } as never,
    )

    expect(result.details).toMatchObject({
      requestTool: REQUEST_CHOICES_TOOL,
      status: "unavailable",
      message:
        "request_choices requires a comment for Other or None selections",
    })
    expect(result.content[0]?.text).toContain(
      "request_choices requires a comment",
    )
  })

  it("detects an unmatched present result for recovery", () => {
    const incomplete = findIncompleteStructuredExchangePresents([
      {
        type: "message",
        message: {
          role: "toolResult",
          toolName: PRESENT_OPTIONS_TOOL,
          toolCallId: "present-call-1",
          content: [{ type: "text", text: "## Offer" }],
          details: {
            schema: "brunch.structured_exchange.present",
            schemaVersion: 1,
            exchangeId: "shell-location",
            presentTool: PRESENT_OPTIONS_TOOL,
            kind: "options",
            status: "presented",
            expectedRequest: { tool: REQUEST_CHOICE_TOOL, required: true },
            createdAtToolCallId: "present-call-1",
          },
          isError: false,
        },
      },
    ])

    expect(incomplete).toHaveLength(1)
    expect(incomplete[0]?.details.exchangeId).toBe("shell-location")
  })
})
