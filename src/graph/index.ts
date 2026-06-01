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
  Diagnostic,
  NeedsHuman,
  PolicyBlocked,
  StructuralIllegal,
  VersionConflict,
} from "./command-executor.js"
