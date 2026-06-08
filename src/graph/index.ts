/**
 * Public exports for the Brunch graph layer.
 *
 * Canonical reference: docs/design/GRAPH_MODEL.md
 *
 * Phase 1: edges, edge policy, reconciliation-need.
 * Phase 2: node type definitions.
 * M4 skeleton: CommandExecutor + result types.
 */

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
  READINESS_GRADES,
} from '../db/schema.js';

export type { EdgeCategory, GraphEdge } from './schema/edges.js';

export type {
  GraphNode,
  NodeKind,
  ReadinessBand,
} from './schema/nodes.js';

export { formatGraphNodeCode, intentKindCategory, parseGraphNodeCode } from './schema/nodes.js';

export {
  CATEGORY_POLICY,
} from './policy/category-policy.js';

export {
  queryGraph,
  getNodes,
  getOpenElicitationBacklogEntries,
  getOpenReconciliationNeeds,
} from './queries.js';
export type {
  EdgeDirection,
  GraphSlice,
  GraphVisibility,
  GraphFilter,
  NodeNeighborhood,
  NodeSelector,
} from './queries.js';

export { CommandExecutor } from './command-executor.js';
export { openWorkspaceCommandExecutor, openWorkspaceGraphRuntime } from './workspace-store.js';
export type { WorkspaceGraphRuntime } from './workspace-store.js';
export type {
  BatchEdgeInput,
  BatchEdgeRef,
  BatchNodeInput,
  CommitGraphInput,
  CommitGraphSuccess,
  Diagnostic,
  ReadinessGrade,
  SpecRecord,
  StructuralIllegal,
} from './command-executor.js';

export { translateReviewSetPayloadToCommitGraph } from './review-set.js';

