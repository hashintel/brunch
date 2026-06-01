/**
 * Public exports for the Brunch graph layer.
 *
 * Canonical reference: docs/design/GRAPH_MODEL.md
 *
 * Phase 1: edges, edge policy, reconciliation-need.
 * Phase 2: node type definitions.
 * M4 skeleton: CommandExecutor + result types.
 */

export type { EdgeId, Lsn, NodeId } from "./atoms.js"

// Re-export shared enum const arrays so extensions can build
// tool parameter schemas without importing db/ directly (I26-L).
export {
  EDGE_CATEGORIES,
  EDGE_STANCES,
  INTENT_KINDS,
  ORACLE_KINDS,
  DESIGN_KINDS,
  PLAN_KINDS,
  NODE_BASES,
} from "../db/schema.js"

export type {
  EdgeBasis,
  EdgeCategory,
  EdgeStance,
  GraphEdge,
} from "./schema/edges.js"

export type {
  DecisionDetail,
  DesignKind,
  GraphNode,
  IntentKind,
  IntentKindCategory,
  NodeBasis,
  NodeDetail,
  NodeKind,
  NodePlane,
  OracleKind,
  PlanKind,
  TermDetail,
} from "./schema/nodes.js"

export { intentKindCategory } from "./schema/nodes.js"

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

export {
  getGraphOverview,
  getNodeNeighborhood,
  getOpenReconciliationNeeds,
} from "./snapshot.js"
export type {
  GraphOverview,
  NeighborhoodOptions,
  NeighborhoodNotFound,
  NeighborhoodResult,
  NeighborhoodSuccess,
} from "./snapshot.js"

export { CommandExecutor } from "./command-executor.js"
export type {
  BatchEdgeInput,
  BatchEdgeRef,
  BatchNodeInput,
  CommandResult,
  CommandSuccess,
  CommitGraphInput,
  CommitGraphResult,
  CommitGraphSuccess,
  CreateNodeInput,
  CreateNodeResult,
  CreateReconNeedInput,
  CreateReconNeedResult,
  Diagnostic,
  NeedsHuman,
  PolicyBlocked,
  ReconNeedResolveSuccess,
  ReconNeedSuccess,
  ReconNeedTarget,
  ResolveReconNeedResult,
  StructuralIllegal,
  VersionConflict,
} from "./command-executor.js"
