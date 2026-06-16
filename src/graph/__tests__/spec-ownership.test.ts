/**
 * Spec ownership isolation across the storage / command / reader / tool seam.
 *
 * SPEC: D61-L (each spec owns its own intent graph; no workspace-global graph),
 * D52-L (graph/ owns the readers), D4-L/D20-L (CommandExecutor authority).
 *
 * This is the card 1 tracer for live-graph-observer--graph-rpc-spine: every
 * graph projection and graph mutation targets exactly one spec.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import type { BrunchDb } from '../../db/connection.js';
import { createDb } from '../../db/connection.js';
import { CommandExecutor } from '../command-executor.js';
import { getNodes, getOpenReconciliationNeeds, queryGraph } from '../queries.js';
import { runCreateOnlyMutation } from './support/create-only-mutation.js';

function freshDbWithTwoSpecs(): {
  db: BrunchDb;
  executor: CommandExecutor;
  specA: number;
  specB: number;
} {
  const db = createDb(':memory:');
  const executor = new CommandExecutor(db);
  const a = executor.createSpec({ name: 'Spec A', slug: 'spec-a' });
  const b = executor.createSpec({ name: 'Spec B', slug: 'spec-b' });
  if (a.status !== 'success' || b.status !== 'success') {
    throw new Error('failed to seed specs');
  }
  return { db, executor, specA: a.specId, specB: b.specId };
}

describe('graph items are owned by spec', () => {
  let db: BrunchDb;
  let executor: CommandExecutor;
  let specA: number;
  let specB: number;

  beforeEach(() => {
    ({ db, executor, specA, specB } = freshDbWithTwoSpecs());
  });

  it('graph ownership isolation: each spec sees only its own nodes and edges', () => {
    const commitA = runCreateOnlyMutation(executor, {
      specId: specA,
      nodes: [
        { ref: 'n1', plane: 'intent', kind: 'goal', title: 'A goal' },
        { ref: 'n2', plane: 'intent', kind: 'requirement', title: 'A requirement' },
      ],
      edges: [{ category: 'dependency', source: 'n2', target: 'n1' }],
    });
    expect(commitA.status).toBe('success');

    const commitB = runCreateOnlyMutation(executor, {
      specId: specB,
      nodes: [{ ref: 'm1', plane: 'intent', kind: 'goal', title: 'B goal' }],
      edges: [],
    });
    expect(commitB.status).toBe('success');

    const overviewA = queryGraph(db, specA);
    const overviewB = queryGraph(db, specB);

    expect(overviewA.nodes).toHaveLength(2);
    expect(overviewA.edges).toHaveLength(1);
    expect(overviewA.nodes.every((n) => n.title.startsWith('A '))).toBe(true);

    expect(overviewB.nodes).toHaveLength(1);
    expect(overviewB.edges).toHaveLength(0);
    expect(overviewB.nodes[0]!.title).toBe('B goal');
  });

  it('existing-ref guard: the create-only mutateGraph helper rejects an existing ref from another spec', () => {
    const seed = runCreateOnlyMutation(executor, {
      specId: specA,
      nodes: [{ ref: 'n1', plane: 'intent', kind: 'goal', title: 'A goal' }],
      edges: [],
    });
    if (seed.status !== 'success') throw new Error('seed failed');
    const aNodeId = seed.createdNodes['n1']!.id;

    const attempt = runCreateOnlyMutation(executor, {
      specId: specB,
      nodes: [{ ref: 'm1', plane: 'intent', kind: 'requirement', title: 'B req' }],
      edges: [{ category: 'dependency', source: 'm1', target: { existing: aNodeId } }],
    });

    expect(attempt.status).toBe('structural_illegal');
    if (attempt.status === 'structural_illegal') {
      const messages = attempt.diagnostics.map((d) => d.message).join(' | ');
      expect(messages).toMatch(/spec/i);
    }

    // Nothing was written for spec B
    const overviewB = queryGraph(db, specB);
    expect(overviewB.nodes).toHaveLength(0);
  });

  it('endpoint guard: an edge cannot connect nodes from different specs', () => {
    const seedA = runCreateOnlyMutation(executor, {
      specId: specA,
      nodes: [{ ref: 'n1', plane: 'intent', kind: 'goal', title: 'A goal' }],
      edges: [],
    });
    const seedB = runCreateOnlyMutation(executor, {
      specId: specB,
      nodes: [{ ref: 'm1', plane: 'intent', kind: 'goal', title: 'B goal' }],
      edges: [],
    });
    if (seedA.status !== 'success' || seedB.status !== 'success') {
      throw new Error('seed failed');
    }
    const aNodeId = seedA.createdNodes['n1']!.id;
    const bNodeId = seedB.createdNodes['m1']!.id;

    // Attempt edge across specs (both endpoints existing)
    const attempt = runCreateOnlyMutation(executor, {
      specId: specA,
      nodes: [],
      edges: [
        {
          category: 'dependency',
          source: { existing: aNodeId },
          target: { existing: bNodeId },
        },
      ],
    });

    expect(attempt.status).toBe('structural_illegal');
  });

  it('reader guard: getNodeNeighborhood is not_found for a node owned by another spec', () => {
    const seedA = runCreateOnlyMutation(executor, {
      specId: specA,
      nodes: [{ ref: 'n1', plane: 'intent', kind: 'goal', title: 'A goal' }],
      edges: [],
    });
    if (seedA.status !== 'success') throw new Error('seed failed');
    const aNodeId = seedA.createdNodes['n1']!.id;

    const [wrongSpec] = getNodes(db, specB, [{ id: aNodeId }]);
    expect(wrongSpec?.status).toBe('not_found');

    const [rightSpec] = getNodes(db, specA, [{ id: aNodeId }]);
    expect(rightSpec?.status).toBe('found');
  });

  it('reconciliation needs are spec-scoped and reject cross-spec targets', () => {
    const seedA = runCreateOnlyMutation(executor, {
      specId: specA,
      nodes: [
        { ref: 'n1', plane: 'intent', kind: 'goal', title: 'A goal' },
        { ref: 'n2', plane: 'intent', kind: 'requirement', title: 'A req' },
      ],
      edges: [{ category: 'dependency', source: 'n2', target: 'n1' }],
    });
    const seedB = runCreateOnlyMutation(executor, {
      specId: specB,
      nodes: [{ ref: 'm1', plane: 'intent', kind: 'goal', title: 'B goal' }],
      edges: [],
    });
    if (seedA.status !== 'success' || seedB.status !== 'success') {
      throw new Error('seed failed');
    }
    const aEdgeId = seedA.createdEdges[0]!;
    const bNodeId = seedB.createdNodes['m1']!.id;
    const aNodeId = seedA.createdNodes['n1']!.id;

    // Valid same-spec need
    const ok = executor.createReconciliationNeed({
      specId: specA,
      target: { kind: 'edge', edgeId: aEdgeId },
      needKind: 'staleness',
    });
    expect(ok.status).toBe('success');

    // Cross-spec node pair rejected
    const crossPair = executor.createReconciliationNeed({
      specId: specA,
      target: { kind: 'node_pair', aId: aNodeId, bId: bNodeId },
      needKind: 'contradiction',
    });
    expect(crossPair.status).toBe('structural_illegal');

    // Resolve scoped to spec
    if (ok.status !== 'success') throw new Error('unreachable');
    const wrongSpecResolve = executor.resolveReconciliationNeed({ specId: specB, id: ok.id });
    expect(wrongSpecResolve.status).toBe('structural_illegal');

    // Listing scoped to spec and wrong-spec resolve leaves the need open
    const needsA = getOpenReconciliationNeeds(db, specA);
    const needsB = getOpenReconciliationNeeds(db, specB);
    expect(needsA).toHaveLength(1);
    expect(needsB).toHaveLength(0);

    const rightSpecResolve = executor.resolveReconciliationNeed({ specId: specA, id: ok.id });
    expect(rightSpecResolve.status).toBe('success');
    expect(getOpenReconciliationNeeds(db, specA)).toHaveLength(0);
  });
});

describe('tool guard: agent-facing graph tool schemas do not expose specId', () => {
  it('MutateGraphParams has no top-level specId field', async () => {
    const mod = await import('../../.pi/extensions/graph/tool-schemas.js');
    // Sinclair TypeBox object schemas store fields under `properties`
    const schema = mod.MutateGraphParams as unknown as {
      properties: Record<string, unknown>;
    };
    expect(Object.keys(schema.properties)).not.toContain('specId');
    expect(Object.keys(schema.properties)).not.toContain('spec_id');
  });

  it('ReadGraphParams has no top-level specId field', async () => {
    const mod = await import('../../.pi/extensions/graph/tool-schemas.js');
    const { Value } = await import('typebox/value');
    expect(Value.Check(mod.ReadGraphParams, { mode: 'overview', specId: 1 })).toBe(false);
    expect(Value.Check(mod.ReadGraphParams, { mode: 'overview', spec_id: 1 })).toBe(false);
  });
});
