import { describe, expect, it } from 'vitest';

import { createDb } from '../../db/connection.js';
import { CommandExecutor } from '../../graph/command-executor.js';
import { getGraphOverview } from '../../graph/snapshot.js';
import {
  buildReviewableReviewSetProposalEntry,
  projectLatestReviewableReviewSetProposal,
  translateReviewSetProposalToCommitGraph,
  type ReviewSetProposalDraft,
} from '../extensions/graph/review-set-proposal.js';

function validProposal(overrides: Partial<ReviewSetProposalDraft> = {}): ReviewSetProposalDraft {
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
        sourceDraftId: 'req-rollback',
        targetDraftId: 'goal-launch',
        rationale: 'Rollback capability is required for safe launch.',
      },
      {
        category: 'support',
        sourceDraftId: 'crit-observable',
        targetDraftId: 'goal-launch',
        stance: 'for',
        rationale: 'Observability supports a safe launch decision.',
      },
    ],
    ...overrides,
  };
}

describe('review-set proposal dry-run gate', () => {
  it('surfaces dry-run-valid review-set proposals as transcript entries', () => {
    const db = createDb(':memory:');
    const executor = new CommandExecutor(db);
    const entry = buildReviewableReviewSetProposalEntry({
      proposal: validProposal(),
      commandExecutor: executor,
      source: 'agent',
    });

    expect(entry).toMatchObject({
      customType: 'brunch.review_set_proposal',
      data: {
        schemaVersion: 1,
        lens: 'design',
        epistemicStatus: 'inferred',
        validation: { status: 'success' },
      },
    });
    expect(getGraphOverview(db)).toMatchObject({ nodeCount: 0, edgeCount: 0, lsn: 0 });
    expect(projectLatestReviewableReviewSetProposal([{ type: 'custom', ...entry }])).toMatchObject({
      pitch: { title: 'Launch readiness review set' },
      validation: { status: 'success' },
    });
  });

  it('does not surface structurally invalid review-set proposals', () => {
    const db = createDb(':memory:');
    const executor = new CommandExecutor(db);
    const entry = buildReviewableReviewSetProposalEntry({
      proposal: validProposal({
        edgeDrafts: [
          {
            category: 'support',
            sourceDraftId: 'req-rollback',
            targetDraftId: 'goal-launch',
          },
        ],
      }),
      commandExecutor: executor,
      source: 'agent',
    });

    expect(entry).toMatchObject({
      status: 'structural_illegal',
      diagnostics: [{ field: 'edges[0].stance', message: expect.stringContaining('required') }],
    });
    expect(getGraphOverview(db)).toMatchObject({ nodeCount: 0, edgeCount: 0, lsn: 0 });
    expect(
      projectLatestReviewableReviewSetProposal([{ type: 'custom', customType: 'other', data: entry }]),
    ).toBeUndefined();
  });

  it('rejects proposal schema drift before CommandExecutor dry-run', () => {
    const db = createDb(':memory:');
    const executor = new CommandExecutor(db);

    for (const proposal of [
      { ...validProposal(), epistemicStatus: undefined },
      { ...validProposal(), lens: 'propose-scenarios-with-tradeoffs' },
      { ...validProposal(), grounding: { summary: 'No support.', support: [] } },
      {
        ...validProposal(),
        edgeDrafts: [
          {
            relation: 'supports',
            sourceDraftId: 'req-rollback',
            targetDraftId: 'goal-launch',
          },
        ],
      },
    ]) {
      const result = buildReviewableReviewSetProposalEntry({
        proposal: proposal as unknown as ReviewSetProposalDraft,
        commandExecutor: executor,
        source: 'agent',
      });
      expect(result.status).toBe('structural_illegal');
    }
  });

  it('keeps dry-run validation in parity with commitGraph validation', () => {
    const db = createDb(':memory:');
    const executor = new CommandExecutor(db);
    const proposal = validProposal();
    const entry = buildReviewableReviewSetProposalEntry({
      proposal,
      commandExecutor: executor,
      source: 'agent',
    });
    expect(entry.status).toBe('reviewable');

    const commitResult = executor.commitGraph(translateReviewSetProposalToCommitGraph(proposal));
    expect(commitResult).toMatchObject({ status: 'success' });
    expect(getGraphOverview(db)).toMatchObject({ nodeCount: 3, edgeCount: 2 });
  });
});
