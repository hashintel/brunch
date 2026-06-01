/**
 * Graph snapshot readers — cursory overview and node neighborhood.
 *
 * SPEC: I35-L (two detail levels), D52-L (graph/ reads db/)
 *
 * These are pure read functions over BrunchDb. They return typed
 * domain objects (GraphNode, GraphEdge), not raw Drizzle rows.
 * Superseded predecessors (nodes that are targets of a `supersession`
 * edge) are excluded per CATEGORY_POLICY projectionEffect.
 */

import { eq, or, inArray } from "drizzle-orm"

import type { BrunchDb } from "../db/connection.js"
import * as schema from "../db/schema.js"
import type { GraphEdge } from "./schema/edges.js"
import type { GraphNode, NodeDetail } from "./schema/nodes.js"

// ---------------------------------------------------------------------------
// Return types
// ---------------------------------------------------------------------------

/** Full-graph cursory overview. */
export interface GraphOverview {
  readonly nodes: readonly GraphNode[]
  readonly edges: readonly GraphEdge[]
  readonly nodeCount: number
  readonly edgeCount: number
  /** Current LSN from graph_clock. */
  readonly lsn: number
}

/** Successful neighborhood result. */
export interface NeighborhoodSuccess {
  readonly status: "success"
  readonly anchor: GraphNode
  readonly neighbors: readonly GraphNode[]
  readonly edges: readonly GraphEdge[]
}

/** Node not found. */
export interface NeighborhoodNotFound {
  readonly status: "not_found"
}

export type NeighborhoodResult = NeighborhoodSuccess | NeighborhoodNotFound

export interface NeighborhoodOptions {
  /** Number of hops from the anchor node. Defaults to 1. */
  readonly hops?: number
}

// ---------------------------------------------------------------------------
// Row → domain mapping
// ---------------------------------------------------------------------------

function rowToNode(row: typeof schema.nodes.$inferSelect): GraphNode {
  return {
    id: row.id,
    plane: row.plane as GraphNode["plane"],
    kind: row.kind as GraphNode["kind"],
    title: row.title,
    ...(row.body != null ? { body: row.body } : {}),
    basis: row.basis as GraphNode["basis"],
    ...(row.source != null ? { source: row.source } : {}),
    ...(row.detail != null
      ? { detail: JSON.parse(row.detail) as NodeDetail }
      : {}),
    createdAtLsn: row.created_at_lsn,
    updatedAtLsn: row.updated_at_lsn,
  }
}

function rowToEdge(row: typeof schema.edges.$inferSelect): GraphEdge {
  const base = {
    id: row.id,
    category: row.category as GraphEdge["category"],
    sourceId: row.source_id,
    targetId: row.target_id,
    basis: row.basis as GraphEdge["basis"],
    createdAtLsn: row.created_at_lsn,
    updatedAtLsn: row.updated_at_lsn,
  }
  return row.stance != null
    ? row.rationale != null
      ? {
          ...base,
          stance: row.stance as NonNullable<GraphEdge["stance"]>,
          rationale: row.rationale,
        }
      : { ...base, stance: row.stance as NonNullable<GraphEdge["stance"]> }
    : row.rationale != null
      ? { ...base, rationale: row.rationale }
      : base
}

// ---------------------------------------------------------------------------
// Supersession helpers
// ---------------------------------------------------------------------------

/** Return the set of node ids that are superseded predecessors. */
function getSupersededIds(db: BrunchDb): Set<number> {
  const rows = db
    .select({ targetId: schema.edges.target_id })
    .from(schema.edges)
    .where(eq(schema.edges.category, "supersession"))
    .all()
  return new Set(rows.map((r) => r.targetId))
}

// ---------------------------------------------------------------------------
// getGraphOverview
// ---------------------------------------------------------------------------

/**
 * Cursory full-graph overview.
 *
 * Returns all accepted nodes and edges with current LSN.
 * Superseded predecessors are excluded from the node list
 * per CATEGORY_POLICY.supersession.projectionEffect.
 */
export function getGraphOverview(db: BrunchDb): GraphOverview {
  const supersededIds = getSupersededIds(db)

  const allNodeRows = db.select().from(schema.nodes).all()
  const allEdgeRows = db.select().from(schema.edges).all()

  const nodes = allNodeRows
    .filter((r) => !supersededIds.has(r.id))
    .map(rowToNode)

  const edges = allEdgeRows.map(rowToEdge)

  const clockRow = db.select().from(schema.graphClock).get()
  const lsn = clockRow?.lsn ?? 0

  return {
    nodes,
    edges,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    lsn,
  }
}

// ---------------------------------------------------------------------------
// getNodeNeighborhood
// ---------------------------------------------------------------------------

/**
 * Neighborhood snapshot around a given node.
 *
 * Returns the anchor node, all reachable neighbors within `hops`
 * distance (default 1), and the edges connecting them.
 * Superseded predecessors are excluded from neighbors
 * (unless the predecessor is the anchor itself).
 */
export function getNodeNeighborhood(
  db: BrunchDb,
  nodeId: number,
  options?: NeighborhoodOptions,
): NeighborhoodResult {
  const hops = options?.hops ?? 1

  // Verify anchor exists
  const anchorRow = db
    .select()
    .from(schema.nodes)
    .where(eq(schema.nodes.id, nodeId))
    .get()

  if (!anchorRow) {
    return { status: "not_found" }
  }

  const supersededIds = getSupersededIds(db)
  const anchor = rowToNode(anchorRow)

  // BFS traversal: collect reachable node ids within hop distance
  const visited = new Set<number>([nodeId])
  let frontier = new Set<number>([nodeId])
  const collectedEdgeIds = new Set<number>()

  for (let hop = 0; hop < hops; hop++) {
    if (frontier.size === 0) break

    // Find all edges touching frontier nodes
    const frontierArr = [...frontier]
    const edgeRows = db
      .select()
      .from(schema.edges)
      .where(
        or(
          inArray(schema.edges.source_id, frontierArr),
          inArray(schema.edges.target_id, frontierArr),
        ),
      )
      .all()

    const nextFrontier = new Set<number>()
    for (const edge of edgeRows) {
      collectedEdgeIds.add(edge.id)
      for (const peerId of [edge.source_id, edge.target_id]) {
        if (!visited.has(peerId)) {
          // Exclude superseded predecessors (unless it's the anchor)
          if (supersededIds.has(peerId) && peerId !== nodeId) continue
          visited.add(peerId)
          nextFrontier.add(peerId)
        }
      }
    }
    frontier = nextFrontier
  }

  // Fetch neighbor nodes (exclude anchor)
  const neighborIds = [...visited].filter((id) => id !== nodeId)
  const neighborNodes: GraphNode[] = []
  if (neighborIds.length > 0) {
    const rows = db
      .select()
      .from(schema.nodes)
      .where(inArray(schema.nodes.id, neighborIds))
      .all()
    neighborNodes.push(...rows.map(rowToNode))
  }

  // Fetch collected edges
  const edgeIdArr = [...collectedEdgeIds]
  const edgeNodes: GraphEdge[] = []
  if (edgeIdArr.length > 0) {
    const rows = db
      .select()
      .from(schema.edges)
      .where(inArray(schema.edges.id, edgeIdArr))
      .all()
    edgeNodes.push(...rows.map(rowToEdge))
  }

  return {
    status: "success",
    anchor,
    neighbors: neighborNodes,
    edges: edgeNodes,
  }
}
