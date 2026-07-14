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
import type {
  AcceptReviewSetDryRunResult,
  AcceptReviewSetInput,
  AcceptReviewSetResult,
  AcknowledgeEdgeRevalidationInput,
  AcknowledgeEdgeRevalidationResult,
  CreateNodeInput,
  CreateNodeResult,
  CreateReconNeedInput,
  CreateReconNeedResult,
  CreateSpecInput,
  CreateSpecResult,
  EstablishSpecPostureInput,
  EstablishSpecPostureResult,
  ResolveReconNeedInput,
  ResolveReconNeedResult,
  SpecRecord,
} from './command-executor/command-types.js';
import {
  validateCreateNode,
  validateEdgePatch,
  validateNodePatchAgainstExisting,
} from './command-executor/command-validation.js';
import { planGraphMutation } from './command-executor/graph-mutation-planner.js';
import type {
  Diagnostic,
  MutateGraphDryRunResult,
  MutateGraphInput,
  MutateGraphResult,
  StructuralIllegal,
} from './command-executor/graph-mutation-types.js';
import { writeGraphMutation } from './command-executor/graph-mutation-writer.js';
import {
  assignProposedReviewSetCodes,
  proposedReviewSetCodeDiagnostics,
  translateReviewSetPayloadToMutateGraph,
  type ReviewSetProposalPayload,
} from './review-set.js';
import { type NodePlane } from './schema/nodes.js';
import { RECONCILIATION_NEED_KINDS } from './schema/reconciliation-need.js';

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
export type { RoleNamedEdgeDraft, RoleNamedEdgeDraftOf } from './command-executor/role-named-edge-draft.js';
export type {
  AcceptReviewSetDryRunResult,
  AcceptReviewSetInput,
  AcceptReviewSetResult,
  AcknowledgeEdgeRevalidationInput,
  AcknowledgeEdgeRevalidationResult,
  CommandResult,
  CreateNodeInput,
  CreateNodeResult,
  CreateReconNeedInput,
  CreateReconNeedResult,
  CreateSpecInput,
  CreateSpecResult,
  EstablishSpecPostureInput,
  EstablishSpecPostureResult,
  ResolveReconNeedInput,
  ResolveReconNeedResult,
  SpecRecord,
} from './command-executor/command-types.js';

function specRecordFromRow(row: typeof schema.specs.$inferSelect): SpecRecord {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    kind: row.kind,
    origin: row.origin,
    relatesToSpecId: row.relates_to_spec_id,
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

  /** Create a spec row through the command boundary. */
  createSpec(input: CreateSpecInput): CreateSpecResult {
    const diagnostics: Diagnostic[] = [];
    const name = input.name.trim();
    const slug = input.slug.trim();
    const kind = input.kind ?? 'product';
    const origin = input.origin ?? null;
    const relatesToSpecId = input.relatesToSpecId ?? null;

    if (!name) diagnostics.push({ field: 'name', message: 'name must be non-empty' });
    if (!slug) diagnostics.push({ field: 'slug', message: 'slug must be non-empty' });
    if (diagnostics.length > 0) return { status: 'structural_illegal', diagnostics };

    return this.db.transaction((tx) => {
      const row = tx
        .insert(schema.specs)
        .values({ name, slug, kind, origin, relates_to_spec_id: relatesToSpecId })
        .returning()
        .get();

      const lsn = this.createInitialSpecClock(tx, row!.id);

      tx.insert(schema.changeLog)
        .values({
          spec_id: row!.id,
          lsn,
          operation: 'create_spec',
          payload: JSON.stringify({ specId: row!.id, name, slug, kind, origin, relatesToSpecId }),
        })
        .run();

      return { status: 'success' as const, specId: row!.id, lsn };
    });
  }

  /**
   * One-time posture establishment on an existing spec (D118-L resume half):
   * confirms origin (and optionally kind / relates-to) on a spec whose
   * posture is still unestablished (`origin: null`). Establish-once — an
   * already-established spec is refused, mirroring the dialog's never-re-ask
   * rule at the command boundary.
   */
  establishSpecPosture(input: EstablishSpecPostureInput): EstablishSpecPostureResult {
    return this.db.transaction((tx) => {
      const spec = tx
        .select({ id: schema.specs.id, origin: schema.specs.origin })
        .from(schema.specs)
        .where(eq(schema.specs.id, input.specId))
        .get();
      if (!spec) {
        return {
          status: 'structural_illegal' as const,
          diagnostics: [{ field: 'specId', message: `spec ${input.specId} does not exist` }],
        };
      }
      if (spec.origin !== null) {
        return {
          status: 'structural_illegal' as const,
          diagnostics: [
            {
              field: 'origin',
              message: `spec ${input.specId} posture is already established (origin: ${spec.origin})`,
            },
          ],
        };
      }

      const lsn = this.bumpExistingSpecLsn(tx, input.specId);

      tx.update(schema.specs)
        .set({
          origin: input.origin,
          ...(input.kind !== undefined ? { kind: input.kind } : {}),
          ...(input.relatesToSpecId !== undefined ? { relates_to_spec_id: input.relatesToSpecId } : {}),
        })
        .where(eq(schema.specs.id, input.specId))
        .run();

      tx.insert(schema.changeLog)
        .values({
          spec_id: input.specId,
          lsn,
          operation: 'establish_spec_posture',
          payload: JSON.stringify({
            specId: input.specId,
            origin: input.origin,
            kind: input.kind ?? null,
            relatesToSpecId: input.relatesToSpecId ?? null,
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
          settlement: input.settlement ?? 'settled',
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

  assignProposedReviewSetCodes(input: {
    readonly specId: number;
    readonly payload: unknown;
  }): ReviewSetProposalPayload | StructuralIllegal {
    return assignProposedReviewSetCodes({ db: this.db, specId: input.specId, payload: input.payload });
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
      const proposedCodeDiagnostics = proposedReviewSetCodeDiagnostics({
        db: tx,
        specId: input.specId,
        payload: translated.payload,
      });
      if (proposedCodeDiagnostics.length > 0) {
        return { status: 'structural_illegal' as const, diagnostics: proposedCodeDiagnostics };
      }

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

      // Trust boundary: needKind arrives from agent tool input. Pin it to the
      // persisted judgment kinds — edge_revalidation is derived, not persisted.
      if (!(RECONCILIATION_NEED_KINDS as readonly string[]).includes(input.needKind)) {
        diagnostics.push({
          field: 'needKind',
          message: `unknown reconciliation need kind: ${input.needKind} (accepted: ${RECONCILIATION_NEED_KINDS.join(', ')})`,
        });
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

  /**
   * Acknowledge a derived `edge_revalidation` staleness signal.
   *
   * Bumps the target edge's `acknowledged_lsn` watermark to a freshly allocated
   * spec LSN — the first and only write in the reconciliation-derivation
   * frontier, structurally separate from the read-only derivation. Idempotent:
   * re-acknowledging advances the watermark to a fresh, higher LSN and leaves the
   * edge cleared. A general graph command like `resolveReconciliationNeed`; it
   * carries no reviewer-agent authority (I16-L stays as-is).
   */
  acknowledgeEdgeRevalidation(input: AcknowledgeEdgeRevalidationInput): AcknowledgeEdgeRevalidationResult {
    return this.db.transaction((tx) => {
      const edge = tx
        .select({ id: schema.edges.id, spec_id: schema.edges.spec_id })
        .from(schema.edges)
        .where(eq(schema.edges.id, input.edgeId))
        .get();
      if (!edge) {
        return {
          status: 'structural_illegal' as const,
          diagnostics: [{ field: 'edgeId', message: `edge ${input.edgeId} does not exist` }],
        };
      }
      if (edge.spec_id !== input.specId) {
        return {
          status: 'structural_illegal' as const,
          diagnostics: [
            {
              field: 'edgeId',
              message: `edge ${input.edgeId} belongs to a different spec (command spec ${input.specId})`,
            },
          ],
        };
      }

      const lsn = this.bumpExistingSpecLsn(tx, input.specId);

      tx.update(schema.edges).set({ acknowledged_lsn: lsn }).where(eq(schema.edges.id, input.edgeId)).run();

      tx.insert(schema.changeLog)
        .values({
          spec_id: input.specId,
          lsn,
          operation: 'acknowledge_edge_revalidation',
          payload: JSON.stringify({ edgeId: input.edgeId, specId: input.specId }),
        })
        .run();

      return { status: 'success' as const, lsn };
    });
  }
}
