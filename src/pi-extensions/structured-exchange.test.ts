import { describe, expect, it } from "vitest"

import registerStructuredExchange, {
  buildStructuredExchangeEditorPrefill,
  parseStructuredExchangeEditorResponse,
} from "./structured-exchange.js"

interface ToolTextContent {
  type: "text"
  text: string
}

interface ToolExecutionResult {
  content: ToolTextContent[]
  details: any
}

interface RenderableText {
  render?: (width: number) => string[]
}

interface RegisteredTool {
  name: string
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
  ) => RenderableText
}

interface FakeTheme {
  fg: (_color: string, text: string) => string
}

const enter = "\r"
const escape = "\x1b"
const down = "\x1b[B"
const space = " "
const theme: FakeTheme = { fg: (_color, text) => text }

function registeredTool(): RegisteredTool {
  let tool: RegisteredTool | undefined
  registerStructuredExchange({
    registerTool: (registered: RegisteredTool) => {
      tool = registered
    },
  } as never)
  if (!tool) throw new Error("tool was not registered")
  return tool
}

function contextDrivingCustom(inputs: string[]) {
  return {
    hasUI: true,
    ui: {
      custom: async (factory: any) => {
        const component = factory(
          { requestRender: () => {} },
          theme,
          {},
          (result: unknown) => {
            resolved = result
          },
        )
        let resolved: unknown = undefined
        for (const input of inputs) {
          component.handleInput(input)
          if (resolved !== undefined) return resolved
        }
        throw new Error("custom UI did not resolve")
      },
    },
  }
}

function contextEditingJson(edit: (payload: any) => void) {
  return {
    hasUI: true,
    ui: {
      editor: async (prefill: string) => {
        const payload = JSON.parse(prefill)
        edit(payload)
        return JSON.stringify(payload)
      },
    },
  }
}

function optionParams(multiSelect = false): Record<string, unknown> {
  return {
    question: "Pick a path",
    details: "Choose deliberately.",
    options: [
      { label: "Alpha", value: "a" },
      { label: "Beta", value: "b" },
    ],
    multiSelect,
  }
}

describe("structured exchange option notes", () => {
  it("requires a focused note submit after a single-select option answer", async () => {
    const tool = registeredTool()

    const result = await tool.execute(
      "call-1",
      optionParams(),
      undefined,
      undefined,
      contextDrivingCustom([enter, ..."Add context", enter]),
    )

    expect(result.details).toMatchObject({
      status: "answered",
      mode: "single-select",
      note: "Add context",
      answers: [{ type: "option", label: "Alpha", value: "a", index: 1 }],
    })
    expect(result.content[0]?.text).toContain("Add context")
  })

  it("preserves Other as an answer and records an intentionally empty single-select note", async () => {
    const tool = registeredTool()

    const result = await tool.execute(
      "call-1",
      optionParams(),
      undefined,
      undefined,
      contextDrivingCustom([down, down, enter, ..."Custom", enter, enter]),
    )

    expect(result.details).toMatchObject({
      status: "answered",
      mode: "single-select",
      note: "",
      answers: [{ type: "other", label: "Custom", value: "Custom" }],
    })
  })

  it("returns from the note step to the multi-select picker with selections preserved", async () => {
    const tool = registeredTool()

    const result = await tool.execute(
      "call-1",
      optionParams(true),
      undefined,
      undefined,
      contextDrivingCustom([
        space,
        down,
        space,
        down,
        down,
        enter,
        escape,
        down,
        down,
        enter,
        enter,
      ]),
    )

    expect(result.details).toMatchObject({
      status: "answered",
      mode: "multi-select",
      note: "",
      answers: [
        { type: "option", label: "Alpha", value: "a", index: 1 },
        { type: "option", label: "Beta", value: "b", index: 2 },
      ],
    })
  })

  it("renders a non-empty note without rendering empty notes", async () => {
    const tool = registeredTool()
    const withNote = await tool.execute(
      "call-1",
      optionParams(),
      undefined,
      undefined,
      contextDrivingCustom([enter, ..."Useful note", enter]),
    )
    const emptyNote = await tool.execute(
      "call-2",
      optionParams(),
      undefined,
      undefined,
      contextDrivingCustom([enter, enter]),
    )

    expect(
      tool
        .renderResult(withNote, undefined, theme, {
          args: optionParams(),
        })
        ?.render?.(80)
        .join("\n"),
    ).toContain("Note: Useful note")
    expect(
      tool
        .renderResult(emptyNote, undefined, theme, {
          args: optionParams(),
        })
        ?.render?.(80)
        .join("\n"),
    ).not.toContain("Note:")
  })
})

describe("structured exchange RPC editor fallback", () => {
  it("builds schema-tagged JSON with options and parses single-select notes", () => {
    const prefill = JSON.parse(
      buildStructuredExchangeEditorPrefill({
        question: "Pick a path",
        context: "Choose deliberately.",
        mode: "single-select",
        options: [
          { label: "Alpha", value: "a" },
          { label: "Beta", value: "b" },
        ],
      }),
    )

    expect(prefill).toMatchObject({
      schema: "brunch.structured_exchange.editor",
      schemaVersion: 1,
      question: "Pick a path",
      context: "Choose deliberately.",
      mode: "single-select",
      options: [
        { index: 1, label: "Alpha", value: "a" },
        { index: 2, label: "Beta", value: "b" },
      ],
      response: { status: "cancelled", answers: [], note: "" },
    })

    prefill.response = {
      status: "answered",
      answers: [{ type: "option", label: "Beta", value: "b", index: 2 }],
      note: "Because it matches the brief.",
    }

    expect(
      parseStructuredExchangeEditorResponse(JSON.stringify(prefill)),
    ).toEqual({
      status: "answered",
      answers: [{ type: "option", label: "Beta", value: "b", index: 2 }],
      note: "Because it matches the brief.",
    })
  })

  it("uses ctx.ui.editor for single-select fallback and keeps empty notes explicit", async () => {
    const tool = registeredTool()

    const result = await tool.execute(
      "call-rpc-single",
      optionParams(),
      undefined,
      undefined,
      contextEditingJson((payload) => {
        payload.response = {
          status: "answered",
          answers: [{ type: "option", label: "Alpha", value: "a", index: 1 }],
          note: "",
        }
      }),
    )

    expect(result.details).toMatchObject({
      status: "answered",
      mode: "single-select",
      answers: [{ type: "option", label: "Alpha", value: "a", index: 1 }],
      note: "",
    })
  })

  it("uses ctx.ui.editor for multi-select fallback with option notes", async () => {
    const tool = registeredTool()

    const result = await tool.execute(
      "call-rpc-multi",
      optionParams(true),
      undefined,
      undefined,
      contextEditingJson((payload) => {
        payload.response = {
          status: "answered",
          answers: [
            { type: "option", label: "Alpha", value: "a", index: 1 },
            { type: "other", label: "Custom", value: "Custom" },
          ],
          note: "Carry this nuance.",
        }
      }),
    )

    expect(result.details).toMatchObject({
      status: "answered",
      mode: "multi-select",
      answers: [
        { type: "option", label: "Alpha", value: "a", index: 1 },
        { type: "other", label: "Custom", value: "Custom" },
      ],
      note: "Carry this nuance.",
    })
  })

  it("returns a structured failure for invalid editor JSON", async () => {
    const tool = registeredTool()

    const result = await tool.execute(
      "call-rpc-invalid",
      optionParams(),
      undefined,
      undefined,
      {
        hasUI: true,
        ui: { editor: async () => "not json" },
      },
    )

    expect(result.details).toMatchObject({
      status: "unavailable",
      mode: "single-select",
      answers: [],
    })
    expect(result.content[0]?.text).toContain("invalid JSON")
  })
})
