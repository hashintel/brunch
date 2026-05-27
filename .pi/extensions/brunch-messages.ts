/**
 * Brunch — custom messages
 *
 * Owns the `alternatives-card-set` custom message type end-to-end:
 *   - registerMessageRenderer to draw bordered cards in the transcript
 *   - registerTool (`present_alternatives`) so the LLM can emit a card set
 *   - demo slash commands that emit card sets directly for visual smoke
 *
 * Compared with an ephemeral picker (e.g. `ctx.ui.custom`), this surface
 * PRESENTS alternatives via `pi.sendMessage` — persistent, returns
 * immediately, no UI focus stolen — and is the closest existing precedent for
 * the offer-first transcript-native loop tracked under FE-744 (D37-L / I23-L).
 *
 * Activate:
 *   /cards-demo            three sample alternatives
 *   /cards-columns-demo    four cards in a 2-column layout
 *   /cards-flavors         one card per flavor (accent/success/warning/muted)
 */

import type { ExtensionAPI, ThemeColor } from "@earendil-works/pi-coding-agent"
import { Container, Text } from "@earendil-works/pi-tui"
import { StringEnum } from "@earendil-works/pi-ai"
import { Type } from "typebox"

import {
  CardComponent,
  ResponsiveColumns,
  chunk,
} from "../../src/pi-components/cards.js"

// ── Types & schema ─────────────────────────────────────────────────────
const FLAVOR = StringEnum(["accent", "success", "warning", "muted"] as const)
type Flavor = "accent" | "success" | "warning" | "muted"

interface Alternative {
  title: string
  body: string
  flavor?: Flavor
}

type Layout = "stack" | "columns"

interface AlternativesDetails {
  headline?: string | undefined
  alternatives: Alternative[]
  layout?: Layout | undefined
  columnCount?: number | undefined
  minColumnWidth?: number | undefined
}

const AlternativeSchema = Type.Object({
  title: Type.String({ description: "Short label for the card header" }),
  body: Type.String({
    description: "Markdown content rendered inside the card",
  }),
  flavor: Type.Optional(FLAVOR),
})

const LAYOUT = StringEnum(["stack", "columns"] as const)

const PresentAlternativesParams = Type.Object({
  headline: Type.Optional(
    Type.String({ description: "Optional headline shown above the cards" }),
  ),
  alternatives: Type.Array(AlternativeSchema, { minItems: 1, maxItems: 6 }),
  layout: Type.Optional(LAYOUT),
  columnCount: Type.Optional(
    Type.Integer({
      minimum: 1,
      maximum: 4,
      description: "Cards per row when layout is 'columns'. Default 2.",
    }),
  ),
  minColumnWidth: Type.Optional(
    Type.Integer({
      minimum: 20,
      maximum: 200,
      description:
        "Minimum width per card before falling back to vertical stack. Default 40.",
    }),
  ),
})

function flavorToColor(flavor: Flavor | undefined): ThemeColor {
  switch (flavor) {
    case "success":
      return "success"
    case "warning":
      return "warning"
    case "muted":
      return "muted"
    default:
      return "accent"
  }
}

// Plain-markdown fallback so RPC clients without the renderer still see
// coherent content. Also persisted as the message `content` field.
function alternativesToMarkdown(details: AlternativesDetails): string {
  const sections: string[] = []
  if (details.headline) sections.push(`## ${details.headline}`)
  for (const alt of details.alternatives) {
    sections.push(`### ${alt.title}\n\n${alt.body}`)
  }
  return sections.join("\n\n---\n\n")
}

export default function brunchMessages(pi: ExtensionAPI) {
  // ── Renderer ────────────────────────────────────────────────────────
  pi.registerMessageRenderer(
    "alternatives-card-set",
    (message, _opts, theme) => {
      const details = message.details as AlternativesDetails | undefined
      if (!details) {
        // Fallback: if details is missing, render the raw content string.
        return new Text(
          typeof message.content === "string" ? message.content : "",
          0,
          0,
        )
      }

      const container = new Container()
      if (details.headline) {
        container.addChild(
          new Text(
            theme.fg("customMessageLabel", theme.bold(details.headline)),
            1,
            1,
          ),
        )
      }

      const layout = details.layout ?? "stack"
      const columnCount = Math.max(1, Math.min(4, details.columnCount ?? 2))
      const minColumnWidth = details.minColumnWidth ?? 40

      const makeCard = (alt: Alternative) =>
        new CardComponent(alt.title, alt.body, theme, flavorToColor(alt.flavor))

      if (layout === "columns" && details.alternatives.length > 1) {
        const groups = chunk(details.alternatives, columnCount)
        groups.forEach((group, gi) => {
          container.addChild(
            new ResponsiveColumns(group.map(makeCard), minColumnWidth),
          )
          if (gi < groups.length - 1) container.addChild(new Text("", 0, 0))
        })
      } else {
        details.alternatives.forEach((alt, i) => {
          container.addChild(makeCard(alt))
          if (i < details.alternatives.length - 1)
            container.addChild(new Text("", 0, 0))
        })
      }
      return container
    },
  )

  // ── Tool ────────────────────────────────────────────────────────────
  pi.registerTool({
    name: "present_alternatives",
    label: "Present Alternatives",
    description:
      "Present 1–6 alternative options to the user as bordered cards. Each alternative has a short title and a markdown body. Optional `flavor` (accent/success/warning/muted) styles the card border. Use when comparing options, surfacing draft variants, or laying out trade-offs.",
    promptSnippet:
      "Present comparable alternatives as bordered cards in the transcript",
    promptGuidelines: [
      "Use present_alternatives when the user needs to compare 2–6 options side by side.",
      "Each alternative's body should be self-contained markdown — headings, lists, code blocks all work.",
      "After present_alternatives, ask the user which one they prefer rather than picking yourself.",
    ],
    parameters: PresentAlternativesParams,

    async execute(_toolCallId, params) {
      const details: AlternativesDetails = {
        headline: params.headline,
        alternatives: params.alternatives,
        layout: params.layout,
        columnCount: params.columnCount,
        minColumnWidth: params.minColumnWidth,
      }

      pi.sendMessage({
        customType: "alternatives-card-set",
        content: alternativesToMarkdown(details), // fallback / replay
        display: true,
        details,
      })

      return {
        content: [
          {
            type: "text",
            text: `Presented ${params.alternatives.length} alternative${
              params.alternatives.length === 1 ? "" : "s"
            }.`,
          },
        ],
        details: { count: params.alternatives.length },
        terminate: true,
      }
    },
  })

  // ── Demo commands ───────────────────────────────────────────────────
  pi.registerCommand("cards-demo", {
    description: "Render three sample alternative cards in the transcript",
    handler: async (_args, _ctx) => {
      const details: AlternativesDetails = {
        headline: "Three approaches to caching",
        alternatives: [
          {
            title: "In-memory LRU",
            flavor: "accent",
            body: [
              "**Pros**",
              "- Zero deploy overhead",
              "- Sub-millisecond access",
              "",
              "**Cons**",
              "- Lost on restart",
              "- Not shared across replicas",
              "",
              "```ts",
              "const cache = new LRU<string, Value>({ max: 1000 });",
              "```",
            ].join("\n"),
          },
          {
            title: "Redis",
            flavor: "success",
            body: [
              "**Pros**",
              "- Survives restarts",
              "- Shared across replicas",
              "- Battle-tested",
              "",
              "**Cons**",
              "- New infra to operate",
              "- Network hop on every read",
            ].join("\n"),
          },
          {
            title: "Filesystem",
            flavor: "warning",
            body: [
              "**Pros**",
              "- Cheap, no new infra",
              "",
              "**Cons**",
              "- Slow",
              "- Concurrency tricky",
              "- Not great for hot data",
            ].join("\n"),
          },
        ],
      }

      pi.sendMessage({
        customType: "alternatives-card-set",
        content: alternativesToMarkdown(details),
        display: true,
        details,
      })
    },
  })

  pi.registerCommand("cards-columns-demo", {
    description: "Render four alternative cards in a 2-column layout",
    handler: async (_args, _ctx) => {
      const details: AlternativesDetails = {
        headline: "Four ways to ship the feature",
        layout: "columns",
        columnCount: 2,
        minColumnWidth: 40,
        alternatives: [
          {
            title: "Vertical slice",
            flavor: "accent",
            body: "Build one thin path end-to-end.\n\n- Fast feedback\n- High confidence\n- Real integration",
          },
          {
            title: "Horizontal layers",
            flavor: "warning",
            body: "Build each layer fully before the next.\n\n- Easier coordination\n- Riskier integration\n- Late surprises",
          },
          {
            title: "Feature flag",
            flavor: "success",
            body: "Ship behind a toggle and dark-launch.\n\n- Safe rollout\n- Production validation\n- Flag debt",
          },
          {
            title: "Spike first",
            flavor: "muted",
            body: "Throw-away prototype to retire risk.\n\n- Cheap learning\n- Discard the code\n- Plan the real build after",
          },
        ],
      }
      pi.sendMessage({
        customType: "alternatives-card-set",
        content: alternativesToMarkdown(details),
        display: true,
        details,
      })
    },
  })

  pi.registerCommand("cards-flavors", {
    description: "Show one card per flavor to compare colors",
    handler: async (_args, _ctx) => {
      const details: AlternativesDetails = {
        headline: "Flavor palette",
        alternatives: (["accent", "success", "warning", "muted"] as const).map(
          (flavor) => ({
            title: flavor,
            flavor,
            body: `This is a **${flavor}** card. Its border, title accents, and any inline emphasis use the \`${flavor}\` theme color.`,
          }),
        ),
      }

      pi.sendMessage({
        customType: "alternatives-card-set",
        content: alternativesToMarkdown(details),
        display: true,
        details,
      })
    },
  })
}
