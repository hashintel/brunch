import {
  Key,
  matchesKey,
  truncateToWidth,
  type Component,
} from "@earendil-works/pi-tui"

export type BrunchMenuDecision = "workspace" | "cancel"

export interface BrunchMenuComponentOptions {
  onDecision: (decision: BrunchMenuDecision) => void
}

interface BrunchMenuOption {
  decision: BrunchMenuDecision
  label: string
  description: string
}

const BRUNCH_MENU_OPTIONS: BrunchMenuOption[] = [
  {
    decision: "workspace",
    label: "Workspace / session",
    description: "Switch specs or open/create a session",
  },
  {
    decision: "cancel",
    label: "Cancel",
    description: "Return to the current conversation",
  },
]

export function createBrunchMenuComponent(
  options: BrunchMenuComponentOptions,
): Component {
  return new BrunchMenuComponent(options)
}

class BrunchMenuComponent implements Component {
  #selectedIndex = 0

  constructor(private options: BrunchMenuComponentOptions) {}

  handleInput(data: string): void {
    if (matchesKey(data, Key.up)) {
      this.#selectedIndex = Math.max(0, this.#selectedIndex - 1)
      return
    }
    if (matchesKey(data, Key.down)) {
      this.#selectedIndex = Math.min(
        BRUNCH_MENU_OPTIONS.length - 1,
        this.#selectedIndex + 1,
      )
      return
    }
    if (matchesKey(data, Key.escape)) {
      this.options.onDecision("cancel")
      return
    }
    if (matchesKey(data, Key.enter)) {
      this.options.onDecision(
        BRUNCH_MENU_OPTIONS[this.#selectedIndex]?.decision ?? "cancel",
      )
    }
  }

  render(width: number): string[] {
    const lines = [
      "Brunch",
      "Choose a product action:",
      "",
      ...BRUNCH_MENU_OPTIONS.flatMap((option, index) => {
        const prefix = index === this.#selectedIndex ? "› " : "  "
        return [`${prefix}${option.label}`, `    ${option.description}`]
      }),
      "",
      "↑↓ navigate • enter select • esc cancel",
    ]
    return lines.map((line) => truncateToWidth(line, width))
  }

  invalidate(): void {}
}
