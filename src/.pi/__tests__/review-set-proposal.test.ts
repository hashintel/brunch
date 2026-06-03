import { describe, expect, it } from 'vitest';

import { createDb } from '../../db/connection.js';
import { CommandExecutor } from '../../graph/command-executor.js';
import { getGraphOverview } from '../../graph/snapshot.js';
import {
  translateReviewSetProposalToCommitGraph,
  validateReviewSetProposalPayload,
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
  it('validates dry-run-valid review-set proposal payloads for structured exchanges', () => {
    const db = createDb(':memory:');
    const executor = new CommandExecutor(db);
    const result = validateReviewSetProposalPayload({
      proposal: validProposal(),
      commandExecutor: executor,
    });

    expect(result).toMatchObject({
      status: 'success',
      proposal: {
        schemaVersion: 1,
        lens: 'design',
        epistemicStatus: 'inferred',
        validation: { status: 'success' },
      },
    });
    expect(getGraphOverview(db)).toMatchObject({ nodeCount: 0, edgeCount: 0, lsn: 0 });
  });

  it('rejects structurally invalid review-set proposal payloads', () => {
    const db = createDb(':memory:');
    const executor = new CommandExecutor(db);
    const result = validateReviewSetProposalPayload({
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
    });

    expect(result).toMatchObject({
      status: 'structural_illegal',
      diagnostics: [{ field: 'edges[0].stance', message: expect.stringContaining('required') }],
    });
    expect(getGraphOverview(db)).toMatchObject({ nodeCount: 0, edgeCount: 0, lsn: 0 });
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
      const result = validateReviewSetProposalPayload({
        proposal: proposal as unknown as ReviewSetProposalDraft,
        commandExecutor: executor,
      });
      expect(result.status).toBe('structural_illegal');
    }
  });

  it('keeps dry-run validation in parity with commitGraph validation', () => {
    const db = createDb(':memory:');
    const executor = new CommandExecutor(db);
    const proposal = validProposal();
    const entry = validateReviewSetProposalPayload({
      proposal,
      commandExecutor: executor,
    });
    expect(entry.status).toBe('success');

    const commitResult = executor.commitGraph(translateReviewSetProposalToCommitGraph(proposal));
    expect(commitResult).toMatchObject({ status: 'success' });
    expect(getGraphOverview(db)).toMatchObject({ nodeCount: 3, edgeCount: 2 });
  });
});
