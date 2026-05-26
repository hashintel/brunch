import { readFile } from "node:fs/promises"

import { visibleWidth } from "@earendil-works/pi-tui"

import { describe, expect, it } from "vitest"

import {
  buildWorkspaceSwitchOptions,
  createWorkspaceSwitchComponent,
} from "./workspace-switcher.js"
import type { WorkspaceLaunchInventory } from "./workspace-session-coordinator.js"

describe("workspace switcher", () => {
  it("builds explicit resume, new-session, open-session, create-spec, and cancel options", () => {
    const options = buildWorkspaceSwitchOptions(inventory())

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
      label: "Create spec",
    })
    expect(options.at(-2)).not.toHaveProperty("decision")
    expect(options.at(-1)).toMatchObject({
      label: "Cancel",
      decision: { action: "cancel" },
    })
  })

  it("selects current resume and existing sessions as typed decisions", () => {
    const decisions: unknown[] = []
    const component = createWorkspaceSwitchComponent({
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
    const component = createWorkspaceSwitchComponent({
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
    const cancelComponent = createWorkspaceSwitchComponent({
      inventory: inventory(),
      onDecision: (decision) => decisions.push(decision),
    })
    cancelComponent.handleInput!("\x1B")

    expect(decisions).toEqual([
      { action: "newSpec", title: "Gamma" },
      { action: "cancel" },
    ])
  })

  it("keeps rendered lines within the requested width", () => {
    const component = createWorkspaceSwitchComponent({
      inventory: inventory(),
      onDecision: () => {},
    })

    expect(component.render(24).every((line) => visibleWidth(line) <= 24)).toBe(
      true,
    )
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
