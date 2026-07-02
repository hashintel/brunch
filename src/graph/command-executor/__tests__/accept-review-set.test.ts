import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { createDb, type BrunchDb } from '../../../db/connection.js';
import { changeLog, edges, graphClock, nodeKindCounters, nodes, specs } from '../../../db/schema.js';
import { CommandExecutor } from '../../command-executor.js';
import type { ReviewSetProposalPayload } from '../../review-set.js';

function graphClockLsn(db: BrunchDb, specId: number): number {
  return (
    db.select({ lsn: graphClock.lsn }).from(graphClock).where(eq(graphClock.spec_id, specId)).get()?.lsn ?? 0
  );
}

function validPayload(overrides: Partial<ReviewSetProposalPayload> = {}): ReviewSetProposalPayload {
  return {
    schemaVersion: 1,
    lens: 'design',
    epistemicStatus: 'asserted',
    grounding: {
      summary: 'The reviewed graph is grounded in launch planning discussion.',
      support: ['The user requested a launch-readiness review set.'],
    },
    pitch: {
      title: 'Launch readiness review set',
      narrative: 'Two exact items and their relationship are ready for review.',
    },
    entityDrafts: [
      { draftId: 'goal-launch', proposedCode: 'G1', plane: 'intent', kind: 'goal', title: 'Launch safely' },
      {
        draftId: 'req-rollback',
        proposedCode: 'REQ1',
        plane: 'intent',
        kind: 'requirement',
        title: 'Rollback path exists',
      },
    ],
    edgeDrafts: [
      {
        category: 'realization',
        abstract: { draftId: 'req-rollback' },
        concrete: { draftId: 'goal-launch' },
      },
    ],
    ...overrides,
  };
}

describe('CommandExecutor.acceptReviewSet', () => {
  let db: BrunchDb;
  let executor: CommandExecutor;
  let specId: number;

  beforeEach(() => {
    db = createDb(':memory:');
    executor = new CommandExecutor(db);
    db.insert(specs).values({ name: 'Test Spec', slug: 'test' }).run();
    specId = db.select({ id: specs.id }).from(specs).get()!.id;
    db.insert(graphClock).values({ spec_id: specId, lsn: 0 }).run();
  });

  it('writes all reviewed nodes and edges with explicit basis', () => {
    const result = executor.acceptReviewSet({
      specId,
      proposalEntryId: 'entry-review-1',
      payload: validPayload(),
    });

    expect(result.status).toBe('success');
    expect(
      db
        .select()
        .from(nodes)
        .all()
        .map((row) => row.basis),
    ).toEqual(['explicit', 'explicit']);
    expect(
      db
        .select()
        .from(edges)
        .all()
        .map((row) => row.basis),
    ).toEqual(['explicit']);
  });

  it('uses one LSN and one accept_review_set change-log row with proposalEntryId audit metadata', () => {
    const result = executor.acceptReviewSet({
      specId,
      proposalEntryId: 'tool-result-42',
      payload: validPayload(),
    });

    expect(result.status).toBe('success');
    if (result.status !== 'success') throw new Error('unreachable');
    expect(result.lsn).toBe(1);
    expect(graphClockLsn(db, specId)).toBe(1);

    const logs = db.select().from(changeLog).all();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ spec_id: specId, lsn: 1, operation: 'accept_review_set' });
    expect(JSON.parse(logs[0]!.payload)).toMatchObject({
      specId,
      proposalEntryId: 'tool-result-42',
      createBasis: 'explicit',
      createdNodes: {
        'goal-launch': expect.any(Number),
        'req-rollback': expect.any(Number),
      },
      createdEdges: [expect.any(Number)],
    });
  });

  it('honors proposed codes and fails loudly when a counter has diverged', () => {
    const result = executor.acceptReviewSet({
      specId,
      proposalEntryId: 'proposal-codes',
      payload: validPayload(),
    });
    expect(result).toMatchObject({
      status: 'success',
      createdNodes: {
        'goal-launch': { code: 'G1' },
        'req-rollback': { code: 'REQ1' },
      },
    });

    const stale = executor.acceptReviewSet({
      specId,
      proposalEntryId: 'proposal-stale',
      payload: validPayload({
        entityDrafts: [
          { draftId: 'goal-next', proposedCode: 'G1', plane: 'intent', kind: 'goal', title: 'Next goal' },
        ],
        edgeDrafts: [
          {
            category: 'dependency',
            dependency: { existingCode: 'G1' },
            dependent: { draftId: 'goal-next' },
          },
        ],
      }),
    });
    expect(stale).toMatchObject({
      status: 'structural_illegal',
      diagnostics: [{ field: 'entityDrafts[0].proposedCode' }],
    });
  });

  it('leaves graph rows, graph clock, and kind counters unchanged on structural failure', () => {
    const before = {
      nodes: db.select().from(nodes).all().length,
      edges: db.select().from(edges).all().length,
      logs: db.select().from(changeLog).all().length,
      counters: db.select().from(nodeKindCounters).all().length,
      lsn: graphClockLsn(db, specId),
    };

    const result = executor.acceptReviewSet({
      specId,
      proposalEntryId: 'bad-entry',
      payload: validPayload({
        edgeDrafts: [
          {
            category: 'rationale',
            support: { draftId: 'req-rollback' },
            claim: { draftId: 'goal-launch' },
          } as never,
        ],
      }),
    });

    expect(result.status).toBe('structural_illegal');
    expect(db.select().from(nodes).all()).toHaveLength(before.nodes);
    expect(db.select().from(edges).all()).toHaveLength(before.edges);
    expect(db.select().from(changeLog).all()).toHaveLength(before.logs);
    expect(db.select().from(nodeKindCounters).all()).toHaveLength(before.counters);
    expect(graphClockLsn(db, specId)).toBe(before.lsn);
  });

  it('rejects per-item basis and retired accepted_review_set payload fields', () => {
    for (const payload of [
      validPayload({ entityDrafts: [{ ...validPayload().entityDrafts[0]!, basis: 'explicit' } as never] }),
      validPayload({
        edgeDrafts: [{ ...validPayload().edgeDrafts[0]!, basis: 'accepted_review_set' } as never],
      }),
    ]) {
      const result = executor.acceptReviewSet({ specId, proposalEntryId: 'bad-basis', payload });
      expect(result.status).toBe('structural_illegal');
    }

    expect(db.select().from(nodes).all()).toHaveLength(0);
    expect(db.select().from(edges).all()).toHaveLength(0);
    expect(db.select().from(changeLog).all()).toHaveLength(0);
    expect(db.select().from(nodeKindCounters).all()).toHaveLength(0);
    expect(graphClockLsn(db, specId)).toBe(0);
  });
});
