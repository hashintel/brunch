import type { ExtensionContext } from "@earendil-works/pi-coding-agent"

import { describe, expect, it } from "vitest"

import {
  extractHashPrefix,
  registerBrunchMentionAutocomplete,
  type GraphMentionSource,
} from "./.pi/extensions/mention-autocomplete.js"

describe("Brunch mention autocomplete", () => {
  it("adds graph mention prompt guidance", async () => {
    const beforeAgentStart: Array<(
      event: { systemPrompt: string },
      ctx: FakeExtensionContext,
    ) => Promise<unknown> | unknown> = []

    registerBrunchMentionAutocomplete({
      on: (event: string, handler: never) => {
        if (event === "before_agent_start") beforeAgentStart.push(handler)
      },
    } as never)

    const promptUpdates = await Promise.all(
      beforeAgentStart.map((handler) =>
        Promise.resolve(handler({ systemPrompt: "base" }, fakeContext())),
      ),
    )

    expect(
      promptUpdates.some(
        (update) =>
          typeof update === "object" &&
          update !== null &&
          "systemPrompt" in update &&
          String(update.systemPrompt).includes("Brunch graph mention handles"),
      ),
    ).toBe(true)
  })

  it("registers graph-code mention autocomplete without fixture tag JSON", async () => {
    let providerFactory: ((
      current: FakeAutocompleteProvider,
    ) => FakeAutocompleteProvider) | undefined
    const source: GraphMentionSource = {
      listMentionCandidates: () => [
        {
          code: "D12",
          title: "Command containment",
          description: "Blocks branchy Pi flows",
          plane: "design",
        },
        { code: "I9", title: "Mention ledger", plane: "intent" },
      ],
    }

    registerBrunchMentionAutocomplete(
      {
        on: (event: string, handler: (event: never, ctx: never) => unknown) => {
          if (event === "session_start") {
            void handler({} as never, {
              ui: {
                addAutocompleteProvider: (factory: typeof providerFactory) => {
                  providerFactory = factory
                },
              },
            } as never)
          }
        },
      } as never,
      source,
    )

    const fallback: FakeAutocompleteProvider = {
      getSuggestions: async () => ({ items: [], prefix: "" }),
      applyCompletion: (lines) => ({ lines, cursorLine: 0, cursorCol: 0 }),
      shouldTriggerFileCompletion: () => true,
    }
    const provider = providerFactory?.(fallback)

    expect(extractHashPrefix("See #D1", 7)).toBe("#D1")
    await expect(
      provider?.getSuggestions(["See #D1"], 0, 7, {} as never),
    ).resolves.toEqual({
      prefix: "#D1",
      items: [
        {
          value: "#D12",
          label: "#D12 Command containment",
          description: "Blocks branchy Pi flows",
        },
      ],
    })
    expect(
      provider?.applyCompletion(
        ["See #D"],
        0,
        6,
        { value: "#D12", label: "#D12 Command containment" },
        "#D",
      ),
    ).toEqual({ lines: ["See #D12"], cursorLine: 0, cursorCol: 8 })
  })
})

function fakeContext(): FakeExtensionContext {
  return {
    sessionManager: {
      getEntries: () => [],
    } as unknown as FakeExtensionContext["sessionManager"],
    ui: {} as never,
  }
}

type FakeExtensionContext = Pick<ExtensionContext, "sessionManager"> & {
  ui: unknown
}

interface FakeAutocompleteItem {
  value: string
  label: string
}

interface FakeAutocompleteProvider {
  getSuggestions(
    lines: string[],
    cursorLine: number,
    cursorCol: number,
    options: never,
  ): Promise<unknown>
  applyCompletion(
    lines: string[],
    cursorLine: number,
    cursorCol: number,
    item: FakeAutocompleteItem,
    prefix: string,
  ): unknown
  shouldTriggerFileCompletion(
    lines: string[],
    cursorLine: number,
    cursorCol: number,
  ): boolean
}
