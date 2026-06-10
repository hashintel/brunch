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

import { and, eq, sql } from 'drizzle-orm';

import type { BrunchDb } from '../db/connection.js';
import * as schema from '../db/schema.js';
import { planGraphMutation } from './command-executor/graph-mutation-planner.js';
import type {
  EdgePatch,
  Diagnostic,
  MutateGraphDryRunResult,
  MutateGraphInput,
  MutateGraphResult,
  MutateGraphSuccess,
  NodePatch,
  StructuralIllegal,
} from './command-executor/graph-mutation-types.js';
import { writeGraphMutation } from './command-executor/graph-mutation-writer.js';
import { translateReviewSetPayloadToMutateGraph } from './review-set.js';
import type { ElicitationGapLensAffinity, GapDisposition, GapPredicate } from './schema/elicitation-gaps.js';
import {
  DESIGN_KINDS,
  INTENT_KINDS,
  GAP_DISPOSITIONS,
  GAP_PREDICATE_KINDS,
  LENS_AFFINITIES,
  NODE_BASES,
  ORACLE_KINDS,
  PLAN_KINDS,
  READINESS_BANDS,
  READINESS_GRADES,
} from './schema/kinds.js';
import { type NodeBasis, type NodePlane, type ReadinessBand } from './schema/nodes.js';

export type ReadinessGrade = (typeof READINESS_GRADES)[number];
export type {
  Diagnostic,
  EdgePatch,
  GraphMutationNodeRef,
  GraphMutationOp,
  MutateGraphDryRunResult,
  MutateGraphInput,
  MutateGraphResult,
  MutateGraphSuccess,
  NodePatch,
  StructuralIllegal,
} from './command-executor/graph-mutation-types.js';
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
  | MutateGraphSuccess
  | AcceptReviewSetSuccess
  | ReconNeedSuccess
  | ReconNeedResolveSuccess
  | CreateSpecSuccess
  | ElicitationGapSuccess
  | ElicitationGapDispositionSuccess
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

/** Result of a createElicitationGap command. */
export type CreateElicitationGapResult = ElicitationGapSuccess | StructuralIllegal;

/** Result of a setElicitationGapDisposition command. */
export type SetElicitationGapDispositionResult = ElicitationGapDispositionSuccess | StructuralIllegal;

/** Result of an updateReadinessGrade command. */
export type UpdateReadinessGradeResult = UpdateReadinessGradeSuccess | StructuralIllegal;

/** Successful accepted review-set graph batch execution. */
interface AcceptReviewSetSuccess extends MutateGraphSuccess {}

/** Result of an acceptReviewSet command. */
export type AcceptReviewSetResult = AcceptReviewSetSuccess | StructuralIllegal;

/** Result of validating a review-set payload before user presentation. */
export type AcceptReviewSetDryRunResult = { readonly status: 'success' } | StructuralIllegal;

type ExistingNodeRow = typeof schema.nodes.$inferSelect;

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

/** Input for creating an elicitation gap. */
export interface CreateElicitationGapInput {
  readonly specId: number;
  readonly name: string;
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

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const VALID_KINDS_BY_PLANE: Record<string, readonly string[]> = {
  intent: INTENT_KINDS as unknown as string[],
  oracle: ORACLE_KINDS as unknown as string[],
  design: DESIGN_KINDS as unknown as string[],
  plan: PLAN_KINDS as unknown as string[],
};

const KINDS_REQUIRING_DETAIL = new Set<string>(['decision', 'term']);
const VALID_READINESS_GRADES = READINESS_GRADES as unknown as string[];
const VALID_NODE_BASES = NODE_BASES as unknown as string[];
const VALID_READINESS_BANDS = READINESS_BANDS as unknown as string[];
const VALID_GAP_DISPOSITIONS = GAP_DISPOSITIONS as unknown as string[];
const VALID_GAP_PREDICATE_KINDS = GAP_PREDICATE_KINDS as unknown as string[];
const VALID_LENS_AFFINITIES = LENS_AFFINITIES as unknown as string[];

const SEEDED_ELICITATION_GAPS: readonly {
  readonly name: string;
  readonly rationale: string;
  readonly basis: NodeBasis;
  readonly band: ReadinessBand;
  readonly predicate: GapPredicate;
  readonly importance: number;
  readonly planeAffinity: NodePlane;
  readonly lensAffinity: ElicitationGapLensAffinity;
}[] = [
  {
    name: 'domain',
    rationale: 'Anchors what kind of thing is being specified and the domain it belongs to.',
    basis: 'implicit',
    band: 'grounding',
    predicate: { kind: 'presence', plane: 'intent', nodeKind: 'context', minimum: 1 },
    importance: 3,
    planeAffinity: 'intent',
    lensAffinity: 'intent',
  },
  {
    name: 'protagonist',
    rationale: 'Identifies who the spec is for or who is most affected by the outcome.',
    basis: 'implicit',
    band: 'grounding',
    predicate: { kind: 'presence', plane: 'intent', nodeKind: 'context', minimum: 1 },
    importance: 3,
    planeAffinity: 'intent',
    lensAffinity: 'intent',
  },
  {
    name: 'pain_pull',
    rationale: 'States the problem, pain, or pull that makes the work worth doing.',
    basis: 'implicit',
    band: 'grounding',
    predicate: { kind: 'presence', plane: 'intent', nodeKind: 'goal', minimum: 1 },
    importance: 3,
    planeAffinity: 'intent',
    lensAffinity: 'intent',
  },
  {
    name: 'constraint',
    rationale: 'Captures binding constraints or non-negotiable boundaries already shaping the work.',
    basis: 'implicit',
    band: 'grounding',
    predicate: { kind: 'presence', plane: 'intent', nodeKind: 'constraint', minimum: 1 },
    importance: 3,
    planeAffinity: 'intent',
    lensAffinity: 'intent',
  },
  {
    name: 'value',
    rationale: 'Clarifies the benefit or value the work should create.',
    basis: 'implicit',
    band: 'grounding',
    predicate: { kind: 'presence', plane: 'intent', nodeKind: 'goal', minimum: 1 },
    importance: 1,
    planeAffinity: 'intent',
    lensAffinity: 'intent',
  },
  {
    name: 'context_of_use',
    rationale: 'Describes when, where, or under what conditions the result will be used.',
    basis: 'implicit',
    band: 'grounding',
    predicate: { kind: 'presence', plane: 'intent', nodeKind: 'context', minimum: 1 },
    importance: 1,
    planeAffinity: 'intent',
    lensAffinity: 'intent',
  },
  {
    name: 'success_sketch',
    rationale: 'Sketches what success looks like or how goodness will be recognized.',
    basis: 'implicit',
    band: 'grounding',
    predicate: { kind: 'presence', plane: 'intent', nodeKind: 'criterion', minimum: 1 },
    importance: 1,
    planeAffinity: 'intent',
    lensAffinity: 'intent',
  },
  {
    name: 'solution_boundary',
    rationale: 'Names non-goals or boundaries around what the solution is explicitly not.',
    basis: 'implicit',
    band: 'grounding',
    predicate: { kind: 'presence', plane: 'intent', nodeKind: 'constraint', minimum: 1 },
    importance: 1,
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

function isElicitationGapLensAffinity(value: string): value is ElicitationGapLensAffinity {
  return VALID_LENS_AFFINITIES.includes(value);
}

function isGapDisposition(value: string): value is GapDisposition {
  return VALID_GAP_DISPOSITIONS.includes(value);
}

function validateGapPredicate(predicate: GapPredicate, diagnostics: Diagnostic[]): void {
  if (typeof predicate !== 'object' || predicate === null) {
    diagnostics.push({ field: 'predicate', message: 'predicate must be an object' });
    return;
  }

  if (!VALID_GAP_PREDICATE_KINDS.includes(predicate.kind)) {
    diagnostics.push({ field: 'predicate.kind', message: 'predicate kind is not valid' });
    return;
  }

  if (predicate.kind === 'presence') {
    if (!Number.isInteger(predicate.minimum) || predicate.minimum < 1) {
      diagnostics.push({ field: 'predicate.minimum', message: 'minimum must be a positive integer' });
    }
    if (predicate.plane !== undefined && !isNodePlane(predicate.plane)) {
      diagnostics.push({ field: 'predicate.plane', message: 'plane is not valid' });
    }
    if (predicate.band !== undefined && !isReadinessBand(predicate.band)) {
      diagnostics.push({ field: 'predicate.band', message: 'band is not valid' });
    }
    if (predicate.nodeKind === undefined && predicate.band === undefined) {
      diagnostics.push({ field: 'predicate', message: 'presence predicate needs nodeKind or band' });
    }
  }
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

function validateCreateElicitationGap(input: CreateElicitationGapInput): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  if (!input.name.trim()) {
    diagnostics.push({ field: 'name', message: 'name must be non-empty' });
  }

  if (!input.rationale.trim()) {
    diagnostics.push({ field: 'rationale', message: 'rationale must be non-empty' });
  }

  if (input.basis !== undefined && !isNodeBasis(input.basis)) {
    diagnostics.push({ field: 'basis', message: 'basis must be explicit or implicit' });
  }

  if (!isReadinessBand(input.band)) {
    diagnostics.push({
      field: 'band',
      message: `"${String(input.band)}" is not a valid readiness band`,
    });
  }

  if (input.importance !== undefined && (!Number.isInteger(input.importance) || input.importance < 1)) {
    diagnostics.push({ field: 'importance', message: 'importance must be a positive integer' });
  }

  validateGapPredicate(input.predicate, diagnostics);

  if (input.planeAffinity !== undefined && !isNodePlane(input.planeAffinity)) {
    diagnostics.push({
      field: 'planeAffinity',
      message: `"${String(input.planeAffinity)}" is not a valid plane affinity`,
    });
  }

  if (input.lensAffinity !== undefined && !isElicitationGapLensAffinity(input.lensAffinity)) {
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

  private seedElicitationGaps(tx: Pick<BrunchDb, 'insert'>, specId: number, lsn: number): void {
    tx.insert(schema.elicitationGaps)
      .values(
        SEEDED_ELICITATION_GAPS.map((entry) => ({
          spec_id: specId,
          name: entry.name,
          rationale: entry.rationale,
          basis: entry.basis,
          readiness_band: entry.band,
          predicate_kind: entry.predicate.kind,
          predicate: JSON.stringify(entry.predicate),
          importance: entry.importance,
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

      this.seedElicitationGaps(tx, row!.id, lsn);

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

  /** Create an elicitation gap through the command boundary. */
  createElicitationGap(input: CreateElicitationGapInput): CreateElicitationGapResult {
    const diagnostics = validateCreateElicitationGap(input);
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

      if (input.aroseFromGapId != null) {
        const parent = tx
          .select({ id: schema.elicitationGaps.id, specId: schema.elicitationGaps.spec_id })
          .from(schema.elicitationGaps)
          .where(eq(schema.elicitationGaps.id, input.aroseFromGapId))
          .get();

        if (!parent) {
          return {
            status: 'structural_illegal' as const,
            diagnostics: [
              { field: 'aroseFromGapId', message: `elicitation gap ${input.aroseFromGapId} does not exist` },
            ],
          };
        }

        if (parent.specId !== input.specId) {
          return {
            status: 'structural_illegal' as const,
            diagnostics: [
              {
                field: 'aroseFromGapId',
                message: `elicitation gap ${input.aroseFromGapId} belongs to a different spec`,
              },
            ],
          };
        }
      }

      const lsn = this.bumpExistingSpecLsn(tx, input.specId);

      const entry = tx
        .insert(schema.elicitationGaps)
        .values({
          spec_id: input.specId,
          name: input.name.trim(),
          rationale: input.rationale.trim(),
          basis: input.basis ?? 'explicit',
          readiness_band: input.band,
          predicate_kind: input.predicate.kind,
          predicate: JSON.stringify(input.predicate),
          importance: input.importance ?? 1,
          plane_affinity: input.planeAffinity ?? null,
          lens_affinity: input.lensAffinity ?? null,
          arose_from_gap_id: input.aroseFromGapId ?? null,
          created_at_lsn: lsn,
        })
        .returning({ id: schema.elicitationGaps.id })
        .get();

      tx.insert(schema.changeLog)
        .values({
          spec_id: input.specId,
          lsn,
          operation: 'create_elicitation_gap',
          payload: JSON.stringify({
            id: entry!.id,
            specId: input.specId,
            name: input.name.trim(),
            band: input.band,
            predicateKind: input.predicate.kind,
            planeAffinity: input.planeAffinity,
            lensAffinity: input.lensAffinity,
            ...(input.aroseFromGapId != null ? { aroseFromGapId: input.aroseFromGapId } : {}),
          }),
        })
        .run();

      return { status: 'success' as const, id: entry!.id, lsn };
    });
  }

  /** Set an elicitation gap's non-derivable disposition through the command boundary. */
  setElicitationGapDisposition(input: SetElicitationGapDispositionInput): SetElicitationGapDispositionResult {
    if (!isGapDisposition(input.disposition)) {
      return {
        status: 'structural_illegal',
        diagnostics: [{ field: 'disposition', message: 'disposition is not valid' }],
      };
    }

    return this.db.transaction((tx) => {
      const gap = tx
        .select()
        .from(schema.elicitationGaps)
        .where(and(eq(schema.elicitationGaps.id, input.id), eq(schema.elicitationGaps.spec_id, input.specId)))
        .get();

      if (!gap) {
        return {
          status: 'structural_illegal' as const,
          diagnostics: [
            { field: 'id', message: `elicitation gap ${input.id} does not exist for spec ${input.specId}` },
          ],
        };
      }

      if (input.disposition === 'answered' && gap.predicate_kind !== 'manual') {
        return {
          status: 'structural_illegal' as const,
          diagnostics: [
            {
              field: 'disposition',
              message: 'structural gap answered state is graph-derived, not hand-settable',
            },
          ],
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
              { field: 'resolvedByNodeId', message: `node ${input.resolvedByNodeId} does not exist` },
            ],
          };
        }

        if (node.specId !== input.specId) {
          return {
            status: 'structural_illegal' as const,
            diagnostics: [
              {
                field: 'resolvedByNodeId',
                message: `node ${input.resolvedByNodeId} belongs to a different spec`,
              },
            ],
          };
        }
      }

      const lsn = this.bumpExistingSpecLsn(tx, input.specId);

      tx.update(schema.elicitationGaps)
        .set({
          disposition: input.disposition,
          resolved_by_node_id: input.resolvedByNodeId ?? null,
          disposition_set_at_lsn: lsn,
        })
        .where(and(eq(schema.elicitationGaps.id, input.id), eq(schema.elicitationGaps.spec_id, input.specId)))
        .run();

      tx.insert(schema.changeLog)
        .values({
          spec_id: input.specId,
          lsn,
          operation: 'set_elicitation_gap_disposition',
          payload: JSON.stringify({
            id: input.id,
            specId: input.specId,
            disposition: input.disposition,
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

  dryRunMutateGraph(input: MutateGraphInput): MutateGraphDryRunResult {
    const result = planGraphMutation({
      db: this.db,
      input,
      validateCreateNode: (op) => validateCreateNode({ ...op, specId: input.specId }),
      validateNodePatch: validateNodePatchAgainstExisting,
      validateEdgePatch,
    });
    return result.status === 'structural_illegal'
      ? { status: 'structural_illegal', diagnostics: result.diagnostics }
      : { status: 'success' };
  }

  mutateGraph(input: MutateGraphInput): MutateGraphResult {
    return this.db.transaction((tx) => {
      const planned = planGraphMutation({
        db: tx,
        input,
        validateCreateNode: (op) => validateCreateNode({ ...op, specId: input.specId }),
        validateNodePatch: validateNodePatchAgainstExisting,
        validateEdgePatch,
      });
      if (planned.status === 'structural_illegal') {
        return { status: 'structural_illegal' as const, diagnostics: planned.diagnostics };
      }

      return writeGraphMutation({
        tx,
        input,
        plan: planned.plan,
        operation: 'mutate_graph',
        bumpExistingSpecLsn: (writerTx, specId) => this.bumpExistingSpecLsn(writerTx, specId),
        allocateNodeKindOrdinal: (writerTx, specId, plane, kind) =>
          this.allocateNodeKindOrdinal(writerTx, specId, plane as NodePlane, kind),
      });
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
      const planned = planGraphMutation({
        db: tx,
        input: translated.command,
        validateCreateNode: (op) => validateCreateNode({ ...op, specId: translated.command.specId }),
        validateNodePatch: validateNodePatchAgainstExisting,
        validateEdgePatch,
      });
      if (planned.status === 'structural_illegal') {
        return { status: 'structural_illegal' as const, diagnostics: planned.diagnostics };
      }

      return writeGraphMutation({
        tx,
        input: translated.command,
        plan: planned.plan,
        operation: 'accept_review_set',
        payloadExtras: { proposalEntryId: input.proposalEntryId },
        bumpExistingSpecLsn: (writerTx, specId) => this.bumpExistingSpecLsn(writerTx, specId),
        allocateNodeKindOrdinal: (writerTx, specId, plane, kind) =>
          this.allocateNodeKindOrdinal(writerTx, specId, plane as NodePlane, kind),
      });
    });
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
