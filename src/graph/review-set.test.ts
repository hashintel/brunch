import { describe, expect, it } from 'vitest';

import { createDb, type BrunchDb } from '../db/connection.js';
import { CommandExecutor } from './command-executor.js';
import { translateReviewSetPayloadToCommitGraph, type ReviewSetProposalPayload } from './review-set.js';
import { getGraphOverview } from './snapshot.js';

function seedSpec(db: BrunchDb): number {
  const result = new CommandExecutor(db).createSpec({ name: 'Test Spec', slug: 'test' });
  if (result.status !== 'success') throw new Error('Unable to create test spec');
  return result.specId;
}

function validPayload(overrides: Partial<ReviewSetProposalPayload> = {}): ReviewSetProposalPayload {
  return {
    schemaVersion: 1,
    lens: 'design',
    epistemicStatus: 'inferred',
    grounding: {
      summary: 'The launch path is thin but enough to propose acceptance criteria.',
      support: ['User accepted a launch-readiness concept.'],
    },
    pitch: {
      title: 'Launch readiness review set',
      narrative: 'A small graph for deciding whether launch can proceed.',
    },
    entityDrafts: [
      {
        draftId: 'goal-launch',
        plane: 'intent',
        kind: 'goal',
        title: 'Launch safely',
      },
      {
        draftId: 'req-rollback',
        plane: 'intent',
        kind: 'requirement',
        title: 'Rollback path exists',
      },
      {
        draftId: 'crit-observable',
        plane: 'intent',
        kind: 'criterion',
        title: 'Operators can observe failures',
      },
    ],
    edgeDrafts: [
      {
        category: 'dependency',
        source: { draftId: 'req-rollback' },
        target: { draftId: 'goal-launch' },
        rationale: 'Rollback capability is required for safe launch.',
      },
      {
        category: 'support',
        source: { draftId: 'crit-observable' },
        target: { draftId: 'goal-launch' },
        stance: 'for',
        rationale: 'Observability supports a safe launch decision.',
      },
    ],
    ...overrides,
  };
}

describe('review-set graph payload translation', () => {
  it('turns dry-run-valid review payloads into explicit-basis command input without graph mutation', () => {
    const db = createDb(':memory:');
    const executor = new CommandExecutor(db);
    const specId = seedSpec(db);

    const result = translateReviewSetPayloadToCommitGraph({ db, specId, payload: validPayload() });

    expect(result).toMatchObject({ status: 'success' });
    if (result.status !== 'success') throw new Error('unreachable');
    expect(result.command).toMatchObject({ specId, basis: 'explicit' });
    expect(result.command.nodes).toHaveLength(3);
    expect(result.command.edges).toHaveLength(2);
    expect(executor.dryRunCommitGraph(result.command)).toEqual({ status: 'success' });
    expect(getGraphOverview(db, specId)).toMatchObject({ nodeCount: 0, edgeCount: 0, lsn: 1 });
  });

  it('rejects retired relation fields, missing epistemic or grounding data, and invalid edge stance', () => {
    const db = createDb(':memory:');
    const specId = seedSpec(db);
    const cases: unknown[] = [
      { ...validPayload(), epistemicStatus: undefined },
      { ...validPayload(), grounding: { summary: 'No support.', support: [] } },
      {
        ...validPayload(),
        edgeDrafts: [
          {
            relation: 'supports',
            source: { draftId: 'crit-observable' },
            target: { draftId: 'goal-launch' },
          },
        ],
      },
      {
        ...validPayload(),
        edgeDrafts: [
          {
            category: 'support',
            source: { draftId: 'crit-observable' },
            target: { draftId: 'goal-launch' },
            stance: 'maybe',
          },
        ],
      },
    ];

    for (const payload of cases) {
      const result = translateReviewSetPayloadToCommitGraph({ db, specId, payload });
      expect(result.status).toBe('structural_illegal');
    }
  });

  it('resolves projected existing-node codes only inside the selected spec', () => {
    const db = createDb(':memory:');
    const executor = new CommandExecutor(db);
    const specA = seedSpec(db);
    const specB = executor.createSpec({ name: 'Other Spec', slug: 'other' });
    if (specB.status !== 'success') throw new Error('unreachable');

    const existingA = executor.createNode({
      specId: specA,
      plane: 'intent',
      kind: 'goal',
      title: 'Existing goal A',
    });
    const existingB = executor.createNode({
      specId: specB.specId,
      plane: 'intent',
      kind: 'goal',
      title: 'Existing goal B',
    });
    if (existingA.status !== 'success' || existingB.status !== 'success') throw new Error('unreachable');

    const valid = translateReviewSetPayloadToCommitGraph({
      db,
      specId: specA,
      payload: validPayload({
        edgeDrafts: [
          {
            category: 'realization',
            source: { existingCode: 'G1' },
            target: { draftId: 'req-rollback' },
          },
        ],
      }),
    });
    expect(valid.status).toBe('success');
    if (valid.status !== 'success') throw new Error('unreachable');
    expect(valid.command.edges[0]!.source).toEqual({ existing: existingA.nodeId });

    const unresolved = translateReviewSetPayloadToCommitGraph({
      db,
      specId: specB.specId,
      payload: validPayload({
        edgeDrafts: [
          {
            category: 'realization',
            source: { existingCode: 'R1' },
            target: { draftId: 'req-rollback' },
          },
        ],
      }),
    });
    expect(unresolved).toMatchObject({
      status: 'structural_illegal',
      diagnostics: [{ field: 'edgeDrafts[0].source.existingCode' }],
    });
  });

  it('rejects raw existing DB ids and per-item basis fields in the review payload contract', () => {
    const db = createDb(':memory:');
    const specId = seedSpec(db);
    const cases: unknown[] = [
      validPayload({ entityDrafts: [{ ...validPayload().entityDrafts[0]!, basis: 'explicit' } as never] }),
      validPayload({
        edgeDrafts: [{ ...validPayload().edgeDrafts[0]!, basis: 'accepted_review_set' } as never],
      }),
      validPayload({
        edgeDrafts: [
          {
            category: 'realization',
            source: { existing: 1 },
            target: { draftId: 'goal-launch' },
          } as never,
        ],
      }),
    ];

    for (const payload of cases) {
      const result = translateReviewSetPayloadToCommitGraph({ db, specId, payload });
      expect(result.status).toBe('structural_illegal');
    }
  });
});
