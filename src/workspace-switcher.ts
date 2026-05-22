import {
  Key,
  matchesKey,
  truncateToWidth,
  type Component,
} from "@earendil-works/pi-tui"

import type {
  WorkspaceLaunchInventory,
  WorkspaceLaunchSession,
  WorkspaceSwitchDecision,
} from "./workspace-session-coordinator.js"

export interface WorkspaceSwitchOption {
  id: string
  label: string
  description: string
  kind: "continue" | "openSession" | "newSession" | "newSpec" | "cancel"
  decision?: WorkspaceSwitchDecision
}

export interface WorkspaceSwitchComponentOptions {
  inventory: WorkspaceLaunchInventory
  onDecision: (decision: WorkspaceSwitchDecision) => void
}

export function buildWorkspaceSwitchOptions(
  inventory: WorkspaceLaunchInventory,
): WorkspaceSwitchOption[] {
  const options: WorkspaceSwitchOption[] = []
  const currentSession = findCurrentSession(inventory)

  if (currentSession && inventory.currentSpec) {
    options.push({
      id: `continue:${currentSession.file}`,
      label: `Continue ${inventory.currentSpec.title}`,
      description: sessionDescription(
        currentSession,
        "Resume selected session",
      ),
      kind: "continue",
      decision: {
        action: "continue",
        specId: inventory.currentSpec.id,
        sessionFile: currentSession.file,
      },
    })
  }

  for (const { spec, sessions } of inventory.specs) {
    options.push({
      id: `new-session:${spec.id}`,
      label: `Start new session in ${spec.title}`,
      description: "Create a binding-only session before Pi starts",
      kind: "newSession",
      decision: { action: "newSession", specId: spec.id },
    })

    for (const session of sessions) {
      if (session.file === currentSession?.file) {
        continue
      }
      options.push({
        id: `open:${session.file}`,
        label: `Open ${spec.title}`,
        description: sessionDescription(session, "Open existing session"),
        kind: "openSession",
        decision: {
          action: "openSession",
          specId: spec.id,
          sessionFile: session.file,
        },
      })
    }
  }

  options.push({
    id: "new-spec",
    label: "Create spec",
    description: "Name a new specification workspace",
    kind: "newSpec",
  })
  options.push({
    id: "cancel",
    label: "Cancel",
    description: "Exit without opening a Brunch session",
    kind: "cancel",
    decision: { action: "cancel" },
  })

  return options
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

function findCurrentSession(
  inventory: WorkspaceLaunchInventory,
): WorkspaceLaunchSession | undefined {
  if (!inventory.currentSessionFile) {
    return undefined
  }
  for (const spec of inventory.specs) {
    const session = spec.sessions.find(
      (candidate) => candidate.file === inventory.currentSessionFile,
    )
    if (session) {
      return session
    }
  }
  return undefined
}

function sessionDescription(
  session: WorkspaceLaunchSession,
  prefix: string,
): string {
  return `${prefix} · ${session.id}`
}

function isPrintableInput(data: string): boolean {
  return data.length === 1 && data >= " " && data !== "\u007f"
}
