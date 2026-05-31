/**
 * Graph atoms — id and clock primitives shared across the graph layer.
 *
 * Canonical reference: docs/design/GRAPH_MODEL.md §"Atoms"
 *
 * Phase 1 lock-and-materialize: type definitions only.
 * Persistence (Drizzle + better-sqlite3 tables, LSN allocation, change_log)
 * lands with the M4 A20-L spike slice.
 */

/** Stable id for a graph node. */
export type NodeId = string

/** Stable id for a graph edge. */
export type EdgeId = string

/** Monotonic logical sequence number; one per CommandExecutor commit. */
export type Lsn = number
