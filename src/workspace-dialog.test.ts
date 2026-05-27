import { readFile } from "node:fs/promises"

import { visibleWidth } from "@earendil-works/pi-tui"

import { describe, expect, it } from "vitest"

import {
  buildWorkspaceDialogOptions,
  createWorkspaceDialogComponent,
} from "./pi-components/workspace-dialog/index.js"
import type { WorkspaceLaunchInventory } from "./workspace-session-coordinator.js"

describe("workspace dialog", () => {
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

  it("selects current resume and existing sessions as typed decisions", () => {
    const decisions: unknown[] = []
    const component = createWorkspaceDialogComponent({
      inventory: inventory(),
      onDecision: (decision) => decisions.push(decision),
    })

    component.handleInput!("\r")
    component.handleInput!("\x1B[B")
    component.handleInput!("\x1B[B")
    component.handleInput!("\r")

    expect(decisions).toEqual([
      {
        action: "continue",
        specId: "spec-alpha",
        sessionFile: "/sessions/alpha-current.jsonl",
      },
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

    for (let index = 0; index < 5; index += 1) {
      component.handleInput!("\x1B[B")
    }
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

  it("renders a branded centered-dialog frame within the requested width", () => {
    const component = createWorkspaceDialogComponent({
      inventory: inventory(),
      onDecision: () => {},
    })

    const lines = component.render(64)

    expect(lines[0]).toContain("╭")
    expect(lines.some((line) => line.includes("Brunch workspace"))).toBe(true)
    expect(lines.every((line) => visibleWidth(line) <= 64)).toBe(true)
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
})

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
