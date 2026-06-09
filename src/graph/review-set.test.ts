import { describe, expect, it } from 'vitest';

import { createDb, type BrunchDb } from '../db/connection.js';
import { CommandExecutor } from './command-executor.js';
import { queryGraph } from './queries.js';
import { translateReviewSetPayloadToMutateGraph, type ReviewSetProposalPayload } from './review-set.js';

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
        dependency: { draftId: 'req-rollback' },
        dependent: { draftId: 'goal-launch' },
        rationale: 'Rollback capability is required for safe launch.',
      },
      {
        category: 'support',
        support: { draftId: 'crit-observable' },
        claim: { draftId: 'goal-launch' },
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

    const result = translateReviewSetPayloadToMutateGraph({ db, specId, payload: validPayload() });

    expect(result).toMatchObject({ status: 'success' });
    if (result.status !== 'success') throw new Error('unreachable');
    expect(result.command).toMatchObject({ specId, createBasis: 'explicit' });
    expect(result.command.ops).toHaveLength(5);
    expect(executor.dryRunMutateGraph(result.command)).toEqual({ status: 'success' });
    expect(queryGraph(db, specId)).toMatchObject({ nodes: [], edges: [], lsn: 1 });
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
            support: { draftId: 'crit-observable' },
            claim: { draftId: 'goal-launch' },
          },
        ],
      },
      {
        ...validPayload(),
        edgeDrafts: [
          {
            category: 'support',
            support: { draftId: 'crit-observable' },
            claim: { draftId: 'goal-launch' },
            stance: 'maybe',
          },
        ],
      },
    ];

    for (const payload of cases) {
      const result = translateReviewSetPayloadToMutateGraph({ db, specId, payload });
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

    const valid = translateReviewSetPayloadToMutateGraph({
      db,
      specId: specA,
      payload: validPayload({
        edgeDrafts: [
          {
            category: 'realization',
            abstract: { existingCode: 'G1' },
            concrete: { draftId: 'req-rollback' },
          },
        ],
      }),
    });
    expect(valid.status).toBe('success');
    if (valid.status !== 'success') throw new Error('unreachable');
    expect(valid.command.ops[3]).toMatchObject({
      op: 'create_edge',
      abstract: { existing: existingA.nodeId },
      concrete: 'req-rollback',
    });

    const unresolved = translateReviewSetPayloadToMutateGraph({
      db,
      specId: specB.specId,
      payload: validPayload({
        edgeDrafts: [
          {
            category: 'realization',
            abstract: { existingCode: 'REQ1' },
            concrete: { draftId: 'req-rollback' },
          },
        ],
      }),
    });
    expect(unresolved).toMatchObject({
      status: 'structural_illegal',
      diagnostics: [{ field: 'edgeDrafts[0].abstract.existingCode' }],
    });
  });

  it('rejects generic source/target review-set edges and keeps stance local to proof/support', () => {
    const db = createDb(':memory:');
    const specId = seedSpec(db);

    const generic = translateReviewSetPayloadToMutateGraph({
      db,
      specId,
      payload: validPayload({
        edgeDrafts: [
          {
            category: 'dependency',
            source: { draftId: 'req-rollback' },
            target: { draftId: 'goal-launch' },
          } as never,
        ],
      }),
    });
    expect(generic.status).toBe('structural_illegal');
    if (generic.status !== 'structural_illegal') throw new Error('unreachable');
    expect(generic.diagnostics.map((diagnostic) => diagnostic.field)).toEqual(
      expect.arrayContaining([
        'edgeDrafts[0].source',
        'edgeDrafts[0].target',
        'edgeDrafts[0].dependency',
        'edgeDrafts[0].dependent',
      ]),
    );

    const nonStance = translateReviewSetPayloadToMutateGraph({
      db,
      specId,
      payload: validPayload({
        edgeDrafts: [
          {
            category: 'dependency',
            dependency: { draftId: 'req-rollback' },
            dependent: { draftId: 'goal-launch' },
            stance: 'for',
          } as never,
        ],
      }),
    });
    expect(nonStance).toMatchObject({ status: 'structural_illegal' });
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
            abstract: { existing: 1 },
            concrete: { draftId: 'goal-launch' },
          } as never,
        ],
      }),
    ];

    for (const payload of cases) {
      const result = translateReviewSetPayloadToMutateGraph({ db, specId, payload });
      expect(result.status).toBe('structural_illegal');
    }
  });
});
