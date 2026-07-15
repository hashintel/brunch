import { describe, expect, it } from 'vitest';

import type { MutateGraphSuccess } from '../../../graph/command-executor.js';
import { projectRequestReview } from '../request-response.js';

const receipt: MutateGraphSuccess = {
  status: 'success',
  lsn: 7,
  createdNodes: { requirement: { id: 11, code: 'REQ1' } },
  createdEdges: [12],
  updatedNodes: [13],
  updatedEdges: [14],
  deletedNodes: [15],
  deletedEdges: [16],
};

describe('projectRequestReview', () => {
  it('requires and preserves the exact receipt for approved review sets', () => {
    const details = projectRequestReview({
      exchangeId: 'review-1',
      respondsToPresentTool: 'present_review_set',
      status: 'answered',
      review: 'approve',
      receipt,
    });

    expect(details).toMatchObject({ answered: { decision: 'approve', receipt } });
    if ('answered' in details && details.answered.decision === 'approve' && 'receipt' in details.answered) {
      expect(details.answered.receipt).toBe(receipt);
    }
  });

  it('keeps all other review outcomes receipt-free', () => {
    const changed = projectRequestReview({
      exchangeId: 'review-1',
      respondsToPresentTool: 'present_review_set',
      status: 'answered',
      review: 'request_changes',
      comment: 'Revise it.',
    });
    const digest = projectRequestReview({
      exchangeId: 'digest-1',
      respondsToPresentTool: 'present_digest',
      status: 'answered',
      review: 'approve',
      acceptedAbstract: 'Accepted digest.',
    });

    expect(changed).not.toHaveProperty('answered.receipt');
    expect(digest).not.toHaveProperty('answered.receipt');
  });
});
