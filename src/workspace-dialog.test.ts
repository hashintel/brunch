import { readFile } from "node:fs/promises"

import { type Terminal } from "@earendil-works/pi-tui"

import { describe, expect, it } from "vitest"

import {
  buildWorkspaceSelectionView,
  createWorkspaceDialogComponent,
  selectWorkspaceSelectionOption,
  runWorkspaceDialogPreflight,
} from "./tui-client/.pi/components/workspace-dialog/index.js"
import type { WorkspaceLaunchInventory } from "./workspace-session-coordinator.js"

describe("spec/session picker", () => {
  it("builds a hierarchical spec/session selection home without per-spec top-level actions", () => {
    const view = buildWorkspaceSelectionView(inventory())

    expect(view.stage).toBe("home")
    expect(view.options.map((option) => option.kind)).toEqual([
      "continue",
      "resumeSpec",
      "newSpec",
      "cancel",
    ])
    expect(view.options.map((option) => option.label)).toEqual([
      "Continue your latest spec and session",
      "Continue another existing specification",
      "Start a new specification",
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
    const specList = selectWorkspaceSelectionOption(home, 1, currentInventory)

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

    expect(selectWorkspaceSelectionOption(home, 2)).toMatchObject({
      view: { stage: "newSpecTitle", title: "", options: [] },
    })
  })

  it("only shows logical home options in an empty workspace", () => {
    const view = buildWorkspaceSelectionView(emptyInventory())

    expect(view.options.map((option) => option.label)).toEqual([
      "Start a new specification",
      "Cancel",
    ])
  })

  it("only shows resume-existing-session when the chosen spec has sessions", () => {
    const view = buildWorkspaceSelectionView(emptySessionInventory(), {
      stage: "specAction",
      specId: "spec-empty",
    })

    expect(view.options.map((option) => option.label)).toEqual([
      "Create new session",
    ])
  })

  it("renders specification copy without user-created workspace wording", () => {
    const component = createWorkspaceDialogComponent({
      inventory: inventory(),
      onDecision: () => {},
    })

    const text = component.render(80).join("\n")

    expect(text).toContain("Choose a specification")
    expect(text).toContain("Start a new specification")
    expect(text).toContain("Continue another existing specification")
    expect(text).not.toContain("Brunch workspace")
    expect(text).not.toContain("Create workspace")
    expect(text).not.toContain("Open workspace")
  })

  it("omits continue-latest from in-session picker contexts", () => {
    const component = createWorkspaceDialogComponent({
      inventory: inventory(),
      includeContinue: false,
      onDecision: () => {},
    })

    const text = component.render(80).join("\n")

    expect(text).not.toContain("Continue your latest spec and session")
    expect(text).toContain("Switch to another specification")
    expect(text).toContain("Start a new specification")
    expect(text.indexOf("Switch to another specification")).toBeLessThan(
      text.indexOf("Start a new specification"),
    )
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

  it("accepts chunked title input from terminal automation", () => {
    const decisions: unknown[] = []
    const component = createWorkspaceDialogComponent({
      inventory: inventory(),
      onDecision: (decision) => decisions.push(decision),
    })

    component.handleInput!("\x1B[B")
    component.handleInput!("\x1B[B")
    component.handleInput!("\r")
    component.handleInput!("Gamma")
    component.handleInput!("\r")

    expect(decisions).toEqual([{ action: "newSpec", title: "Gamma" }])
  })

  it("backs out one picker stage on escape and cancels from the home stage", () => {
    const decisions: unknown[] = []
    const component = createWorkspaceDialogComponent({
      inventory: inventory(),
      onDecision: (decision) => decisions.push(decision),
    })

    component.handleInput!("\x1B[B")
    component.handleInput!("\r")
    expect(component.render(80).join("\n")).toContain("Choose a specification")
    component.handleInput!("\x1B")
    expect(component.render(80).join("\n")).toContain(
      "Continue your latest spec and session",
    )
    component.handleInput!("\x1B")

    expect(decisions).toEqual([{ action: "cancel" }])
  })

  it("cancels from startup preflight on ctrl-c", async () => {
    const terminal = new FakeTerminal()
    const decision = runWorkspaceDialogPreflight(inventory(), { terminal })

    terminal.emit("\x03")

    await expect(decision).resolves.toEqual({ action: "cancel" })
    expect(terminal.events.at(-2)).toBe("stop")
    expect(terminal.events.at(-1)).toBe("clearScreen")
  })

  it("renders a branded centered-dialog frame with separately styled version metadata", () => {
    const component = createWorkspaceDialogComponent({
      inventory: inventory(),
      onDecision: () => {},
      theme: {
        fg: (color, text) => `[${color}]${text}[/${color}]`,
      },
    })

    const lines = component.render(80)

    expect(lines[0]).toContain("╭")
    expect(lines[1]).toMatch(
      /^\[borderMuted\]│\[\/borderMuted\]\s+\[borderMuted\]│\[\/borderMuted\]$/,
    )
    expect(lines.some((line) => line.includes("Choose a specification"))).toBe(
      true,
    )
    expect(
      lines.some((line) => line.includes("[accent]brunch v0.0.0[/accent]")),
    ).toBe(true)
    expect(lines.some((line) => line.includes("[success](dev"))).toBe(true)
    expect(lines.some((line) => line.includes("built on Pi v"))).toBe(true)
  })

  it("keeps logo assets colocated with the private picker component", async () => {
    const source = await readFile(
      new URL(
        "./tui-client/.pi/components/workspace-dialog/assets/brunch-logo-quad-56x18.ansi",
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

  it("clears the startup preflight frame after a spec/session decision", async () => {
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

function emptyInventory(): WorkspaceLaunchInventory {
  return {
    cwd: "/project",
    currentSpec: null,
    currentSessionFile: null,
    needsNewSpec: true,
    specs: [],
    unavailableSessions: [],
  }
}

function emptySessionInventory(): WorkspaceLaunchInventory {
  return {
    cwd: "/project",
    currentSpec: { id: "spec-empty", title: "Empty" },
    currentSessionFile: null,
    needsNewSpec: false,
    specs: [{ spec: { id: "spec-empty", title: "Empty" }, sessions: [] }],
    unavailableSessions: [],
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
