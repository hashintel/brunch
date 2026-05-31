/**
 * Public exports for the Brunch graph layer.
 *
 * Canonical reference: docs/design/GRAPH_MODEL.md
 *
 * Phase 1 lock-and-materialize: edges, edge policy, and the
 * reconciliation-need shape. Nodes are deferred to Phase 2.
 */

export type { EdgeId, Lsn, NodeId } from "./atoms.js"

export type {
  EdgeBasis,
  EdgeCategory,
  EdgeProvenance,
  EdgeStance,
  GraphEdge,
} from "./schema/edges.js"

export type {
  ReconciliationNeed,
  ReconciliationNeedKind,
  ReconciliationNeedTarget,
} from "./schema/reconciliation-need.js"

export {
  CATEGORY_POLICY,
  type CategoryPolicy,
  type ProjectionEffect,
  type ReconNeedTrigger,
} from "./policy/category-policy.js"
