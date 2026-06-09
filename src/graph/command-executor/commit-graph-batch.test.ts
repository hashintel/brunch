import { eq } from 'drizzle-orm';
import { describe, expect, it, beforeEach } from 'vitest';

import { createDb, type BrunchDb } from '../../db/connection.js';
import { changeLog, edges, graphClock, nodeKindCounters, nodes, specs } from '../../db/schema.js';
import { CommandExecutor } from '../command-executor.js';
import type { CommitGraphInput, CommitGraphResult } from '../command-executor.js';

function createTestDb(): BrunchDb {
  return createDb(':memory:');
}

function graphClockLsn(db: BrunchDb, specId: number): number {
  return (
    db.select({ lsn: graphClock.lsn }).from(graphClock).where(eq(graphClock.spec_id, specId)).get()?.lsn ?? 0
  );
}

function expectMatchingStructuralDiagnostics(
  dryRun: ReturnType<CommandExecutor['dryRunCommitGraph']>,
  commit: CommitGraphResult,
): void {
  expect(dryRun.status).toBe('structural_illegal');
  expect(commit.status).toBe('structural_illegal');
  if (dryRun.status !== 'structural_illegal' || commit.status !== 'structural_illegal') {
    throw new Error('unreachable');
  }
  expect(commit.diagnostics).toEqual(dryRun.diagnostics);
}

describe('CommandExecutor commitGraph', () => {
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
    db.insert(graphClock).values({ spec_id: specId, lsn: 0 }).run();
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
      expect(Object.keys(result.createdNodes)).toHaveLength(2);
      expect(result.edges).toHaveLength(1);

      // Verify DB state
      expect(db.select().from(nodes).all()).toHaveLength(2);
      expect(db.select().from(edges).all()).toHaveLength(1);
    });

    it('plans commits inside the transaction before allocating an LSN', () => {
      const guardedDb = db as BrunchDb & { select: BrunchDb['select'] };
      const originalSelect = guardedDb.select;
      let result: ReturnType<CommandExecutor['commitGraph']> | undefined;

      guardedDb.select = (() => {
        throw new Error('commitGraph planned outside its transaction');
      }) as BrunchDb['select'];
      try {
        result = executor.commitGraph({
          specId,
          nodes: [{ ref: 'n1', plane: 'intent', kind: 'goal', title: 'Goal' }],
          edges: [],
        });
      } finally {
        guardedDb.select = originalSelect;
      }

      expect(result?.status).toBe('success');
      expect(graphClockLsn(db, specId)).toBe(1);
      expect(db.select().from(nodes).all()).toHaveLength(1);
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
      expect(edgeRow.source_id).toBe(result.createdNodes['a']!.id);
      expect(edgeRow.target_id).toBe(result.createdNodes['b']!.id);
    });

    it('applies one batch approval basis to all created nodes and edges', () => {
      const result = executor.commitGraph({
        specId,
        basis: 'implicit',
        nodes: [
          { ref: 'n1', plane: 'intent', kind: 'goal', title: 'G1' },
          { ref: 'n2', plane: 'intent', kind: 'requirement', title: 'R1' },
        ],
        edges: [{ category: 'realization', source: 'n1', target: 'n2' }],
      });

      expect(result.status).toBe('success');
      expect(
        db
          .select()
          .from(nodes)
          .all()
          .map((row) => row.basis),
      ).toEqual(['implicit', 'implicit']);
      expect(
        db
          .select()
          .from(edges)
          .all()
          .map((row) => row.basis),
      ).toEqual(['implicit']);
      expect(JSON.parse(db.select().from(changeLog).all()[0]!.payload).basis).toBe('implicit');
    });

    it('rejects retired accepted_review_set basis at the command boundary', () => {
      const result = executor.commitGraph({
        specId,
        basis: 'accepted_review_set' as never,
        nodes: [{ ref: 'n1', plane: 'intent', kind: 'goal', title: 'G1' }],
        edges: [],
      });

      expect(result.status).toBe('structural_illegal');
      if (result.status !== 'structural_illegal') throw new Error('unreachable');
      expect(result.diagnostics).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'basis' })]),
      );
      expect(db.select().from(nodes).all()).toHaveLength(0);
      expect(db.select().from(changeLog).all()).toHaveLength(0);
    });

    it('resolves existing-node refs to verified NodeIds', () => {
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
      expect(edgeRow.target_id).toBe(result.createdNodes['n1']!.id);
    });

    it('returns projected node codes for created-node refs without accepting code refs at mutation boundary', () => {
      const result = executor.commitGraph({
        specId,
        nodes: [{ ref: 'n1', plane: 'intent', kind: 'requirement', title: 'New req' }],
        edges: [],
      });

      expect(result.status).toBe('success');
      if (result.status !== 'success') throw new Error('unreachable');
      expect(result.createdNodes).toEqual({ n1: { id: expect.any(Number), code: 'REQ1' } });
    });

    it('returns one created-node identity shape and edges array in success result', () => {
      const result = executor.commitGraph({
        specId,
        nodes: [
          { ref: 'x', plane: 'intent', kind: 'context', title: 'Ctx' },
          { ref: 'y', plane: 'intent', kind: 'thesis', title: 'Thesis' },
        ],
        edges: [],
      });

      if (result.status !== 'success') throw new Error('unreachable');
      expect(result.createdNodes['x']!.id).toBeTypeOf('number');
      expect(result.createdNodes['x']!.code).toBe('CTX1');
      expect(result.createdNodes['y']!.id).toBeTypeOf('number');
      expect(result.createdNodes['y']!.code).toBe('TH1');
      expect(result.createdNodes['x']!.id).not.toBe(result.createdNodes['y']!.id);
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
      expect(graphClockLsn(db, specId)).toBe(0);
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
      expect(db.select().from(nodes).all()).toHaveLength(0);
      expect(graphClockLsn(db, specId)).toBe(0);
    });

    it('does not advance the target spec clock when a batch rolls back after sibling-spec mutations', () => {
      const otherSpec = executor.createSpec({ name: 'Other Spec', slug: 'other' });
      if (otherSpec.status !== 'success') throw new Error('unreachable');
      executor.commitGraph({
        specId: otherSpec.specId,
        nodes: [{ ref: 'other-goal', plane: 'intent', kind: 'goal', title: 'Other goal' }],
        edges: [],
      });

      const before = graphClockLsn(db, specId);
      const result = executor.commitGraph({
        specId,
        nodes: [
          { ref: 'valid', plane: 'intent', kind: 'goal', title: 'Valid goal' },
          { ref: 'invalid', plane: 'intent', kind: 'check', title: 'Invalid kind' },
        ],
        edges: [],
      });

      expect(result.status).toBe('structural_illegal');
      expect(graphClockLsn(db, specId)).toBe(before);
      expect(graphClockLsn(db, otherSpec.specId)).toBe(2);
    });

    it('rejects supersession cycles against existing edges', () => {
      const newer = executor.createNode({ specId, plane: 'intent', kind: 'requirement', title: 'R2' });
      const older = executor.createNode({ specId, plane: 'intent', kind: 'requirement', title: 'R1' });
      if (newer.status !== 'success' || older.status !== 'success') throw new Error('unreachable');
      expect(
        executor.commitGraph({
          specId,
          nodes: [],
          edges: [
            {
              category: 'supersession',
              source: { existing: newer.nodeId },
              target: { existing: older.nodeId },
            },
          ],
        }).status,
      ).toBe('success');

      const result = executor.commitGraph({
        specId,
        nodes: [],
        edges: [
          {
            category: 'supersession',
            source: { existing: older.nodeId },
            target: { existing: newer.nodeId },
          },
        ],
      });

      expectMatchingStructuralDiagnostics(
        executor.dryRunCommitGraph({
          specId,
          nodes: [],
          edges: [
            {
              category: 'supersession',
              source: { existing: older.nodeId },
              target: { existing: newer.nodeId },
            },
          ],
        }),
        result,
      );

      expect(result.status).toBe('structural_illegal');
      expect(db.select().from(edges).all()).toHaveLength(1);
    });

    it('rejects intra-batch supersession cycles', () => {
      const input: CommitGraphInput = {
        specId,
        nodes: [
          { ref: 'a', plane: 'intent', kind: 'requirement', title: 'A' },
          { ref: 'b', plane: 'intent', kind: 'requirement', title: 'B' },
        ],
        edges: [
          { category: 'supersession', source: 'a', target: 'b' },
          { category: 'supersession', source: 'b', target: 'a' },
        ],
      };

      const dryRun = executor.dryRunCommitGraph(input);
      const result = executor.commitGraph(input);

      expectMatchingStructuralDiagnostics(dryRun, result);
      expect(db.select().from(nodes).all()).toHaveLength(0);
      expect(db.select().from(edges).all()).toHaveLength(0);
      expect(db.select().from(changeLog).all()).toHaveLength(0);
    });

    it('rejects mixed existing and batch supersession cycles', () => {
      const a = executor.createNode({ specId, plane: 'intent', kind: 'requirement', title: 'A' });
      const b = executor.createNode({ specId, plane: 'intent', kind: 'requirement', title: 'B' });
      if (a.status !== 'success' || b.status !== 'success') throw new Error('unreachable');
      expect(
        executor.commitGraph({
          specId,
          nodes: [],
          edges: [
            { category: 'supersession', source: { existing: a.nodeId }, target: { existing: b.nodeId } },
          ],
        }).status,
      ).toBe('success');

      const input: CommitGraphInput = {
        specId,
        nodes: [{ ref: 'c', plane: 'intent', kind: 'requirement', title: 'C' }],
        edges: [
          { category: 'supersession', source: { existing: b.nodeId }, target: 'c' },
          { category: 'supersession', source: 'c', target: { existing: a.nodeId } },
        ],
      };

      const dryRun = executor.dryRunCommitGraph(input);
      const result = executor.commitGraph(input);

      expectMatchingStructuralDiagnostics(dryRun, result);
      expect(db.select().from(nodes).all()).toHaveLength(2);
      expect(db.select().from(edges).all()).toHaveLength(1);
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
      expect(Object.keys(result.createdNodes)).toHaveLength(0);
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
      expect(Object.keys(result.createdNodes)).toHaveLength(2);
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

    it('dry-run and commit return matching diagnostics for structural-illegal families', () => {
      const existing = executor.createNode({ specId, plane: 'intent', kind: 'goal', title: 'Existing' });
      if (existing.status !== 'success') throw new Error('unreachable');
      const cases: CommitGraphInput[] = [
        {
          specId,
          basis: 'accepted_review_set' as never,
          nodes: [{ ref: 'n1', plane: 'intent', kind: 'goal', title: 'G1' }],
          edges: [],
        },
        {
          specId,
          nodes: [{ ref: 'n1', plane: 'intent', kind: 'goal', title: 'G' }],
          edges: [{ category: 'dependency', source: { existing: 9999 }, target: 'n1' }],
        },
        {
          specId,
          nodes: [{ ref: 'n1', plane: 'intent', kind: 'check', title: 'Wrong' }],
          edges: [],
        },
        {
          specId,
          nodes: [{ ref: 'n1', plane: 'intent', kind: 'goal', title: 'G' }],
          edges: [{ category: 'association', source: 'n1', target: 'n1' }],
        },
        {
          specId,
          nodes: [
            {
              ref: 'n1',
              plane: 'intent',
              kind: 'decision',
              title: 'Bad detail',
              detail: { chosen_option: 'A' },
            },
          ],
          edges: [],
        },
        {
          specId,
          nodes: [],
          edges: [
            {
              category: 'support',
              source: { existing: existing.nodeId },
              target: { existing: existing.nodeId },
            },
          ],
        },
      ];

      for (const input of cases) {
        expectMatchingStructuralDiagnostics(executor.dryRunCommitGraph(input), executor.commitGraph(input));
      }
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
      expect(edgeRow.target_id).toBe(result.createdNodes['new']!.id);
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
});
