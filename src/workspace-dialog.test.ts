import { readFile } from "node:fs/promises"

import { visibleWidth, type Terminal } from "@earendil-works/pi-tui"

import { describe, expect, it } from "vitest"

import {
  buildWorkspaceDialogOptions,
  buildWorkspaceSelectionView,
  createWorkspaceDialogComponent,
  selectWorkspaceSelectionOption,
  runWorkspaceDialogPreflight,
} from "./pi-components/workspace-dialog/index.js"
import type { WorkspaceLaunchInventory } from "./workspace-session-coordinator.js"

describe("workspace dialog", () => {
  it("builds a hierarchical spec/session selection home without per-spec top-level actions", () => {
    const view = buildWorkspaceSelectionView(inventory())

    expect(view.stage).toBe("home")
    expect(view.options.map((option) => option.kind)).toEqual([
      "continue",
      "newSpec",
      "resumeSpec",
      "cancel",
    ])
    expect(view.options.map((option) => option.label)).toEqual([
      "Continue last session",
      "Create new specification",
      "Resume existing specification",
      "Cancel",
    ])
    expect(view.options.map((option) => option.label).join("\n")).not.toMatch(
      /Resume Alpha|Open Alpha|Start new session in Alpha/,
    )
    expect(selectWorkspaceSelectionOption(view, 0)).toEqual({
      decision: {
        action: "continue",
        specId: "spec-alpha",
        sessionFile: "/sessions/alpha-current.jsonl",
      },
    })
  })

  it("navigates resume-existing-spec to spec actions without emitting activation early", () => {
    const currentInventory = inventory()
    const home = buildWorkspaceSelectionView(currentInventory)
    const specList = selectWorkspaceSelectionOption(home, 2, currentInventory)

    expect(specList).toMatchObject({ view: { stage: "specList" } })
    if (!("view" in specList)) throw new Error("expected spec list")
    expect(specList.view.options.map((option) => option.label)).toEqual([
      "Alpha",
      "Beta",
    ])

    const specAction = selectWorkspaceSelectionOption(
      specList.view,
      0,
      currentInventory,
    )

    expect(specAction).toMatchObject({ view: { stage: "specAction" } })
    if (!("view" in specAction)) throw new Error("expected spec action")
    expect(specAction.view.options.map((option) => option.label)).toEqual([
      "Create new session",
      "Resume existing session",
    ])
    expect(selectWorkspaceSelectionOption(specAction.view, 0)).toEqual({
      decision: { action: "newSession", specId: "spec-alpha" },
    })
  })

  it("emits open-session only after a session is selected", () => {
    const sessionList = buildWorkspaceSelectionView(inventory(), {
      stage: "sessionList",
      specId: "spec-alpha",
    })

    expect(sessionList.options.map((option) => option.label)).toEqual([
      "session-alpha-current",
      "session-alpha-older",
    ])
    expect(selectWorkspaceSelectionOption(sessionList, 1)).toEqual({
      decision: {
        action: "openSession",
        specId: "spec-alpha",
        sessionFile: "/sessions/alpha-older.jsonl",
      },
    })
  })

  it("enters new-spec title state before emitting a new-spec decision", () => {
    const home = buildWorkspaceSelectionView(inventory())

    expect(selectWorkspaceSelectionOption(home, 1)).toMatchObject({
      view: { stage: "newSpecTitle", title: "", options: [] },
    })
  })

  it("builds explicit resume, new-session, open-session, create-spec, and cancel options", () => {
    const options = buildWorkspaceDialogOptions(inventory())

    expect(options.map((option) => option.kind)).toEqual([
      "continue",
      "newSession",
      "openSession",
      "newSession",
      "openSession",
      "newSpec",
      "cancel",
    ])
    expect(options[0]).toMatchObject({
      label: "Continue Alpha",
      decision: {
        action: "continue",
        specId: "spec-alpha",
        sessionFile: "/sessions/alpha-current.jsonl",
      },
    })
    expect(options.at(-2)).toMatchObject({
      label: "Create workspace",
    })
    expect(options.at(-2)).not.toHaveProperty("decision")
    expect(options.at(-1)).toMatchObject({
      label: "Cancel",
      decision: { action: "cancel" },
    })
  })

  it("renders specification copy without user-created workspace wording", () => {
    const component = createWorkspaceDialogComponent({
      inventory: inventory(),
      onDecision: () => {},
    })

    const text = component.render(80).join("\n")

    expect(text).toContain("Choose a specification")
    expect(text).toContain("Create new specification")
    expect(text).toContain("Resume existing specification")
    expect(text).not.toContain("Brunch workspace")
    expect(text).not.toContain("Create workspace")
    expect(text).not.toContain("Open workspace")
  })

  it("selects current continue as a typed decision", () => {
    const decisions: unknown[] = []
    const component = createWorkspaceDialogComponent({
      inventory: inventory(),
      onDecision: (decision) => decisions.push(decision),
    })

    component.handleInput!("\r")

    expect(decisions).toEqual([
      {
        action: "continue",
        specId: "spec-alpha",
        sessionFile: "/sessions/alpha-current.jsonl",
      },
    ])
  })

  it("returns new-session through the hierarchical keyboard path", () => {
    const decisions: unknown[] = []
    const component = createWorkspaceDialogComponent({
      inventory: inventory(),
      onDecision: (decision) => decisions.push(decision),
    })

    component.handleInput!("\x1B[B")
    component.handleInput!("\x1B[B")
    component.handleInput!("\r")
    component.handleInput!("\r")
    component.handleInput!("\r")

    expect(decisions).toEqual([{ action: "newSession", specId: "spec-alpha" }])
  })

  it("returns open-session through the hierarchical keyboard path", () => {
    const decisions: unknown[] = []
    const component = createWorkspaceDialogComponent({
      inventory: inventory(),
      onDecision: (decision) => decisions.push(decision),
    })

    component.handleInput!("\x1B[B")
    component.handleInput!("\x1B[B")
    component.handleInput!("\r")
    component.handleInput!("\r")
    component.handleInput!("\x1B[B")
    component.handleInput!("\r")
    component.handleInput!("\x1B[B")
    component.handleInput!("\r")

    expect(decisions).toEqual([
      {
        action: "openSession",
        specId: "spec-alpha",
        sessionFile: "/sessions/alpha-older.jsonl",
      },
    ])
  })

  it("returns new-spec decisions from title entry and cancel on escape", () => {
    const decisions: unknown[] = []
    const component = createWorkspaceDialogComponent({
      inventory: inventory(),
      onDecision: (decision) => decisions.push(decision),
    })

    component.handleInput!("\x1B[B")
    component.handleInput!("\r")
    for (const char of "Gamma") {
      component.handleInput!(char)
    }
    component.handleInput!("\r")
    const cancelComponent = createWorkspaceDialogComponent({
      inventory: inventory(),
      onDecision: (decision) => decisions.push(decision),
    })
    cancelComponent.handleInput!("\x1B")

    expect(decisions).toEqual([
      { action: "newSpec", title: "Gamma" },
      { action: "cancel" },
    ])
  })

  it("backs out one picker stage on escape and cancels from the home stage", () => {
    const decisions: unknown[] = []
    const component = createWorkspaceDialogComponent({
      inventory: inventory(),
      onDecision: (decision) => decisions.push(decision),
    })

    component.handleInput!("\x1B[B")
    component.handleInput!("\x1B[B")
    component.handleInput!("\r")
    expect(component.render(80).join("\n")).toContain("Choose a specification")
    component.handleInput!("\x1B")
    expect(component.render(80).join("\n")).toContain("Continue last session")
    component.handleInput!("\x1B")

    expect(decisions).toEqual([{ action: "cancel" }])
  })

  it("renders a branded centered-dialog frame with version metadata", () => {
    const component = createWorkspaceDialogComponent({
      inventory: inventory(),
      onDecision: () => {},
    })

    const lines = component.render(80)

    expect(lines[0]).toContain("╭")
    expect(lines[1]).toMatch(/^│\s+│$/)
    expect(lines.some((line) => line.includes("Choose a specification"))).toBe(
      true,
    )
    expect(lines.some((line) => line.includes("brunch v0.0.0"))).toBe(true)
    expect(lines.some((line) => line.includes("(dev"))).toBe(true)
    expect(lines.some((line) => line.includes("built on Pi v"))).toBe(true)
    expect(lines.every((line) => visibleWidth(line) <= 80)).toBe(true)
  })

  it("keeps logo assets colocated with the workspace dialog component", async () => {
    const source = await readFile(
      new URL(
        "./pi-components/workspace-dialog/assets/brunch-logo-quad-56x18.ansi",
        import.meta.url,
      ),
      "utf8",
    )

    expect(source).toContain("\x1B[")
  })

  it("declares pi-tui as a direct dependency", async () => {
    const manifest = JSON.parse(
      await readFile(new URL("../package.json", import.meta.url), "utf8"),
    ) as { dependencies?: Record<string, string> }

    expect(manifest.dependencies).toHaveProperty("@earendil-works/pi-tui")
  })

  it("clears the startup preflight frame after a workspace decision", async () => {
    const terminal = new FakeTerminal()
    const decision = runWorkspaceDialogPreflight(inventory(), { terminal })

    terminal.emit("\r")

    await expect(decision).resolves.toMatchObject({ action: "continue" })
    expect(terminal.events.at(-2)).toBe("stop")
    expect(terminal.events.at(-1)).toBe("clearScreen")
  })
})

class FakeTerminal implements Terminal {
  events: string[] = []
  #onInput: ((data: string) => void) | undefined

  get columns(): number {
    return 100
  }

  get rows(): number {
    return 32
  }

  get kittyProtocolActive(): boolean {
    return false
  }

  start(onInput: (data: string) => void): void {
    this.events.push("start")
    this.#onInput = onInput
  }

  stop(): void {
    this.events.push("stop")
  }

  async drainInput(): Promise<void> {}

  write(_data: string): void {}

  moveBy(_lines: number): void {}

  hideCursor(): void {}

  showCursor(): void {}

  clearLine(): void {}

  clearFromCursor(): void {}

  clearScreen(): void {
    this.events.push("clearScreen")
  }

  setTitle(_title: string): void {}

  setProgress(_active: boolean): void {}

  emit(data: string): void {
    this.#onInput?.(data)
  }
}

function inventory(): WorkspaceLaunchInventory {
  return {
    cwd: "/project",
    currentSpec: { id: "spec-alpha", title: "Alpha" },
    currentSessionFile: "/sessions/alpha-current.jsonl",
    needsNewSpec: false,
    specs: [
      {
        spec: { id: "spec-alpha", title: "Alpha" },
        sessions: [
          {
            id: "session-alpha-current",
            file: "/sessions/alpha-current.jsonl",
            specId: "spec-alpha",
            specTitle: "Alpha",
            available: true,
          },
          {
            id: "session-alpha-older",
            file: "/sessions/alpha-older.jsonl",
            specId: "spec-alpha",
            specTitle: "Alpha",
            available: true,
          },
        ],
      },
      {
        spec: { id: "spec-beta", title: "Beta" },
        sessions: [
          {
            id: "session-beta",
            file: "/sessions/beta.jsonl",
            specId: "spec-beta",
            specTitle: "Beta",
            available: true,
          },
        ],
      },
    ],
    unavailableSessions: [],
  }
}
