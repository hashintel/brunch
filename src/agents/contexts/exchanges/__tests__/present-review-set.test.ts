import { describe, expect, it } from 'vitest';

import type { ReviewSetProposalPayload } from '../../../../graph/review-set.js';
import { projectPresentReviewSet } from '../../../../projections/exchanges/present-review-set.js';
import { formatPresentReviewSet } from '../present-review-set.js';

describe('formatPresentReviewSet', () => {
  it('renders role-named edge drafts as readable relations, not raw draft arrows', async () => {
    const rendered = formatPresentReviewSet(
      projectPresentReviewSet({ exchangeId: 'review-launch', payload: reviewSetPayload }),
    );

    await expect(rendered).toMatchFileSnapshot('../__snapshots__/present-review-set.md');
    expect(rendered).not.toContain('—exclusion→');
    expect(rendered).not.toContain('—witness [for]→');
  });
});

const reviewSetPayload = {
  schemaVersion: 1,
  lens: 'intent',
  epistemicStatus: 'asserted',
  grounding: {
    summary: 'Launch readiness needs rollback and observability.',
    support: ['User asked for launch readiness.'],
  },
  pitch: {
    title: 'Launch readiness review set',
    narrative: 'Review the launch-readiness commitments together.',
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
      title: 'Rollback is required',
    },
    {
      draftId: 'check-observable',
      plane: 'oracle',
      kind: 'check',
      title: 'Observe rollback path',
    },
  ],
  edgeDrafts: [
    {
      category: 'exclusion',
      boundary: { draftId: 'req-rollback' },
      subject: { draftId: 'goal-launch' },
    },
    {
      category: 'witness',
      oracle: { draftId: 'check-observable' },
      claim: { draftId: 'goal-launch' },
      stance: 'for',
    },
  ],
} satisfies ReviewSetProposalPayload;
