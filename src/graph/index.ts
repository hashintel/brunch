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

export type { GraphNode, NodeKind, ReadinessBand } from './schema/nodes.js';

export { formatGraphNodeCode, intentKindCategory, parseGraphNodeCode } from './schema/nodes.js';

export { EDGE_CATEGORY_METADATA, edgeEndpointRole } from './policy/category-policy.js';
export type {
  EdgeCategoryMetadata,
  EdgeEndpoint,
  EdgeEndpointRole,
  EdgeImpactStrength,
  ProjectionEffect,
} from './policy/category-policy.js';

export { edgeLabel } from './projection/labels.js';
export type { AnchorRole, EdgeLabelInput } from './projection/labels.js';
export { edgeImpact, relationFromAnchor } from './projection/direction.js';
export type { AnchoredRelation, EdgeImpact, EdgeRelation } from './projection/direction.js';

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
  EdgePatch,
  GraphMutationOp,
  MutateGraphInput,
  MutateGraphSuccess,
  NodePatch,
  ReadinessGrade,
  RoleNamedEdgeDraft,
  SpecRecord,
  StructuralIllegal,
} from './command-executor.js';

export { normalizeRoleNamedEdgeDraft } from './command-executor/role-named-edge-draft.js';

export { translateReviewSetPayloadToCommitGraph } from './review-set.js';
