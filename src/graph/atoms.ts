/**
 * Graph atoms — id and clock primitives shared across the graph layer.
 *
 * Canonical reference: memory/SPEC.md D8-L (spec-local LSN clock), D62-L (integer node ids vs projected codes)
 *
 * Phase 1 lock-and-materialize: type definitions only.
 * Persistence (Drizzle + better-sqlite3 tables, LSN allocation, change_log)
 * lands with the M4 A20-L spike slice.
 */

/** Stable id for a graph node (SQLite auto-increment integer). */
export type NodeId = number;

/** Stable id for a graph edge (SQLite auto-increment integer). */
export type EdgeId = number;

/** Monotonic logical sequence number; one per CommandExecutor commit. */
export type Lsn = number;
