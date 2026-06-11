/**
 * Deprecated graph-neighborhood projection seam.
 *
 * Node-local graph facts intentionally stay as `NodeNeighborhood` from
 * graph/queries.ts. Renderers, RPC, web query helpers, and Pi context adapters
 * consume that typed PULL shape directly; model-facing flattening lives beside
 * the graph renderer. Keep this empty module as a topology marker so future
 * work does not reintroduce a pass-through PROJECT layer for symmetry.
 */

export {};
