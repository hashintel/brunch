/**
 * CommandExecutor tests — acceptance criteria for the M4 skeleton slice.
 *
 * SPEC: D4-L, D20-L, D16-L, D52-L
 * Scope card: CommandExecutor skeleton with single-node proof-of-life
 */

import { describe, expect, it, beforeEach } from "vitest"

import { createDb, type BrunchDb } from "../db/connection.js"
import { graphClock, changeLog, nodes } from "../db/schema.js"
import { CommandExecutor } from "./command-executor.js"

function createTestDb(): BrunchDb {
  return createDb(":memory:")
}

describe("CommandExecutor", () => {
  let db: BrunchDb
  let executor: CommandExecutor

  beforeEach(() => {
    db = createTestDb()
    executor = new CommandExecutor(db)
  })

  // --- graph_clock initialization ---

  it("initializes graph_clock with lsn=0", () => {
    const rows = db.select().from(graphClock).all()
    expect(rows).toHaveLength(1)
    expect(rows[0]!.lsn).toBe(0)
  })

  // --- createNode: success path ---

  it("creates a valid intent node and returns success with nodeId and lsn", () => {
    const result = executor.createNode({
      plane: "intent",
      kind: "requirement",
      title: "System must be offline-capable",
      body: "Works without network connectivity",
    })

    expect(result.status).toBe("success")
    if (result.status !== "success") throw new Error("unreachable")
    expect(result.nodeId).toBeTypeOf("number")
    expect(result.lsn).toBe(1)
  })

  it("defaults basis to 'explicit' when omitted", () => {
    executor.createNode({
      plane: "intent",
      kind: "goal",
      title: "Some goal",
    })

    const row = db.select().from(nodes).all()[0]
    expect(row!.basis).toBe("explicit")
  })

  it("stores optional body and source fields", () => {
    executor.createNode({
      plane: "intent",
      kind: "context",
      title: "Target market",
      body: "Enterprise B2B SaaS",
      source: "stakeholder",
    })

    const row = db.select().from(nodes).all()[0]
    expect(row!.body).toBe("Enterprise B2B SaaS")
    expect(row!.source).toBe("stakeholder")
  })

  it("creates a decision node with required detail", () => {
    const result = executor.createNode({
      plane: "intent",
      kind: "decision",
      title: "Use SQLite for persistence",
      detail: {
        chosen_option: "SQLite via better-sqlite3",
        rejected: ["PostgreSQL", "In-memory only"],
        rationale: "Local-first single-process, no server needed",
      },
    })

    expect(result.status).toBe("success")
    const row = db.select().from(nodes).all()[0]
    expect(row!.detail).not.toBeNull()
    const detail = JSON.parse(row!.detail!)
    expect(detail.chosen_option).toBe("SQLite via better-sqlite3")
    expect(detail.rejected).toEqual(["PostgreSQL", "In-memory only"])
  })

  it("creates a term node with required detail", () => {
    const result = executor.createNode({
      plane: "intent",
      kind: "term",
      title: "Reconciliation Need",
      detail: {
        definition: "A record of an open impasse over graph state",
        aliases: ["recon need", "impasse"],
      },
    })

    expect(result.status).toBe("success")
    const row = db.select().from(nodes).all()[0]
    const detail = JSON.parse(row!.detail!)
    expect(detail.definition).toBe(
      "A record of an open impasse over graph state",
    )
    expect(detail.aliases).toEqual(["recon need", "impasse"])
  })

  // --- createNode: structural_illegal rejections ---

  it("rejects invalid kind for plane", () => {
    const result = executor.createNode({
      plane: "intent",
      kind: "check", // oracle-plane kind, not intent
      title: "Wrong plane",
    })

    expect(result.status).toBe("structural_illegal")
    if (result.status !== "structural_illegal") throw new Error("unreachable")
    expect(result.diagnostics.some((d) => d.field === "kind")).toBe(true)
  })

  it("rejects decision without detail", () => {
    const result = executor.createNode({
      plane: "intent",
      kind: "decision",
      title: "Some decision",
    })

    expect(result.status).toBe("structural_illegal")
    if (result.status !== "structural_illegal") throw new Error("unreachable")
    expect(result.diagnostics.some((d) => d.field === "detail")).toBe(true)
  })

  it("rejects term without detail", () => {
    const result = executor.createNode({
      plane: "intent",
      kind: "term",
      title: "Some term",
    })

    expect(result.status).toBe("structural_illegal")
    if (result.status !== "structural_illegal") throw new Error("unreachable")
    expect(result.diagnostics.some((d) => d.field === "detail")).toBe(true)
  })

  it("rejects non-decision/term node with detail present", () => {
    const result = executor.createNode({
      plane: "intent",
      kind: "requirement",
      title: "Some requirement",
      detail: { definition: "should not be here" },
    })

    expect(result.status).toBe("structural_illegal")
    if (result.status !== "structural_illegal") throw new Error("unreachable")
    expect(result.diagnostics.some((d) => d.field === "detail")).toBe(true)
  })

  it("rejects decision with empty rejected array", () => {
    const result = executor.createNode({
      plane: "intent",
      kind: "decision",
      title: "Bad decision",
      detail: {
        chosen_option: "A",
        rejected: [],
        rationale: "because",
      },
    })

    expect(result.status).toBe("structural_illegal")
    if (result.status !== "structural_illegal") throw new Error("unreachable")
    expect(result.diagnostics.some((d) => d.field === "detail.rejected")).toBe(
      true,
    )
  })

  it("rejects decision detail with unknown fields", () => {
    const result = executor.createNode({
      plane: "intent",
      kind: "decision",
      title: "Leaky decision",
      detail: {
        chosen_option: "A",
        rejected: ["B"],
        rationale: "because",
        extra_field: "should not be here",
      },
    })

    expect(result.status).toBe("structural_illegal")
    if (result.status !== "structural_illegal") throw new Error("unreachable")
    expect(
      result.diagnostics.some((d) => d.field === "detail.extra_field"),
    ).toBe(true)
  })

  // --- LSN / graph_clock ---

  it("increments graph_clock atomically per command", () => {
    executor.createNode({
      plane: "intent",
      kind: "goal",
      title: "First",
    })
    executor.createNode({
      plane: "intent",
      kind: "goal",
      title: "Second",
    })

    const [clock] = db.select().from(graphClock).all()
    expect(clock!.lsn).toBe(2)
  })

  it("assigns matching created_at_lsn and updated_at_lsn on new nodes", () => {
    const result = executor.createNode({
      plane: "intent",
      kind: "assumption",
      title: "Pi exposes enough seams",
    })

    if (result.status !== "success") throw new Error("unreachable")
    const row = db.select().from(nodes).all()[0]
    expect(row!.created_at_lsn).toBe(result.lsn)
    expect(row!.updated_at_lsn).toBe(result.lsn)
  })

  it("LSN is strictly monotonic across multiple creates", () => {
    const lsns: number[] = []
    for (let i = 0; i < 10; i++) {
      const result = executor.createNode({
        plane: "intent",
        kind: "context",
        title: `Context ${i}`,
      })
      if (result.status !== "success") throw new Error("unreachable")
      lsns.push(result.lsn)
    }

    for (let i = 1; i < lsns.length; i++) {
      expect(lsns[i]).toBe(lsns[i - 1]! + 1)
    }
  })

  // --- change_log ---

  it("appends exactly one change_log entry per successful command", () => {
    executor.createNode({
      plane: "intent",
      kind: "requirement",
      title: "Must persist",
    })

    const logs = db.select().from(changeLog).all()
    expect(logs).toHaveLength(1)
    expect(logs[0]!.operation).toBe("create_node")
  })

  it("change_log payload contains nodeId, plane, and kind", () => {
    const result = executor.createNode({
      plane: "intent",
      kind: "invariant",
      title: "LSN monotonicity",
    })

    if (result.status !== "success") throw new Error("unreachable")
    const [log] = db.select().from(changeLog).all()
    const payload = JSON.parse(log!.payload)
    expect(payload.nodeId).toBe(result.nodeId)
    expect(payload.plane).toBe("intent")
    expect(payload.kind).toBe("invariant")
  })

  it("change_log.lsn matches the command's allocated LSN", () => {
    const result = executor.createNode({
      plane: "intent",
      kind: "goal",
      title: "Test",
    })

    if (result.status !== "success") throw new Error("unreachable")
    const [log] = db.select().from(changeLog).all()
    expect(log!.lsn).toBe(result.lsn)
  })

  // --- Transaction integrity ---

  it("writes nothing on validation failure (no LSN bump, no change_log)", () => {
    executor.createNode({
      plane: "intent",
      kind: "check", // invalid kind for intent plane
      title: "Should fail",
    })

    const [clock] = db.select().from(graphClock).all()
    expect(clock!.lsn).toBe(0)
    expect(db.select().from(nodes).all()).toHaveLength(0)
    expect(db.select().from(changeLog).all()).toHaveLength(0)
  })

  // --- Oracle/design/plan plane nodes ---

  it("creates oracle-plane nodes", () => {
    const result = executor.createNode({
      plane: "oracle",
      kind: "check",
      title: "Verify LSN monotonicity",
    })

    expect(result.status).toBe("success")
  })

  it("creates design-plane nodes", () => {
    const result = executor.createNode({
      plane: "design",
      kind: "module",
      title: "CommandExecutor",
    })

    expect(result.status).toBe("success")
  })

  it("creates plan-plane nodes", () => {
    const result = executor.createNode({
      plane: "plan",
      kind: "slice",
      title: "M4 skeleton",
    })

    expect(result.status).toBe("success")
  })
})
