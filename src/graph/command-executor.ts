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

import { and, eq, sql } from 'drizzle-orm';

import type { BrunchDb } from '../db/connection.js';
import * as schema from '../db/schema.js';
import {
  formatCreatedGraphNode,
  planCommitGraphBatch,
  type PlannedBatchEndpoint,
} from './command-executor/commit-graph-batch.js';
import type {
  CommitGraphDryRunResult,
  CommitGraphInput,
  CommitGraphResult,
  CommitGraphSuccess,
  Diagnostic,
  StructuralIllegal,
} from './command-executor/commit-graph-types.js';
import { type NodeBasis, type NodePlane } from './schema/nodes.js';

export type ReadinessGrade = (typeof schema.READINESS_GRADES)[number];
export type {
  BatchEdgeInput,
  BatchEdgeRef,
  BatchNodeInput,
  CommitGraphDryRunResult,
  CommitGraphInput,
  CommitGraphResult,
  CommitGraphSuccess,
  CreatedGraphNodeResult,
  CreatedGraphNodes,
  Diagnostic,
  DryRunSuccess,
  StructuralIllegal,
} from './command-executor/commit-graph-types.js';

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

/** Successful command execution. */
export interface CommandSuccess {
  readonly status: 'success';
  readonly nodeId: number;
  readonly lsn: number;
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

function isReadinessGrade(value: string): value is ReadinessGrade {
  return VALID_READINESS_GRADES.includes(value);
}

function isNodeBasis(value: string): value is NodeBasis {
  return VALID_NODE_BASES.includes(value);
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
    const result = this.planCommitGraph(input, this.db);
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

      const clock = tx
        .update(schema.graphClock)
        .set({ lsn: sql`${schema.graphClock.lsn} + 1` })
        .where(eq(schema.graphClock.id, 1))
        .returning()
        .get();
      const lsn = clock!.lsn;

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
      for (const edge of planned.plan.edges) {
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
          lsn,
          operation: 'commit_graph',
          payload: JSON.stringify({
            basis: input.basis ?? 'explicit',
            specId: input.specId,
            nodes: Object.fromEntries(Object.entries(createdNodes).map(([ref, node]) => [ref, node.id])),
            edges: edgeIds,
          }),
        })
        .run();

      return {
        status: 'success' as const,
        lsn,
        createdNodes,
        edges: edgeIds,
      };
    });
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
