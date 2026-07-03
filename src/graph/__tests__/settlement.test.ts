/**
 * Settlement materialization tests (Card 5, elicitation-gap-guidance frontier).
 *
 * SPEC: D63-L, D99-L, I52-L — `settlement` (advisory | settled) is a graph-item
 * dimension orthogonal to `basis`. These tests prove: the schema persists it
 * separately from basis, CommandExecutor enforces the advisory->settled
 * promotion direction (never the reverse), and read-side filtering lets
 * projection/plan/commitment readers exclude advisory items from "settled"
 * reads (I52-L).
 */

import { eq } from 'drizzle-orm';
import { describe, expect, it, beforeEach } from 'vitest';

import { createDb, type BrunchDb } from '../../db/connection.js';
import { edges, graphClock, nodes, specs } from '../../db/schema.js';
import { CommandExecutor } from '../command-executor.js';
import { queryGraph } from '../queries.js';
import { runCreateOnlyMutation } from './support/create-only-mutation.js';

function createTestDb(): BrunchDb {
  return createDb(':memory:');
}

describe('graph item settlement (D99-L, I52-L)', () => {
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

  it("defaults createNode settlement to 'settled'", () => {
    executor.createNode({ specId, plane: 'intent', kind: 'goal', title: 'Some goal' });
    const row = db.select().from(nodes).all()[0];
    expect(row!.settlement).toBe('settled');
  });

  it('persists an explicit advisory createNode settlement', () => {
    executor.createNode({
      specId,
      plane: 'intent',
      kind: 'context',
      title: 'Observed from brownfield code',
      settlement: 'advisory',
    });
    const row = db.select().from(nodes).all()[0];
    expect(row!.settlement).toBe('advisory');
  });

  it('rejects an invalid createNode settlement value', () => {
    const result = executor.createNode({
      specId,
      plane: 'intent',
      kind: 'goal',
      title: 'Bad settlement',
      settlement: 'reviewed' as never,
    });
    expect(result.status).toBe('structural_illegal');
    if (result.status !== 'structural_illegal') throw new Error('unreachable');
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'settlement' })]),
    );
    expect(db.select().from(nodes).all()).toHaveLength(0);
  });

  it('mutateGraph batch create applies createSettlement to nodes and edges alike', () => {
    const result = runCreateOnlyMutation(executor, {
      specId,
      settlement: 'advisory',
      nodes: [
        { ref: 'g1', plane: 'intent', kind: 'goal', title: 'Digest-sourced goal' },
        { ref: 'r1', plane: 'intent', kind: 'requirement', title: 'Digest-sourced requirement' },
      ],
      edges: [{ category: 'dependency', source: 'g1', target: 'r1' }],
    });
    expect(result.status).toBe('success');
    if (result.status !== 'success') throw new Error('unreachable');

    const nodeRows = db.select().from(nodes).all();
    expect(nodeRows.map((row) => row.settlement)).toEqual(['advisory', 'advisory']);
    const edgeRows = db.select().from(edges).all();
    expect(edgeRows.map((row) => row.settlement)).toEqual(['advisory']);
  });

  it('patch_node promotes an advisory node to settled', () => {
    const seed = runCreateOnlyMutation(executor, {
      specId,
      settlement: 'advisory',
      nodes: [{ ref: 'g1', plane: 'intent', kind: 'goal', title: 'Digest-sourced goal' }],
      edges: [],
    });
    if (seed.status !== 'success') throw new Error('unreachable');
    const nodeId = seed.createdNodes['g1']!.id;

    const result = executor.mutateGraph({
      specId,
      ops: [{ op: 'patch_node', node: { existing: nodeId }, patch: { settlement: 'settled' } }],
    });

    expect(result.status).toBe('success');
    const row = db.select().from(nodes).where(eq(nodes.id, nodeId)).get();
    expect(row!.settlement).toBe('settled');
  });

  it('rejects a patch_node regression from settled back to advisory (I52-L)', () => {
    const seed = runCreateOnlyMutation(executor, {
      specId,
      nodes: [{ ref: 'g1', plane: 'intent', kind: 'goal', title: 'Directly-stated goal' }],
      edges: [],
    });
    if (seed.status !== 'success') throw new Error('unreachable');
    const nodeId = seed.createdNodes['g1']!.id;

    const result = executor.mutateGraph({
      specId,
      ops: [{ op: 'patch_node', node: { existing: nodeId }, patch: { settlement: 'advisory' } }],
    });

    expect(result.status).toBe('structural_illegal');
    const row = db.select().from(nodes).where(eq(nodes.id, nodeId)).get();
    expect(row!.settlement).toBe('settled');
  });

  it('queryGraph settlement filter excludes advisory nodes from a settled-only read', () => {
    runCreateOnlyMutation(executor, {
      specId,
      settlement: 'advisory',
      nodes: [{ ref: 'advisoryGoal', plane: 'intent', kind: 'goal', title: 'Advisory goal' }],
      edges: [],
    });
    runCreateOnlyMutation(executor, {
      specId,
      nodes: [{ ref: 'settledGoal', plane: 'intent', kind: 'goal', title: 'Settled goal' }],
      edges: [],
    });

    const settledOnly = queryGraph(db, specId, { settlement: ['settled'] });
    expect(settledOnly.nodes.map((node) => node.title)).toEqual(['Settled goal']);

    const everything = queryGraph(db, specId);
    expect(everything.nodes).toHaveLength(2);
  });

  it('queryGraph settlement filter excludes an advisory edge even between two settled nodes', () => {
    const seed = runCreateOnlyMutation(executor, {
      specId,
      nodes: [
        { ref: 'g1', plane: 'intent', kind: 'goal', title: 'Settled goal' },
        { ref: 'r1', plane: 'intent', kind: 'requirement', title: 'Settled requirement' },
      ],
      edges: [],
    });
    if (seed.status !== 'success') throw new Error('unreachable');
    const g1 = seed.createdNodes['g1']!.id;
    const r1 = seed.createdNodes['r1']!.id;

    runCreateOnlyMutation(executor, {
      specId,
      settlement: 'advisory',
      nodes: [],
      edges: [{ category: 'dependency', source: { existing: g1 }, target: { existing: r1 } }],
    });

    const settledOnly = queryGraph(db, specId, { settlement: ['settled'] });
    expect(settledOnly.nodes).toHaveLength(2);
    expect(settledOnly.edges).toHaveLength(0);

    const everything = queryGraph(db, specId);
    expect(everything.edges).toHaveLength(1);
  });

  it('patch_edge promotes an advisory edge to settled', () => {
    const seed = runCreateOnlyMutation(executor, {
      specId,
      settlement: 'advisory',
      nodes: [
        { ref: 'g1', plane: 'intent', kind: 'goal', title: 'Goal' },
        { ref: 'r1', plane: 'intent', kind: 'requirement', title: 'Requirement' },
      ],
      edges: [{ category: 'dependency', source: 'g1', target: 'r1' }],
    });
    if (seed.status !== 'success') throw new Error('unreachable');
    const edgeId = seed.createdEdges[0]!;

    const result = executor.mutateGraph({
      specId,
      ops: [{ op: 'patch_edge', edge: { existing: edgeId }, patch: { settlement: 'settled' } }],
    });

    expect(result.status).toBe('success');
    const row = db.select().from(edges).where(eq(edges.id, edgeId)).get();
    expect(row!.settlement).toBe('settled');
  });

  it('rejects a patch_edge regression from settled back to advisory (I52-L)', () => {
    const seed = runCreateOnlyMutation(executor, {
      specId,
      nodes: [
        { ref: 'g1', plane: 'intent', kind: 'goal', title: 'Goal' },
        { ref: 'r1', plane: 'intent', kind: 'requirement', title: 'Requirement' },
      ],
      edges: [{ category: 'dependency', source: 'g1', target: 'r1' }],
    });
    if (seed.status !== 'success') throw new Error('unreachable');
    const edgeId = seed.createdEdges[0]!;

    const result = executor.mutateGraph({
      specId,
      ops: [{ op: 'patch_edge', edge: { existing: edgeId }, patch: { settlement: 'advisory' } }],
    });

    expect(result.status).toBe('structural_illegal');
    const row = db.select().from(edges).where(eq(edges.id, edgeId)).get();
    expect(row!.settlement).toBe('settled');
  });
});
