/**
 * CommandExecutor — the single public mutation boundary for graph truth.
 *
 * SPEC: D4-L (one shared mutation surface), D20-L (command execution owns
 * authority seam), D16-L (one-transaction-per-commit, no bypass), D52-L
 * (graph/ imports db/, no other layer imports db/).
 *
 * Every graph mutation routes through this class. The executor owns:
 *  - structural validation
 *  - one SQLite transaction per command
 *  - monotonic LSN allocation from graph_clock
 *  - change_log append
 *  - structured result return
 *
 * The result contract already includes all discriminants (success,
 * structural_illegal, needs_human, policy_blocked, version_conflict)
 * even though pre-M6 policy classification is minimal.
 */

import { eq, sql } from "drizzle-orm"

import type { BrunchDb } from "../db/connection.js"
import * as schema from "../db/schema.js"
import type { NodeBasis, NodePlane } from "./schema/nodes.js"

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

/** A single validation problem discovered during structural checks. */
export interface Diagnostic {
  readonly field: string
  readonly message: string
}

/** Successful command execution. */
export interface CommandSuccess {
  readonly status: "success"
  readonly nodeId: number
  readonly lsn: number
}

/** Structurally invalid input — validation failed before any write. */
export interface StructuralIllegal {
  readonly status: "structural_illegal"
  readonly diagnostics: readonly Diagnostic[]
}

/** Action requires human confirmation (M6 placeholder). */
export interface NeedsHuman {
  readonly status: "needs_human"
}

/** Action blocked by authority policy (M6 placeholder). */
export interface PolicyBlocked {
  readonly status: "policy_blocked"
}

/** Optimistic concurrency conflict (M6 placeholder). */
export interface VersionConflict {
  readonly status: "version_conflict"
}

/** Union of all possible command results. */
export type CommandResult = CommandSuccess | StructuralIllegal | NeedsHuman | PolicyBlocked | VersionConflict

/** Result of a createNode command. */
export type CreateNodeResult = CommandSuccess | StructuralIllegal

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

/** Input for creating a single graph node. */
export interface CreateNodeInput {
  readonly plane: NodePlane
  readonly kind: string
  readonly title: string
  readonly body?: string | undefined
  readonly basis?: NodeBasis | undefined
  readonly source?: string | undefined
  readonly detail?: unknown
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const VALID_KINDS_BY_PLANE: Record<string, readonly string[]> = {
  intent: schema.INTENT_KINDS as unknown as string[],
  oracle: schema.ORACLE_KINDS as unknown as string[],
  design: schema.DESIGN_KINDS as unknown as string[],
  plan: schema.PLAN_KINDS as unknown as string[],
}

const KINDS_REQUIRING_DETAIL = new Set<string>(["decision", "term"])

function validateCreateNode(input: CreateNodeInput): Diagnostic[] {
  const diagnostics: Diagnostic[] = []

  // Title must be non-empty
  if (!input.title.trim()) {
    diagnostics.push({ field: "title", message: "title must be non-empty" })
  }

  // Kind must be valid for the given plane
  const validKinds = VALID_KINDS_BY_PLANE[input.plane]
  if (!validKinds?.includes(input.kind)) {
    diagnostics.push({
      field: "kind",
      message: `"${input.kind}" is not a valid kind for plane "${input.plane}"`,
    })
    return diagnostics // can't validate detail if kind is wrong
  }

  // Detail requirement: decision and term REQUIRE detail
  if (KINDS_REQUIRING_DETAIL.has(input.kind) && input.detail == null) {
    diagnostics.push({
      field: "detail",
      message: `"${input.kind}" nodes require a detail object`,
    })
    return diagnostics
  }

  // Detail prohibition: all other kinds must NOT have detail
  if (!KINDS_REQUIRING_DETAIL.has(input.kind) && input.detail != null) {
    diagnostics.push({
      field: "detail",
      message: `"${input.kind}" nodes must not have a detail object`,
    })
    return diagnostics
  }

  // Validate detail shape per kind
  if (input.kind === "decision" && input.detail != null) {
    validateDecisionDetail(input.detail, diagnostics)
  }
  if (input.kind === "term" && input.detail != null) {
    validateTermDetail(input.detail, diagnostics)
  }

  return diagnostics
}

function validateDecisionDetail(
  detail: unknown,
  diagnostics: Diagnostic[],
): void {
  if (typeof detail !== "object" || detail === null) {
    diagnostics.push({ field: "detail", message: "must be an object" })
    return
  }

  const d = detail as Record<string, unknown>
  const knownFields = new Set(["chosen_option", "rejected", "rationale"])

  if (typeof d["chosen_option"] !== "string") {
    diagnostics.push({
      field: "detail.chosen_option",
      message: "required string",
    })
  }

  if (
    !Array.isArray(d["rejected"]) ||
    d["rejected"].length < 1 ||
    !d["rejected"].every((r) => typeof r === "string")
  ) {
    diagnostics.push({
      field: "detail.rejected",
      message: "required non-empty string array",
    })
  }

  if (typeof d["rationale"] !== "string") {
    diagnostics.push({ field: "detail.rationale", message: "required string" })
  }

  // Closed validation: reject unknown fields
  for (const key of Object.keys(d)) {
    if (!knownFields.has(key)) {
      diagnostics.push({ field: `detail.${key}`, message: "unknown field" })
    }
  }
}

function validateTermDetail(detail: unknown, diagnostics: Diagnostic[]): void {
  if (typeof detail !== "object" || detail === null) {
    diagnostics.push({ field: "detail", message: "must be an object" })
    return
  }

  const d = detail as Record<string, unknown>
  const knownFields = new Set(["definition", "aliases"])

  if (typeof d["definition"] !== "string") {
    diagnostics.push({
      field: "detail.definition",
      message: "required string",
    })
  }

  if (
    d["aliases"] != null &&
    (!Array.isArray(d["aliases"]) ||
      !d["aliases"].every((a) => typeof a === "string"))
  ) {
    diagnostics.push({
      field: "detail.aliases",
      message: "must be a string array if present",
    })
  }

  // Closed validation: reject unknown fields
  for (const key of Object.keys(d)) {
    if (!knownFields.has(key)) {
      diagnostics.push({ field: `detail.${key}`, message: "unknown field" })
    }
  }
}

// ---------------------------------------------------------------------------
// CommandExecutor
// ---------------------------------------------------------------------------

export class CommandExecutor {
  constructor(private readonly db: BrunchDb) {}

  /**
   * Create a single graph node.
   *
   * Validates structurally, then executes inside one transaction:
   * allocate LSN → insert node → append change_log → return result.
   *
   * On validation failure, nothing is written.
   */
  createNode(input: CreateNodeInput): CreateNodeResult {
    const diagnostics = validateCreateNode(input)
    if (diagnostics.length > 0) {
      return { status: "structural_illegal", diagnostics }
    }

    return this.db.transaction((tx) => {
      // 1. Allocate LSN (atomic increment)
      const clock = tx
        .update(schema.graphClock)
        .set({ lsn: sql`${schema.graphClock.lsn} + 1` })
        .where(eq(schema.graphClock.id, 1))
        .returning()
        .get()
      const lsn = clock!.lsn

      // 2. Insert node
      const node = tx
        .insert(schema.nodes)
        .values({
          plane: input.plane,
          kind: input.kind,
          title: input.title,
          body: input.body ?? null,
          basis: input.basis ?? "explicit",
          source: input.source ?? null,
          detail: input.detail != null ? JSON.stringify(input.detail) : null,
          created_at_lsn: lsn,
          updated_at_lsn: lsn,
        })
        .returning()
        .get()
      const nodeId = node!.id

      // 3. Append change_log
      tx.insert(schema.changeLog)
        .values({
          lsn,
          operation: "create_node",
          payload: JSON.stringify({
            nodeId,
            plane: input.plane,
            kind: input.kind,
          }),
        })
        .run()

      return { status: "success" as const, nodeId, lsn }
    })
  }
}
