/**
 * Pi tool → CommandExecutor translation seam.
 *
 * SPEC: D4-L, D20-L, D52-L, D53-L
 *
 * This module translates Pi tool parameters (flat JSON from LLM tool calls)
 * into CommandExecutor input types and formats CommandExecutor results into
 * Pi tool result content. It does NOT import from db/ — all graph access
 * routes through CommandExecutor and snapshot readers.
 */

import type {
  BatchEdgeInput,
  BatchEdgeRef,
  BatchNodeInput,
  CommitGraphInput,
  CommitGraphResult,
  CommitGraphSuccess,
  Diagnostic,
  StructuralIllegal,
} from "../../../graph/command-executor.js"
import type {
  GraphOverview,
  NeighborhoodResult,
} from "../../../graph/snapshot.js"

// ---------------------------------------------------------------------------
// commit-graph: Pi params → CommitGraphInput
// ---------------------------------------------------------------------------

/** Shape of a node as received from the LLM tool call. */
export interface ToolCommitNode {
  readonly ref: string
  readonly plane: string
  readonly kind: string
  readonly title: string
  readonly body?: string
  readonly basis?: string
  readonly source?: string
  readonly detail?: unknown
}

/** Shape of an edge as received from the LLM tool call. */
export interface ToolCommitEdge {
  readonly category: string
  readonly source: string | { readonly existing: number }
  readonly target: string | { readonly existing: number }
  readonly stance?: string
  readonly rationale?: string
}

/** Shape of the commit_graph tool params from the LLM. */
export interface ToolCommitGraphParams {
  readonly nodes: readonly ToolCommitNode[]
  readonly edges: readonly ToolCommitEdge[]
}

/**
 * Translate Pi tool params into a CommandExecutor CommitGraphInput.
 *
 * The translation is thin — structural validation happens in the CommandExecutor.
 */
export function translateCommitGraph(
  params: ToolCommitGraphParams,
): CommitGraphInput {
  const nodes: BatchNodeInput[] = params.nodes.map((n) => ({
    ref: n.ref,
    plane: n.plane as BatchNodeInput["plane"],
    kind: n.kind,
    title: n.title,
    body: n.body,
    basis: n.basis as BatchNodeInput["basis"],
    source: n.source,
    detail: n.detail,
  }))

  const edges: BatchEdgeInput[] = params.edges.map((e) => ({
    category: e.category,
    source: resolveEdgeRef(e.source),
    target: resolveEdgeRef(e.target),
    stance: e.stance,
    rationale: e.rationale,
  }))

  return { nodes, edges }
}

function resolveEdgeRef(
  ref: string | { readonly existing: number },
): BatchEdgeRef {
  if (typeof ref === "string") return ref
  return { existing: ref.existing }
}

// ---------------------------------------------------------------------------
// Result formatting
// ---------------------------------------------------------------------------

/**
 * Format a CommitGraphResult as Pi tool result text content.
 *
 * On success: human-readable summary with created ids.
 * On structural_illegal: diagnostic listing for agent self-correction.
 */
export function formatCommitGraphResult(result: CommitGraphResult): string {
  if (result.status === "success") {
    return formatCommitSuccess(result)
  }
  return formatDiagnostics(result)
}

function formatCommitSuccess(result: CommitGraphSuccess): string {
  const nodeEntries = Object.entries(result.nodes)
  const lines: string[] = [`Graph committed successfully (LSN ${result.lsn}).`]

  if (nodeEntries.length > 0) {
    lines.push(
      `Nodes created: ${nodeEntries.map(([ref, id]) => `${ref} → #${id}`).join(", ")}`,
    )
  }
  if (result.edges.length > 0) {
    lines.push(
      `Edges created: ${result.edges.map((id) => `#${id}`).join(", ")}`,
    )
  }

  return lines.join("\n")
}

function formatDiagnostics(result: StructuralIllegal): string {
  const lines: string[] = [
    "STRUCTURAL_ILLEGAL: The batch was rejected. Fix the following issues and retry:",
    "",
  ]

  for (const d of result.diagnostics) {
    lines.push(`- ${d.field}: ${d.message}`)
  }

  return lines.join("\n")
}

// ---------------------------------------------------------------------------
// read-graph: overview formatting
// ---------------------------------------------------------------------------

/**
 * Format a GraphOverview as readable text for the agent.
 */
export function formatGraphOverview(overview: GraphOverview): string {
  if (overview.nodeCount === 0) {
    return "The graph is empty (no nodes or edges)."
  }

  const lines: string[] = [
    `Graph overview (LSN ${overview.lsn}): ${overview.nodeCount} node(s), ${overview.edgeCount} edge(s).`,
    "",
  ]

  for (const node of overview.nodes) {
    const detail = node.detail ? ` [has detail]` : ""
    lines.push(
      `- [#${node.id}] ${node.plane}/${node.kind}: "${node.title}"${detail}`,
    )
  }

  if (overview.edges.length > 0) {
    lines.push("")
    for (const edge of overview.edges) {
      const stance = edge.stance ? ` (${edge.stance})` : ""
      lines.push(
        `- Edge #${edge.id}: #${edge.sourceId} —[${edge.category}${stance}]→ #${edge.targetId}`,
      )
    }
  }

  return lines.join("\n")
}

/**
 * Format a NeighborhoodResult as readable text for the agent.
 */
export function formatNeighborhoodResult(result: NeighborhoodResult): string {
  if (result.status === "not_found") {
    return "Node not found."
  }

  const { anchor, neighbors, edges } = result
  const lines: string[] = [
    `Neighborhood of [#${anchor.id}] ${anchor.plane}/${anchor.kind}: "${anchor.title}"`,
  ]

  if (anchor.body) {
    lines.push(`Body: ${anchor.body}`)
  }

  if (neighbors.length > 0) {
    lines.push("", "Neighbors:")
    for (const n of neighbors) {
      lines.push(`  - [#${n.id}] ${n.plane}/${n.kind}: "${n.title}"`)
    }
  }

  if (edges.length > 0) {
    lines.push("", "Edges:")
    for (const e of edges) {
      const stance = e.stance ? ` (${e.stance})` : ""
      lines.push(
        `  - #${e.id}: #${e.sourceId} —[${e.category}${stance}]→ #${e.targetId}`,
      )
    }
  }

  return lines.join("\n")
}
