/**
 * Brunch — autocomplete (`#`-tag provider)
 *
 * Middleware-style autocomplete provider over `ctx.ui.addAutocompleteProvider`.
 * Triggers on `#<chars>` tokens at the cursor; delegates everything else
 * (file completion, slash commands, etc.) to the wrapped provider.
 *
 * TEMPORARY: tag candidates currently load from a co-located JSON file at
 *   <cwd>/.pi/extensions/brunch-tags.json
 * This is a stand-in until the autocomplete source is wired to brunch graph
 * items (intent/oracle/design/plan nodes) and `#`-mentions become ID-anchored
 * per SPEC.md D14-L / I9-L. Treat this file as throwaway scaffolding for the
 * autocomplete seam; do not grow product semantics on top of the JSON store.
 *
 * Companion command:
 *   /brunch-tags-edit   open the JSON tag list in `ctx.ui.editor()`
 */

import { readFile, writeFile, access } from "node:fs/promises"
import { join } from "node:path"

import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent"
import type {
  AutocompleteItem,
  AutocompleteSuggestions,
} from "@earendil-works/pi-tui"

interface BrunchTag {
  value: string // inserted text (without the leading '#')
  label: string // display label
  description?: string
}

const SEED_TAGS: BrunchTag[] = [
  {
    value: "breakfast",
    label: "Breakfast",
    description: "First meal of the day",
  },
  { value: "brunch", label: "Brunch", description: "Late morning treat" },
  { value: "coffee", label: "Coffee", description: "Morning fuel" },
  { value: "croissant", label: "Croissant", description: "Flaky pastry" },
  {
    value: "eggs-benedict",
    label: "Eggs Benedict",
    description: "With hollandaise",
  },
  { value: "mimosa", label: "Mimosa", description: "OJ + champagne" },
  { value: "pancakes", label: "Pancakes", description: "Fluffy stack" },
  { value: "toast", label: "Toast", description: "Crispy bread" },
  { value: "waffles", label: "Waffles", description: "Grid-shaped breakfast" },
]

// Co-located with the extension source so editing the file (in any editor)
// takes effect on the next autocomplete invocation.
function tagsPath(ctx: ExtensionContext): string {
  return join(ctx.cwd, ".pi", "extensions", "brunch-tags.json")
}

async function ensureTagsFile(ctx: ExtensionContext): Promise<void> {
  const path = tagsPath(ctx)
  try {
    await access(path)
  } catch {
    await writeFile(path, JSON.stringify(SEED_TAGS, null, 2), "utf8")
  }
}

async function loadTags(ctx: ExtensionContext): Promise<BrunchTag[]> {
  try {
    const raw = await readFile(tagsPath(ctx), "utf8")
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (t): t is BrunchTag =>
        t && typeof t.value === "string" && typeof t.label === "string",
    )
  } catch {
    return []
  }
}

// Extract a `#<chars>` token at the cursor. Returns the matched prefix
// (including the `#`) or null if the cursor is not inside such a token.
function extractHashPrefix(line: string, cursorCol: number): string | null {
  const before = line.slice(0, cursorCol)
  // `#` preceded by start-of-line or whitespace, followed by [A-Za-z0-9_-]*
  const match = before.match(/(?:^|\s)(#[\w-]*)$/)
  return match?.[1] ?? null
}

export default function brunchAutocomplete(pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    await ensureTagsFile(ctx)

    ctx.ui.addAutocompleteProvider((current) => ({
      async getSuggestions(lines, cursorLine, cursorCol, options) {
        const line = lines[cursorLine] ?? ""
        const prefix = extractHashPrefix(line, cursorCol)

        if (prefix === null) {
          // Not our trigger — hand off to the wrapped provider.
          return current.getSuggestions(lines, cursorLine, cursorCol, options)
        }

        const query = prefix.slice(1).toLowerCase() // strip leading '#'
        const tags = await loadTags(ctx) // re-read JSON every time

        const filtered =
          query.length === 0
            ? tags
            : tags.filter((t) => t.value.toLowerCase().includes(query))

        const items: AutocompleteItem[] = filtered.map((t) => ({
          value: `#${t.value}`,
          label: `#${t.label}`,
          ...(t.description !== undefined
            ? { description: t.description }
            : {}),
        }))

        const result: AutocompleteSuggestions = { items, prefix }
        return result
      },

      applyCompletion(lines, cursorLine, cursorCol, item, prefix) {
        // If the prefix isn't a '#' token, let the wrapped provider handle it.
        if (!prefix.startsWith("#")) {
          return current.applyCompletion(
            lines,
            cursorLine,
            cursorCol,
            item,
            prefix,
          )
        }

        const line = lines[cursorLine] ?? ""
        const before = line.slice(0, cursorCol)
        const after = line.slice(cursorCol)
        // Replace the trailing `prefix` (e.g. "#br") with the chosen value.
        const newBefore = before.slice(0, -prefix.length) + item.value
        const newLine = newBefore + after

        return {
          lines: lines.map((l, i) => (i === cursorLine ? newLine : l)),
          cursorLine,
          cursorCol: newBefore.length,
        }
      },

      shouldTriggerFileCompletion(lines, cursorLine, cursorCol) {
        // Never hijack file completion (the `@` trigger);
        // delegate the decision to the wrapped provider.
        return (
          current.shouldTriggerFileCompletion?.(lines, cursorLine, cursorCol) ??
          false
        )
      },
    }))
  })

  // Convenience: edit the tag JSON in the system editor without leaving pi.
  pi.registerCommand("brunch-tags-edit", {
    description: "Edit the brunch autocomplete tag list (JSON)",
    handler: async (_args, ctx) => {
      await ensureTagsFile(ctx)
      const path = tagsPath(ctx)
      const current = await readFile(path, "utf8")
      const edited = await ctx.ui.editor(`Edit ${path}`, current)
      if (edited === undefined) {
        ctx.ui.notify("Edit cancelled", "info")
        return
      }
      try {
        const parsed = JSON.parse(edited)
        if (!Array.isArray(parsed))
          throw new Error("top-level must be a JSON array")
      } catch (err) {
        ctx.ui.notify(`Invalid JSON: ${(err as Error).message}`, "error")
        return
      }
      await writeFile(path, edited, "utf8")
      ctx.ui.notify("Tags saved", "info")
    },
  })
}
