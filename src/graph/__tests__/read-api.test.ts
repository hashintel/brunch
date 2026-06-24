import { beforeEach, describe, expect, it } from 'vitest';

import { createDb, type BrunchDb } from '../../db/connection.js';
import { graphClock, specs } from '../../db/schema.js';
import { CommandExecutor } from '../command-executor.js';
import { getNodes, queryGraph } from '../queries.js';
import { runCreateOnlyMutation } from './support/create-only-mutation.js';

function createTestDb(): BrunchDb {
  return createDb(':memory:');
}

describe('graph read API', () => {
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

  it('queryGraph returns the selected-spec graph and applies active/all visibility', () => {
    const legacy = executor.createNode({
      specId,
      plane: 'intent',
      kind: 'requirement',
      title: 'Legacy requirement',
    });
    expect(legacy.status).toBe('success');
    if (legacy.status !== 'success') throw new Error('unreachable');

    const batch = runCreateOnlyMutation(executor, {
      specId,
      nodes: [{ ref: 'r2', plane: 'intent', kind: 'requirement', title: 'Current requirement' }],
      edges: [{ category: 'supersession', source: 'r2', target: { existing: legacy.nodeId } }],
    });
    expect(batch.status).toBe('success');

    expect(queryGraph(db, specId).nodes.map((node) => node.title)).toEqual(['Current requirement']);
    expect(
      queryGraph(db, specId, undefined, { visibility: 'all' })
        .nodes.map((node) => node.title)
        .sort(),
    ).toEqual(['Current requirement', 'Legacy requirement']);
  });

  it('getNodes resolves ids and codes, preserving selector order and per-node context', () => {
    const batch = runCreateOnlyMutation(executor, {
      specId,
      nodes: [
        { ref: 'g1', plane: 'intent', kind: 'goal', title: 'Goal' },
        { ref: 'r1', plane: 'intent', kind: 'requirement', title: 'Requirement' },
        { ref: 'a1', plane: 'intent', kind: 'assumption', title: 'Assumption' },
      ],
      edges: [
        { category: 'realization', source: 'g1', target: 'r1' },
        { category: 'dependency', source: 'r1', target: 'a1' },
      ],
    });
    expect(batch.status).toBe('success');
    if (batch.status !== 'success') throw new Error('unreachable');

    const results = getNodes(
      db,
      specId,
      [{ code: 'G1' }, { id: batch.createdNodes.r1!.id }, { code: 'NOPE' }],
      { hops: 1 },
    );

    expect(results.map((result) => result.status)).toEqual(['found', 'found', 'not_found']);
    const [goal, requirement] = results;
    if (goal?.status !== 'found' || requirement?.status !== 'found') throw new Error('unreachable');
    expect(goal.node.title).toBe('Goal');
    expect(goal.related.map((node) => node.title)).toEqual(['Requirement']);
    expect(requirement.related.map((node) => node.title).sort()).toEqual(['Assumption', 'Goal']);
    expect(requirement.edges).toHaveLength(2);
  });

  it('queryGraph supports positive and negative node/edge predicates', () => {
    const batch = runCreateOnlyMutation(executor, {
      specId,
      nodes: [
        { ref: 'r1', plane: 'intent', kind: 'requirement', title: 'Proved requirement' },
        { ref: 'r2', plane: 'intent', kind: 'requirement', title: 'Unproved requirement' },
        { ref: 'e1', plane: 'oracle', kind: 'evidence', title: 'Evidence' },
      ],
      edges: [{ category: 'witness', source: 'e1', target: 'r1', stance: 'for' }],
    });
    expect(batch.status).toBe('success');

    expect(
      queryGraph(db, specId, {
        kinds: ['requirement'],
        hasEdge: { categories: ['witness'], direction: 'incoming' },
      }).nodes.map((node) => node.title),
    ).toEqual(['Proved requirement']);

    expect(
      queryGraph(db, specId, {
        kinds: ['requirement'],
        lacksEdge: { categories: ['witness'], direction: 'incoming' },
      }).nodes.map((node) => node.title),
    ).toEqual(['Unproved requirement']);

    expect(
      queryGraph(db, specId, { bands: ['commitment'] })
        .nodes.map((node) => node.kind)
        .sort(),
    ).toEqual(['requirement', 'requirement']);
    expect(queryGraph(db, specId, { bands: ['projection'] }).nodes.map((node) => node.kind)).toEqual([
      'evidence',
    ]);
  });
});
