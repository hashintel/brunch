/**
 * DB-facing derived `edge_revalidation` read path — the tracer's I/O shell.
 *
 * Proves the derived read surfaces over real graph state, stays distinct from
 * persisted `getOpenReconciliationNeeds`, and — the I16-L stop-the-line — writes
 * nothing: no `reconciliation_need` rows and no node/edge byte-state change.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { createDb, type BrunchDb } from '../../db/connection.js';
import {
  edges as edgesTable,
  graphClock,
  nodes as nodesTable,
  reconciliationNeed,
  specs,
} from '../../db/schema.js';
import { CommandExecutor } from '../command-executor.js';
import { getDerivedEdgeRevalidations, getOpenReconciliationNeeds } from '../queries.js';
import { runCreateOnlyMutation } from './support/create-only-mutation.js';

interface StaleFixture {
  readonly edgeId: number;
  readonly upstreamNodeId: number;
  readonly downstreamNodeId: number;
}

function snapshot(db: BrunchDb) {
  return {
    needCount: db.select().from(reconciliationNeed).all().length,
    nodeLsns: db
      .select({ id: nodesTable.id, lsn: nodesTable.updated_at_lsn })
      .from(nodesTable)
      .all()
      .map((r) => `${r.id}:${r.lsn}`)
      .sort()
      .join(','),
    edgeLsns: db
      .select({ id: edgesTable.id, lsn: edgesTable.updated_at_lsn })
      .from(edgesTable)
      .all()
      .map((r) => `${r.id}:${r.lsn}`)
      .sort()
      .join(','),
  };
}

describe('getDerivedEdgeRevalidations', () => {
  let db: BrunchDb;
  let executor: CommandExecutor;
  let specId: number;

  /** Create source→target dependency edge, then bump the upstream (source) node so the edge is stale. */
  function seedStaleDependency(): StaleFixture {
    const batch = runCreateOnlyMutation(executor, {
      specId,
      nodes: [
        { ref: 'r1', plane: 'intent', kind: 'requirement', title: 'R1' },
        { ref: 'a1', plane: 'intent', kind: 'assumption', title: 'A1' },
      ],
      edges: [{ category: 'dependency', source: 'r1', target: 'a1' }],
    });
    if (batch.status !== 'success') throw new Error('seed batch failed');
    const upstreamNodeId = batch.createdNodes['r1']!.id;
    const downstreamNodeId = batch.createdNodes['a1']!.id;
    const edgeId = batch.createdEdges[0]!;

    const bump = executor.mutateGraph({
      specId,
      ops: [{ op: 'patch_node', node: { existing: upstreamNodeId }, patch: { title: 'R1 revised' } }],
    });
    if (bump.status !== 'success') throw new Error('bump failed');

    return { edgeId, upstreamNodeId, downstreamNodeId };
  }

  beforeEach(() => {
    db = createDb(':memory:');
    executor = new CommandExecutor(db);
    db.insert(specs).values({ name: 'Test Spec', slug: 'test' }).run();
    specId = db.select({ id: specs.id }).from(specs).get()!.id;
    db.insert(graphClock).values({ spec_id: specId, lsn: 0 }).run();
  });

  it('surfaces a derived entry for an edge whose upstream endpoint updated after the edge', () => {
    const { edgeId, upstreamNodeId, downstreamNodeId } = seedStaleDependency();

    expect(getDerivedEdgeRevalidations(db, specId)).toMatchObject([
      {
        derived: true,
        kind: 'edge_revalidation',
        edgeId,
        category: 'dependency',
        impactKind: 'cascade',
        downstreamEndpoint: 'target',
        upstreamNodeId,
        downstreamNodeId,
      },
    ]);
  });

  it('is distinct from persisted needs: derived staleness surfaces with no persisted need present', () => {
    seedStaleDependency();
    // No agent authored a reconciliation_need; the derived read still reports staleness.
    expect(getOpenReconciliationNeeds(db, specId)).toEqual([]);
    expect(getDerivedEdgeRevalidations(db, specId)).toHaveLength(1);
  });

  it('performs no writes — reconciliation_need count and node/edge LSN state are unchanged (I16-L)', () => {
    seedStaleDependency();
    const before = snapshot(db);
    getDerivedEdgeRevalidations(db, specId);
    getDerivedEdgeRevalidations(db, specId);
    expect(snapshot(db)).toEqual(before);
  });
});
