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
      {
        draftId: 'goal-launch',
        proposedCode: 'G1',
        settlement: 'settled' as const,
        plane: 'intent',
        kind: 'goal',
        title: 'Launch safely',
      },
      {
        draftId: 'req-rollback',
        proposedCode: 'REQ1',
        settlement: 'settled' as const,
        plane: 'intent',
        kind: 'requirement',
        title: 'Rollback path exists',
      },
    ],
    edgeDrafts: [
      {
        category: 'realization',
        settlement: 'settled' as const,
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

  it('uses one LSN and one accept_review_set change-log row for the exact translated mutation', () => {
    const result = executor.acceptReviewSet({
      specId,
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
      payload: validPayload({
        entityDrafts: [
          {
            draftId: 'goal-next',
            proposedCode: 'G1',
            settlement: 'settled' as const,
            plane: 'intent',
            kind: 'goal',
            title: 'Next goal',
          },
        ],
        edgeDrafts: [
          {
            category: 'dependency',
            settlement: 'settled' as const,
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
      payload: validPayload({
        edgeDrafts: [
          {
            category: 'rationale',
            settlement: 'settled' as const,
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
      const result = executor.acceptReviewSet({ specId, payload });
      expect(result.status).toBe('structural_illegal');
    }

    expect(db.select().from(nodes).all()).toHaveLength(0);
    expect(db.select().from(edges).all()).toHaveLength(0);
    expect(db.select().from(changeLog).all()).toHaveLength(0);
    expect(db.select().from(nodeKindCounters).all()).toHaveLength(0);
    expect(graphClockLsn(db, specId)).toBe(0);
  });

  it('can commit a scope package that links frontier, requirement, criterion, design, and verification anchors', () => {
    const result = executor.acceptReviewSet({
      specId,
      payload: {
        schemaVersion: 1,
        lens: 'design',
        epistemicStatus: 'asserted',
        grounding: {
          summary: 'The user approved one scope as the handoff from specification to execution.',
          support: ['The tracer packages one reviewed implementation unit.'],
        },
        pitch: {
          title: 'Canvas scope package',
          narrative: 'Commit one scope plus its design and verification anchors.',
        },
        entityDrafts: [
          {
            draftId: 'frontier-execution',
            proposedCode: 'F1',
            settlement: 'settled' as const,
            plane: 'plan',
            kind: 'frontier',
            title: 'Execution handoff',
          },
          {
            draftId: 'scope-canvas',
            proposedCode: 'SCP1',
            settlement: 'settled' as const,
            plane: 'plan',
            kind: 'scope',
            title: 'Canvas scope',
            body: 'Build the graph canvas from reviewed design and verification anchors.',
          },
          {
            draftId: 'req-canvas',
            proposedCode: 'REQ1',
            settlement: 'settled' as const,
            plane: 'intent',
            kind: 'requirement',
            title: 'Render graph canvas',
          },
          {
            draftId: 'ac-canvas',
            proposedCode: 'AC1',
            settlement: 'settled' as const,
            plane: 'intent',
            kind: 'criterion',
            title: 'Canvas is reachable',
            body: 'A visible canvas proves the new surface is reachable.',
          },
          {
            draftId: 'mod-canvas',
            proposedCode: 'MOD1',
            settlement: 'settled' as const,
            plane: 'design',
            kind: 'module',
            title: 'Canvas route module',
          },
          {
            draftId: 'check-canvas',
            proposedCode: 'CH1',
            settlement: 'settled' as const,
            plane: 'oracle',
            kind: 'check',
            title: 'Canvas smoke test',
          },
        ],
        edgeDrafts: [
          {
            category: 'composition',
            settlement: 'settled' as const,
            whole: { draftId: 'frontier-execution' },
            part: { draftId: 'scope-canvas' },
          },
          {
            category: 'realization',
            settlement: 'settled' as const,
            abstract: { draftId: 'req-canvas' },
            concrete: { draftId: 'scope-canvas' },
          },
          {
            category: 'dependency',
            settlement: 'settled' as const,
            dependency: { draftId: 'ac-canvas' },
            dependent: { draftId: 'scope-canvas' },
          },
          {
            category: 'composition',
            settlement: 'settled' as const,
            whole: { draftId: 'scope-canvas' },
            part: { draftId: 'mod-canvas' },
          },
          {
            category: 'dependency',
            settlement: 'settled' as const,
            dependency: { draftId: 'check-canvas' },
            dependent: { draftId: 'scope-canvas' },
          },
          {
            category: 'witness',
            settlement: 'settled' as const,
            oracle: { draftId: 'ac-canvas' },
            claim: { draftId: 'req-canvas' },
            stance: 'for',
          },
        ],
      },
    });

    expect(result).toMatchObject({
      status: 'success',
      createdNodes: {
        'frontier-execution': { code: 'F1' },
        'scope-canvas': { code: 'SCP1' },
        'req-canvas': { code: 'REQ1' },
        'ac-canvas': { code: 'AC1' },
        'mod-canvas': { code: 'MOD1' },
        'check-canvas': { code: 'CH1' },
      },
    });

    const persistedNodes = db
      .select({ kind: nodes.kind, title: nodes.title, kindOrdinal: nodes.kind_ordinal })
      .from(nodes)
      .all();
    expect(persistedNodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'scope', title: 'Canvas scope', kindOrdinal: 1 }),
        expect.objectContaining({ kind: 'frontier', title: 'Execution handoff', kindOrdinal: 1 }),
      ]),
    );
    expect(
      db
        .select({ category: edges.category, stance: edges.stance, settlement: edges.settlement })
        .from(edges)
        .all(),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: 'composition' }),
        expect.objectContaining({ category: 'realization' }),
        expect.objectContaining({ category: 'witness', settlement: 'settled' as const, stance: 'for' }),
      ]),
    );
  });
});
