import { Text } from "@earendil-works/pi-tui"
import { describe, expect, it } from "vitest"
import askUserQuestion from "./pi-extensions/structured-exchange.js"

const ansiPattern = new RegExp(
  `${String.fromCharCode(27)}\\[[0-?]*[ -/]*[@-~]`,
  "g",
)

function stripAnsi(text: string): string {
  return text.replace(ansiPattern, "")
}

function registerAskUserQuestionTool() {
  let tool: any
  askUserQuestion({
    registerTool(definition: any) {
      tool = definition
    },
  } as any)
  return tool
}

const theme = {
  fg: (_color: string, text: string) => text,
  bg: (_color: string, text: string) => text,
  bold: (text: string) => text,
}

describe("ask_user_question experimental renderer", () => {
  it("renders prompt markdown before the question without duplicating options", () => {
    const tool = registerAskUserQuestionTool()

    const component = tool.renderCall(
      {
        question: "Which path should we take?",
        details: "## Preamble\n\nThis is caller-provided context.",
        options: [
          { label: "First path", value: "first" },
          { label: "Second path", value: "second" },
        ],
      },
      theme,
      { argsComplete: true, lastComponent: new Text("stale", 0, 0) },
    )

    const rendered = stripAnsi(component.render(80).join("\n"))
    expect(rendered.indexOf("Preamble")).toBeLessThan(
      rendered.indexOf("Question"),
    )
    expect(rendered).toContain("This is caller-provided context.")
    expect(rendered).toContain("Which path should we take?")
    expect(rendered).not.toContain("First path")
    expect(rendered).not.toContain("Second path")
    expect(rendered).not.toContain("ask_user_question")
  })

  it("keeps renderCall component reuse type-safe across partial renders", () => {
    const tool = registerAskUserQuestionTool()
    const args = { question: "Proceed?" }

    const partial = tool.renderCall(args, theme, { argsComplete: false })
    expect(stripAnsi(partial.render(80).join("\n"))).toBe("")

    const first = tool.renderCall(args, theme, {
      argsComplete: true,
      lastComponent: partial,
    })
    const second = tool.renderCall({ question: "Proceed now?" }, theme, {
      argsComplete: true,
      lastComponent: first,
    })

    expect(second).toBe(first)
    expect(stripAnsi(second.render(80).join("\n"))).toContain("Proceed now?")
  })

  it("summarizes selected and rejected options using original option indexes", () => {
    const tool = registerAskUserQuestionTool()

    const component = tool.renderResult(
      {
        content: [{ type: "text", text: "User selected: 2. Second" }],
        details: {
          status: "answered",
          question: "Pick one",
          mode: "single-select",
          answers: [
            { type: "option", label: "Second", value: "second", index: 2 },
          ],
        },
      },
      { expanded: true, isPartial: false },
      theme,
      {
        args: {
          options: [
            { label: "First", value: "first" },
            { label: "Second", value: "second" },
            { label: "Third", value: "third" },
          ],
        },
      },
    )

    const rendered = stripAnsi(component.render(80).join("\n"))
    expect(rendered).toContain("✓ Selected: 2. Second")
    expect(rendered).toContain("○ Rejected: 1. First")
    expect(rendered).toContain("○ Rejected: 3. Third")
    expect(rendered).not.toContain("○ Rejected: 2. Third")
  })
})
