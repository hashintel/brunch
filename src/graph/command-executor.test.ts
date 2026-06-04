/**
 * CommandExecutor tests — acceptance criteria for the M4 skeleton slice.
 *
 * SPEC: D4-L, D20-L, D16-L, D52-L
 * Scope card: CommandExecutor skeleton with single-node proof-of-life
 */

import { eq } from 'drizzle-orm';
import { describe, expect, it, beforeEach } from 'vitest';

import { createDb, type BrunchDb } from '../db/connection.js';
import {
  graphClock,
  changeLog,
  edges,
  nodeKindCounters,
  nodes,
  reconciliationNeed,
  specs,
} from '../db/schema.js';
import { CommandExecutor } from './command-executor.js';
import type { CommitGraphInput } from './command-executor.js';

function createTestDb(): BrunchDb {
  return createDb(':memory:');
}

describe('CommandExecutor', () => {
  let db: BrunchDb;
  let executor: CommandExecutor;
  let specId: number;

  beforeEach(() => {
    db = createTestDb();
    executor = new CommandExecutor(db);
    db.insert(specs)
      .values({ name: 'Test Spec', slug: 'test', readiness_grade: 'grounding_onboarding' })
      .run();
    specId = db.select({ id: specs.id }).from(specs).get()!.id;
  });

  // --- graph_clock initialization ---

  it('initializes graph_clock with lsn=0', () => {
    const rows = db.select().from(graphClock).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.lsn).toBe(0);
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

  it('rejects non-decision/term node with detail present', () => {
    const result = executor.createNode({
      specId,
      plane: 'intent',
      kind: 'requirement',
      title: 'Some requirement',
      detail: { definition: 'should not be here' },
    });

    expect(result.status).toBe('structural_illegal');
    if (result.status !== 'structural_illegal') throw new Error('unreachable');
    expect(result.diagnostics.some((d) => d.field === 'detail')).toBe(true);
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

  // --- LSN / graph_clock ---

  it('increments graph_clock atomically per command', () => {
    executor.createNode({ specId, plane: 'intent', kind: 'goal', title: 'First' });
    executor.createNode({ specId, plane: 'intent', kind: 'goal', title: 'Second' });

    const [clock] = db.select().from(graphClock).all();
    expect(clock!.lsn).toBe(2);
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

    const [clock] = db.select().from(graphClock).all();
    expect(clock!.lsn).toBe(0);
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
        readinessGrade: 'grounding_onboarding',
      });

      expect(result.status).toBe('success');
      if (result.status !== 'success') throw new Error('unreachable');
      expect(result.specId).toBeTypeOf('number');
      expect(result.lsn).toBe(1);

      const row = db.select().from(specs).where(eq(specs.id, result.specId)).get()!;
      expect(row.id).toBe(result.specId);
      expect(row.name).toBe('Brunch POC');
      expect(row.slug).toBe('brunch-poc');
      expect(row.readiness_grade).toBe('grounding_onboarding');
    });

    it('reads a spec row by integer id', () => {
      const created = executor.createSpec({ name: 'Spec A', slug: 'spec-a' });
      if (created.status !== 'success') throw new Error('unreachable');

      const spec = executor.getSpec(created.specId);

      expect(spec).toEqual({
        id: created.specId,
        name: 'Spec A',
        slug: 'spec-a',
        readinessGrade: 'grounding_onboarding',
      });
    });

    it('updates readiness grade through the command boundary', () => {
      const created = executor.createSpec({ name: 'Spec A', slug: 'spec-a' });
      if (created.status !== 'success') throw new Error('unreachable');

      const result = executor.updateReadinessGrade({
        specId: created.specId,
        readinessGrade: 'elicitation_ready',
      });

      expect(result.status).toBe('success');
      if (result.status !== 'success') throw new Error('unreachable');
      expect(result.lsn).toBe(2);
      expect(executor.getSpec(created.specId)?.readinessGrade).toBe('elicitation_ready');
    });

    it('rejects an invalid readiness grade without writing', () => {
      const created = executor.createSpec({ name: 'Spec A', slug: 'spec-a' });
      if (created.status !== 'success') throw new Error('unreachable');

      const result = executor.updateReadinessGrade({
        specId: created.specId,
        readinessGrade: 'pinning' as never,
      });

      expect(result.status).toBe('structural_illegal');
      expect(executor.getSpec(created.specId)?.readinessGrade).toBe('grounding_onboarding');
      expect(db.select().from(changeLog).all()).toHaveLength(1);
    });
  });

  // ==========================================================================
  // commitGraph
  // ==========================================================================

  describe('commitGraph', () => {
    // --- success path ---

    it('creates multiple nodes + edges in one transaction with one LSN', () => {
      const input: CommitGraphInput = {
        specId,
        nodes: [
          { ref: 'n1', plane: 'intent', kind: 'requirement', title: 'Req A' },
          { ref: 'n2', plane: 'intent', kind: 'constraint', title: 'Con B' },
        ],
        edges: [{ category: 'boundary', source: 'n2', target: 'n1' }],
      };

      const result = executor.commitGraph(input);
      expect(result.status).toBe('success');
      if (result.status !== 'success') throw new Error('unreachable');

      expect(result.lsn).toBe(1);
      expect(Object.keys(result.nodes)).toHaveLength(2);
      expect(result.edges).toHaveLength(1);

      // Verify DB state
      expect(db.select().from(nodes).all()).toHaveLength(2);
      expect(db.select().from(edges).all()).toHaveLength(1);
    });

    it('allocates kind ordinals per spec, plane, and kind within multi-node batches', () => {
      const otherSpec = executor.createSpec({ name: 'Other Spec', slug: 'other' });
      if (otherSpec.status !== 'success') throw new Error('unreachable');

      executor.createNode({ specId, plane: 'intent', kind: 'goal', title: 'Existing goal' });
      const firstBatch = executor.commitGraph({
        specId,
        nodes: [
          { ref: 'goal', plane: 'intent', kind: 'goal', title: 'Batch goal' },
          { ref: 'requirement', plane: 'intent', kind: 'requirement', title: 'Batch req' },
          { ref: 'oracle-goal', plane: 'oracle', kind: 'check', title: 'Oracle check' },
        ],
        edges: [],
      });
      const otherSpecBatch = executor.commitGraph({
        specId: otherSpec.specId,
        nodes: [{ ref: 'goal', plane: 'intent', kind: 'goal', title: 'Other goal' }],
        edges: [],
      });

      expect(firstBatch.status).toBe('success');
      expect(otherSpecBatch.status).toBe('success');
      const rows = db
        .select({
          specId: nodes.spec_id,
          plane: nodes.plane,
          kind: nodes.kind,
          title: nodes.title,
          kindOrdinal: nodes.kind_ordinal,
        })
        .from(nodes)
        .all();

      expect(rows).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            specId,
            plane: 'intent',
            kind: 'goal',
            title: 'Existing goal',
            kindOrdinal: 1,
          }),
          expect.objectContaining({
            specId,
            plane: 'intent',
            kind: 'goal',
            title: 'Batch goal',
            kindOrdinal: 2,
          }),
          expect.objectContaining({
            specId,
            plane: 'intent',
            kind: 'requirement',
            title: 'Batch req',
            kindOrdinal: 1,
          }),
          expect.objectContaining({
            specId,
            plane: 'oracle',
            kind: 'check',
            title: 'Oracle check',
            kindOrdinal: 1,
          }),
          expect.objectContaining({
            specId: otherSpec.specId,
            plane: 'intent',
            kind: 'goal',
            title: 'Other goal',
            kindOrdinal: 1,
          }),
        ]),
      );
    });

    it('rejects duplicate stored kind ordinals for one spec, plane, and kind', () => {
      executor.createNode({ specId, plane: 'intent', kind: 'goal', title: 'G1' });

      expect(() =>
        db
          .insert(nodes)
          .values({
            spec_id: specId,
            plane: 'intent',
            kind: 'goal',
            kind_ordinal: 1,
            title: 'Duplicate G1',
            basis: 'explicit',
            created_at_lsn: 1,
            updated_at_lsn: 1,
          })
          .run(),
      ).toThrow();
    });

    it('resolves intra-batch refs to real NodeIds', () => {
      const result = executor.commitGraph({
        specId,
        nodes: [
          { ref: 'a', plane: 'intent', kind: 'assumption', title: 'A1' },
          {
            ref: 'b',
            plane: 'intent',
            kind: 'decision',
            title: 'D1',
            detail: {
              chosen_option: 'X',
              rejected: ['Y'],
              rationale: 'because',
            },
          },
        ],
        edges: [{ category: 'dependency', source: 'a', target: 'b' }],
      });

      if (result.status !== 'success') throw new Error('unreachable');
      const edgeRow = db.select().from(edges).all()[0]!;
      expect(edgeRow.source_id).toBe(result.nodes['a']);
      expect(edgeRow.target_id).toBe(result.nodes['b']);
    });

    it('resolves existing-node refs to verified NodeIds', () => {
      // Pre-create a node
      const pre = executor.createNode({ specId, plane: 'intent', kind: 'goal', title: 'Existing goal' });
      if (pre.status !== 'success') throw new Error('unreachable');

      const result = executor.commitGraph({
        specId,
        nodes: [{ ref: 'n1', plane: 'intent', kind: 'requirement', title: 'New req' }],
        edges: [
          {
            category: 'support',
            source: { existing: pre.nodeId },
            target: 'n1',
            stance: 'for',
          },
        ],
      });

      expect(result.status).toBe('success');
      if (result.status !== 'success') throw new Error('unreachable');
      const edgeRow = db.select().from(edges).all()[0]!;
      expect(edgeRow.source_id).toBe(pre.nodeId);
      expect(edgeRow.target_id).toBe(result.nodes['n1']);
    });

    it('returns nodes mapping and edges array in success result', () => {
      const result = executor.commitGraph({
        specId,
        nodes: [
          { ref: 'x', plane: 'intent', kind: 'context', title: 'Ctx' },
          { ref: 'y', plane: 'intent', kind: 'thesis', title: 'Thesis' },
        ],
        edges: [],
      });

      if (result.status !== 'success') throw new Error('unreachable');
      expect(result.nodes['x']).toBeTypeOf('number');
      expect(result.nodes['y']).toBeTypeOf('number');
      expect(result.nodes['x']).not.toBe(result.nodes['y']);
      expect(result.edges).toEqual([]);
    });

    it('appends one change_log entry for the entire batch', () => {
      executor.commitGraph({
        specId,
        nodes: [
          { ref: 'n1', plane: 'intent', kind: 'goal', title: 'G1' },
          { ref: 'n2', plane: 'intent', kind: 'goal', title: 'G2' },
        ],
        edges: [{ category: 'association', source: 'n1', target: 'n2' }],
      });

      const logs = db.select().from(changeLog).all();
      expect(logs).toHaveLength(1);
      expect(logs[0]!.operation).toBe('commit_graph');
      const payload = JSON.parse(logs[0]!.payload);
      expect(Object.keys(payload.nodes)).toHaveLength(2);
      expect(payload.edges).toHaveLength(1);
    });

    // --- edge structural validation ---

    it('rejects edge with invalid category', () => {
      const result = executor.commitGraph({
        specId,
        nodes: [
          { ref: 'n1', plane: 'intent', kind: 'goal', title: 'G' },
          { ref: 'n2', plane: 'intent', kind: 'goal', title: 'G2' },
        ],
        edges: [{ category: 'invented_relation', source: 'n1', target: 'n2' }],
      });

      expect(result.status).toBe('structural_illegal');
      if (result.status !== 'structural_illegal') throw new Error('unreachable');
      expect(result.diagnostics.some((d) => d.field.includes('category'))).toBe(true);
    });

    it('rejects proof edge without stance', () => {
      const result = executor.commitGraph({
        specId,
        nodes: [
          { ref: 'n1', plane: 'intent', kind: 'criterion', title: 'Cr' },
          { ref: 'n2', plane: 'intent', kind: 'invariant', title: 'Inv' },
        ],
        edges: [{ category: 'proof', source: 'n1', target: 'n2' }],
      });

      expect(result.status).toBe('structural_illegal');
      if (result.status !== 'structural_illegal') throw new Error('unreachable');
      expect(result.diagnostics.some((d) => d.field.includes('stance'))).toBe(true);
    });

    it('rejects support edge without stance', () => {
      const result = executor.commitGraph({
        specId,
        nodes: [
          { ref: 'n1', plane: 'intent', kind: 'context', title: 'Ctx' },
          { ref: 'n2', plane: 'intent', kind: 'requirement', title: 'Req' },
        ],
        edges: [{ category: 'support', source: 'n1', target: 'n2' }],
      });

      expect(result.status).toBe('structural_illegal');
    });

    it('rejects non-proof/non-support edge with stance', () => {
      const result = executor.commitGraph({
        specId,
        nodes: [
          { ref: 'n1', plane: 'intent', kind: 'assumption', title: 'A' },
          { ref: 'n2', plane: 'intent', kind: 'requirement', title: 'R' },
        ],
        edges: [{ category: 'dependency', source: 'n1', target: 'n2', stance: 'for' }],
      });

      expect(result.status).toBe('structural_illegal');
      if (result.status !== 'structural_illegal') throw new Error('unreachable');
      expect(result.diagnostics.some((d) => d.field.includes('stance'))).toBe(true);
    });

    it('rejects edge referencing non-existent existing node', () => {
      const result = executor.commitGraph({
        specId,
        nodes: [{ ref: 'n1', plane: 'intent', kind: 'goal', title: 'G' }],
        edges: [{ category: 'dependency', source: { existing: 9999 }, target: 'n1' }],
      });

      expect(result.status).toBe('structural_illegal');
      if (result.status !== 'structural_illegal') throw new Error('unreachable');
      expect(result.diagnostics.some((d) => d.field.includes('source'))).toBe(true);
    });

    it('rejects edge with unresolvable intra-batch ref', () => {
      const result = executor.commitGraph({
        specId,
        nodes: [{ ref: 'n1', plane: 'intent', kind: 'goal', title: 'G' }],
        edges: [{ category: 'dependency', source: 'n1', target: 'missing_ref' }],
      });

      expect(result.status).toBe('structural_illegal');
      if (result.status !== 'structural_illegal') throw new Error('unreachable');
      expect(result.diagnostics.some((d) => d.field.includes('target'))).toBe(true);
    });

    it('rejects self-loop edge', () => {
      const result = executor.commitGraph({
        specId,
        nodes: [{ ref: 'n1', plane: 'intent', kind: 'goal', title: 'G' }],
        edges: [{ category: 'association', source: 'n1', target: 'n1' }],
      });

      expect(result.status).toBe('structural_illegal');
      if (result.status !== 'structural_illegal') throw new Error('unreachable');
      expect(result.diagnostics.some((d) => d.message.includes('self-loop'))).toBe(true);
    });

    // --- node validation reuse ---

    it('rejects batch node with invalid kind-for-plane', () => {
      const result = executor.commitGraph({
        specId,
        nodes: [{ ref: 'n1', plane: 'intent', kind: 'check', title: 'Wrong' }],
        edges: [],
      });

      expect(result.status).toBe('structural_illegal');
      if (result.status !== 'structural_illegal') throw new Error('unreachable');
      expect(result.diagnostics.some((d) => d.field.includes('nodes[0]'))).toBe(true);
    });

    it('rejects batch decision without detail', () => {
      const result = executor.commitGraph({
        specId,
        nodes: [{ ref: 'n1', plane: 'intent', kind: 'decision', title: 'D' }],
        edges: [],
      });

      expect(result.status).toBe('structural_illegal');
    });

    // --- all-or-nothing (I34-L) ---

    it('if any node fails validation, entire batch rejected — nothing written', () => {
      const result = executor.commitGraph({
        specId,
        nodes: [
          { ref: 'n1', plane: 'intent', kind: 'goal', title: 'Valid' },
          { ref: 'n2', plane: 'intent', kind: 'check', title: 'Invalid kind' },
        ],
        edges: [],
      });

      expect(result.status).toBe('structural_illegal');
      expect(db.select().from(nodes).all()).toHaveLength(0);
      const [clock] = db.select().from(graphClock).all();
      expect(clock!.lsn).toBe(0);
    });

    it('if any edge fails validation, no nodes written', () => {
      const result = executor.commitGraph({
        specId,
        nodes: [
          { ref: 'n1', plane: 'intent', kind: 'goal', title: 'Valid goal' },
          { ref: 'n2', plane: 'intent', kind: 'context', title: 'Valid ctx' },
        ],
        edges: [
          { category: 'proof', source: 'n1', target: 'n2' }, // missing stance
        ],
      });

      expect(result.status).toBe('structural_illegal');
      // Transaction rolled back — no nodes either
      expect(db.select().from(nodes).all()).toHaveLength(0);
      const [clock] = db.select().from(graphClock).all();
      expect(clock!.lsn).toBe(0);
    });

    it('if post-insert edge validation fails, no nodes, change log, or counter state is written', () => {
      const result = executor.commitGraph({
        specId,
        nodes: [
          { ref: 'n1', plane: 'intent', kind: 'goal', title: 'Valid goal' },
          { ref: 'n2', plane: 'intent', kind: 'context', title: 'Valid ctx' },
        ],
        edges: [{ category: 'proof', source: 'n1', target: 'n2' }],
      });

      expect(result.status).toBe('structural_illegal');
      expect(db.select().from(nodes).all()).toHaveLength(0);
      expect(db.select().from(edges).all()).toHaveLength(0);
      expect(db.select().from(changeLog).all()).toHaveLength(0);
      expect(db.select().from(nodeKindCounters).all()).toHaveLength(0);
    });

    it('diagnostics include which entry failed', () => {
      const result = executor.commitGraph({
        specId,
        nodes: [{ ref: 'n1', plane: 'intent', kind: 'goal', title: 'OK' }],
        edges: [{ category: 'dependency', source: 'n1', target: { existing: 9999 } }],
      });

      if (result.status !== 'structural_illegal') throw new Error('unreachable');
      expect(result.diagnostics.some((d) => d.field.startsWith('edges[0]'))).toBe(true);
    });

    // --- edge cases ---

    it('edge-only batch between existing nodes', () => {
      const a = executor.createNode({ specId, plane: 'intent', kind: 'requirement', title: 'R1' });
      const b = executor.createNode({ specId, plane: 'intent', kind: 'assumption', title: 'A1' });
      if (a.status !== 'success' || b.status !== 'success') throw new Error('unreachable');

      const result = executor.commitGraph({
        specId,
        nodes: [],
        edges: [
          {
            category: 'dependency',
            source: { existing: b.nodeId },
            target: { existing: a.nodeId },
          },
        ],
      });

      expect(result.status).toBe('success');
      if (result.status !== 'success') throw new Error('unreachable');
      expect(Object.keys(result.nodes)).toHaveLength(0);
      expect(result.edges).toHaveLength(1);
    });

    it('node-only batch (no edges)', () => {
      const result = executor.commitGraph({
        specId,
        nodes: [
          { ref: 'n1', plane: 'intent', kind: 'context', title: 'C1' },
          { ref: 'n2', plane: 'intent', kind: 'context', title: 'C2' },
        ],
        edges: [],
      });

      expect(result.status).toBe('success');
      if (result.status !== 'success') throw new Error('unreachable');
      expect(Object.keys(result.nodes)).toHaveLength(2);
      expect(result.edges).toEqual([]);
    });

    it('empty batch → structural_illegal', () => {
      const result = executor.commitGraph({ specId, nodes: [], edges: [] });
      expect(result.status).toBe('structural_illegal');
    });

    it('dry-run rejects nonexistent spec before review-set proposals can be surfaced', () => {
      const missingSpecId = specId + 10_000;
      const input: CommitGraphInput = {
        specId: missingSpecId,
        nodes: [{ ref: 'n1', plane: 'intent', kind: 'goal', title: 'Missing spec goal' }],
        edges: [],
      };

      const dryRun = executor.dryRunCommitGraph(input);
      const commit = executor.commitGraph(input);

      expect(dryRun).toMatchObject({
        status: 'structural_illegal',
        diagnostics: [{ field: 'specId' }],
      });
      expect(commit).toMatchObject({
        status: 'structural_illegal',
        diagnostics: [{ field: 'specId' }],
      });
      expect(db.select().from(nodes).all()).toHaveLength(0);
    });

    // --- mixed refs ---

    it('edges can mix intra-batch source with existing target', () => {
      const pre = executor.createNode({ specId, plane: 'intent', kind: 'goal', title: 'Existing' });
      if (pre.status !== 'success') throw new Error('unreachable');

      const result = executor.commitGraph({
        specId,
        nodes: [{ ref: 'new', plane: 'intent', kind: 'requirement', title: 'New' }],
        edges: [
          {
            category: 'realization',
            source: { existing: pre.nodeId },
            target: 'new',
          },
        ],
      });

      expect(result.status).toBe('success');
      if (result.status !== 'success') throw new Error('unreachable');
      const edgeRow = db.select().from(edges).all()[0]!;
      expect(edgeRow.source_id).toBe(pre.nodeId);
      expect(edgeRow.target_id).toBe(result.nodes['new']);
    });

    // --- LSN behavior ---

    it('uses one LSN for the entire batch (not per-entity)', () => {
      const result = executor.commitGraph({
        specId,
        nodes: [
          { ref: 'n1', plane: 'intent', kind: 'goal', title: 'G1' },
          { ref: 'n2', plane: 'intent', kind: 'goal', title: 'G2' },
        ],
        edges: [{ category: 'association', source: 'n1', target: 'n2' }],
      });

      if (result.status !== 'success') throw new Error('unreachable');
      const allNodes = db.select().from(nodes).all();
      const allEdges = db.select().from(edges).all();
      // All entities share the same LSN
      for (const n of allNodes) {
        expect(n.created_at_lsn).toBe(result.lsn);
      }
      for (const e of allEdges) {
        expect(e.created_at_lsn).toBe(result.lsn);
      }
    });
  });

  // --- createReconciliationNeed ---

  describe('createReconciliationNeed', () => {
    it('creates a recon need targeting an edge and returns success with id and lsn', () => {
      // Seed a node and edge first
      const batch = executor.commitGraph({
        specId,
        nodes: [
          { ref: 'r1', plane: 'intent', kind: 'requirement', title: 'R1' },
          { ref: 'a1', plane: 'intent', kind: 'assumption', title: 'A1' },
        ],
        edges: [{ category: 'dependency', source: 'r1', target: 'a1' }],
      });
      expect(batch.status).toBe('success');
      if (batch.status !== 'success') throw new Error('unreachable');
      const edgeId = batch.edges[0]!;

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
      const batch = executor.commitGraph({
        specId,
        nodes: [
          { ref: 'r1', plane: 'intent', kind: 'requirement', title: 'R1' },
          { ref: 'r2', plane: 'intent', kind: 'requirement', title: 'R2' },
        ],
        edges: [],
      });
      expect(batch.status).toBe('success');
      if (batch.status !== 'success') throw new Error('unreachable');
      const aId = batch.nodes['r1']!;
      const bId = batch.nodes['r2']!;

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

  // --- resolveReconciliationNeed ---

  describe('resolveReconciliationNeed', () => {
    it('resolves an open need and records resolvedAtLsn', () => {
      const batch = executor.commitGraph({
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
        target: { kind: 'edge', edgeId: batch.edges[0]! },
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
      const batch = executor.commitGraph({
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
        target: { kind: 'edge', edgeId: batch.edges[0]! },
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
      const batch = executor.commitGraph({
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
        target: { kind: 'edge', edgeId: batch.edges[0]! },
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
