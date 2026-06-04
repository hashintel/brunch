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
 *  - monotonic LSN allocation from graph_clock
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
import type { EdgeCategory, EdgeStance } from './schema/edges.js';
import { formatGraphNodeCode, type NodeBasis, type NodeKind, type NodePlane } from './schema/nodes.js';

export type ReadinessGrade = (typeof schema.READINESS_GRADES)[number];

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

/** A single validation problem discovered during structural checks. */
export interface Diagnostic {
  readonly field: string;
  readonly message: string;
}

/** Successful command execution. */
export interface CommandSuccess {
  readonly status: 'success';
  readonly nodeId: number;
  readonly lsn: number;
}

/** Structurally invalid input — validation failed before any write. */
export interface StructuralIllegal {
  readonly status: 'structural_illegal';
  readonly diagnostics: readonly Diagnostic[];
}

/** Action requires human confirmation (M6 placeholder). */
export interface NeedsHuman {
  readonly status: 'needs_human';
}

/** Action blocked by authority policy (M6 placeholder). */
export interface PolicyBlocked {
  readonly status: 'policy_blocked';
}

/** Optimistic concurrency conflict (M6 placeholder). */
export interface VersionConflict {
  readonly status: 'version_conflict';
}

/** Successful commitGraph batch execution. */
export interface CommitGraphSuccess {
  readonly status: 'success';
  readonly lsn: number;
  readonly nodes: Readonly<Record<string, number>>;
  readonly nodeCodes?: Readonly<Record<string, string>>;
  readonly edges: readonly number[];
}

/** Successful dry-run validation without mutation. */
export interface DryRunSuccess {
  readonly status: 'success';
}

/** Successful reconciliation-need creation. */
export interface ReconNeedSuccess {
  readonly status: 'success';
  readonly id: number;
  readonly lsn: number;
}

/** Successful reconciliation-need resolution. */
export interface ReconNeedResolveSuccess {
  readonly status: 'success';
  readonly lsn: number;
}

/** Successful spec creation. */
export interface CreateSpecSuccess {
  readonly status: 'success';
  readonly specId: number;
  readonly lsn: number;
}

/** Successful spec readiness-grade update. */
export interface UpdateReadinessGradeSuccess {
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
  | ReconNeedSuccess
  | ReconNeedResolveSuccess
  | CreateSpecSuccess
  | UpdateReadinessGradeSuccess
  | StructuralIllegal
  | NeedsHuman
  | PolicyBlocked
  | VersionConflict;

/** Result of a createNode command. */
export type CreateNodeResult = CommandSuccess | StructuralIllegal;

/** Result of a commitGraph command. */
export type CommitGraphResult = CommitGraphSuccess | StructuralIllegal;

/** Result of a commitGraph dry-run validation. */
export type CommitGraphDryRunResult = DryRunSuccess | StructuralIllegal;

/** Result of a createReconciliationNeed command. */
export type CreateReconNeedResult = ReconNeedSuccess | StructuralIllegal;

/** Result of a resolveReconciliationNeed command. */
export type ResolveReconNeedResult = ReconNeedResolveSuccess | StructuralIllegal;

/** Result of a createSpec command. */
export type CreateSpecResult = CreateSpecSuccess | StructuralIllegal;

/** Result of an updateReadinessGrade command. */
export type UpdateReadinessGradeResult = UpdateReadinessGradeSuccess | StructuralIllegal;

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
export type ReconNeedTargetEdge = {
  readonly kind: 'edge';
  readonly edgeId: number;
};

/** Target for a reconciliation need — node pair. */
export type ReconNeedTargetNodePair = {
  readonly kind: 'node_pair';
  readonly aId: number;
  readonly bId: number;
};

/** Target for a reconciliation need. */
export type ReconNeedTarget = ReconNeedTargetEdge | ReconNeedTargetNodePair;

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
// Batch input types (commitGraph)
// ---------------------------------------------------------------------------

/** Reference to a node endpoint in a batch edge. */
export type BatchEdgeRef = string | { readonly existing: number };

/** A node to create inside a commitGraph batch. */
export interface BatchNodeInput {
  readonly ref: string;
  readonly plane: NodePlane;
  readonly kind: string;
  readonly title: string;
  readonly body?: string | undefined;
  readonly source?: string | undefined;
  readonly detail?: unknown;
}

/** An edge to create inside a commitGraph batch. */
export interface BatchEdgeInput {
  readonly category: string;
  readonly source: BatchEdgeRef;
  readonly target: BatchEdgeRef;
  readonly stance?: string | undefined;
  readonly rationale?: string | undefined;
}

/** Input for the commitGraph atomic batch mutation. */
export interface CommitGraphInput {
  readonly specId: number;
  readonly basis?: NodeBasis | undefined;
  readonly nodes: readonly BatchNodeInput[];
  readonly edges: readonly BatchEdgeInput[];
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

function isReadinessGrade(value: string): value is ReadinessGrade {
  return VALID_READINESS_GRADES.includes(value);
}

function validateCreateNode(input: CreateNodeInput): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  // Title must be non-empty
  if (!input.title.trim()) {
    diagnostics.push({ field: 'title', message: 'title must be non-empty' });
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

// ---------------------------------------------------------------------------
// Edge validation
// ---------------------------------------------------------------------------

const VALID_CATEGORIES = schema.EDGE_CATEGORIES as unknown as string[];
const STANCE_REQUIRED_CATEGORIES = new Set(['proof', 'support']);
const VALID_STANCES = schema.EDGE_STANCES as unknown as string[];
const VALID_BASES = schema.NODE_BASES as unknown as string[];

interface ResolvedEdge {
  sourceId: number;
  targetId: number;
  category: EdgeCategory;
  stance: EdgeStance | null;
  rationale: string | null;
}

interface EdgeValidationResult {
  diagnostics: Diagnostic[];
  resolved?: ResolvedEdge;
}

function resolveExistingRefId(ref: { readonly existing: number }): number {
  return ref.existing;
}

function resolveEndpointRef(
  _db: Pick<BrunchDb, 'select'>,
  ref: BatchEdgeRef,
  specId: number,
  refMap: ReadonlyMap<string, number>,
  existingNodeIds: ReadonlySet<number>,
  crossSpecExisting: ReadonlySet<number>,
  field: string,
  diagnostics: Diagnostic[],
): number | undefined {
  if (typeof ref === 'string') {
    const id = refMap.get(ref);
    if (id === undefined) {
      diagnostics.push({ field, message: `unresolvable intra-batch ref "${ref}"` });
    }
    return id;
  }

  const id = resolveExistingRefId(ref);
  if (crossSpecExisting.has(id)) {
    diagnostics.push({
      field,
      message: `existing node ${id} belongs to a different spec (command spec ${specId})`,
    });
  } else if (!existingNodeIds.has(id)) {
    diagnostics.push({ field, message: `existing node ${id} not found` });
  }
  return id;
}

function addExistingRefId(
  _db: Pick<BrunchDb, 'select'>,
  ref: BatchEdgeRef,
  _specId: number,
  refs: Set<number>,
): void {
  if (typeof ref === 'string') return;
  refs.add(resolveExistingRefId(ref));
}

function findSupersessionCycle(
  db: Pick<BrunchDb, 'select'>,
  specId: number,
  proposedEdges: readonly ResolvedEdge[],
): Diagnostic | undefined {
  const supersessionEdges = proposedEdges.filter((edge) => edge.category === 'supersession');
  if (supersessionEdges.length === 0) return undefined;

  const adjacency = new Map<number, number[]>();
  const addEdge = (source: number, target: number) => {
    const targets = adjacency.get(source);
    if (targets) {
      targets.push(target);
    } else {
      adjacency.set(source, [target]);
    }
  };

  for (const edge of db
    .select({ sourceId: schema.edges.source_id, targetId: schema.edges.target_id })
    .from(schema.edges)
    .where(and(eq(schema.edges.spec_id, specId), eq(schema.edges.category, 'supersession')))
    .all()) {
    addEdge(edge.sourceId, edge.targetId);
  }
  for (const edge of supersessionEdges) {
    addEdge(edge.sourceId, edge.targetId);
  }

  const visiting = new Set<number>();
  const visited = new Set<number>();
  const hasCycle = (nodeId: number): boolean => {
    if (visiting.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;
    visiting.add(nodeId);
    for (const targetId of adjacency.get(nodeId) ?? []) {
      if (hasCycle(targetId)) return true;
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
    return false;
  };

  for (const nodeId of adjacency.keys()) {
    if (hasCycle(nodeId)) {
      return { field: 'edges', message: 'supersession edges must be acyclic within one spec' };
    }
  }
  return undefined;
}

function validateAndResolveBatchEdge(
  input: BatchEdgeInput,
  index: number,
  refMap: ReadonlyMap<string, number>,
  existingNodeIds: ReadonlySet<number>,
  crossSpecExisting: ReadonlySet<number>,
  db: Pick<BrunchDb, 'select'>,
  specId: number,
): EdgeValidationResult {
  const diagnostics: Diagnostic[] = [];
  const p = `edges[${index}]`;

  if (!VALID_CATEGORIES.includes(input.category)) {
    diagnostics.push({
      field: `${p}.category`,
      message: `"${input.category}" is not a valid edge category`,
    });
    return { diagnostics };
  }

  const stanceRequired = STANCE_REQUIRED_CATEGORIES.has(input.category);
  if (stanceRequired && input.stance == null) {
    diagnostics.push({
      field: `${p}.stance`,
      message: `stance is required for "${input.category}" edges`,
    });
  }
  if (!stanceRequired && input.stance != null) {
    diagnostics.push({
      field: `${p}.stance`,
      message: `stance is not allowed for "${input.category}" edges`,
    });
  }
  if (input.stance != null && !VALID_STANCES.includes(input.stance)) {
    diagnostics.push({
      field: `${p}.stance`,
      message: `"${input.stance}" is not a valid stance`,
    });
  }

  const resolvedSourceId = resolveEndpointRef(
    db,
    input.source,
    specId,
    refMap,
    existingNodeIds,
    crossSpecExisting,
    `${p}.source`,
    diagnostics,
  );
  const resolvedTargetId = resolveEndpointRef(
    db,
    input.target,
    specId,
    refMap,
    existingNodeIds,
    crossSpecExisting,
    `${p}.target`,
    diagnostics,
  );

  if (
    resolvedSourceId !== undefined &&
    resolvedTargetId !== undefined &&
    resolvedSourceId === resolvedTargetId
  ) {
    diagnostics.push({
      field: p,
      message: 'self-loop: source and target resolve to the same node',
    });
  }

  if (diagnostics.length > 0) return { diagnostics };

  return {
    diagnostics,
    resolved: {
      sourceId: resolvedSourceId!,
      targetId: resolvedTargetId!,
      category: input.category as EdgeCategory,
      stance: (input.stance as EdgeStance) ?? null,
      rationale: input.rationale ?? null,
    },
  };
}

/** Thrown inside a transaction to trigger rollback on edge validation failure. */
class BatchValidationError extends Error {
  constructor(readonly diagnostics: readonly Diagnostic[]) {
    super('batch validation failed');
  }
}

// ---------------------------------------------------------------------------
// CommandExecutor
// ---------------------------------------------------------------------------

export class CommandExecutor {
  constructor(private readonly db: BrunchDb) {}

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
      const clock = tx
        .update(schema.graphClock)
        .set({ lsn: sql`${schema.graphClock.lsn} + 1` })
        .where(eq(schema.graphClock.id, 1))
        .returning()
        .get();
      const lsn = clock!.lsn;

      const row = tx
        .insert(schema.specs)
        .values({ name, slug, readiness_grade: readinessGrade })
        .returning()
        .get();

      tx.insert(schema.changeLog)
        .values({
          lsn,
          operation: 'create_spec',
          payload: JSON.stringify({ specId: row!.id, name, slug, readinessGrade }),
        })
        .run();

      return { status: 'success' as const, specId: row!.id, lsn };
    });
  }

  /** Read a spec row by id. */
  getSpec(specId: number): SpecRecord | undefined {
    const row = this.db.select().from(schema.specs).where(eq(schema.specs.id, specId)).get();
    if (!row) return undefined;
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      readinessGrade: row.readiness_grade,
    };
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

      const clock = tx
        .update(schema.graphClock)
        .set({ lsn: sql`${schema.graphClock.lsn} + 1` })
        .where(eq(schema.graphClock.id, 1))
        .returning()
        .get();
      const lsn = clock!.lsn;

      tx.update(schema.specs)
        .set({ readiness_grade: input.readinessGrade })
        .where(eq(schema.specs.id, input.specId))
        .run();

      tx.insert(schema.changeLog)
        .values({
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

      // 2. Allocate LSN (atomic increment)
      const clock = tx
        .update(schema.graphClock)
        .set({ lsn: sql`${schema.graphClock.lsn} + 1` })
        .where(eq(schema.graphClock.id, 1))
        .returning()
        .get();
      const lsn = clock!.lsn;
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
    const diagnostics = this.validateCommitGraphInput(input);
    return diagnostics.length > 0 ? { status: 'structural_illegal', diagnostics } : { status: 'success' };
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
    const diagnostics = this.validateCommitGraphInput(input);
    if (diagnostics.length > 0) {
      return { status: 'structural_illegal', diagnostics };
    }

    // --- Transaction: insert nodes, resolve refs, validate + insert edges ---
    try {
      return this.db.transaction((tx) => {
        // 1. Verify spec exists
        const specRow = tx
          .select({ id: schema.specs.id })
          .from(schema.specs)
          .where(eq(schema.specs.id, input.specId))
          .get();
        if (!specRow) {
          throw new BatchValidationError([
            { field: 'specId', message: `spec ${input.specId} does not exist` },
          ]);
        }

        // 2. Allocate ONE LSN
        const clock = tx
          .update(schema.graphClock)
          .set({ lsn: sql`${schema.graphClock.lsn} + 1` })
          .where(eq(schema.graphClock.id, 1))
          .returning()
          .get();
        const lsn = clock!.lsn;

        // 3. Insert all nodes, build ref → id map
        const refMap = new Map<string, number>();
        const nodeCodeMap = new Map<string, string>();
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
          refMap.set(bn.ref, row!.id);
          nodeCodeMap.set(bn.ref, formatGraphNodeCode(row!.kind as NodeKind, row!.kind_ordinal));
        }

        // 4. Collect and verify existing-node references — must be same spec
        const existingRefs = new Set<number>();
        for (const edge of input.edges) {
          addExistingRefId(tx, edge.source, input.specId, existingRefs);
          addExistingRefId(tx, edge.target, input.specId, existingRefs);
        }

        const verifiedExisting = new Set<number>();
        const crossSpecExisting = new Set<number>();
        if (existingRefs.size > 0) {
          const rows = tx
            .select({ id: schema.nodes.id, spec_id: schema.nodes.spec_id })
            .from(schema.nodes)
            .where(inArray(schema.nodes.id, [...existingRefs]))
            .all();
          for (const row of rows) {
            if (row.spec_id === input.specId) {
              verifiedExisting.add(row.id);
            } else {
              crossSpecExisting.add(row.id);
            }
          }
        }

        // 5. Validate and resolve all edges
        const edgeDiagnostics: Diagnostic[] = [];
        const resolvedEdges: ResolvedEdge[] = [];

        for (let i = 0; i < input.edges.length; i++) {
          const result = validateAndResolveBatchEdge(
            input.edges[i]!,
            i,
            refMap,
            verifiedExisting,
            crossSpecExisting,
            tx,
            input.specId,
          );
          edgeDiagnostics.push(...result.diagnostics);
          if (result.resolved) resolvedEdges.push(result.resolved);
        }

        if (edgeDiagnostics.length > 0) {
          throw new BatchValidationError(edgeDiagnostics);
        }

        const cycleDiagnostic = findSupersessionCycle(tx, input.specId, resolvedEdges);
        if (cycleDiagnostic) {
          throw new BatchValidationError([cycleDiagnostic]);
        }

        // 6. Insert all edges
        const edgeIds: number[] = [];
        for (const re of resolvedEdges) {
          const row = tx
            .insert(schema.edges)
            .values({
              spec_id: input.specId,
              category: re.category,
              source_id: re.sourceId,
              target_id: re.targetId,
              stance: re.stance,
              basis: input.basis ?? 'explicit',
              rationale: re.rationale,
              created_at_lsn: lsn,
              updated_at_lsn: lsn,
            })
            .returning()
            .get();
          edgeIds.push(row!.id);
        }

        // 7. Append one change_log entry for the entire batch
        tx.insert(schema.changeLog)
          .values({
            lsn,
            operation: 'commit_graph',
            payload: JSON.stringify({
              basis: input.basis ?? 'explicit',
              specId: input.specId,
              nodes: Object.fromEntries(refMap),
              edges: edgeIds,
            }),
          })
          .run();

        return {
          status: 'success' as const,
          lsn,
          nodes: Object.fromEntries(refMap),
          nodeCodes: Object.fromEntries(nodeCodeMap),
          edges: edgeIds,
        };
      });
    } catch (e) {
      if (e instanceof BatchValidationError) {
        return { status: 'structural_illegal', diagnostics: e.diagnostics };
      }
      throw e;
    }
  }

  private validateCommitGraphInput(input: CommitGraphInput): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    if (input.nodes.length === 0 && input.edges.length === 0) {
      diagnostics.push({ field: 'batch', message: 'empty batch — nothing to commit' });
      return diagnostics;
    }
    if (input.basis != null && !VALID_BASES.includes(input.basis)) {
      diagnostics.push({
        field: 'basis',
        message: `"${String(input.basis)}" is not a valid graph approval basis`,
      });
    }

    const specRow = this.db
      .select({ id: schema.specs.id })
      .from(schema.specs)
      .where(eq(schema.specs.id, input.specId))
      .get();
    if (!specRow) {
      diagnostics.push({ field: 'specId', message: `spec ${input.specId} does not exist` });
      return diagnostics;
    }

    const refMap = new Map<string, number>();
    for (let i = 0; i < input.nodes.length; i++) {
      const bn = input.nodes[i]!;
      if (refMap.has(bn.ref)) {
        diagnostics.push({
          field: `nodes[${i}].ref`,
          message: `duplicate batch ref "${bn.ref}"`,
        });
      }
      refMap.set(bn.ref, -(i + 1));

      // Node validation reuses createNode rules; specId comes from the batch.
      for (const diagnostic of validateCreateNode({ ...bn, specId: input.specId })) {
        diagnostics.push({
          field: `nodes[${i}].${diagnostic.field}`,
          message: diagnostic.message,
        });
      }
    }
    if (diagnostics.length > 0) return diagnostics;

    const existingRefs = new Set<number>();
    for (const edge of input.edges) {
      addExistingRefId(this.db, edge.source, input.specId, existingRefs);
      addExistingRefId(this.db, edge.target, input.specId, existingRefs);
    }

    const verifiedExisting = new Set<number>();
    const crossSpecExisting = new Set<number>();
    if (existingRefs.size > 0) {
      const rows = this.db
        .select({ id: schema.nodes.id, spec_id: schema.nodes.spec_id })
        .from(schema.nodes)
        .where(inArray(schema.nodes.id, [...existingRefs]))
        .all();
      for (const row of rows) {
        if (row.spec_id === input.specId) {
          verifiedExisting.add(row.id);
        } else {
          crossSpecExisting.add(row.id);
        }
      }
    }

    for (let i = 0; i < input.edges.length; i++) {
      diagnostics.push(
        ...validateAndResolveBatchEdge(
          input.edges[i]!,
          i,
          refMap,
          verifiedExisting,
          crossSpecExisting,
          this.db,
          input.specId,
        ).diagnostics,
      );
    }
    return diagnostics;
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

      // Allocate LSN
      const clock = tx
        .update(schema.graphClock)
        .set({ lsn: sql`${schema.graphClock.lsn} + 1` })
        .where(eq(schema.graphClock.id, 1))
        .returning()
        .get();
      const lsn = clock!.lsn;

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

      // Allocate LSN
      const clock = tx
        .update(schema.graphClock)
        .set({ lsn: sql`${schema.graphClock.lsn} + 1` })
        .where(eq(schema.graphClock.id, 1))
        .returning()
        .get();
      const lsn = clock!.lsn;

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
          lsn,
          operation: 'resolve_reconciliation_need',
          payload: JSON.stringify({ id: input.id, specId: input.specId }),
        })
        .run();

      return { status: 'success' as const, lsn };
    });
  }
}
