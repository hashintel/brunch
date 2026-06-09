/**
 * CommandExecutor — the single public mutation boundary for graph truth.
 *
 * SPEC: D4-L (one shared mutation surface), D20-L (command execution owns
 * authority seam), D16-L (one-transaction-per-commit, no bypass), D52-L
 * (graph/ imports db/, no other layer imports db/).
 *
 * Every graph mutation routes through this class. The executor owns:
 *  - structural validation
 *  - one SQLite transaction per command
 *  - monotonic spec-local LSN allocation from graph_clock
 *  - change_log append
 *  - structured result return
 *
 * The result contract already includes all discriminants (success,
 * structural_illegal, needs_human, policy_blocked, version_conflict)
 * even though pre-M6 policy classification is minimal.
 */

import { and, eq, inArray, sql } from 'drizzle-orm';

import type { BrunchDb } from '../db/connection.js';
import * as schema from '../db/schema.js';
import {
  formatCreatedGraphNode,
  planCommitGraphBatch,
  type PlannedBatchEndpoint,
  type PlannedBatchEdge,
} from './command-executor/commit-graph-batch.js';
import type {
  EdgePatch,
  GraphMutationOp,
  CommitGraphDryRunResult,
  CommitGraphInput,
  CommitGraphResult,
  CommitGraphSuccess,
  Diagnostic,
  MutateGraphDryRunResult,
  MutateGraphInput,
  MutateGraphResult,
  MutateGraphSuccess,
  NodePatch,
  StructuralIllegal,
} from './command-executor/commit-graph-types.js';
import { normalizeRoleNamedEdgeDraft } from './command-executor/role-named-edge-draft.js';
import { translateReviewSetPayloadToMutateGraph } from './review-set.js';
import type { ElicitationBacklogLensAffinity } from './schema/elicitation-backlog.js';
import { type NodeBasis, type NodePlane, type ReadinessBand } from './schema/nodes.js';

export type ReadinessGrade = (typeof schema.READINESS_GRADES)[number];
export type {
  BatchEdgeInput,
  BatchEdgeRef,
  BatchNodeInput,
  CommitGraphDryRunResult,
  CommitGraphInput,
  CommitGraphResult,
  CommitGraphSuccess,
  Diagnostic,
  EdgePatch,
  GraphMutationOp,
  MutateGraphDryRunResult,
  MutateGraphInput,
  MutateGraphResult,
  MutateGraphSuccess,
  NodePatch,
  StructuralIllegal,
} from './command-executor/commit-graph-types.js';
export { normalizeRoleNamedEdgeDraft } from './command-executor/role-named-edge-draft.js';
export type { RoleNamedEdgeDraft } from './command-executor/role-named-edge-draft.js';

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

/** Successful elicitation-backlog creation. */
interface ElicitationBacklogSuccess {
  readonly status: 'success';
  readonly id: number;
  readonly lsn: number;
}

/** Successful elicitation-backlog close. */
interface ElicitationBacklogCloseSuccess {
  readonly status: 'success';
  readonly lsn: number;
}

/** Successful spec readiness-grade update. */
interface UpdateReadinessGradeSuccess {
  readonly status: 'success';
  readonly lsn: number;
}

/** Spec row returned by CommandExecutor reads. */
export interface SpecRecord {
  readonly id: number;
  readonly name: string;
  readonly slug: string;
  readonly readinessGrade: ReadinessGrade;
}

/** Union of all possible command results. */
export type CommandResult =
  | CommandSuccess
  | CommitGraphSuccess
  | AcceptReviewSetSuccess
  | ReconNeedSuccess
  | ReconNeedResolveSuccess
  | CreateSpecSuccess
  | ElicitationBacklogSuccess
  | ElicitationBacklogCloseSuccess
  | UpdateReadinessGradeSuccess
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

/** Result of a createElicitationBacklogEntry command. */
export type CreateElicitationBacklogEntryResult = ElicitationBacklogSuccess | StructuralIllegal;

/** Result of a closeElicitationBacklogEntry command. */
export type CloseElicitationBacklogEntryResult = ElicitationBacklogCloseSuccess | StructuralIllegal;

/** Result of an updateReadinessGrade command. */
export type UpdateReadinessGradeResult = UpdateReadinessGradeSuccess | StructuralIllegal;

/** Successful accepted review-set graph batch execution. */
interface AcceptReviewSetSuccess extends CommitGraphSuccess {}

/** Result of an acceptReviewSet command. */
export type AcceptReviewSetResult = AcceptReviewSetSuccess | StructuralIllegal;

/** Result of validating a review-set payload before user presentation. */
export type AcceptReviewSetDryRunResult = { readonly status: 'success' } | StructuralIllegal;

type ExistingNodeRow = typeof schema.nodes.$inferSelect;

interface PlannedNodePatch {
  readonly nodeId: number;
  readonly patch: NodePatch;
}

interface PlannedEdgePatch {
  readonly edgeId: number;
  readonly patch: EdgePatch;
}

interface PlannedNodeDelete {
  readonly nodeId: number;
  readonly incidentEdgeIds: readonly number[];
}

interface PlannedMutateGraph {
  readonly createInput: CommitGraphInput;
  readonly createEdges: readonly PlannedBatchEdge[];
  readonly patchNodes: readonly PlannedNodePatch[];
  readonly patchEdges: readonly PlannedEdgePatch[];
  readonly deleteEdges: readonly number[];
  readonly deleteNodes: readonly PlannedNodeDelete[];
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

/** Input for creating a spec row. */
export interface CreateSpecInput {
  readonly name: string;
  readonly slug: string;
  readonly readinessGrade?: ReadinessGrade | undefined;
}

/** Input for updating a spec readiness grade. */
export interface UpdateReadinessGradeInput {
  readonly specId: number;
  readonly readinessGrade: ReadinessGrade;
}

/** Input for accepting an exact user-reviewed graph batch. */
export interface AcceptReviewSetInput {
  readonly specId: number;
  readonly proposalEntryId?: string | undefined;
  readonly payload: unknown;
}

/** Input for creating an elicitation-backlog entry. */
export interface CreateElicitationBacklogEntryInput {
  readonly specId: number;
  readonly kind: string;
  readonly question: string;
  readonly basis?: NodeBasis | undefined;
  readonly readinessBand: ReadinessBand;
  readonly planeAffinity?: NodePlane | undefined;
  readonly lensAffinity?: ElicitationBacklogLensAffinity | undefined;
  readonly aroseFromEntryId?: number | undefined;
  readonly rationale?: string | undefined;
}

/** Input for closing an elicitation-backlog entry. */
export interface CloseElicitationBacklogEntryInput {
  readonly specId: number;
  readonly id: number;
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

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const VALID_KINDS_BY_PLANE: Record<string, readonly string[]> = {
  intent: schema.INTENT_KINDS as unknown as string[],
  oracle: schema.ORACLE_KINDS as unknown as string[],
  design: schema.DESIGN_KINDS as unknown as string[],
  plan: schema.PLAN_KINDS as unknown as string[],
};

const KINDS_REQUIRING_DETAIL = new Set<string>(['decision', 'term']);
const VALID_READINESS_GRADES = schema.READINESS_GRADES as unknown as string[];
const VALID_NODE_BASES = schema.NODE_BASES as unknown as string[];
const VALID_READINESS_BANDS = schema.READINESS_BANDS as unknown as string[];
const VALID_LENS_AFFINITIES = schema.LENS_AFFINITIES as unknown as string[];

const SEEDED_ELICITATION_BACKLOG: readonly {
  readonly kind: string;
  readonly question: string;
  readonly basis: NodeBasis;
  readonly readinessBand: ReadinessBand;
  readonly planeAffinity: NodePlane;
  readonly lensAffinity: ElicitationBacklogLensAffinity;
}[] = [
  {
    kind: 'domain_anchor_question',
    question: 'What is the thing or domain we are specifying?',
    basis: 'explicit',
    readinessBand: 'grounding',
    planeAffinity: 'intent',
    lensAffinity: 'intent',
  },
  {
    kind: 'protagonist_anchor_question',
    question: 'Who is this for, or who is most affected by it?',
    basis: 'explicit',
    readinessBand: 'grounding',
    planeAffinity: 'intent',
    lensAffinity: 'intent',
  },
  {
    kind: 'pain_anchor_question',
    question: 'What problem, pain, or pull is driving this work?',
    basis: 'explicit',
    readinessBand: 'grounding',
    planeAffinity: 'intent',
    lensAffinity: 'intent',
  },
  {
    kind: 'constraint_anchor_question',
    question: 'What constraints or non-negotiable boundaries already shape it?',
    basis: 'explicit',
    readinessBand: 'grounding',
    planeAffinity: 'intent',
    lensAffinity: 'intent',
  },
] as const;

function isReadinessGrade(value: string): value is ReadinessGrade {
  return VALID_READINESS_GRADES.includes(value);
}

function isNodeBasis(value: string): value is NodeBasis {
  return VALID_NODE_BASES.includes(value);
}

function isNodePlane(value: string): value is NodePlane {
  return value === 'intent' || value === 'oracle' || value === 'design' || value === 'plan';
}

function isReadinessBand(value: string): value is ReadinessBand {
  return VALID_READINESS_BANDS.includes(value);
}

function isElicitationBacklogLensAffinity(value: string): value is ElicitationBacklogLensAffinity {
  return VALID_LENS_AFFINITIES.includes(value);
}

function validateCreateNode(input: CreateNodeInput): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  // Title must be non-empty
  if (!input.title.trim()) {
    diagnostics.push({ field: 'title', message: 'title must be non-empty' });
  }

  if (input.basis !== undefined && !isNodeBasis(input.basis)) {
    diagnostics.push({
      field: 'basis',
      message: 'basis must be explicit or implicit',
    });
  }

  // Kind must be valid for the given plane
  const validKinds = VALID_KINDS_BY_PLANE[input.plane];
  if (!validKinds?.includes(input.kind)) {
    diagnostics.push({
      field: 'kind',
      message: `"${input.kind}" is not a valid kind for plane "${input.plane}"`,
    });
    return diagnostics; // can't validate detail if kind is wrong
  }

  // Detail requirement: decision and term REQUIRE detail
  if (KINDS_REQUIRING_DETAIL.has(input.kind) && input.detail == null) {
    diagnostics.push({
      field: 'detail',
      message: `"${input.kind}" nodes require a detail object`,
    });
    return diagnostics;
  }

  // Detail prohibition: all other kinds must NOT have detail
  if (!KINDS_REQUIRING_DETAIL.has(input.kind) && input.detail != null) {
    diagnostics.push({
      field: 'detail',
      message: `"${input.kind}" nodes must not have a detail object`,
    });
    return diagnostics;
  }

  // Validate detail shape per kind
  if (input.kind === 'decision' && input.detail != null) {
    validateDecisionDetail(input.detail, diagnostics);
  }
  if (input.kind === 'term' && input.detail != null) {
    validateTermDetail(input.detail, diagnostics);
  }

  return diagnostics;
}

function hasOwn(object: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function parseNodeDetail(row: ExistingNodeRow): unknown {
  return row.detail == null ? undefined : JSON.parse(row.detail);
}

function validateNodePatchAgainstExisting(row: ExistingNodeRow, patch: NodePatch): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const patchRecord = patch as Record<string, unknown>;
  const patchFields = Object.keys(patchRecord);
  const allowedFields = new Set(['title', 'body', 'source', 'detail']);

  if (patchFields.length === 0) {
    diagnostics.push({ field: 'patch', message: 'patch_node requires at least one patch field' });
    return diagnostics;
  }

  for (const field of patchFields) {
    if (!allowedFields.has(field)) {
      diagnostics.push({ field: `patch.${field}`, message: 'field is not patchable' });
    }
  }

  if (hasOwn(patchRecord, 'title') && typeof patch.title !== 'string') {
    diagnostics.push({ field: 'patch.title', message: 'title must be a string when present' });
  }
  if (hasOwn(patchRecord, 'body') && patch.body !== null && typeof patch.body !== 'string') {
    diagnostics.push({ field: 'patch.body', message: 'body must be a string or null when present' });
  }
  if (hasOwn(patchRecord, 'source') && patch.source !== null && typeof patch.source !== 'string') {
    diagnostics.push({ field: 'patch.source', message: 'source must be a string or null when present' });
  }

  const merged: CreateNodeInput = {
    specId: row.spec_id,
    plane: row.plane,
    kind: row.kind,
    title: hasOwn(patchRecord, 'title') ? (patch.title as string) : row.title,
    body: hasOwn(patchRecord, 'body') ? (patch.body ?? undefined) : (row.body ?? undefined),
    basis: row.basis,
    source: hasOwn(patchRecord, 'source') ? (patch.source ?? undefined) : (row.source ?? undefined),
    detail: hasOwn(patchRecord, 'detail') ? patch.detail : parseNodeDetail(row),
  };

  diagnostics.push(
    ...validateCreateNode(merged).map((diagnostic) => ({
      field: `patch.${diagnostic.field}`,
      message: diagnostic.message,
    })),
  );

  return diagnostics;
}

function validateEdgePatch(patch: EdgePatch): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const patchRecord = patch as Record<string, unknown>;
  const patchFields = Object.keys(patchRecord);

  if (patchFields.length === 0) {
    diagnostics.push({ field: 'patch', message: 'patch_edge requires at least one patch field' });
    return diagnostics;
  }

  for (const field of patchFields) {
    if (field !== 'rationale') {
      diagnostics.push({ field: `patch.${field}`, message: 'field is not patchable' });
    }
  }

  if (hasOwn(patchRecord, 'rationale') && patch.rationale !== null && typeof patch.rationale !== 'string') {
    diagnostics.push({
      field: 'patch.rationale',
      message: 'rationale must be a string or null when present',
    });
  }

  return diagnostics;
}

function validateCreateElicitationBacklogEntry(input: CreateElicitationBacklogEntryInput): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  if (!input.kind.trim()) {
    diagnostics.push({ field: 'kind', message: 'kind must be non-empty' });
  }

  if (!input.question.trim()) {
    diagnostics.push({ field: 'question', message: 'question must be non-empty' });
  }

  if (input.basis !== undefined && !isNodeBasis(input.basis)) {
    diagnostics.push({ field: 'basis', message: 'basis must be explicit or implicit' });
  }

  if (!isReadinessBand(input.readinessBand)) {
    diagnostics.push({
      field: 'readinessBand',
      message: `"${String(input.readinessBand)}" is not a valid readiness band`,
    });
  }

  if (input.planeAffinity !== undefined && !isNodePlane(input.planeAffinity)) {
    diagnostics.push({
      field: 'planeAffinity',
      message: `"${String(input.planeAffinity)}" is not a valid plane affinity`,
    });
  }

  if (input.lensAffinity !== undefined && !isElicitationBacklogLensAffinity(input.lensAffinity)) {
    diagnostics.push({
      field: 'lensAffinity',
      message: `"${String(input.lensAffinity)}" is not a valid lens affinity`,
    });
  }

  return diagnostics;
}

function validateDecisionDetail(detail: unknown, diagnostics: Diagnostic[]): void {
  if (typeof detail !== 'object' || detail === null) {
    diagnostics.push({ field: 'detail', message: 'must be an object' });
    return;
  }

  const d = detail as Record<string, unknown>;
  const knownFields = new Set(['chosen_option', 'rejected', 'rationale']);

  if (typeof d['chosen_option'] !== 'string') {
    diagnostics.push({
      field: 'detail.chosen_option',
      message: 'required string',
    });
  }

  if (
    !Array.isArray(d['rejected']) ||
    d['rejected'].length < 1 ||
    !d['rejected'].every((r) => typeof r === 'string')
  ) {
    diagnostics.push({
      field: 'detail.rejected',
      message: 'required non-empty string array',
    });
  }

  if (typeof d['rationale'] !== 'string') {
    diagnostics.push({ field: 'detail.rationale', message: 'required string' });
  }

  // Closed validation: reject unknown fields
  for (const key of Object.keys(d)) {
    if (!knownFields.has(key)) {
      diagnostics.push({ field: `detail.${key}`, message: 'unknown field' });
    }
  }
}

function validateTermDetail(detail: unknown, diagnostics: Diagnostic[]): void {
  if (typeof detail !== 'object' || detail === null) {
    diagnostics.push({ field: 'detail', message: 'must be an object' });
    return;
  }

  const d = detail as Record<string, unknown>;
  const knownFields = new Set(['definition', 'aliases']);

  if (typeof d['definition'] !== 'string') {
    diagnostics.push({
      field: 'detail.definition',
      message: 'required string',
    });
  }

  if (
    d['aliases'] != null &&
    (!Array.isArray(d['aliases']) || !d['aliases'].every((a) => typeof a === 'string'))
  ) {
    diagnostics.push({
      field: 'detail.aliases',
      message: 'must be a string array if present',
    });
  }

  // Closed validation: reject unknown fields
  for (const key of Object.keys(d)) {
    if (!knownFields.has(key)) {
      diagnostics.push({ field: `detail.${key}`, message: 'unknown field' });
    }
  }
}

function specRecordFromRow(row: typeof schema.specs.$inferSelect): SpecRecord {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    readinessGrade: row.readiness_grade,
  };
}

// ---------------------------------------------------------------------------
// CommandExecutor
// ---------------------------------------------------------------------------

class GraphClockInvariantError extends Error {
  constructor(specId: number) {
    super(`graph_clock invariant failed: spec ${specId} has no clock row`);
    this.name = 'GraphClockInvariantError';
  }
}

export class CommandExecutor {
  constructor(private readonly db: BrunchDb) {}

  private createInitialSpecClock(tx: Pick<BrunchDb, 'insert'>, specId: number): number {
    tx.insert(schema.graphClock).values({ spec_id: specId, lsn: 1 }).run();
    return 1;
  }

  private bumpExistingSpecLsn(tx: Pick<BrunchDb, 'update'>, specId: number): number {
    const clock = tx
      .update(schema.graphClock)
      .set({ lsn: sql`${schema.graphClock.lsn} + 1` })
      .where(eq(schema.graphClock.spec_id, specId))
      .returning({ lsn: schema.graphClock.lsn })
      .get();

    if (!clock) throw new GraphClockInvariantError(specId);
    return clock.lsn;
  }

  private allocateNodeKindOrdinal(
    tx: Pick<BrunchDb, 'select' | 'insert' | 'update'>,
    specId: number,
    plane: NodePlane,
    kind: string,
  ): number {
    const existing = tx
      .select({
        id: schema.nodeKindCounters.id,
        nextOrdinal: schema.nodeKindCounters.next_ordinal,
      })
      .from(schema.nodeKindCounters)
      .where(
        and(
          eq(schema.nodeKindCounters.spec_id, specId),
          eq(schema.nodeKindCounters.plane, plane),
          eq(schema.nodeKindCounters.kind, kind),
        ),
      )
      .get();

    if (!existing) {
      tx.insert(schema.nodeKindCounters).values({ spec_id: specId, plane, kind, next_ordinal: 2 }).run();
      return 1;
    }

    tx.update(schema.nodeKindCounters)
      .set({ next_ordinal: existing.nextOrdinal + 1 })
      .where(eq(schema.nodeKindCounters.id, existing.id))
      .run();
    return existing.nextOrdinal;
  }

  private seedElicitationBacklog(tx: Pick<BrunchDb, 'insert'>, specId: number, lsn: number): void {
    tx.insert(schema.elicitationBacklog)
      .values(
        SEEDED_ELICITATION_BACKLOG.map((entry) => ({
          spec_id: specId,
          kind: entry.kind,
          question: entry.question,
          basis: entry.basis,
          readiness_band: entry.readinessBand,
          plane_affinity: entry.planeAffinity,
          lens_affinity: entry.lensAffinity,
          created_at_lsn: lsn,
        })),
      )
      .run();
  }

  /** Create a spec row through the command boundary. */
  createSpec(input: CreateSpecInput): CreateSpecResult {
    const diagnostics: Diagnostic[] = [];
    const name = input.name.trim();
    const slug = input.slug.trim();
    const readinessGrade = input.readinessGrade ?? 'grounding_onboarding';

    if (!name) diagnostics.push({ field: 'name', message: 'name must be non-empty' });
    if (!slug) diagnostics.push({ field: 'slug', message: 'slug must be non-empty' });
    if (!isReadinessGrade(readinessGrade)) {
      diagnostics.push({
        field: 'readinessGrade',
        message: `"${String(readinessGrade)}" is not a valid readiness grade`,
      });
    }
    if (diagnostics.length > 0) return { status: 'structural_illegal', diagnostics };

    return this.db.transaction((tx) => {
      const row = tx
        .insert(schema.specs)
        .values({ name, slug, readiness_grade: readinessGrade })
        .returning()
        .get();

      const lsn = this.createInitialSpecClock(tx, row!.id);

      this.seedElicitationBacklog(tx, row!.id, lsn);

      tx.insert(schema.changeLog)
        .values({
          spec_id: row!.id,
          lsn,
          operation: 'create_spec',
          payload: JSON.stringify({ specId: row!.id, name, slug, readinessGrade }),
        })
        .run();

      return { status: 'success' as const, specId: row!.id, lsn };
    });
  }

  /** Create an elicitation-backlog entry through the command boundary. */
  createElicitationBacklogEntry(
    input: CreateElicitationBacklogEntryInput,
  ): CreateElicitationBacklogEntryResult {
    const diagnostics = validateCreateElicitationBacklogEntry(input);
    if (diagnostics.length > 0) {
      return { status: 'structural_illegal', diagnostics };
    }

    return this.db.transaction((tx) => {
      const specRow = tx
        .select({ id: schema.specs.id })
        .from(schema.specs)
        .where(eq(schema.specs.id, input.specId))
        .get();
      if (!specRow) {
        return {
          status: 'structural_illegal' as const,
          diagnostics: [{ field: 'specId', message: `spec ${input.specId} does not exist` }],
        };
      }

      if (input.aroseFromEntryId != null) {
        const parent = tx
          .select({ id: schema.elicitationBacklog.id, specId: schema.elicitationBacklog.spec_id })
          .from(schema.elicitationBacklog)
          .where(eq(schema.elicitationBacklog.id, input.aroseFromEntryId))
          .get();

        if (!parent) {
          return {
            status: 'structural_illegal' as const,
            diagnostics: [
              {
                field: 'aroseFromEntryId',
                message: `elicitation backlog entry ${input.aroseFromEntryId} does not exist`,
              },
            ],
          };
        }

        if (parent.specId !== input.specId) {
          return {
            status: 'structural_illegal' as const,
            diagnostics: [
              {
                field: 'aroseFromEntryId',
                message:
                  `elicitation backlog entry ${input.aroseFromEntryId} belongs to a different spec ` +
                  `(command spec ${input.specId})`,
              },
            ],
          };
        }
      }

      const lsn = this.bumpExistingSpecLsn(tx, input.specId);

      const entry = tx
        .insert(schema.elicitationBacklog)
        .values({
          spec_id: input.specId,
          kind: input.kind.trim(),
          question: input.question.trim(),
          basis: input.basis ?? 'explicit',
          readiness_band: input.readinessBand,
          plane_affinity: input.planeAffinity ?? null,
          lens_affinity: input.lensAffinity ?? null,
          arose_from_entry_id: input.aroseFromEntryId ?? null,
          rationale: input.rationale ?? null,
          created_at_lsn: lsn,
        })
        .returning({ id: schema.elicitationBacklog.id })
        .get();

      tx.insert(schema.changeLog)
        .values({
          spec_id: input.specId,
          lsn,
          operation: 'create_elicitation_backlog_entry',
          payload: JSON.stringify({
            id: entry!.id,
            specId: input.specId,
            kind: input.kind.trim(),
            readinessBand: input.readinessBand,
            planeAffinity: input.planeAffinity,
            lensAffinity: input.lensAffinity,
            ...(input.aroseFromEntryId != null ? { aroseFromEntryId: input.aroseFromEntryId } : {}),
          }),
        })
        .run();

      return { status: 'success' as const, id: entry!.id, lsn };
    });
  }

  /** Close an elicitation-backlog entry through the command boundary. */
  closeElicitationBacklogEntry(input: CloseElicitationBacklogEntryInput): CloseElicitationBacklogEntryResult {
    return this.db.transaction((tx) => {
      const entry = tx
        .select()
        .from(schema.elicitationBacklog)
        .where(
          and(
            eq(schema.elicitationBacklog.id, input.id),
            eq(schema.elicitationBacklog.spec_id, input.specId),
          ),
        )
        .get();

      if (!entry) {
        return {
          status: 'structural_illegal' as const,
          diagnostics: [
            {
              field: 'id',
              message: `elicitation backlog entry ${input.id} does not exist for spec ${input.specId}`,
            },
          ],
        };
      }

      if (entry.status === 'closed') {
        return {
          status: 'structural_illegal' as const,
          diagnostics: [{ field: 'id', message: `elicitation backlog entry ${input.id} is already closed` }],
        };
      }

      if (input.resolvedByNodeId != null) {
        const node = tx
          .select({ id: schema.nodes.id, specId: schema.nodes.spec_id })
          .from(schema.nodes)
          .where(eq(schema.nodes.id, input.resolvedByNodeId))
          .get();

        if (!node) {
          return {
            status: 'structural_illegal' as const,
            diagnostics: [
              {
                field: 'resolvedByNodeId',
                message: `node ${input.resolvedByNodeId} does not exist`,
              },
            ],
          };
        }

        if (node.specId !== input.specId) {
          return {
            status: 'structural_illegal' as const,
            diagnostics: [
              {
                field: 'resolvedByNodeId',
                message:
                  `node ${input.resolvedByNodeId} belongs to a different spec ` +
                  `(command spec ${input.specId})`,
              },
            ],
          };
        }
      }

      const lsn = this.bumpExistingSpecLsn(tx, input.specId);

      tx.update(schema.elicitationBacklog)
        .set({
          status: 'closed',
          resolved_by_node_id: input.resolvedByNodeId ?? null,
          closed_at_lsn: lsn,
        })
        .where(
          and(
            eq(schema.elicitationBacklog.id, input.id),
            eq(schema.elicitationBacklog.spec_id, input.specId),
          ),
        )
        .run();

      tx.insert(schema.changeLog)
        .values({
          spec_id: input.specId,
          lsn,
          operation: 'close_elicitation_backlog_entry',
          payload: JSON.stringify({
            id: input.id,
            specId: input.specId,
            ...(input.resolvedByNodeId != null ? { resolvedByNodeId: input.resolvedByNodeId } : {}),
          }),
        })
        .run();

      return { status: 'success' as const, lsn };
    });
  }

  /** Read all spec rows. */
  listSpecs(): SpecRecord[] {
    return this.db.select().from(schema.specs).all().map(specRecordFromRow);
  }

  /** Read a spec row by id. */
  getSpec(specId: number): SpecRecord | undefined {
    const row = this.db.select().from(schema.specs).where(eq(schema.specs.id, specId)).get();
    return row ? specRecordFromRow(row) : undefined;
  }

  /** Update a spec's readiness grade through the command boundary. */
  updateReadinessGrade(input: UpdateReadinessGradeInput): UpdateReadinessGradeResult {
    if (!isReadinessGrade(input.readinessGrade)) {
      return {
        status: 'structural_illegal',
        diagnostics: [
          {
            field: 'readinessGrade',
            message: `"${String(input.readinessGrade)}" is not a valid readiness grade`,
          },
        ],
      };
    }

    return this.db.transaction((tx) => {
      const existing = tx
        .select({ id: schema.specs.id })
        .from(schema.specs)
        .where(eq(schema.specs.id, input.specId))
        .get();
      if (!existing) {
        return {
          status: 'structural_illegal' as const,
          diagnostics: [{ field: 'specId', message: `spec ${input.specId} does not exist` }],
        };
      }

      const lsn = this.bumpExistingSpecLsn(tx, input.specId);
      tx.update(schema.specs)
        .set({ readiness_grade: input.readinessGrade })
        .where(eq(schema.specs.id, input.specId))
        .run();

      tx.insert(schema.changeLog)
        .values({
          spec_id: input.specId,
          lsn,
          operation: 'update_spec_readiness_grade',
          payload: JSON.stringify({ specId: input.specId, readinessGrade: input.readinessGrade }),
        })
        .run();

      return { status: 'success' as const, lsn };
    });
  }

  /**
   * Create a single graph node.
   *
   * Validates structurally, then executes inside one transaction:
   * verify spec exists → allocate LSN → insert node → append change_log → return result.
   *
   * On validation failure, nothing is written.
   */
  createNode(input: CreateNodeInput): CreateNodeResult {
    const diagnostics = validateCreateNode(input);
    if (diagnostics.length > 0) {
      return { status: 'structural_illegal', diagnostics };
    }

    return this.db.transaction((tx) => {
      // 1. Verify spec exists
      const specRow = tx
        .select({ id: schema.specs.id })
        .from(schema.specs)
        .where(eq(schema.specs.id, input.specId))
        .get();
      if (!specRow) {
        return {
          status: 'structural_illegal' as const,
          diagnostics: [{ field: 'specId', message: `spec ${input.specId} does not exist` }],
        };
      }

      // 2. Allocate spec-local LSN (atomic within this transaction)
      const lsn = this.bumpExistingSpecLsn(tx, input.specId);
      const kindOrdinal = this.allocateNodeKindOrdinal(tx, input.specId, input.plane, input.kind);

      // 3. Insert node
      const node = tx
        .insert(schema.nodes)
        .values({
          spec_id: input.specId,
          plane: input.plane,
          kind: input.kind,
          kind_ordinal: kindOrdinal,
          title: input.title,
          body: input.body ?? null,
          basis: input.basis ?? 'explicit',
          source: input.source ?? null,
          detail: input.detail != null ? JSON.stringify(input.detail) : null,
          created_at_lsn: lsn,
          updated_at_lsn: lsn,
        })
        .returning()
        .get();
      const nodeId = node!.id;

      // 4. Append change_log
      tx.insert(schema.changeLog)
        .values({
          spec_id: input.specId,
          lsn,
          operation: 'create_node',
          payload: JSON.stringify({
            nodeId,
            specId: input.specId,
            plane: input.plane,
            kind: input.kind,
          }),
        })
        .run();

      return { status: 'success' as const, nodeId, lsn };
    });
  }

  /**
   * Validate a commitGraph batch without mutating graph truth.
   *
   * This is the product gate for review-set proposals: a user-reviewable
   * proposal must pass the same structural checks as the eventual commit.
   */
  dryRunCommitGraph(input: CommitGraphInput): CommitGraphDryRunResult {
    const result = this.planCommitGraph(input, this.db);
    return result.status === 'structural_illegal'
      ? { status: 'structural_illegal', diagnostics: result.diagnostics }
      : { status: 'success' };
  }

  dryRunMutateGraph(input: MutateGraphInput): MutateGraphDryRunResult {
    const result = this.planMutateGraph(input, this.db);
    return result.status === 'structural_illegal'
      ? { status: 'structural_illegal', diagnostics: result.diagnostics }
      : { status: 'success' };
  }

  /**
   * Atomic batch creation of nodes and edges (D53-L).
   *
   * One transaction, one LSN. Intra-batch refs (strings) resolve to
   * just-inserted NodeIds; existing refs ({ existing: id }) are verified
   * against the database AND must belong to the command's spec
   * (D61-L spec ownership). All-or-nothing: if any entry fails structural
   * validation, the entire batch is rejected (I34-L).
   */
  commitGraph(input: CommitGraphInput): CommitGraphResult {
    return this.db.transaction((tx) => {
      const planned = this.planCommitGraph(input, tx);
      if (planned.status === 'structural_illegal') {
        return { status: 'structural_illegal' as const, diagnostics: planned.diagnostics };
      }

      return this.writePlannedGraphBatch(tx, input, planned.plan.edges, 'commit_graph');
    });
  }

  mutateGraph(input: MutateGraphInput): MutateGraphResult {
    return this.db.transaction((tx) => {
      const planned = this.planMutateGraph(input, tx);
      if (planned.status === 'structural_illegal') {
        return { status: 'structural_illegal' as const, diagnostics: planned.diagnostics };
      }

      return this.writePlannedMutationBatch(tx, input, planned.plan);
    });
  }

  /**
   * Validate a review-set payload before it becomes user-reviewable.
   *
   * This performs the same payload translation and graph batch structural
   * checks as `acceptReviewSet`, but does not allocate an LSN or mutate graph
   * truth.
   */
  dryRunAcceptReviewSet(input: AcceptReviewSetInput): AcceptReviewSetDryRunResult {
    const translated = translateReviewSetPayloadToMutateGraph({
      db: this.db,
      specId: input.specId,
      payload: input.payload,
    });
    if (translated.status === 'structural_illegal') return translated;
    return this.dryRunMutateGraph(translated.command);
  }

  /**
   * Atomic acceptance of an exact review-set payload (D27-L/I15-L).
   *
   * Review-set payloads use projected existing-node codes at the product
   * boundary. This command resolves them for the selected spec, validates the
   * resulting explicit-basis graph batch, and writes one transaction/change-log
   * row with operation `accept_review_set`.
   */
  acceptReviewSet(input: AcceptReviewSetInput): AcceptReviewSetResult {
    const translated = translateReviewSetPayloadToMutateGraph({
      db: this.db,
      specId: input.specId,
      payload: input.payload,
    });
    if (translated.status === 'structural_illegal') return translated;

    return this.db.transaction((tx) => {
      const planned = this.planMutateGraph(translated.command, tx);
      if (planned.status === 'structural_illegal') {
        return { status: 'structural_illegal' as const, diagnostics: planned.diagnostics };
      }

      return this.writePlannedGraphBatch(
        tx,
        planned.plan.createInput,
        planned.plan.createEdges,
        'accept_review_set',
        {
          proposalEntryId: input.proposalEntryId,
        },
      );
    });
  }

  private writePlannedGraphBatch(
    tx: Pick<BrunchDb, 'select' | 'insert' | 'update'>,
    input: CommitGraphInput,
    plannedEdges: readonly PlannedBatchEdge[],
    operation: 'commit_graph' | 'accept_review_set',
    payloadExtras: Record<string, unknown> = {},
  ): CommitGraphSuccess {
    const lsn = this.bumpExistingSpecLsn(tx, input.specId);

    const createdNodes: Record<string, { id: number; code: string }> = {};
    for (const bn of input.nodes) {
      const kindOrdinal = this.allocateNodeKindOrdinal(tx, input.specId, bn.plane, bn.kind);
      const row = tx
        .insert(schema.nodes)
        .values({
          spec_id: input.specId,
          plane: bn.plane,
          kind: bn.kind,
          kind_ordinal: kindOrdinal,
          title: bn.title,
          body: bn.body ?? null,
          basis: input.basis ?? 'explicit',
          source: bn.source ?? null,
          detail: bn.detail != null ? JSON.stringify(bn.detail) : null,
          created_at_lsn: lsn,
          updated_at_lsn: lsn,
        })
        .returning()
        .get();
      createdNodes[bn.ref] = formatCreatedGraphNode(row!);
    }

    const resolvePlannedEndpoint = (endpoint: PlannedBatchEndpoint): number => {
      if (endpoint.kind === 'existing') return endpoint.ref as number;
      return createdNodes[endpoint.ref as string]!.id;
    };

    const edgeIds: number[] = [];
    for (const edge of plannedEdges) {
      const row = tx
        .insert(schema.edges)
        .values({
          spec_id: input.specId,
          category: edge.category,
          source_id: resolvePlannedEndpoint(edge.source),
          target_id: resolvePlannedEndpoint(edge.target),
          stance: edge.stance,
          basis: input.basis ?? 'explicit',
          rationale: edge.rationale,
          created_at_lsn: lsn,
          updated_at_lsn: lsn,
        })
        .returning()
        .get();
      edgeIds.push(row!.id);
    }

    tx.insert(schema.changeLog)
      .values({
        spec_id: input.specId,
        lsn,
        operation,
        payload: JSON.stringify({
          ...payloadExtras,
          basis: input.basis ?? 'explicit',
          specId: input.specId,
          nodes: Object.fromEntries(Object.entries(createdNodes).map(([ref, node]) => [ref, node.id])),
          edges: edgeIds,
        }),
      })
      .run();

    return {
      status: 'success',
      lsn,
      createdNodes,
      edges: edgeIds,
    };
  }

  private planCommitGraph(input: CommitGraphInput, db: Pick<BrunchDb, 'select'>) {
    return planCommitGraphBatch(db, input, (nodeIndex) => {
      const node = input.nodes[nodeIndex]!;
      return validateCreateNode({ ...node, specId: input.specId }).map((diagnostic) => ({
        field: `nodes[${nodeIndex}].${diagnostic.field}`,
        message: diagnostic.message,
      }));
    });
  }

  private planMutateGraph(input: MutateGraphInput, db: Pick<BrunchDb, 'select'>) {
    const diagnostics: Diagnostic[] = [];

    if (input.ops.length === 0) {
      return {
        status: 'structural_illegal' as const,
        diagnostics: [{ field: 'ops', message: 'empty mutation batch — nothing to mutate' }],
      };
    }

    const createNodes = input.ops.filter(
      (op): op is Extract<GraphMutationOp, { readonly op: 'create_node' }> => op.op === 'create_node',
    );
    const createEdges = input.ops.filter(
      (op): op is Extract<GraphMutationOp, { readonly op: 'create_edge' }> => op.op === 'create_edge',
    );
    const patchNodes = input.ops.filter(
      (op): op is Extract<GraphMutationOp, { readonly op: 'patch_node' }> => op.op === 'patch_node',
    );
    const patchEdges = input.ops.filter(
      (op): op is Extract<GraphMutationOp, { readonly op: 'patch_edge' }> => op.op === 'patch_edge',
    );
    const deleteEdges = input.ops.filter(
      (op): op is Extract<GraphMutationOp, { readonly op: 'delete_edge' }> => op.op === 'delete_edge',
    );
    const deleteNodes = input.ops.filter(
      (op): op is Extract<GraphMutationOp, { readonly op: 'delete_node' }> => op.op === 'delete_node',
    );

    const normalizedCreateEdges = createEdges.flatMap((edge) => {
      try {
        return [normalizeRoleNamedEdgeDraft(edge)];
      } catch (error) {
        diagnostics.push({
          field: `ops[${input.ops.indexOf(edge)}]`,
          message: error instanceof Error ? error.message : 'invalid create_edge op',
        });
        return [];
      }
    });

    const createInput: CommitGraphInput = {
      specId: input.specId,
      basis: input.createBasis,
      nodes: createNodes.map(({ ref, plane, kind, title, body, source, detail }) => ({
        ref,
        plane,
        kind,
        title,
        body,
        source,
        detail,
      })),
      edges: normalizedCreateEdges,
    };

    const createPlan =
      createInput.nodes.length === 0 && createInput.edges.length === 0
        ? { status: 'success' as const, plan: { edges: [] as const } }
        : this.planCommitGraph(createInput, db);
    if (createPlan.status === 'structural_illegal') {
      diagnostics.push(...createPlan.diagnostics);
    }

    const referencedNodeIds = new Set<number>();
    const referencedEdgeIds = new Set<number>();
    for (const op of patchNodes) referencedNodeIds.add(op.node.existing);
    for (const op of deleteNodes) referencedNodeIds.add(op.node.existing);
    for (const op of patchEdges) referencedEdgeIds.add(op.edge.existing);
    for (const op of deleteEdges) referencedEdgeIds.add(op.edge.existing);

    const nodeRows =
      referencedNodeIds.size === 0
        ? []
        : db
            .select()
            .from(schema.nodes)
            .where(inArray(schema.nodes.id, [...referencedNodeIds]))
            .all();
    const edgeRows =
      referencedEdgeIds.size === 0
        ? []
        : db
            .select()
            .from(schema.edges)
            .where(inArray(schema.edges.id, [...referencedEdgeIds]))
            .all();

    const nodeRowsById = new Map(nodeRows.map((row) => [row.id, row]));
    const edgeRowsById = new Map(edgeRows.map((row) => [row.id, row]));

    const patchNodeTargets = new Set<number>();
    const plannedNodePatches: PlannedNodePatch[] = [];
    for (const op of patchNodes) {
      const path = `ops[${input.ops.indexOf(op)}]`;
      const row = nodeRowsById.get(op.node.existing);
      if (!row) {
        diagnostics.push({
          field: `${path}.node.existing`,
          message: `node ${op.node.existing} does not exist`,
        });
        continue;
      }
      if (row.spec_id !== input.specId) {
        diagnostics.push({
          field: `${path}.node.existing`,
          message: `node ${op.node.existing} belongs to a different spec (command spec ${input.specId})`,
        });
        continue;
      }
      if (patchNodeTargets.has(op.node.existing)) {
        diagnostics.push({
          field: `${path}.node.existing`,
          message: `node ${op.node.existing} is patched more than once`,
        });
        continue;
      }
      patchNodeTargets.add(op.node.existing);
      diagnostics.push(
        ...validateNodePatchAgainstExisting(row, op.patch).map((diagnostic) => ({
          field: `${path}.${diagnostic.field}`,
          message: diagnostic.message,
        })),
      );
      plannedNodePatches.push({ nodeId: op.node.existing, patch: op.patch });
    }

    const patchEdgeTargets = new Set<number>();
    const plannedEdgePatches: PlannedEdgePatch[] = [];
    for (const op of patchEdges) {
      const path = `ops[${input.ops.indexOf(op)}]`;
      const row = edgeRowsById.get(op.edge.existing);
      if (!row) {
        diagnostics.push({
          field: `${path}.edge.existing`,
          message: `edge ${op.edge.existing} does not exist`,
        });
        continue;
      }
      if (row.spec_id !== input.specId) {
        diagnostics.push({
          field: `${path}.edge.existing`,
          message: `edge ${op.edge.existing} belongs to a different spec (command spec ${input.specId})`,
        });
        continue;
      }
      if (patchEdgeTargets.has(op.edge.existing)) {
        diagnostics.push({
          field: `${path}.edge.existing`,
          message: `edge ${op.edge.existing} is patched more than once`,
        });
        continue;
      }
      patchEdgeTargets.add(op.edge.existing);
      diagnostics.push(
        ...validateEdgePatch(op.patch).map((diagnostic) => ({
          field: `${path}.${diagnostic.field}`,
          message: diagnostic.message,
        })),
      );
      plannedEdgePatches.push({ edgeId: op.edge.existing, patch: op.patch });
    }

    const deletedEdgeIds = new Set<number>();
    const plannedEdgeDeletes: number[] = [];
    for (const op of deleteEdges) {
      const path = `ops[${input.ops.indexOf(op)}]`;
      const row = edgeRowsById.get(op.edge.existing);
      if (!row) {
        diagnostics.push({
          field: `${path}.edge.existing`,
          message: `edge ${op.edge.existing} does not exist`,
        });
        continue;
      }
      if (row.spec_id !== input.specId) {
        diagnostics.push({
          field: `${path}.edge.existing`,
          message: `edge ${op.edge.existing} belongs to a different spec (command spec ${input.specId})`,
        });
        continue;
      }
      if (deletedEdgeIds.has(op.edge.existing)) {
        diagnostics.push({
          field: `${path}.edge.existing`,
          message: `edge ${op.edge.existing} is deleted more than once`,
        });
        continue;
      }
      deletedEdgeIds.add(op.edge.existing);
      plannedEdgeDeletes.push(op.edge.existing);
    }

    const deletedNodeIds = new Set<number>();
    const deletedExistingNodeIds = new Set(deleteNodes.map((op) => op.node.existing));
    const createEdgePlans = createPlan.status === 'success' ? createPlan.plan.edges : [];
    const plannedNodeDeletes: PlannedNodeDelete[] = [];
    for (const op of deleteNodes) {
      const path = `ops[${input.ops.indexOf(op)}]`;
      const row = nodeRowsById.get(op.node.existing);
      if (!row) {
        diagnostics.push({
          field: `${path}.node.existing`,
          message: `node ${op.node.existing} does not exist`,
        });
        continue;
      }
      if (row.spec_id !== input.specId) {
        diagnostics.push({
          field: `${path}.node.existing`,
          message: `node ${op.node.existing} belongs to a different spec (command spec ${input.specId})`,
        });
        continue;
      }
      if (deletedNodeIds.has(op.node.existing)) {
        diagnostics.push({
          field: `${path}.node.existing`,
          message: `node ${op.node.existing} is deleted more than once`,
        });
        continue;
      }
      deletedNodeIds.add(op.node.existing);

      if (patchNodeTargets.has(op.node.existing)) {
        diagnostics.push({
          field: `${path}.node.existing`,
          message: `node ${op.node.existing} cannot be patched and deleted in one batch`,
        });
      }

      const incidentRows = db
        .select({ id: schema.edges.id })
        .from(schema.edges)
        .where(
          and(
            eq(schema.edges.spec_id, input.specId),
            sql`(${schema.edges.source_id} = ${op.node.existing} or ${schema.edges.target_id} = ${op.node.existing})`,
          ),
        )
        .all();

      const remainingIncidentEdgeIds = incidentRows
        .map((edge) => edge.id)
        .filter((edgeId) => !deletedEdgeIds.has(edgeId));

      const createsIncidentEdge = createEdgePlans.some(
        (edge) =>
          (edge.source.kind === 'existing' && edge.source.ref === op.node.existing) ||
          (edge.target.kind === 'existing' && edge.target.ref === op.node.existing),
      );
      if (createsIncidentEdge) {
        diagnostics.push({
          field: `${path}.node.existing`,
          message: `node ${op.node.existing} cannot be deleted in the same batch that creates incident edges`,
        });
      }

      if (!op.deleteIncidentEdges && remainingIncidentEdgeIds.length > 0) {
        diagnostics.push({
          field: `${path}.deleteIncidentEdges`,
          message: `node ${op.node.existing} has incident edges; set deleteIncidentEdges to true to delete it`,
        });
      }

      plannedNodeDeletes.push({ nodeId: op.node.existing, incidentEdgeIds: remainingIncidentEdgeIds });
    }

    for (const edgeId of patchEdgeTargets) {
      const row = edgeRowsById.get(edgeId);
      if (!row) {
        continue;
      }
      if (
        deletedEdgeIds.has(edgeId) ||
        deletedExistingNodeIds.has(row.source_id) ||
        deletedExistingNodeIds.has(row.target_id)
      ) {
        diagnostics.push({
          field: 'ops',
          message: `edge ${edgeId} cannot be patched when it is deleted or attached to a deleted node in the same batch`,
        });
      }
    }

    if (diagnostics.length > 0 || createPlan.status === 'structural_illegal') {
      return { status: 'structural_illegal' as const, diagnostics };
    }

    return {
      status: 'success' as const,
      plan: {
        createInput,
        createEdges: createPlan.plan.edges,
        patchNodes: plannedNodePatches,
        patchEdges: plannedEdgePatches,
        deleteEdges: plannedEdgeDeletes,
        deleteNodes: plannedNodeDeletes,
      },
    };
  }

  private writePlannedMutationBatch(
    tx: Pick<BrunchDb, 'select' | 'insert' | 'update' | 'delete'>,
    input: MutateGraphInput,
    plan: PlannedMutateGraph,
  ): MutateGraphSuccess {
    const lsn = this.bumpExistingSpecLsn(tx, input.specId);

    const createdNodes: Record<string, { id: number; code: string }> = {};
    for (const node of plan.createInput.nodes) {
      const kindOrdinal = this.allocateNodeKindOrdinal(tx, input.specId, node.plane, node.kind);
      const row = tx
        .insert(schema.nodes)
        .values({
          spec_id: input.specId,
          plane: node.plane,
          kind: node.kind,
          kind_ordinal: kindOrdinal,
          title: node.title,
          body: node.body ?? null,
          basis: input.createBasis ?? 'explicit',
          source: node.source ?? null,
          detail: node.detail != null ? JSON.stringify(node.detail) : null,
          created_at_lsn: lsn,
          updated_at_lsn: lsn,
        })
        .returning()
        .get();
      createdNodes[node.ref] = formatCreatedGraphNode(row!);
    }

    const resolvePlannedEndpoint = (endpoint: PlannedBatchEndpoint): number => {
      if (endpoint.kind === 'existing') return endpoint.ref as number;
      return createdNodes[endpoint.ref as string]!.id;
    };

    const createdEdges: number[] = [];
    for (const edge of plan.createEdges) {
      const row = tx
        .insert(schema.edges)
        .values({
          spec_id: input.specId,
          category: edge.category,
          source_id: resolvePlannedEndpoint(edge.source),
          target_id: resolvePlannedEndpoint(edge.target),
          stance: edge.stance,
          basis: input.createBasis ?? 'explicit',
          rationale: edge.rationale,
          created_at_lsn: lsn,
          updated_at_lsn: lsn,
        })
        .returning({ id: schema.edges.id })
        .get();
      createdEdges.push(row!.id);
    }

    const updatedNodes: number[] = [];
    for (const node of plan.patchNodes) {
      const patchRecord = node.patch as Record<string, unknown>;
      const values: Record<string, unknown> = { updated_at_lsn: lsn };
      if (hasOwn(patchRecord, 'title')) values['title'] = node.patch.title;
      if (hasOwn(patchRecord, 'body')) values['body'] = node.patch.body ?? null;
      if (hasOwn(patchRecord, 'source')) values['source'] = node.patch.source ?? null;
      if (hasOwn(patchRecord, 'detail')) {
        values['detail'] = node.patch.detail == null ? null : JSON.stringify(node.patch.detail);
      }
      tx.update(schema.nodes).set(values).where(eq(schema.nodes.id, node.nodeId)).run();
      updatedNodes.push(node.nodeId);
    }

    const updatedEdges: number[] = [];
    for (const edge of plan.patchEdges) {
      const patchRecord = edge.patch as Record<string, unknown>;
      const values: Record<string, unknown> = { updated_at_lsn: lsn };
      if (hasOwn(patchRecord, 'rationale')) values['rationale'] = edge.patch.rationale ?? null;
      tx.update(schema.edges).set(values).where(eq(schema.edges.id, edge.edgeId)).run();
      updatedEdges.push(edge.edgeId);
    }

    const deletedEdges = new Set<number>();
    for (const edgeId of plan.deleteEdges) {
      tx.delete(schema.edges).where(eq(schema.edges.id, edgeId)).run();
      deletedEdges.add(edgeId);
    }

    const deletedNodes: number[] = [];
    for (const node of plan.deleteNodes) {
      for (const edgeId of node.incidentEdgeIds) {
        if (deletedEdges.has(edgeId)) {
          continue;
        }
        tx.delete(schema.edges).where(eq(schema.edges.id, edgeId)).run();
        deletedEdges.add(edgeId);
      }
      tx.delete(schema.nodes).where(eq(schema.nodes.id, node.nodeId)).run();
      deletedNodes.push(node.nodeId);
    }

    tx.insert(schema.changeLog)
      .values({
        spec_id: input.specId,
        lsn,
        operation: 'mutate_graph',
        payload: JSON.stringify({
          specId: input.specId,
          createBasis: input.createBasis ?? 'explicit',
          createdNodes: Object.fromEntries(Object.entries(createdNodes).map(([ref, node]) => [ref, node.id])),
          createdEdges,
          updatedNodes,
          updatedEdges,
          deletedNodes,
          deletedEdges: [...deletedEdges],
        }),
      })
      .run();

    return {
      status: 'success',
      lsn,
      createdNodes,
      createdEdges,
      updatedNodes,
      updatedEdges,
      deletedNodes,
      deletedEdges: [...deletedEdges],
    };
  }

  /**
   * Create a reconciliation need.
   *
   * Validates that the target (edge or node pair) exists, then inserts
   * inside one transaction with LSN allocation and change_log append.
   */
  createReconciliationNeed(input: CreateReconNeedInput): CreateReconNeedResult {
    // Validate spec + target references exist and share the same spec.
    return this.db.transaction((tx) => {
      const diagnostics: Diagnostic[] = [];

      const specRow = tx
        .select({ id: schema.specs.id })
        .from(schema.specs)
        .where(eq(schema.specs.id, input.specId))
        .get();
      if (!specRow) {
        diagnostics.push({ field: 'specId', message: `spec ${input.specId} does not exist` });
        return { status: 'structural_illegal' as const, diagnostics };
      }

      if (input.target.kind === 'edge') {
        const row = tx
          .select({ id: schema.edges.id, spec_id: schema.edges.spec_id })
          .from(schema.edges)
          .where(eq(schema.edges.id, input.target.edgeId))
          .get();
        if (!row) {
          diagnostics.push({
            field: 'target.edgeId',
            message: `edge ${input.target.edgeId} does not exist`,
          });
        } else if (row.spec_id !== input.specId) {
          diagnostics.push({
            field: 'target.edgeId',
            message: `edge ${input.target.edgeId} belongs to a different spec (command spec ${input.specId})`,
          });
        }
      } else {
        const checkNode = (id: number, field: 'target.aId' | 'target.bId'): void => {
          const row = tx
            .select({ id: schema.nodes.id, spec_id: schema.nodes.spec_id })
            .from(schema.nodes)
            .where(eq(schema.nodes.id, id))
            .get();
          if (!row) {
            diagnostics.push({ field, message: `node ${id} does not exist` });
          } else if (row.spec_id !== input.specId) {
            diagnostics.push({
              field,
              message: `node ${id} belongs to a different spec (command spec ${input.specId})`,
            });
          }
        };
        checkNode(input.target.aId, 'target.aId');
        checkNode(input.target.bId, 'target.bId');
      }

      if (diagnostics.length > 0) {
        return { status: 'structural_illegal' as const, diagnostics };
      }

      // Allocate spec-local LSN
      const lsn = this.bumpExistingSpecLsn(tx, input.specId);

      // Insert reconciliation need
      const row = tx
        .insert(schema.reconciliationNeed)
        .values({
          spec_id: input.specId,
          target_kind: input.target.kind,
          target_edge_id: input.target.kind === 'edge' ? input.target.edgeId : null,
          target_a_id: input.target.kind === 'node_pair' ? input.target.aId : null,
          target_b_id: input.target.kind === 'node_pair' ? input.target.bId : null,
          kind: input.needKind,
          reason: input.reason ?? null,
          created_at_lsn: lsn,
        })
        .returning()
        .get();

      // Append change_log
      tx.insert(schema.changeLog)
        .values({
          spec_id: input.specId,
          lsn,
          operation: 'create_reconciliation_need',
          payload: JSON.stringify({
            id: row!.id,
            specId: input.specId,
            target: input.target,
            kind: input.needKind,
          }),
        })
        .run();

      return { status: 'success' as const, id: row!.id, lsn };
    });
  }

  /**
   * Resolve an open reconciliation need.
   *
   * Sets status to "resolved" and records the resolvedAtLsn.
   * Rejects if the need does not exist or is already resolved.
   */
  resolveReconciliationNeed(input: ResolveReconNeedInput): ResolveReconNeedResult {
    return this.db.transaction((tx) => {
      const existing = tx
        .select()
        .from(schema.reconciliationNeed)
        .where(
          and(
            eq(schema.reconciliationNeed.id, input.id),
            eq(schema.reconciliationNeed.spec_id, input.specId),
          ),
        )
        .get();

      if (!existing) {
        return {
          status: 'structural_illegal' as const,
          diagnostics: [
            {
              field: 'id',
              message: `reconciliation need ${input.id} does not exist for spec ${input.specId}`,
            },
          ],
        };
      }

      if (existing.status === 'resolved') {
        return {
          status: 'structural_illegal' as const,
          diagnostics: [
            {
              field: 'id',
              message: `reconciliation need ${input.id} is already resolved`,
            },
          ],
        };
      }

      // Allocate spec-local LSN
      const lsn = this.bumpExistingSpecLsn(tx, input.specId);

      // Update status
      tx.update(schema.reconciliationNeed)
        .set({ status: 'resolved', resolved_at_lsn: lsn })
        .where(
          and(
            eq(schema.reconciliationNeed.id, input.id),
            eq(schema.reconciliationNeed.spec_id, input.specId),
          ),
        )
        .run();

      // Append change_log
      tx.insert(schema.changeLog)
        .values({
          spec_id: input.specId,
          lsn,
          operation: 'resolve_reconciliation_need',
          payload: JSON.stringify({ id: input.id, specId: input.specId }),
        })
        .run();

      return { status: 'success' as const, lsn };
    });
  }
}
