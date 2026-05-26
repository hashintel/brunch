/**
 * Brunch — commands
 *
 * Slash commands and shortcuts. Currently exercises Pi's `ctx.ui.custom()`
 * with the shipped `SettingsList` widget as a placeholder for richer Brunch
 * dialogs. State is module-scoped, which means it resets on `/reload`; if/when
 * persistence matters, write a custom session entry on change and rehydrate on
 * `session_start`.
 *
 * Activate via:
 *   /brunch          slash command
 *   ctrl+shift+b     keyboard shortcut
 *
 * (The previous `ctrl+b` alias has been removed because it collided with
 * `tui.editor.cursorLeft`.)
 */

import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent"
import { getSettingsListTheme } from "@earendil-works/pi-coding-agent"
import { SettingsList, type SettingItem } from "@earendil-works/pi-tui"

interface BrunchState {
  drink: string
  eggs: string
  toast: string
  hashBrowns: string
  mood: string
}

export default function brunchCommands(pi: ExtensionAPI) {
  // Module-scoped — reset on `/reload`. See header comment.
  const state: BrunchState = {
    drink: "Coffee",
    eggs: "Scrambled",
    toast: "Sourdough",
    hashBrowns: "Yes",
    mood: "Leisurely",
  }

  function buildItems(): SettingItem[] {
    return [
      {
        id: "drink",
        label: "Drink",
        description: "What's in your glass or mug?",
        currentValue: state.drink,
        values: ["Coffee", "Tea", "Juice", "Mimosa", "Water"],
      },
      {
        id: "eggs",
        label: "Eggs",
        description: "How would you like your eggs?",
        currentValue: state.eggs,
        values: [
          "Scrambled",
          "Poached",
          "Fried",
          "Over Easy",
          "Omelette",
          "None",
        ],
      },
      {
        id: "toast",
        label: "Toast",
        description: "Bread choice",
        currentValue: state.toast,
        values: ["Sourdough", "White", "Rye", "Multigrain", "None"],
      },
      {
        id: "hashBrowns",
        label: "Hash Browns",
        description: "Always a good idea",
        currentValue: state.hashBrowns,
        values: ["Yes", "No"],
      },
      {
        id: "mood",
        label: "Mood",
        description: "Pacing for the meal",
        currentValue: state.mood,
        values: ["Leisurely", "Focused", "Chatty", "Quiet"],
      },
    ]
  }

  function summarize(): string {
    return `🥐 ${state.drink} · ${state.eggs} eggs · ${state.toast} · Hash browns: ${state.hashBrowns} · ${state.mood}`
  }

  async function openBrunch(ctx: ExtensionContext) {
    if (!ctx.hasUI) {
      ctx.ui?.notify?.("Brunch settings require UI mode", "warning")
      return
    }

    await ctx.ui.custom<void>((_tui, _theme, _kb, done) => {
      const items = buildItems()
      const list = new SettingsList(
        items,
        10, // maxVisible: rows shown at once
        getSettingsListTheme(),
        (id, newValue) => {
          // Mirror the picked value into module state. The list updates its
          // own currentValue display internally.
          if (id === "drink") state.drink = newValue
          else if (id === "eggs") state.eggs = newValue
          else if (id === "toast") state.toast = newValue
          else if (id === "hashBrowns") state.hashBrowns = newValue
          else if (id === "mood") state.mood = newValue
        },
        () => done(),
        { enableSearch: true },
      )

      return {
        render: (width: number) => list.render(width),
        invalidate: () => list.invalidate(),
        handleInput: (data: string) => list.handleInput(data),
      }
    })

    // After dismissal, surface the current selection as a transient toast.
    // Persistent chrome (status/widget/header/footer) is deliberately not
    // touched from here — it lives in `brunch-chrome.ts`.
    ctx.ui.notify(summarize(), "info")
  }

  pi.registerCommand("brunch", {
    description: "Open the brunch settings selector",
    handler: async (_args, ctx) => openBrunch(ctx),
  })

  pi.registerShortcut("ctrl+shift+b", {
    description: "Open brunch settings",
    handler: async (ctx) => openBrunch(ctx),
  })
}
