/**
 * Public exports for the Brunch graph layer.
 *
 * Canonical reference: docs/design/GRAPH_MODEL.md
 *
 * Phase 1: edges, edge policy, reconciliation-need.
 * Phase 2: node type definitions.
 * M4 skeleton: CommandExecutor + result types.
 */

export type { EdgeId, Lsn, NodeId } from './atoms.js';

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

export type { EdgeBasis, EdgeCategory, EdgeStance, GraphEdge } from './schema/edges.js';

export type {
  DecisionDetail,
  DesignKind,
  GraphNode,
  IntentKind,
  IntentKindCategory,
  NodeBasis,
  NodeKindMetadata,
  NodeDetail,
  NodeKind,
  NodePlane,
  OracleKind,
  PlanKind,
  TermDetail,
  ReadinessBand,
} from './schema/nodes.js';

export { formatGraphNodeCode, intentKindCategory, parseGraphNodeCode } from './schema/nodes.js';

export type {
  ReconciliationNeed,
  ReconciliationNeedKind,
  ReconciliationNeedTarget,
} from './schema/reconciliation-need.js';

export {
  CATEGORY_POLICY,
  type CategoryPolicy,
  type ProjectionEffect,
  type ReconNeedTrigger,
} from './policy/category-policy.js';

export { getGraphOverview, getNodeNeighborhood, getOpenReconciliationNeeds } from './snapshot.js';
export type {
  GraphOverview,
  GraphOverviewOptions,
  GraphProjection,
  NeighborhoodOptions,
  NeighborhoodNotFound,
  NeighborhoodResult,
  NeighborhoodSuccess,
} from './snapshot.js';

export { CommandExecutor } from './command-executor.js';
export { openWorkspaceCommandExecutor, openWorkspaceGraphRuntime } from './workspace-store.js';
export type { WorkspaceGraphRuntime } from './workspace-store.js';
export type {
  AcceptReviewSetInput,
  AcceptReviewSetResult,
  AcceptReviewSetSuccess,
  BatchEdgeInput,
  BatchEdgeRef,
  BatchNodeInput,
  CommandResult,
  CommandSuccess,
  CommitGraphInput,
  CommitGraphDryRunResult,
  CommitGraphResult,
  CommitGraphSuccess,
  CreateNodeInput,
  CreateNodeResult,
  CreateReconNeedInput,
  CreateSpecInput,
  CreateSpecResult,
  CreateSpecSuccess,
  DryRunSuccess,
  CreateReconNeedResult,
  Diagnostic,
  NeedsHuman,
  PolicyBlocked,
  ReadinessGrade,
  ReconNeedResolveSuccess,
  ReconNeedSuccess,
  ReconNeedTarget,
  ResolveReconNeedInput,
  ResolveReconNeedResult,
  SpecRecord,
  StructuralIllegal,
  UpdateReadinessGradeInput,
  UpdateReadinessGradeResult,
  UpdateReadinessGradeSuccess,
  VersionConflict,
} from './command-executor.js';

export { translateReviewSetPayloadToCommitGraph } from './review-set.js';
export type {
  ReviewSetEdgeDraft,
  ReviewSetEndpointRef,
  ReviewSetEpistemicStatus,
  ReviewSetEntityDraft,
  ReviewSetLens,
  ReviewSetProposalGrounding,
  ReviewSetProposalPayload,
  ReviewSetProposalPitch,
  ReviewSetTranslationResult,
  ReviewSetTranslationSuccess,
} from './review-set.js';
