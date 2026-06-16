/**
 * CommandExecutor command contract types — the input and result shapes for the
 * public command surface in `../command-executor.ts`.
 *
 * Re-exported by `command-executor.ts`; external consumers import these from the
 * root entrypoint, not from this module. Low-level mutateGraph batch types live
 * in `./graph-mutation-types.ts`.
 */

import type { ElicitationGapLensAffinity, GapDisposition, GapPredicate } from '../schema/elicitation-gaps.js';
import type { NodeBasis, NodeKind, NodePlane, ReadinessBand } from '../schema/nodes.js';
import type { MutateGraphSuccess, StructuralIllegal } from './graph-mutation-types.js';

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

/** Successful command execution. */
interface CommandSuccess {
  readonly status: 'success';
  readonly nodeId: number;
  readonly lsn: number;
}

/** Action requires human confirmation (M6 placeholder). */
interface NeedsHuman {
  readonly status: 'needs_human';
}

/** Action blocked by authority policy (M6 placeholder). */
interface PolicyBlocked {
  readonly status: 'policy_blocked';
}

/** Optimistic concurrency conflict (M6 placeholder). */
interface VersionConflict {
  readonly status: 'version_conflict';
}

/** Successful reconciliation-need creation. */
interface ReconNeedSuccess {
  readonly status: 'success';
  readonly id: number;
  readonly lsn: number;
}

/** Successful reconciliation-need resolution. */
interface ReconNeedResolveSuccess {
  readonly status: 'success';
  readonly lsn: number;
}

/** Successful spec creation. */
interface CreateSpecSuccess {
  readonly status: 'success';
  readonly specId: number;
  readonly lsn: number;
}

/** Successful elicitation-gap creation. */
interface ElicitationGapSuccess {
  readonly status: 'success';
  readonly id: number;
  readonly lsn: number;
}

/** Successful elicitation-gap disposition update. */
interface ElicitationGapDispositionSuccess {
  readonly status: 'success';
  readonly lsn: number;
}

export interface RepairSeededElicitationGapsSpecResult {
  readonly specId: number;
  readonly insertedCount: number;
  readonly lsn: number;
}

interface RepairSeededElicitationGapsSuccess {
  readonly status: 'success';
  readonly repairedSpecs: readonly RepairSeededElicitationGapsSpecResult[];
}

/** Spec row returned by CommandExecutor reads. */
export interface SpecRecord {
  readonly id: number;
  readonly name: string;
  readonly slug: string;
}

/** Union of all possible command results. */
export type CommandResult =
  | CommandSuccess
  | MutateGraphSuccess
  | AcceptReviewSetSuccess
  | ReconNeedSuccess
  | ReconNeedResolveSuccess
  | CreateSpecSuccess
  | ElicitationGapSuccess
  | ElicitationGapDispositionSuccess
  | RepairSeededElicitationGapsSuccess
  | StructuralIllegal
  | NeedsHuman
  | PolicyBlocked
  | VersionConflict;

/** Result of a createNode command. */
export type CreateNodeResult = CommandSuccess | StructuralIllegal;

/** Result of a createReconciliationNeed command. */
export type CreateReconNeedResult = ReconNeedSuccess | StructuralIllegal;

/** Result of a resolveReconciliationNeed command. */
export type ResolveReconNeedResult = ReconNeedResolveSuccess | StructuralIllegal;

/** Result of a createSpec command. */
export type CreateSpecResult = CreateSpecSuccess | StructuralIllegal;

/** Result of a createElicitationGap command. */
export type CreateElicitationGapResult = ElicitationGapSuccess | StructuralIllegal;

/** Result of a setElicitationGapDisposition command. */
export type SetElicitationGapDispositionResult = ElicitationGapDispositionSuccess | StructuralIllegal;

/** Result of repairing legacy specs missing the current seeded gap floor. */
export type RepairSeededElicitationGapsResult = RepairSeededElicitationGapsSuccess;

/** Successful accepted review-set graph batch execution. */
interface AcceptReviewSetSuccess extends MutateGraphSuccess {}

/** Result of an acceptReviewSet command. */
export type AcceptReviewSetResult = AcceptReviewSetSuccess | StructuralIllegal;

/** Result of validating a review-set payload before user presentation. */
export type AcceptReviewSetDryRunResult = { readonly status: 'success' } | StructuralIllegal;

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

/** Input for creating a spec row. */
export interface CreateSpecInput {
  readonly name: string;
  readonly slug: string;
}

/** Input for accepting an exact user-reviewed graph batch. */
export interface AcceptReviewSetInput {
  readonly specId: number;
  readonly proposalEntryId?: string | undefined;
  readonly payload: unknown;
}

/** Input for creating an elicitation gap. */
export interface CreateElicitationGapInput {
  readonly specId: number;
  readonly refersTo: NodeKind;
  readonly question: string;
  readonly rationale: string;
  readonly basis?: NodeBasis | undefined;
  readonly band: ReadinessBand;
  readonly predicate: GapPredicate;
  readonly importance?: number | undefined;
  readonly planeAffinity?: NodePlane | undefined;
  readonly lensAffinity?: ElicitationGapLensAffinity | undefined;
  readonly aroseFromGapId?: number | undefined;
}

/** Input for updating an elicitation gap's non-derivable disposition. */
export interface SetElicitationGapDispositionInput {
  readonly specId: number;
  readonly id: number;
  readonly disposition: Extract<
    GapDisposition,
    'open' | 'answered' | 'not_applicable' | 'irrelevant' | 'reopened'
  >;
  readonly resolvedByNodeId?: number | undefined;
}

/** Input for creating a single graph node. */
export interface CreateNodeInput {
  readonly specId: number;
  readonly plane: NodePlane;
  readonly kind: string;
  readonly title: string;
  readonly body?: string | undefined;
  readonly basis?: NodeBasis | undefined;
  readonly source?: string | undefined;
  readonly detail?: unknown;
}

// ---------------------------------------------------------------------------
// Reconciliation-need input types
// ---------------------------------------------------------------------------

/** Target for a reconciliation need — edge or node pair. */
type ReconNeedTargetEdge = {
  readonly kind: 'edge';
  readonly edgeId: number;
};

/** Target for a reconciliation need — node pair. */
type ReconNeedTargetNodePair = {
  readonly kind: 'node_pair';
  readonly aId: number;
  readonly bId: number;
};

/** Target for a reconciliation need. */
type ReconNeedTarget = ReconNeedTargetEdge | ReconNeedTargetNodePair;

/** Input for creating a reconciliation need. */
export interface CreateReconNeedInput {
  readonly specId: number;
  readonly target: ReconNeedTarget;
  readonly needKind: string;
  readonly reason?: string | undefined;
}

/** Input for resolving a reconciliation need. */
export interface ResolveReconNeedInput {
  readonly specId: number;
  readonly id: number;
}
