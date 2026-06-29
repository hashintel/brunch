/**
 * CommandExecutor tests — acceptance criteria for the M4 skeleton slice.
 *
 * SPEC: D4-L, D20-L, D16-L, D52-L
 * Scope card: CommandExecutor skeleton with single-node proof-of-life
 */

import { eq } from 'drizzle-orm';
import { describe, expect, it, beforeEach } from 'vitest';

import { createDb, type BrunchDb } from '../../db/connection.js';
import {
  changeLog,
  elicitationGaps,
  graphClock,
  nodeKindCounters,
  nodes,
  reconciliationNeed,
  specs,
} from '../../db/schema.js';
import { CommandExecutor } from '../command-executor.js';
import { runCreateOnlyMutation } from './support/create-only-mutation.js';

const gherkinThenField = ['th', 'en'].join('') as 'then';

function createTestDb(): BrunchDb {
  return createDb(':memory:');
}

function graphClockLsn(db: BrunchDb, specId: number): number {
  return (
    db.select({ lsn: graphClock.lsn }).from(graphClock).where(eq(graphClock.spec_id, specId)).get()?.lsn ?? 0
  );
}

describe('CommandExecutor', () => {
  let db: BrunchDb;
  let executor: CommandExecutor;
  let specId: number;

  beforeEach(() => {
    db = createTestDb();
    executor = new CommandExecutor(db);
    db.insert(specs).values({ name: 'Test Spec', slug: 'test' }).run();
    specId = db.select({ id: specs.id }).from(specs).get()!.id;
    db.insert(graphClock).values({ spec_id: specId, lsn: 0 }).run();
  });

  // --- graph_clock initialization ---

  it('stores a spec-local graph clock row for the persisted test spec', () => {
    expect(db.select({ specId: graphClock.spec_id, lsn: graphClock.lsn }).from(graphClock).all()).toEqual([
      { specId, lsn: 0 },
    ]);
  });

  // --- createNode: success path ---

  it('creates a valid intent node and returns success with nodeId and lsn', () => {
    const result = executor.createNode({
      specId,
      plane: 'intent',
      kind: 'requirement',
      title: 'System must be offline-capable',
      body: 'Works without network connectivity',
    });

    expect(result.status).toBe('success');
    if (result.status !== 'success') throw new Error('unreachable');
    expect(result.nodeId).toBeTypeOf('number');
    expect(result.lsn).toBe(1);
  });

  // --- createNode: story / unknown intent kinds (D87-L / D89-L) ---

  it('creates a story node as an intent claim (no detail)', () => {
    const result = executor.createNode({ specId, plane: 'intent', kind: 'story', title: 'Checkout flow' });

    expect(result.status).toBe('success');
  });

  it('creates an unknown node as an intent claim, distinct from elicitation_gaps', () => {
    const result = executor.createNode({
      specId,
      plane: 'intent',
      kind: 'unknown',
      title: 'Regulatory regime for the EU launch is undecided',
    });

    expect(result.status).toBe('success');
    // unknown rides the node graph; it does not create an elicitation-gap obligation.
    expect(
      db.select().from(elicitationGaps).where(eq(elicitationGaps.refers_to, 'unknown')).all(),
    ).toHaveLength(0);
  });

  it('wires a story via composition to a requirement, reusing the existing edge vocabulary', () => {
    const batch = runCreateOnlyMutation(executor, {
      specId,
      nodes: [
        { ref: 's1', plane: 'intent', kind: 'story', title: 'Checkout flow' },
        {
          ref: 'r1',
          plane: 'intent',
          kind: 'requirement',
          title: 'Cart total is recomputed on quantity change',
        },
      ],
      edges: [{ category: 'composition', source: 's1', target: 'r1' }],
    });

    expect(batch.status).toBe('success');
  });

  it("defaults basis to 'explicit' when omitted", () => {
    executor.createNode({ specId, plane: 'intent', kind: 'goal', title: 'Some goal' });

    const row = db.select().from(nodes).all()[0];
    expect(row!.basis).toBe('explicit');
  });

  it('stores optional body and source fields', () => {
    executor.createNode({
      specId,
      plane: 'intent',
      kind: 'context',
      title: 'Target market',
      body: 'Enterprise B2B SaaS',
      source: 'stakeholder',
    });

    const row = db.select().from(nodes).all()[0];
    expect(row!.body).toBe('Enterprise B2B SaaS');
    expect(row!.source).toBe('stakeholder');
  });

  it('creates a decision node with required detail', () => {
    const result = executor.createNode({
      specId,
      plane: 'intent',
      kind: 'decision',
      title: 'Use SQLite for persistence',
      detail: {
        chosen_option: 'SQLite via better-sqlite3',
        rejected: ['PostgreSQL', 'In-memory only'],
        rationale: 'Local-first single-process, no server needed',
      },
    });

    expect(result.status).toBe('success');
    const row = db.select().from(nodes).all()[0];
    expect(row!.detail).not.toBeNull();
    const detail = JSON.parse(row!.detail!);
    expect(detail.chosen_option).toBe('SQLite via better-sqlite3');
    expect(detail.rejected).toEqual(['PostgreSQL', 'In-memory only']);
  });

  it('creates a term node with required detail', () => {
    const result = executor.createNode({
      specId,
      plane: 'intent',
      kind: 'term',
      title: 'Reconciliation Need',
      detail: {
        definition: 'A record of an open impasse over graph state',
        aliases: ['recon need', 'impasse'],
      },
    });

    expect(result.status).toBe('success');
    const row = db.select().from(nodes).all()[0];
    const detail = JSON.parse(row!.detail!);
    expect(detail.definition).toBe('A record of an open impasse over graph state');
    expect(detail.aliases).toEqual(['recon need', 'impasse']);
  });

  // --- createNode: structural_illegal rejections ---

  it('rejects invalid kind for plane', () => {
    const result = executor.createNode({
      specId,
      plane: 'intent',
      kind: 'check', // oracle-plane kind, not intent
      title: 'Wrong plane',
    });

    expect(result.status).toBe('structural_illegal');
    if (result.status !== 'structural_illegal') throw new Error('unreachable');
    expect(result.diagnostics.some((d) => d.field === 'kind')).toBe(true);
  });

  it('rejects decision without detail', () => {
    const result = executor.createNode({ specId, plane: 'intent', kind: 'decision', title: 'Some decision' });

    expect(result.status).toBe('structural_illegal');
    if (result.status !== 'structural_illegal') throw new Error('unreachable');
    expect(result.diagnostics.some((d) => d.field === 'detail')).toBe(true);
  });

  it('rejects term without detail', () => {
    const result = executor.createNode({ specId, plane: 'intent', kind: 'term', title: 'Some term' });

    expect(result.status).toBe('structural_illegal');
    if (result.status !== 'structural_illegal') throw new Error('unreachable');
    expect(result.diagnostics.some((d) => d.field === 'detail')).toBe(true);
  });

  it('rejects a prohibited-detail node with detail present', () => {
    const result = executor.createNode({
      specId,
      plane: 'intent',
      kind: 'goal',
      title: 'Some goal',
      detail: { definition: 'should not be here' },
    });

    expect(result.status).toBe('structural_illegal');
    if (result.status !== 'structural_illegal') throw new Error('unreachable');
    expect(result.diagnostics.some((d) => d.field === 'detail')).toBe(true);
  });

  // --- createNode: claim-kind detail.form union (D88-L) ---

  it('creates a claim node with no detail (default plain form)', () => {
    const result = executor.createNode({
      specId,
      plane: 'intent',
      kind: 'requirement',
      title: 'Plain requirement',
    });

    expect(result.status).toBe('success');
    const row = db.select().from(nodes).all()[0];
    expect(row!.detail).toBeNull();
  });

  it('creates a criterion node with a gherkin form detail', () => {
    const result = executor.createNode({
      specId,
      plane: 'intent',
      kind: 'criterion',
      title: 'Offline save works',
      detail: {
        form: 'gherkin',
        given: ['the app is offline'],
        when: ['the user saves'],
        [gherkinThenField]: ['the change is persisted locally'],
      },
    });

    expect(result.status).toBe('success');
    const row = db.select().from(nodes).all()[0];
    const detail = JSON.parse(row!.detail!);
    expect(detail.form).toBe('gherkin');
    expect(detail.then).toEqual(['the change is persisted locally']);
  });

  it('creates an invariant node with a formal form detail', () => {
    const result = executor.createNode({
      specId,
      plane: 'intent',
      kind: 'invariant',
      title: 'Balance never negative',
      detail: { form: 'formal', language: 'lean', statement: '∀ a, balance a ≥ 0' },
    });

    expect(result.status).toBe('success');
    const row = db.select().from(nodes).all()[0];
    const detail = JSON.parse(row!.detail!);
    expect(detail.form).toBe('formal');
    expect(detail.language).toBe('lean');
  });

  it('creates a context node with a given form detail', () => {
    const result = executor.createNode({
      specId,
      plane: 'intent',
      kind: 'context',
      title: 'Single-process assumption',
      detail: { form: 'given', statement: 'Exactly one writer process exists.' },
    });

    expect(result.status).toBe('success');
    const row = db.select().from(nodes).all()[0];
    const detail = JSON.parse(row!.detail!);
    expect(detail.form).toBe('given');
  });

  it('rejects a claim node whose detail form is not allowed for its kind', () => {
    const result = executor.createNode({
      specId,
      plane: 'intent',
      kind: 'requirement',
      title: 'Bogus form',
      detail: { form: 'bogus' },
    });

    expect(result.status).toBe('structural_illegal');
    if (result.status !== 'structural_illegal') throw new Error('unreachable');
    expect(result.diagnostics.some((d) => d.field === 'detail.form')).toBe(true);
  });

  it('rejects a context node that carries a non-given form', () => {
    const result = executor.createNode({
      specId,
      plane: 'intent',
      kind: 'context',
      title: 'Context with plain form',
      detail: { form: 'plain' },
    });

    expect(result.status).toBe('structural_illegal');
    if (result.status !== 'structural_illegal') throw new Error('unreachable');
    expect(result.diagnostics.some((d) => d.field === 'detail.form')).toBe(true);
  });

  it('rejects a gherkin form detail without a then outcome', () => {
    const result = executor.createNode({
      specId,
      plane: 'intent',
      kind: 'criterion',
      title: 'Missing then',
      detail: { form: 'gherkin', given: ['x'] },
    });

    expect(result.status).toBe('structural_illegal');
    if (result.status !== 'structural_illegal') throw new Error('unreachable');
    expect(result.diagnostics.some((d) => d.field === 'detail.then')).toBe(true);
  });

  it('rejects a claim form detail with unknown fields', () => {
    const result = executor.createNode({
      specId,
      plane: 'intent',
      kind: 'requirement',
      title: 'Leaky form',
      detail: { form: 'formal', language: 'dafny', statement: 's', extra_field: 'nope' },
    });

    expect(result.status).toBe('structural_illegal');
    if (result.status !== 'structural_illegal') throw new Error('unreachable');
    expect(result.diagnostics.some((d) => d.field === 'detail.extra_field')).toBe(true);
  });

  it('rejects decision with empty rejected array', () => {
    const result = executor.createNode({
      specId,
      plane: 'intent',
      kind: 'decision',
      title: 'Bad decision',
      detail: {
        chosen_option: 'A',
        rejected: [],
        rationale: 'because',
      },
    });

    expect(result.status).toBe('structural_illegal');
    if (result.status !== 'structural_illegal') throw new Error('unreachable');
    expect(result.diagnostics.some((d) => d.field === 'detail.rejected')).toBe(true);
  });

  it('rejects decision detail with unknown fields', () => {
    const result = executor.createNode({
      specId,
      plane: 'intent',
      kind: 'decision',
      title: 'Leaky decision',
      detail: {
        chosen_option: 'A',
        rejected: ['B'],
        rationale: 'because',
        extra_field: 'should not be here',
      },
    });

    expect(result.status).toBe('structural_illegal');
    if (result.status !== 'structural_illegal') throw new Error('unreachable');
    expect(result.diagnostics.some((d) => d.field === 'detail.extra_field')).toBe(true);
  });

  it('rejects retired createNode basis values before allocating graph state', () => {
    const result = executor.createNode({
      specId,
      plane: 'intent',
      kind: 'goal',
      title: 'Legacy basis should fail',
      basis: 'accepted_review_set' as never,
    });

    expect(result.status).toBe('structural_illegal');
    if (result.status !== 'structural_illegal') throw new Error('unreachable');
    expect(result.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'basis' })]));
    expect(db.select().from(nodes).all()).toHaveLength(0);
    expect(db.select().from(changeLog).all()).toHaveLength(0);
    expect(db.select().from(nodeKindCounters).all()).toHaveLength(0);
    expect(graphClockLsn(db, specId)).toBe(0);
  });

  it('persists explicit and implicit createNode basis values unchanged', () => {
    executor.createNode({
      specId,
      plane: 'intent',
      kind: 'goal',
      title: 'Explicit node',
      basis: 'explicit',
    });
    executor.createNode({
      specId,
      plane: 'intent',
      kind: 'goal',
      title: 'Implicit node',
      basis: 'implicit',
    });

    expect(
      db
        .select()
        .from(nodes)
        .all()
        .map((row) => row.basis),
    ).toEqual(['explicit', 'implicit']);
  });

  // --- LSN / graph_clock ---

  it('increments graph_clock atomically per command', () => {
    executor.createNode({ specId, plane: 'intent', kind: 'goal', title: 'First' });
    executor.createNode({ specId, plane: 'intent', kind: 'goal', title: 'Second' });

    expect(graphClockLsn(db, specId)).toBe(2);
  });

  it('assigns matching created_at_lsn and updated_at_lsn on new nodes', () => {
    const result = executor.createNode({
      specId,
      plane: 'intent',
      kind: 'assumption',
      title: 'Pi exposes enough seams',
    });

    if (result.status !== 'success') throw new Error('unreachable');
    const row = db.select().from(nodes).all()[0];
    expect(row!.created_at_lsn).toBe(result.lsn);
    expect(row!.updated_at_lsn).toBe(result.lsn);
  });

  it('LSN is strictly monotonic across multiple creates', () => {
    const lsns: number[] = [];
    for (let i = 0; i < 10; i++) {
      const result = executor.createNode({ specId, plane: 'intent', kind: 'context', title: `Context ${i}` });
      if (result.status !== 'success') throw new Error('unreachable');
      lsns.push(result.lsn);
    }

    for (let i = 1; i < lsns.length; i++) {
      expect(lsns[i]).toBe(lsns[i - 1]! + 1);
    }
  });

  // --- change_log ---

  it('appends exactly one change_log entry per successful command', () => {
    executor.createNode({ specId, plane: 'intent', kind: 'requirement', title: 'Must persist' });

    const logs = db.select().from(changeLog).all();
    expect(logs).toHaveLength(1);
    expect(logs[0]!.operation).toBe('create_node');
  });

  it('change_log payload contains nodeId, plane, and kind', () => {
    const result = executor.createNode({
      specId,
      plane: 'intent',
      kind: 'invariant',
      title: 'LSN monotonicity',
    });

    if (result.status !== 'success') throw new Error('unreachable');
    const [log] = db.select().from(changeLog).all();
    const payload = JSON.parse(log!.payload);
    expect(payload.nodeId).toBe(result.nodeId);
    expect(payload.plane).toBe('intent');
    expect(payload.kind).toBe('invariant');
  });

  it("change_log.lsn matches the command's allocated LSN", () => {
    const result = executor.createNode({ specId, plane: 'intent', kind: 'goal', title: 'Test' });

    if (result.status !== 'success') throw new Error('unreachable');
    const [log] = db.select().from(changeLog).all();
    expect(log!.lsn).toBe(result.lsn);
  });

  // --- Transaction integrity ---

  it('writes nothing on validation failure (no LSN bump, no change_log)', () => {
    executor.createNode({
      specId,
      plane: 'intent',
      kind: 'check', // invalid kind for intent plane
      title: 'Should fail',
    });

    expect(graphClockLsn(db, specId)).toBe(0);
    expect(db.select().from(nodes).all()).toHaveLength(0);
    expect(db.select().from(changeLog).all()).toHaveLength(0);
  });

  // --- Oracle/design/plan plane nodes ---

  it('creates oracle-plane nodes', () => {
    const result = executor.createNode({
      specId,
      plane: 'oracle',
      kind: 'check',
      title: 'Verify LSN monotonicity',
    });

    expect(result.status).toBe('success');
  });

  it('creates design-plane nodes', () => {
    const result = executor.createNode({ specId, plane: 'design', kind: 'module', title: 'CommandExecutor' });

    expect(result.status).toBe('success');
  });

  it('creates plan-plane nodes', () => {
    const result = executor.createNode({ specId, plane: 'plan', kind: 'slice', title: 'M4 skeleton' });

    expect(result.status).toBe('success');
  });

  // ==========================================================================
  // specs
  // ==========================================================================

  describe('specs', () => {
    it('creates a spec row and returns an integer id', () => {
      const result = executor.createSpec({
        name: 'Brunch POC',
        slug: 'brunch-poc',
      });

      expect(result.status).toBe('success');
      if (result.status !== 'success') throw new Error('unreachable');
      expect(result.specId).toBeTypeOf('number');
      expect(result.lsn).toBe(1);

      const row = db.select().from(specs).where(eq(specs.id, result.specId)).get()!;
      expect(row.id).toBe(result.specId);
      expect(row.name).toBe('Brunch POC');
      expect(row.slug).toBe('brunch-poc');
    });

    it('defaults spec kind to product when omitted (D89-L)', () => {
      const result = executor.createSpec({ name: 'Default Scope', slug: 'default-scope' });
      expect(result.status).toBe('success');
      if (result.status !== 'success') throw new Error('unreachable');

      expect(executor.getSpec(result.specId)?.kind).toBe('product');
    });

    it('persists and reads an explicit spec kind (D89-L)', () => {
      const created = executor.createSpec({ name: 'Focused Lib', slug: 'focused-lib', kind: 'function' });
      expect(created.status).toBe('success');
      if (created.status !== 'success') throw new Error('unreachable');

      const row = db.select().from(specs).where(eq(specs.id, created.specId)).get()!;
      expect(row.kind).toBe('function');
      expect(executor.getSpec(created.specId)?.kind).toBe('function');
    });

    it('creates exactly one graph clock row for a new spec at LSN 1', () => {
      const result = executor.createSpec({ name: 'Clocked Spec', slug: 'clocked-spec' });

      expect(result.status).toBe('success');
      if (result.status !== 'success') throw new Error('unreachable');
      expect(
        db
          .select({ specId: graphClock.spec_id, lsn: graphClock.lsn })
          .from(graphClock)
          .where(eq(graphClock.spec_id, result.specId))
          .all(),
      ).toEqual([{ specId: result.specId, lsn: 1 }]);
    });

    it('seeds grounding typology gaps and the situating gap for the new spec at create-spec LSN', () => {
      const result = executor.createSpec({ name: 'Grounded Spec', slug: 'grounded-spec' });
      expect(result.status).toBe('success');
      if (result.status !== 'success') throw new Error('unreachable');

      expect(
        db
          .select({
            refersTo: elicitationGaps.refers_to,
            question: elicitationGaps.question,
            disposition: elicitationGaps.disposition,
            basis: elicitationGaps.basis,
            readinessBand: elicitationGaps.readiness_band,
            predicateKind: elicitationGaps.predicate_kind,
            importance: elicitationGaps.importance,
            planeAffinity: elicitationGaps.plane_affinity,
            lensAffinity: elicitationGaps.lens_affinity,
            createdAtLsn: elicitationGaps.created_at_lsn,
          })
          .from(elicitationGaps)
          .where(eq(elicitationGaps.spec_id, result.specId))
          .all(),
      ).toEqual(
        [
          [
            'context',
            'What kind of thing is this, and what domain or environment does it live in?',
            3,
            'presence',
          ],
          [
            'context',
            'Is this new-from-scratch, a brownfield codebase, or a continuation of a prior thread?',
            3,
            'manual',
          ],
          ['thesis', 'Who is this for, and what pull or pain makes it worth doing?', 3, 'presence'],
          ['goal', 'What outcome or value should this create?', 3, 'presence'],
          [
            'constraint',
            'What binding constraints, non-goals, or boundaries already shape the work?',
            3,
            'presence',
          ],
          ['term', 'What key word or domain term needs a shared definition?', 1, 'presence'],
          ['assumption', 'What are we assuming that might be false?', 1, 'presence'],
        ].map(([refersTo, question, importance, predicateKind]) => ({
          refersTo,
          question,
          disposition: 'open',
          basis: 'implicit',
          readinessBand: 'grounding',
          predicateKind,
          importance,
          planeAffinity: 'intent',
          lensAffinity: 'intent',
          createdAtLsn: result.lsn,
        })),
      );
    });

    it('seeds a situating gap whose rationale routes acquisition modes', () => {
      const result = executor.createSpec({ name: 'Situated Spec', slug: 'situated-spec' });
      expect(result.status).toBe('success');
      if (result.status !== 'success') throw new Error('unreachable');

      const row = db
        .select({
          refersTo: elicitationGaps.refers_to,
          question: elicitationGaps.question,
          rationale: elicitationGaps.rationale,
          predicateKind: elicitationGaps.predicate_kind,
          predicate: elicitationGaps.predicate,
          importance: elicitationGaps.importance,
          readinessBand: elicitationGaps.readiness_band,
        })
        .from(elicitationGaps)
        .where(eq(elicitationGaps.spec_id, result.specId))
        .all()
        .find((gap) => gap.predicateKind === 'manual');

      expect(row).toMatchObject({
        refersTo: 'context',
        question: 'Is this new-from-scratch, a brownfield codebase, or a continuation of a prior thread?',
        predicateKind: 'manual',
        importance: 3,
        readinessBand: 'grounding',
      });
      expect(row?.rationale).toContain('new-from-scratch');
      expect(row?.rationale).toContain('brownfield codebase');
      expect(row?.rationale).toContain('continuation of a prior thread');
      expect(row?.rationale).toContain('elicit-by-question');
      expect(row?.rationale).toContain('ingest-paste');
      expect(row?.rationale).toContain('read-referenced-documents');
      expect(row?.rationale).toContain('explore-and-characterize');
      expect(JSON.parse(row!.predicate)).toEqual({
        kind: 'manual',
        rubric: 'The opening orientation is clear enough to choose an acquisition mode.',
      });
    });

    it('scopes create_spec audit LSNs to the newly created spec', () => {
      const specA = executor.createSpec({ name: 'Spec A', slug: 'spec-a' });
      const specB = executor.createSpec({ name: 'Spec B', slug: 'spec-b' });
      if (specA.status !== 'success' || specB.status !== 'success') throw new Error('unreachable');

      expect(specA.lsn).toBe(1);
      expect(specB.lsn).toBe(1);
      expect(graphClockLsn(db, specA.specId)).toBe(1);
      expect(graphClockLsn(db, specB.specId)).toBe(1);
      expect(
        db
          .select({ specId: changeLog.spec_id, lsn: changeLog.lsn, operation: changeLog.operation })
          .from(changeLog)
          .all(),
      ).toEqual([
        { specId: specA.specId, lsn: 1, operation: 'create_spec' },
        { specId: specB.specId, lsn: 1, operation: 'create_spec' },
      ]);
    });

    it('mutating one spec does not advance sibling spec clocks', () => {
      const specA = executor.createSpec({ name: 'Spec A', slug: 'spec-a' });
      const specB = executor.createSpec({ name: 'Spec B', slug: 'spec-b' });
      if (specA.status !== 'success' || specB.status !== 'success') throw new Error('unreachable');

      const result = executor.createNode({
        specId: specA.specId,
        plane: 'intent',
        kind: 'goal',
        title: 'Spec A goal',
      });

      expect(result.status).toBe('success');
      if (result.status !== 'success') throw new Error('unreachable');
      expect(result.lsn).toBe(2);
      expect(graphClockLsn(db, specA.specId)).toBe(2);
      expect(graphClockLsn(db, specB.specId)).toBe(1);
    });

    it('reads a spec row by integer id', () => {
      const created = executor.createSpec({ name: 'Spec A', slug: 'spec-a' });
      if (created.status !== 'success') throw new Error('unreachable');

      const spec = executor.getSpec(created.specId);

      expect(spec).toEqual({
        id: created.specId,
        name: 'Spec A',
        slug: 'spec-a',
        kind: 'product',
      });
    });

    it('repairs a floor-predating spec with the missing manual situating gap', () => {
      const legacy = executor.createSpec({ name: 'Legacy Spec', slug: 'legacy-spec' });
      expect(legacy.status).toBe('success');
      if (legacy.status !== 'success') throw new Error('unreachable');
      db.delete(elicitationGaps).where(eq(elicitationGaps.predicate_kind, 'manual')).run();

      const repair = executor.repairSeededElicitationGaps();

      expect(repair.status).toBe('success');
      expect(repair.repairedSpecs).toContainEqual({ specId: legacy.specId, insertedCount: 1, lsn: 2 });
      expect(
        db
          .select({ predicateKind: elicitationGaps.predicate_kind, refersTo: elicitationGaps.refers_to })
          .from(elicitationGaps)
          .where(eq(elicitationGaps.spec_id, legacy.specId))
          .all()
          .filter((row) => row.predicateKind === 'manual'),
      ).toEqual([{ predicateKind: 'manual', refersTo: 'context' }]);
    });

    it('fails loud when an existing spec is missing its graph clock row', () => {
      const created = executor.createSpec({ name: 'Corrupt Spec', slug: 'corrupt-spec' });
      if (created.status !== 'success') throw new Error('unreachable');
      db.delete(graphClock).where(eq(graphClock.spec_id, created.specId)).run();

      expect(() =>
        executor.createNode({
          specId: created.specId,
          plane: 'intent',
          kind: 'goal',
          title: 'This mutation should not repair storage',
        }),
      ).toThrow(/graph_clock invariant failed/);
    });
  });

  // --- createReconciliationNeed ---

  describe('createReconciliationNeed', () => {
    it('creates a recon need targeting an edge and returns success with id and lsn', () => {
      // Seed a node and edge first
      const batch = runCreateOnlyMutation(executor, {
        specId,
        nodes: [
          { ref: 'r1', plane: 'intent', kind: 'requirement', title: 'R1' },
          { ref: 'a1', plane: 'intent', kind: 'assumption', title: 'A1' },
        ],
        edges: [{ category: 'dependency', source: 'r1', target: 'a1' }],
      });
      expect(batch.status).toBe('success');
      if (batch.status !== 'success') throw new Error('unreachable');
      const edgeId = batch.createdEdges[0]!;

      const result = executor.createReconciliationNeed({
        specId,
        target: { kind: 'edge', edgeId },
        needKind: 'edge_revalidation',
        reason: 'upstream assumption changed',
      });

      expect(result.status).toBe('success');
      if (result.status !== 'success') throw new Error('unreachable');
      expect(result.id).toBeTypeOf('number');
      expect(result.lsn).toBeTypeOf('number');
    });

    it('creates a recon need targeting a node pair', () => {
      const batch = runCreateOnlyMutation(executor, {
        specId,
        nodes: [
          { ref: 'r1', plane: 'intent', kind: 'requirement', title: 'R1' },
          { ref: 'r2', plane: 'intent', kind: 'requirement', title: 'R2' },
        ],
        edges: [],
      });
      expect(batch.status).toBe('success');
      if (batch.status !== 'success') throw new Error('unreachable');
      const aId = batch.createdNodes['r1']!.id;
      const bId = batch.createdNodes['r2']!.id;

      const result = executor.createReconciliationNeed({
        specId,
        target: { kind: 'node_pair', aId, bId },
        needKind: 'possible_duplicate',
      });

      expect(result.status).toBe('success');
      if (result.status !== 'success') throw new Error('unreachable');
      expect(result.id).toBeTypeOf('number');
    });

    it('rejects edge target with non-existent edgeId', () => {
      const result = executor.createReconciliationNeed({
        specId,
        target: { kind: 'edge', edgeId: 999 },
        needKind: 'edge_revalidation',
      });

      expect(result.status).toBe('structural_illegal');
      if (result.status !== 'structural_illegal') throw new Error('unreachable');
      expect(result.diagnostics[0]!.field).toBe('target.edgeId');
    });

    it('rejects node_pair target with non-existent nodeId', () => {
      const n = executor.createNode({ specId, plane: 'intent', kind: 'goal', title: 'G1' });
      expect(n.status).toBe('success');
      if (n.status !== 'success') throw new Error('unreachable');

      const result = executor.createReconciliationNeed({
        specId,
        target: { kind: 'node_pair', aId: n.nodeId, bId: 999 },
        needKind: 'possible_relation',
      });

      expect(result.status).toBe('structural_illegal');
      if (result.status !== 'structural_illegal') throw new Error('unreachable');
      expect(result.diagnostics[0]!.field).toBe('target.bId');
    });

    it('allocates a new LSN for each recon need', () => {
      const n = executor.createNode({ specId, plane: 'intent', kind: 'goal', title: 'G1' });
      expect(n.status).toBe('success');
      if (n.status !== 'success') throw new Error('unreachable');
      const n2 = executor.createNode({ specId, plane: 'intent', kind: 'goal', title: 'G2' });
      expect(n2.status).toBe('success');
      if (n2.status !== 'success') throw new Error('unreachable');

      const r1 = executor.createReconciliationNeed({
        specId,
        target: { kind: 'node_pair', aId: n.nodeId, bId: n2.nodeId },
        needKind: 'possible_relation',
      });
      expect(r1.status).toBe('success');
      if (r1.status !== 'success') throw new Error('unreachable');

      const r2 = executor.createReconciliationNeed({
        specId,
        target: { kind: 'node_pair', aId: n.nodeId, bId: n2.nodeId },
        needKind: 'semantic_conflict',
      });
      expect(r2.status).toBe('success');
      if (r2.status !== 'success') throw new Error('unreachable');

      expect(r2.lsn).toBeGreaterThan(r1.lsn);
    });
  });

  describe('createElicitationGap', () => {
    it('creates an open gap and preserves the arose-from pointer', () => {
      const parent = executor.createElicitationGap({
        specId,
        refersTo: 'context',
        question: 'What kind of product is this?',
        rationale: 'Name the product domain.',
        band: 'grounding',
        predicate: { kind: 'presence', plane: 'intent', nodeKind: 'context', minimum: 1 },
        planeAffinity: 'intent',
        lensAffinity: 'intent',
      });
      expect(parent.status).toBe('success');
      if (parent.status !== 'success') throw new Error('unreachable');

      const child = executor.createElicitationGap({
        specId,
        refersTo: 'thesis',
        question: 'Which user is blocked most by the current version?',
        rationale: 'Clarify which user is blocked most by the current version.',
        band: 'grounding',
        predicate: { kind: 'presence', plane: 'intent', nodeKind: 'thesis', minimum: 1 },
        planeAffinity: 'intent',
        lensAffinity: 'intent',
        aroseFromGapId: parent.id,
      });

      expect(child.status).toBe('success');
      if (child.status !== 'success') throw new Error('unreachable');

      expect(db.select().from(elicitationGaps).where(eq(elicitationGaps.id, child.id)).get()).toMatchObject({
        spec_id: specId,
        refers_to: 'thesis',
        question: 'Which user is blocked most by the current version?',
        rationale: 'Clarify which user is blocked most by the current version.',
        disposition: 'open',
        basis: 'explicit',
        readiness_band: 'grounding',
        predicate_kind: 'presence',
        plane_affinity: 'intent',
        lens_affinity: 'intent',
        arose_from_gap_id: parent.id,
        created_at_lsn: child.lsn,
        disposition_set_at_lsn: null,
      });
    });

    it('accepts projection as a readiness band and rejects unknown bands', () => {
      const projected = executor.createElicitationGap({
        specId,
        refersTo: 'module',
        question: 'Which module should exist?',
        rationale: 'Projection-band obligations cover design and oracle nodes.',
        band: 'projection',
        predicate: { kind: 'presence', band: 'projection', minimum: 1 },
      });
      expect(projected.status).toBe('success');

      const unknown = executor.createElicitationGap({
        specId,
        refersTo: 'module',
        question: 'Which module should exist?',
        rationale: 'Unknown readiness bands stay boundary-illegal.',
        band: 'later' as never,
        predicate: { kind: 'presence', band: 'later' as never, minimum: 1 },
      });
      expect(unknown).toMatchObject({
        status: 'structural_illegal',
        diagnostics: expect.arrayContaining([
          { field: 'band', message: '"later" is not a valid readiness band' },
          { field: 'predicate.band', message: 'band is not valid' },
        ]),
      });
    });

    it('rejects unsupported field and coverage predicates', () => {
      for (const predicate of [
        { kind: 'field', nodeKind: 'goal', field: 'title' },
        { kind: 'coverage', subjectKind: 'goal', relation: 'support' },
      ] as const) {
        const result = executor.createElicitationGap({
          specId,
          refersTo: 'goal',
          question: 'Unsupported?',
          rationale: 'This arm has no derivation yet.',
          band: 'grounding',
          predicate,
        });
        expect(result).toMatchObject({
          status: 'structural_illegal',
          diagnostics: [{ field: 'predicate.kind', message: 'predicate kind not yet supported' }],
        });
      }
    });

    it('rejects duplicate open presence kind-floor gaps', () => {
      const first = executor.createElicitationGap({
        specId,
        refersTo: 'module',
        question: 'Name a module.',
        rationale: 'One module floor is enough.',
        band: 'grounding',
        predicate: { kind: 'presence', nodeKind: 'module', minimum: 1 },
      });
      expect(first.status).toBe('success');
      const duplicate = executor.createElicitationGap({
        specId,
        refersTo: 'module',
        question: 'Name another module.',
        rationale: 'This aliases the same floor.',
        band: 'grounding',
        predicate: { kind: 'presence', nodeKind: 'module', minimum: 1 },
      });
      expect(duplicate).toMatchObject({
        status: 'structural_illegal',
        diagnostics: [expect.objectContaining({ field: 'predicate.nodeKind' })],
      });
    });

    it('rejects malformed gaps without writing rows or advancing the clock', () => {
      const result = executor.createElicitationGap({
        specId,
        refersTo: 'not_a_kind' as never,
        question: '   ',
        rationale: '   ',
        band: 'later' as never,
        predicate: { kind: 'presence', minimum: 0, nodeKind: 'not_a_kind' as never },
      });

      expect(result.status).toBe('structural_illegal');
      if (result.status !== 'structural_illegal') throw new Error('unreachable');
      expect(result.diagnostics.map((diagnostic) => diagnostic.field)).toEqual(
        expect.arrayContaining([
          'refersTo',
          'question',
          'rationale',
          'band',
          'predicate.minimum',
          'predicate.nodeKind',
        ]),
      );
      expect(db.select().from(elicitationGaps).all()).toEqual([]);
      expect(graphClockLsn(db, specId)).toBe(0);
      expect(db.select().from(changeLog).all()).toEqual([]);
    });
  });

  describe('setElicitationGapDisposition', () => {
    it('sets a non-derivable disposition and records resolvedByNodeId and dispositionSetAtLsn', () => {
      const entry = executor.createElicitationGap({
        specId,
        refersTo: 'thesis',
        question: 'Is the audience and pain clear enough?',
        rationale: 'Judge whether grounding is sufficient.',
        band: 'grounding',
        predicate: { kind: 'manual', rubric: 'Sufficiently grounded for generative work.' },
      });
      expect(entry.status).toBe('success');
      if (entry.status !== 'success') throw new Error('unreachable');

      const node = executor.createNode({ specId, plane: 'intent', kind: 'goal', title: 'Clarified goal' });
      expect(node.status).toBe('success');
      if (node.status !== 'success') throw new Error('unreachable');

      const setDisposition = executor.setElicitationGapDisposition({
        specId,
        id: entry.id,
        disposition: 'answered',
        resolvedByNodeId: node.nodeId,
      });

      expect(setDisposition.status).toBe('success');
      if (setDisposition.status !== 'success') throw new Error('unreachable');
      expect(setDisposition.lsn).toBeGreaterThan(node.lsn);
      expect(
        db
          .select({
            disposition: elicitationGaps.disposition,
            resolvedByNodeId: elicitationGaps.resolved_by_node_id,
            dispositionSetAtLsn: elicitationGaps.disposition_set_at_lsn,
          })
          .from(elicitationGaps)
          .where(eq(elicitationGaps.id, entry.id))
          .get(),
      ).toEqual({
        disposition: 'answered',
        resolvedByNodeId: node.nodeId,
        dispositionSetAtLsn: setDisposition.lsn,
      });
    });

    it('rejects hand-setting answered for structural predicates', () => {
      const entry = executor.createElicitationGap({
        specId,
        refersTo: 'context',
        question: 'What kind of product is this?',
        rationale: 'Name the product domain.',
        band: 'grounding',
        predicate: { kind: 'presence', plane: 'intent', nodeKind: 'context', minimum: 1 },
      });
      expect(entry.status).toBe('success');
      if (entry.status !== 'success') throw new Error('unreachable');

      const result = executor.setElicitationGapDisposition({ specId, id: entry.id, disposition: 'answered' });

      expect(result.status).toBe('structural_illegal');
      if (result.status !== 'structural_illegal') throw new Error('unreachable');
      expect(result.diagnostics[0]!.field).toBe('disposition');
      expect(
        db
          .select({ disposition: elicitationGaps.disposition })
          .from(elicitationGaps)
          .where(eq(elicitationGaps.id, entry.id))
          .get(),
      ).toEqual({ disposition: 'open' });
    });

    it('rejects a resolved-by node from another spec', () => {
      const entry = executor.createElicitationGap({
        specId,
        refersTo: 'thesis',
        question: 'Is the audience and pain clear enough?',
        rationale: 'Judge whether grounding is sufficient.',
        band: 'grounding',
        predicate: { kind: 'manual', rubric: 'Sufficiently grounded for generative work.' },
      });
      expect(entry.status).toBe('success');
      if (entry.status !== 'success') throw new Error('unreachable');

      const otherSpec = executor.createSpec({ name: 'Other Spec', slug: 'other-spec' });
      expect(otherSpec.status).toBe('success');
      if (otherSpec.status !== 'success') throw new Error('unreachable');
      const otherNode = executor.createNode({
        specId: otherSpec.specId,
        plane: 'intent',
        kind: 'goal',
        title: 'Sibling goal',
      });
      expect(otherNode.status).toBe('success');
      if (otherNode.status !== 'success') throw new Error('unreachable');

      const result = executor.setElicitationGapDisposition({
        specId,
        id: entry.id,
        disposition: 'answered',
        resolvedByNodeId: otherNode.nodeId,
      });

      expect(result.status).toBe('structural_illegal');
      if (result.status !== 'structural_illegal') throw new Error('unreachable');
      expect(result.diagnostics[0]!.field).toBe('resolvedByNodeId');
      expect(
        db
          .select({
            disposition: elicitationGaps.disposition,
            resolvedByNodeId: elicitationGaps.resolved_by_node_id,
            dispositionSetAtLsn: elicitationGaps.disposition_set_at_lsn,
          })
          .from(elicitationGaps)
          .where(eq(elicitationGaps.id, entry.id))
          .get(),
      ).toEqual({ disposition: 'open', resolvedByNodeId: null, dispositionSetAtLsn: null });
    });
  });

  // --- resolveReconciliationNeed ---

  describe('resolveReconciliationNeed', () => {
    it('resolves an open need and records resolvedAtLsn', () => {
      const batch = runCreateOnlyMutation(executor, {
        specId,
        nodes: [
          { ref: 'r1', plane: 'intent', kind: 'requirement', title: 'R1' },
          { ref: 'a1', plane: 'intent', kind: 'assumption', title: 'A1' },
        ],
        edges: [{ category: 'dependency', source: 'r1', target: 'a1' }],
      });
      expect(batch.status).toBe('success');
      if (batch.status !== 'success') throw new Error('unreachable');

      const create = executor.createReconciliationNeed({
        specId,
        target: { kind: 'edge', edgeId: batch.createdEdges[0]! },
        needKind: 'edge_revalidation',
      });
      expect(create.status).toBe('success');
      if (create.status !== 'success') throw new Error('unreachable');

      const resolve = executor.resolveReconciliationNeed({ specId, id: create.id });
      expect(resolve.status).toBe('success');
      if (resolve.status !== 'success') throw new Error('unreachable');
      expect(resolve.lsn).toBeGreaterThan(create.lsn);
    });

    it('rejects non-existent need id', () => {
      const result = executor.resolveReconciliationNeed({ specId, id: 999 });
      expect(result.status).toBe('structural_illegal');
    });

    it('rejects a need id that belongs to another spec without resolving it', () => {
      const otherSpec = executor.createSpec({ name: 'Other Spec', slug: 'other-spec' });
      expect(otherSpec.status).toBe('success');
      if (otherSpec.status !== 'success') throw new Error('unreachable');
      const batch = runCreateOnlyMutation(executor, {
        specId,
        nodes: [
          { ref: 'r1', plane: 'intent', kind: 'requirement', title: 'R1' },
          { ref: 'a1', plane: 'intent', kind: 'assumption', title: 'A1' },
        ],
        edges: [{ category: 'dependency', source: 'r1', target: 'a1' }],
      });
      expect(batch.status).toBe('success');
      if (batch.status !== 'success') throw new Error('unreachable');
      const create = executor.createReconciliationNeed({
        specId,
        target: { kind: 'edge', edgeId: batch.createdEdges[0]! },
        needKind: 'edge_revalidation',
      });
      expect(create.status).toBe('success');
      if (create.status !== 'success') throw new Error('unreachable');

      const wrongSpecResolve = executor.resolveReconciliationNeed({
        specId: otherSpec.specId,
        id: create.id,
      });

      expect(wrongSpecResolve.status).toBe('structural_illegal');
      expect(
        db
          .select({ status: reconciliationNeed.status, resolvedAtLsn: reconciliationNeed.resolved_at_lsn })
          .from(reconciliationNeed)
          .where(eq(reconciliationNeed.id, create.id))
          .get(),
      ).toEqual({ status: 'open', resolvedAtLsn: null });
    });

    it('rejects already-resolved need', () => {
      const batch = runCreateOnlyMutation(executor, {
        specId,
        nodes: [
          { ref: 'r1', plane: 'intent', kind: 'requirement', title: 'R1' },
          { ref: 'a1', plane: 'intent', kind: 'assumption', title: 'A1' },
        ],
        edges: [{ category: 'dependency', source: 'r1', target: 'a1' }],
      });
      expect(batch.status).toBe('success');
      if (batch.status !== 'success') throw new Error('unreachable');

      const create = executor.createReconciliationNeed({
        specId,
        target: { kind: 'edge', edgeId: batch.createdEdges[0]! },
        needKind: 'edge_revalidation',
      });
      expect(create.status).toBe('success');
      if (create.status !== 'success') throw new Error('unreachable');

      const resolve1 = executor.resolveReconciliationNeed({ specId, id: create.id });
      expect(resolve1.status).toBe('success');

      const resolve2 = executor.resolveReconciliationNeed({ specId, id: create.id });
      expect(resolve2.status).toBe('structural_illegal');
      if (resolve2.status !== 'structural_illegal') throw new Error('unreachable');
      expect(resolve2.diagnostics[0]!.message).toContain('already resolved');
    });
  });
});
