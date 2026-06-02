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

import { eq, inArray, sql } from 'drizzle-orm';

import type { BrunchDb } from '../db/connection.js';
import * as schema from '../db/schema.js';
import type { EdgeCategory, EdgeStance } from './schema/edges.js';
import type { NodeBasis, NodePlane } from './schema/nodes.js';

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
  readonly edges: readonly number[];
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

/** Union of all possible command results. */
export type CommandResult =
  | CommandSuccess
  | CommitGraphSuccess
  | ReconNeedSuccess
  | ReconNeedResolveSuccess
  | StructuralIllegal
  | NeedsHuman
  | PolicyBlocked
  | VersionConflict;

/** Result of a createNode command. */
export type CreateNodeResult = CommandSuccess | StructuralIllegal;

/** Result of a commitGraph command. */
export type CommitGraphResult = CommitGraphSuccess | StructuralIllegal;

/** Result of a createReconciliationNeed command. */
export type CreateReconNeedResult = ReconNeedSuccess | StructuralIllegal;

/** Result of a resolveReconciliationNeed command. */
export type ResolveReconNeedResult = ReconNeedResolveSuccess | StructuralIllegal;

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

/** Input for creating a single graph node. */
export interface CreateNodeInput {
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
  readonly target: ReconNeedTarget;
  readonly needKind: string;
  readonly reason?: string | undefined;
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
  readonly basis?: NodeBasis | undefined;
  readonly source?: string | undefined;
  readonly detail?: unknown;
}

/** An edge to create inside a commitGraph batch. */
export interface BatchEdgeInput {
  readonly category: string;
  readonly source: BatchEdgeRef;
  readonly target: BatchEdgeRef;
  readonly stance?: string | undefined;
  readonly basis?: NodeBasis | undefined;
  readonly rationale?: string | undefined;
}

/** Input for the commitGraph atomic batch mutation. */
export interface CommitGraphInput {
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

interface ResolvedEdge {
  sourceId: number;
  targetId: number;
  category: EdgeCategory;
  stance: EdgeStance | null;
  basis: NodeBasis;
  rationale: string | null;
}

interface EdgeValidationResult {
  diagnostics: Diagnostic[];
  resolved?: ResolvedEdge;
}

function validateAndResolveBatchEdge(
  input: BatchEdgeInput,
  index: number,
  refMap: ReadonlyMap<string, number>,
  existingNodeIds: ReadonlySet<number>,
): EdgeValidationResult {
  const diagnostics: Diagnostic[] = [];
  const p = `edges[${index}]`;

  // Category must be in the closed set
  if (!VALID_CATEGORIES.includes(input.category)) {
    diagnostics.push({
      field: `${p}.category`,
      message: `"${input.category}" is not a valid edge category`,
    });
    return { diagnostics };
  }

  // Stance: required iff proof/support, invalid otherwise
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

  // Resolve source ref
  let resolvedSourceId: number | undefined;
  if (typeof input.source === 'string') {
    resolvedSourceId = refMap.get(input.source);
    if (resolvedSourceId === undefined) {
      diagnostics.push({
        field: `${p}.source`,
        message: `unresolvable intra-batch ref "${input.source}"`,
      });
    }
  } else {
    resolvedSourceId = input.source.existing;
    if (!existingNodeIds.has(resolvedSourceId)) {
      diagnostics.push({
        field: `${p}.source`,
        message: `existing node ${resolvedSourceId} not found`,
      });
    }
  }

  // Resolve target ref
  let resolvedTargetId: number | undefined;
  if (typeof input.target === 'string') {
    resolvedTargetId = refMap.get(input.target);
    if (resolvedTargetId === undefined) {
      diagnostics.push({
        field: `${p}.target`,
        message: `unresolvable intra-batch ref "${input.target}"`,
      });
    }
  } else {
    resolvedTargetId = input.target.existing;
    if (!existingNodeIds.has(resolvedTargetId)) {
      diagnostics.push({
        field: `${p}.target`,
        message: `existing node ${resolvedTargetId} not found`,
      });
    }
  }

  // Self-loop check (only if both resolved)
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
      basis: (input.basis as NodeBasis) ?? 'explicit',
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

  /**
   * Create a single graph node.
   *
   * Validates structurally, then executes inside one transaction:
   * allocate LSN → insert node → append change_log → return result.
   *
   * On validation failure, nothing is written.
   */
  createNode(input: CreateNodeInput): CreateNodeResult {
    const diagnostics = validateCreateNode(input);
    if (diagnostics.length > 0) {
      return { status: 'structural_illegal', diagnostics };
    }

    return this.db.transaction((tx) => {
      // 1. Allocate LSN (atomic increment)
      const clock = tx
        .update(schema.graphClock)
        .set({ lsn: sql`${schema.graphClock.lsn} + 1` })
        .where(eq(schema.graphClock.id, 1))
        .returning()
        .get();
      const lsn = clock!.lsn;

      // 2. Insert node
      const node = tx
        .insert(schema.nodes)
        .values({
          plane: input.plane,
          kind: input.kind,
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

      // 3. Append change_log
      tx.insert(schema.changeLog)
        .values({
          lsn,
          operation: 'create_node',
          payload: JSON.stringify({
            nodeId,
            plane: input.plane,
            kind: input.kind,
          }),
        })
        .run();

      return { status: 'success' as const, nodeId, lsn };
    });
  }

  /**
   * Atomic batch creation of nodes and edges (D53-L).
   *
   * One transaction, one LSN. Intra-batch refs (strings) resolve to
   * just-inserted NodeIds; existing refs ({ existing: id }) are verified
   * against the database. All-or-nothing: if any entry fails structural
   * validation, the entire batch is rejected (I34-L).
   */
  commitGraph(input: CommitGraphInput): CommitGraphResult {
    // Empty batch is structural_illegal
    if (input.nodes.length === 0 && input.edges.length === 0) {
      return {
        status: 'structural_illegal',
        diagnostics: [{ field: 'batch', message: 'empty batch — nothing to commit' }],
      };
    }

    // --- Pre-transaction: validate all batch nodes (pure checks) ---
    const preDiagnostics: Diagnostic[] = [];
    const seenRefs = new Set<string>();

    for (let i = 0; i < input.nodes.length; i++) {
      const bn = input.nodes[i]!;

      // Duplicate ref check
      if (seenRefs.has(bn.ref)) {
        preDiagnostics.push({
          field: `nodes[${i}].ref`,
          message: `duplicate batch ref "${bn.ref}"`,
        });
      }
      seenRefs.add(bn.ref);

      // Structural node validation (reuse)
      for (const d of validateCreateNode(bn)) {
        preDiagnostics.push({
          field: `nodes[${i}].${d.field}`,
          message: d.message,
        });
      }
    }

    if (preDiagnostics.length > 0) {
      return { status: 'structural_illegal', diagnostics: preDiagnostics };
    }

    // --- Transaction: insert nodes, resolve refs, validate + insert edges ---
    try {
      return this.db.transaction((tx) => {
        // 1. Allocate ONE LSN
        const clock = tx
          .update(schema.graphClock)
          .set({ lsn: sql`${schema.graphClock.lsn} + 1` })
          .where(eq(schema.graphClock.id, 1))
          .returning()
          .get();
        const lsn = clock!.lsn;

        // 2. Insert all nodes, build ref → id map
        const refMap = new Map<string, number>();
        for (const bn of input.nodes) {
          const row = tx
            .insert(schema.nodes)
            .values({
              plane: bn.plane,
              kind: bn.kind,
              title: bn.title,
              body: bn.body ?? null,
              basis: bn.basis ?? 'explicit',
              source: bn.source ?? null,
              detail: bn.detail != null ? JSON.stringify(bn.detail) : null,
              created_at_lsn: lsn,
              updated_at_lsn: lsn,
            })
            .returning()
            .get();
          refMap.set(bn.ref, row!.id);
        }

        // 3. Collect and verify existing-node references
        const existingRefs = new Set<number>();
        for (const edge of input.edges) {
          if (typeof edge.source !== 'string') existingRefs.add(edge.source.existing);
          if (typeof edge.target !== 'string') existingRefs.add(edge.target.existing);
        }

        const verifiedExisting = new Set<number>();
        if (existingRefs.size > 0) {
          const rows = tx
            .select({ id: schema.nodes.id })
            .from(schema.nodes)
            .where(inArray(schema.nodes.id, [...existingRefs]))
            .all();
          for (const row of rows) verifiedExisting.add(row.id);
        }

        // 4. Validate and resolve all edges
        const edgeDiagnostics: Diagnostic[] = [];
        const resolvedEdges: ResolvedEdge[] = [];

        for (let i = 0; i < input.edges.length; i++) {
          const result = validateAndResolveBatchEdge(input.edges[i]!, i, refMap, verifiedExisting);
          edgeDiagnostics.push(...result.diagnostics);
          if (result.resolved) resolvedEdges.push(result.resolved);
        }

        if (edgeDiagnostics.length > 0) {
          throw new BatchValidationError(edgeDiagnostics);
        }

        // 5. Insert all edges
        const edgeIds: number[] = [];
        for (const re of resolvedEdges) {
          const row = tx
            .insert(schema.edges)
            .values({
              category: re.category,
              source_id: re.sourceId,
              target_id: re.targetId,
              stance: re.stance,
              basis: re.basis,
              rationale: re.rationale,
              created_at_lsn: lsn,
              updated_at_lsn: lsn,
            })
            .returning()
            .get();
          edgeIds.push(row!.id);
        }

        // 6. Append one change_log entry for the entire batch
        tx.insert(schema.changeLog)
          .values({
            lsn,
            operation: 'commit_graph',
            payload: JSON.stringify({
              nodes: Object.fromEntries(refMap),
              edges: edgeIds,
            }),
          })
          .run();

        return {
          status: 'success' as const,
          lsn,
          nodes: Object.fromEntries(refMap),
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

  /**
   * Create a reconciliation need.
   *
   * Validates that the target (edge or node pair) exists, then inserts
   * inside one transaction with LSN allocation and change_log append.
   */
  createReconciliationNeed(input: CreateReconNeedInput): CreateReconNeedResult {
    // Validate target references exist
    return this.db.transaction((tx) => {
      const diagnostics: Diagnostic[] = [];

      if (input.target.kind === 'edge') {
        const row = tx
          .select({ id: schema.edges.id })
          .from(schema.edges)
          .where(eq(schema.edges.id, input.target.edgeId))
          .get();
        if (!row) {
          diagnostics.push({
            field: 'target.edgeId',
            message: `edge ${input.target.edgeId} does not exist`,
          });
        }
      } else {
        const aRow = tx
          .select({ id: schema.nodes.id })
          .from(schema.nodes)
          .where(eq(schema.nodes.id, input.target.aId))
          .get();
        if (!aRow) {
          diagnostics.push({
            field: 'target.aId',
            message: `node ${input.target.aId} does not exist`,
          });
        }
        const bRow = tx
          .select({ id: schema.nodes.id })
          .from(schema.nodes)
          .where(eq(schema.nodes.id, input.target.bId))
          .get();
        if (!bRow) {
          diagnostics.push({
            field: 'target.bId',
            message: `node ${input.target.bId} does not exist`,
          });
        }
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
  resolveReconciliationNeed(id: number): ResolveReconNeedResult {
    return this.db.transaction((tx) => {
      const existing = tx
        .select()
        .from(schema.reconciliationNeed)
        .where(eq(schema.reconciliationNeed.id, id))
        .get();

      if (!existing) {
        return {
          status: 'structural_illegal' as const,
          diagnostics: [
            {
              field: 'id',
              message: `reconciliation need ${id} does not exist`,
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
              message: `reconciliation need ${id} is already resolved`,
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
        .where(eq(schema.reconciliationNeed.id, id))
        .run();

      // Append change_log
      tx.insert(schema.changeLog)
        .values({
          lsn,
          operation: 'resolve_reconciliation_need',
          payload: JSON.stringify({ id }),
        })
        .run();

      return { status: 'success' as const, lsn };
    });
  }
}
