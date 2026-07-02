import { describe, expect, it } from 'vitest';

import type { ReviewSetProposalPayload } from '../../../../graph/review-set.js';
import { projectPresentReviewSet } from '../../../../projections/exchanges/present-review-set.js';
import { formatPresentReviewSet, PRESENT_REVIEW_SET_CONTENT_ELISIONS } from '../present-review-set.js';
import { missingRenderedDetailsLeaves } from '../render-honesty.js';

describe('formatPresentReviewSet', () => {
  it('renders role-named edge drafts as readable relations, not raw draft arrows', async () => {
    const rendered = formatPresentReviewSet(
      projectPresentReviewSet({ exchangeId: 'review-launch', payload: reviewSetPayload }),
    );

    await expect(rendered).toMatchFileSnapshot('../__snapshots__/present-review-set.md');
    expect(rendered).not.toContain('—exclusion→');
    expect(rendered).not.toContain('—witness [for]→');
  });

  it('declares every details leaf as rendered or intentionally elided', () => {
    const projection = projectPresentReviewSet({ exchangeId: 'review-launch', payload: reviewSetPayload });
    const rendered = formatPresentReviewSet(projection);

    expect(
      missingRenderedDetailsLeaves(projection.details, rendered, {
        elisions: PRESENT_REVIEW_SET_CONTENT_ELISIONS,
      }),
    ).toEqual([]);
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
      proposedCode: 'G2',
      plane: 'intent',
      kind: 'goal',
      title: 'Launch safely',
    },
    {
      draftId: 'req-rollback',
      proposedCode: 'REQ5',
      plane: 'intent',
      kind: 'requirement',
      title: 'Rollback is required',
    },
    {
      draftId: 'check-observable',
      proposedCode: 'CH3',
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
