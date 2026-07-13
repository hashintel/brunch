/**
 * Public exports for the Brunch graph layer.
 *
 * Canonical reference: src/graph/TOPOLOGY.md
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
  NODE_KINDS,
  NODE_PLANES,
  NODE_BASES,
  READINESS_BANDS,
  SPEC_KINDS,
} from './schema/kinds.js';

export type { ReadinessBand, SpecKind } from './schema/kinds.js';

export type { EdgeCategory, GraphEdge } from './schema/edges.js';
export type { ReconciliationNeed, ReconciliationNeedTarget } from './schema/reconciliation-need.js';

export type {
  ClaimFormDetail,
  ClaimFormDiscriminant,
  GraphNode,
  NodeDetail,
  NodeKind,
  NodeKindRequiringDetail,
  NodeKindWithFormDetail,
} from './schema/nodes.js';

export {
  latestExpectedBand,
  CLAIM_FORM_JSON_SCHEMAS,
  claimFormKnownFields,
  formatGraphNodeCode,
  NODE_DETAIL_FORMS,
  NODE_DETAIL_JSON_SCHEMAS,
  NODE_KINDS_REQUIRING_DETAIL,
  NODE_KINDS_WITH_FORM_DETAIL,
  nodeDetailForms,
  nodeDetailKnownFields,
  parseGraphNodeCode,
} from './schema/nodes.js';

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

export { queryGraph, getNodes, getOpenReconciliationNeeds } from './queries.js';
export type {
  EdgeDirection,
  GraphSlice,
  GraphVisibility,
  GraphFilter,
  NodeNeighborhood,
  NodeSelector,
} from './queries.js';

export { CommandExecutor } from './command-executor.js';
export {
  detectLegacyZeroXDatabase,
  LEGACY_ALPHA_DB_FILENAME,
  LEGACY_ZERO_X_DB_FILENAME,
  openWorkspaceCommandExecutor,
  openWorkspaceDb,
  openWorkspaceGraphRuntime,
  WORKSPACE_DB_FILENAME,
  WorkspaceDbRefusalError,
} from './workspace-store.js';
export type { WorkspaceGraphRuntime } from './workspace-store.js';
export type {
  CreateReconNeedResult,
  Diagnostic,
  EdgePatch,
  GraphMutationNodeRef,
  GraphMutationOp,
  MutateGraphInput,
  MutateGraphSuccess,
  NodePatch,
  ResolveReconNeedResult,
  RoleNamedEdgeDraft,
  RoleNamedEdgeDraftOf,
  SpecRecord,
  StructuralIllegal,
} from './command-executor.js';

export {
  authoredEdgeEndpointFields,
  normalizeRoleNamedEdgeDraft,
} from './command-executor/role-named-edge-draft.js';

export { translateReviewSetPayloadToMutateGraph } from './review-set.js';
