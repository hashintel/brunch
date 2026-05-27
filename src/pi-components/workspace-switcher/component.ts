import {
  Key,
  matchesKey,
  truncateToWidth,
  type Component,
} from "@earendil-works/pi-tui"

import type {
  WorkspaceLaunchInventory,
  WorkspaceSwitchDecision,
} from "../../workspace-session-coordinator.js"
import {
  buildWorkspaceSwitchOptions,
  type WorkspaceSwitchOption,
} from "./model.js"

export interface WorkspaceSwitchComponentOptions {
  inventory: WorkspaceLaunchInventory
  onDecision: (decision: WorkspaceSwitchDecision) => void
}

export function createWorkspaceSwitchComponent(
  options: WorkspaceSwitchComponentOptions,
): Component {
  return new WorkspaceSwitchComponent(options)
}

class WorkspaceSwitchComponent implements Component {
  #options: WorkspaceSwitchOption[]
  #onDecision: (decision: WorkspaceSwitchDecision) => void
  #selectedIndex = 0
  #mode: "select" | "newSpecTitle" = "select"
  #title = ""

  constructor(options: WorkspaceSwitchComponentOptions) {
    this.#options = buildWorkspaceSwitchOptions(options.inventory)
    this.#onDecision = options.onDecision
  }

  handleInput(data: string): void {
    if (this.#mode === "newSpecTitle") {
      this.#handleTitleInput(data)
      return
    }

    if (matchesKey(data, Key.up)) {
      this.#selectedIndex = Math.max(0, this.#selectedIndex - 1)
      return
    }
    if (matchesKey(data, Key.down)) {
      this.#selectedIndex = Math.min(
        this.#options.length - 1,
        this.#selectedIndex + 1,
      )
      return
    }
    if (matchesKey(data, Key.escape)) {
      this.#onDecision({ action: "cancel" })
      return
    }
    if (matchesKey(data, Key.enter)) {
      this.#selectCurrentOption()
    }
  }

  render(width: number): string[] {
    const lines = ["Brunch workspace", "Choose how to start this session:", ""]

    if (this.#mode === "newSpecTitle") {
      lines.push("New spec title:", `> ${this.#title}`)
      lines.push("enter create • esc cancel")
      return lines.map((line) => truncateToWidth(line, width))
    }

    for (const [index, option] of this.#options.entries()) {
      const prefix = index === this.#selectedIndex ? "› " : "  "
      lines.push(`${prefix}${option.label}`)
      lines.push(`    ${option.description}`)
    }
    lines.push("", "↑↓ navigate • enter select • esc cancel")
    return lines.map((line) => truncateToWidth(line, width))
  }

  invalidate(): void {}

  #selectCurrentOption(): void {
    const option = this.#options[this.#selectedIndex]
    if (!option) {
      return
    }
    if (option.kind === "newSpec") {
      this.#mode = "newSpecTitle"
      this.#title = ""
      return
    }
    if (option.decision) {
      this.#onDecision(option.decision)
    }
  }

  #handleTitleInput(data: string): void {
    if (matchesKey(data, Key.escape)) {
      this.#mode = "select"
      this.#title = ""
      return
    }
    if (matchesKey(data, Key.backspace)) {
      this.#title = this.#title.slice(0, -1)
      return
    }
    if (matchesKey(data, Key.enter)) {
      const title = this.#title.trim()
      if (title.length > 0) {
        this.#onDecision({ action: "newSpec", title })
      }
      return
    }
    if (isPrintableInput(data)) {
      this.#title += data
    }
  }
}

function isPrintableInput(data: string): boolean {
  return data.length === 1 && data >= " " && data !== "\u007f"
}
