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
  CreateElicitationGapInput,
  CreateElicitationGapResult,
  CreateNodeInput,
  CreateNodeResult,
  CreateReconNeedInput,
  CreateReconNeedResult,
  CreateSpecInput,
  CreateSpecResult,
  RepairSeededElicitationGapsResult,
  RepairSeededElicitationGapsSpecResult,
  ResolveReconNeedInput,
  ResolveReconNeedResult,
  SetElicitationGapDispositionInput,
  SetElicitationGapDispositionResult,
  SpecRecord,
} from './command-executor/command-types.js';
import {
  isGapDisposition,
  validateCreateElicitationGap,
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
} from './command-executor/graph-mutation-types.js';
import { writeGraphMutation } from './command-executor/graph-mutation-writer.js';
import { translateReviewSetPayloadToMutateGraph } from './review-set.js';
import type { ElicitationGapLensAffinity, GapPredicate } from './schema/elicitation-gaps.js';
import { type NodeBasis, type NodeKind, type NodePlane, type ReadinessBand } from './schema/nodes.js';

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
export type {
  AcceptReviewSetDryRunResult,
  AcceptReviewSetInput,
  AcceptReviewSetResult,
  CommandResult,
  CreateElicitationGapInput,
  CreateElicitationGapResult,
  CreateNodeInput,
  CreateNodeResult,
  CreateReconNeedInput,
  CreateReconNeedResult,
  CreateSpecInput,
  CreateSpecResult,
  RepairSeededElicitationGapsResult,
  RepairSeededElicitationGapsSpecResult,
  ResolveReconNeedInput,
  ResolveReconNeedResult,
  SetElicitationGapDispositionInput,
  SetElicitationGapDispositionResult,
  SpecRecord,
} from './command-executor/command-types.js';

// ---------------------------------------------------------------------------
// Seeded elicitation gaps
// ---------------------------------------------------------------------------

const SEEDED_ELICITATION_GAPS: readonly {
  readonly refersTo: NodeKind;
  readonly question: string;
  readonly rationale: string;
  readonly basis: NodeBasis;
  readonly band: ReadinessBand;
  readonly predicate: GapPredicate;
  readonly importance: number;
  readonly planeAffinity: NodePlane;
  readonly lensAffinity: ElicitationGapLensAffinity;
}[] = [
  {
    refersTo: 'context',
    question: 'What kind of thing is this, and what domain or environment does it live in?',
    rationale: 'Anchors what kind of thing is being specified and the domain it belongs to.',
    basis: 'implicit',
    band: 'grounding',
    predicate: { kind: 'presence', plane: 'intent', nodeKind: 'context', minimum: 1 },
    importance: 3,
    planeAffinity: 'intent',
    lensAffinity: 'intent',
  },
  {
    refersTo: 'context',
    question: 'Is this new-from-scratch, a brownfield codebase, or a continuation of a prior thread?',
    rationale:
      'Situates the opening acquisition route: new-from-scratch usually starts with elicit-by-question or ingest-paste; brownfield codebase usually starts with explore-and-characterize or read-referenced-documents; continuation of a prior thread usually starts by ingesting paste or reading referenced documents before capture.',
    basis: 'implicit',
    band: 'grounding',
    predicate: {
      kind: 'manual',
      rubric: 'The opening orientation is clear enough to choose an acquisition mode.',
    },
    importance: 3,
    planeAffinity: 'intent',
    lensAffinity: 'intent',
  },
  {
    refersTo: 'thesis',
    question: 'Who is this for, and what pull or pain makes it worth doing?',
    rationale: 'Identifies the primary audience and why the work matters for them.',
    basis: 'implicit',
    band: 'grounding',
    predicate: { kind: 'presence', plane: 'intent', nodeKind: 'thesis', minimum: 1 },
    importance: 3,
    planeAffinity: 'intent',
    lensAffinity: 'intent',
  },
  {
    refersTo: 'goal',
    question: 'What outcome or value should this create?',
    rationale: 'Clarifies the desired outcome or payoff the work should create.',
    basis: 'implicit',
    band: 'grounding',
    predicate: { kind: 'presence', plane: 'intent', nodeKind: 'goal', minimum: 1 },
    importance: 3,
    planeAffinity: 'intent',
    lensAffinity: 'intent',
  },
  {
    refersTo: 'constraint',
    question: 'What binding constraints, non-goals, or boundaries already shape the work?',
    rationale: 'Captures binding constraints or non-negotiable boundaries already shaping the work.',
    basis: 'implicit',
    band: 'grounding',
    predicate: { kind: 'presence', plane: 'intent', nodeKind: 'constraint', minimum: 1 },
    importance: 3,
    planeAffinity: 'intent',
    lensAffinity: 'intent',
  },
  {
    refersTo: 'term',
    question: 'What key word or domain term needs a shared definition?',
    rationale: 'Pins ubiquitous language before naming drift becomes specification ambiguity.',
    basis: 'implicit',
    band: 'grounding',
    predicate: { kind: 'presence', plane: 'intent', nodeKind: 'term', minimum: 1 },
    importance: 1,
    planeAffinity: 'intent',
    lensAffinity: 'intent',
  },
  {
    refersTo: 'assumption',
    question: 'What are we assuming that might be false?',
    rationale: 'Surfaces early bets and fragility without turning them into hidden readiness gates.',
    basis: 'implicit',
    band: 'grounding',
    predicate: { kind: 'presence', plane: 'intent', nodeKind: 'assumption', minimum: 1 },
    importance: 1,
    planeAffinity: 'intent',
    lensAffinity: 'intent',
  },
] as const;

function seededElicitationGapKey(seed: {
  readonly refersTo: string;
  readonly question: string;
  readonly predicateKind: string;
}): string {
  return `${seed.refersTo}\u0000${seed.predicateKind}\u0000${seed.question}`;
}

function specRecordFromRow(row: typeof schema.specs.$inferSelect): SpecRecord {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
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

  private seededElicitationGapRows(
    entries: readonly (typeof SEEDED_ELICITATION_GAPS)[number][],
    specId: number,
    lsn: number,
  ) {
    return entries.map((entry) => ({
      spec_id: specId,
      refers_to: entry.refersTo,
      question: entry.question,
      rationale: entry.rationale,
      basis: entry.basis,
      readiness_band: entry.band,
      predicate_kind: entry.predicate.kind,
      predicate: JSON.stringify(entry.predicate),
      importance: entry.importance,
      plane_affinity: entry.planeAffinity,
      lens_affinity: entry.lensAffinity,
      created_at_lsn: lsn,
    }));
  }

  private seedElicitationGaps(tx: Pick<BrunchDb, 'insert'>, specId: number, lsn: number): void {
    tx.insert(schema.elicitationGaps)
      .values(this.seededElicitationGapRows(SEEDED_ELICITATION_GAPS, specId, lsn))
      .run();
  }

  /** Create a spec row through the command boundary. */
  createSpec(input: CreateSpecInput): CreateSpecResult {
    const diagnostics: Diagnostic[] = [];
    const name = input.name.trim();
    const slug = input.slug.trim();

    if (!name) diagnostics.push({ field: 'name', message: 'name must be non-empty' });
    if (!slug) diagnostics.push({ field: 'slug', message: 'slug must be non-empty' });
    if (diagnostics.length > 0) return { status: 'structural_illegal', diagnostics };

    return this.db.transaction((tx) => {
      const row = tx.insert(schema.specs).values({ name, slug }).returning().get();

      const lsn = this.createInitialSpecClock(tx, row!.id);

      this.seedElicitationGaps(tx, row!.id, lsn);

      tx.insert(schema.changeLog)
        .values({
          spec_id: row!.id,
          lsn,
          operation: 'create_spec',
          payload: JSON.stringify({ specId: row!.id, name, slug }),
        })
        .run();

      return { status: 'success' as const, specId: row!.id, lsn };
    });
  }

  /** Repair legacy/local specs that predate the current seeded elicitation-gap floor. */
  repairSeededElicitationGaps(): RepairSeededElicitationGapsResult {
    return this.db.transaction((tx) => {
      const repairedSpecs: RepairSeededElicitationGapsSpecResult[] = [];
      const specRows = tx.select({ id: schema.specs.id }).from(schema.specs).all();

      for (const spec of specRows) {
        const existingSeedKeys = new Set(
          tx
            .select({
              refersTo: schema.elicitationGaps.refers_to,
              question: schema.elicitationGaps.question,
              predicateKind: schema.elicitationGaps.predicate_kind,
            })
            .from(schema.elicitationGaps)
            .where(eq(schema.elicitationGaps.spec_id, spec.id))
            .all()
            .map((row) => seededElicitationGapKey(row)),
        );
        const missing = SEEDED_ELICITATION_GAPS.filter(
          (entry) =>
            !existingSeedKeys.has(
              seededElicitationGapKey({
                refersTo: entry.refersTo,
                question: entry.question,
                predicateKind: entry.predicate.kind,
              }),
            ),
        );
        if (missing.length === 0) continue;

        const lsn = this.bumpExistingSpecLsn(tx, spec.id);
        tx.insert(schema.elicitationGaps)
          .values(this.seededElicitationGapRows(missing, spec.id, lsn))
          .run();
        tx.insert(schema.changeLog)
          .values({
            spec_id: spec.id,
            lsn,
            operation: 'repair_seeded_elicitation_gaps',
            payload: JSON.stringify({
              specId: spec.id,
              insertedGaps: missing.map((entry) => ({
                refersTo: entry.refersTo,
                predicateKind: entry.predicate.kind,
              })),
            }),
          })
          .run();
        repairedSpecs.push({ specId: spec.id, insertedCount: missing.length, lsn });
      }

      return { status: 'success' as const, repairedSpecs };
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

      if (input.predicate.kind === 'presence' && input.predicate.nodeKind !== undefined) {
        const duplicate = tx
          .select({ id: schema.elicitationGaps.id })
          .from(schema.elicitationGaps)
          .where(
            and(
              eq(schema.elicitationGaps.spec_id, input.specId),
              eq(schema.elicitationGaps.predicate_kind, 'presence'),
              eq(schema.elicitationGaps.refers_to, input.predicate.nodeKind),
              eq(schema.elicitationGaps.disposition, 'open'),
            ),
          )
          .get();
        if (duplicate) {
          return {
            status: 'structural_illegal' as const,
            diagnostics: [
              {
                field: 'predicate.nodeKind',
                message: `open presence gap already exists for ${input.predicate.nodeKind}: ${duplicate.id}`,
              },
            ],
          };
        }
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
          refers_to: input.refersTo,
          question: input.question.trim(),
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
            refersTo: input.refersTo,
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
