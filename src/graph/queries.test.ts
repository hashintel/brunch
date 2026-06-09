import { beforeEach, describe, expect, it } from 'vitest';

import { createDb, type BrunchDb } from '../db/connection.js';
import { graphClock, specs } from '../db/schema.js';
import { CommandExecutor } from './command-executor.js';
import { getOpenElicitationBacklogEntries, getOpenReconciliationNeeds } from './queries.js';
import { NODE_KIND_METADATA, parseGraphNodeCode } from './schema/nodes.js';

function createTestDb(): BrunchDb {
  return createDb(':memory:');
}

describe('graph node code metadata', () => {
  it('uses globally unique 1-3 letter labels and parses by longest prefix', () => {
    const labels = Object.values(NODE_KIND_METADATA).map((metadata) => metadata.label);
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels.every((label) => /^[A-Z]{1,3}$/.test(label))).toBe(true);
    expect(Object.values(NODE_KIND_METADATA).every((metadata) => metadata.readinessBands.length > 0)).toBe(
      true,
    );
    expect(parseGraphNodeCode('A1')).toEqual({ kind: 'assumption', kindOrdinal: 1 });
    expect(parseGraphNodeCode('CON2')).toEqual({ kind: 'constraint', kindOrdinal: 2 });
    expect(parseGraphNodeCode('REQ3')).toEqual({ kind: 'requirement', kindOrdinal: 3 });
    expect(parseGraphNodeCode('AC4')).toEqual({ kind: 'criterion', kindOrdinal: 4 });
  });
});

describe('getOpenReconciliationNeeds', () => {
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

  it('returns open needs as typed domain objects and excludes resolved needs', () => {
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
      reason: 'upstream changed',
    });
    expect(create.status).toBe('success');
    if (create.status !== 'success') throw new Error('unreachable');

    expect(getOpenReconciliationNeeds(db, specId)).toMatchObject([
      {
        kind: 'edge_revalidation',
        target: { kind: 'edge', edgeId: batch.edges[0]! },
        rationale: 'upstream changed',
      },
    ]);

    executor.resolveReconciliationNeed({ specId, id: create.id });
    expect(getOpenReconciliationNeeds(db, specId)).toEqual([]);
  });
});

describe('getOpenElicitationBacklogEntries', () => {
  let db: BrunchDb;
  let executor: CommandExecutor;
  let specId: number;

  beforeEach(() => {
    db = createTestDb();
    executor = new CommandExecutor(db);
    const created = executor.createSpec({ name: 'Test Spec', slug: 'test-spec' });
    expect(created.status).toBe('success');
    if (created.status !== 'success') throw new Error('unreachable');
    specId = created.specId;
  });

  it('returns only open entries for the requested spec', () => {
    const other = executor.createSpec({ name: 'Other Spec', slug: 'other-spec' });
    expect(other.status).toBe('success');
    if (other.status !== 'success') throw new Error('unreachable');

    const created = executor.createElicitationBacklogEntry({
      specId,
      kind: 'follow_on_question',
      question: 'What evidence would prove this is working?',
      readinessBand: 'elicitation',
      planeAffinity: 'oracle',
      lensAffinity: 'oracle',
    });
    expect(created.status).toBe('success');
    if (created.status !== 'success') throw new Error('unreachable');

    const resolvedNode = executor.createNode({
      specId,
      plane: 'intent',
      kind: 'goal',
      title: 'Goal clarified',
    });
    expect(resolvedNode.status).toBe('success');
    if (resolvedNode.status !== 'success') throw new Error('unreachable');

    expect(
      executor.closeElicitationBacklogEntry({
        specId,
        id: created.id,
        resolvedByNodeId: resolvedNode.nodeId,
      }).status,
    ).toBe('success');

    expect(getOpenElicitationBacklogEntries(db, specId)).toHaveLength(4);
    expect(getOpenElicitationBacklogEntries(db, other.specId)).toHaveLength(4);
  });
});
