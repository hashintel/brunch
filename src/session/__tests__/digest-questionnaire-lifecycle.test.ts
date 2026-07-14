import { describe, expect, it } from 'vitest';

import { projectDigestQuestionnaire } from '../../exchanges/projections/ask.js';
import { projectPresentDigest } from '../../exchanges/projections/present-digest.js';
import { projectRequestReview } from '../../exchanges/projections/request-response/review.js';
import { resolveEligibleDigestAcceptance } from '../../exchanges/recovery.js';
import { zRequestReviewDetails } from '../../exchanges/schemas/index.js';

function entry(details: unknown) {
  return { type: 'message', message: { role: 'toolResult', details } };
}

function digest(id: string, abstract: string) {
  return entry(projectPresentDigest({ exchangeId: id, heading: 'Digest', digest: { abstract } }).details);
}

function submitted(id: string, acceptsDigest: string, acceptedAbstract: string) {
  return entry(
    projectDigestQuestionnaire({
      exchangeId: id,
      acceptsDigest,
      acceptedAbstract,
      questions: [
        {
          id: 'confirm',
          kind: 'single-select',
          prompt: 'Proceed?',
          options: [{ id: 'yes', label: 'Yes' }],
        },
      ],
      answers: [{ questionId: 'confirm', kind: 'single-select', optionId: 'yes' }],
    }),
  );
}

describe('production digest questionnaire eligibility', () => {
  it('allows retry after cancellation but rejects stale digests and any second carrier id', () => {
    const d1 = digest('d1', 'Draft');
    const cancelled = entry({
      schema: 'brunch.structured_exchange.request',
      v: 1,
      exchange_id: 'q-cancelled',
      tool_meta: { curr: 'ask' },
      question: { body: 'Digest questionnaire' },
      cancelled: {},
    });
    expect(resolveEligibleDigestAcceptance([d1, cancelled], 'd1')?.exchange_id).toBe('d1');

    const d2 = digest('d2', 'Final');
    expect(resolveEligibleDigestAcceptance([d1, cancelled, d2], 'd1')).toBeUndefined();
    expect(resolveEligibleDigestAcceptance([d1, cancelled, d2], 'd2')?.exchange_id).toBe('d2');

    const firstCarrier = submitted('q1', 'd2', 'Final');
    expect(resolveEligibleDigestAcceptance([d1, d2, firstCarrier], 'd2')).toBeUndefined();
    expect(resolveEligibleDigestAcceptance([d1, d2, firstCarrier], 'missing')).toBeUndefined();
  });

  it('treats only an approved legacy digest review as an existing acceptance', () => {
    const present = digest('legacy-digest', 'Persisted legacy abstract');
    const legacyReview = (review: 'approve' | 'request_changes' | 'reject') => {
      const details =
        review === 'approve'
          ? projectRequestReview({
              exchangeId: 'legacy-digest',
              status: 'answered',
              review,
              acceptedAbstract: 'Persisted legacy abstract',
              respondsToPresentTool: 'present_digest',
            })
          : projectRequestReview({
              exchangeId: 'legacy-digest',
              status: 'answered',
              review,
              comment: 'Revise before acceptance.',
              respondsToPresentTool: 'present_digest',
            });
      return entry(zRequestReviewDetails.parse(details));
    };

    expect(
      resolveEligibleDigestAcceptance([present, legacyReview('approve')], 'legacy-digest'),
    ).toBeUndefined();
    expect(
      resolveEligibleDigestAcceptance([present, legacyReview('request_changes')], 'legacy-digest')
        ?.exchange_id,
    ).toBe('legacy-digest');
    expect(
      resolveEligibleDigestAcceptance([present, legacyReview('reject')], 'legacy-digest')?.exchange_id,
    ).toBe('legacy-digest');

    const cancelled = entry(
      projectRequestReview({
        exchangeId: 'legacy-digest',
        status: 'cancelled',
        respondsToPresentTool: 'present_digest',
      }),
    );
    expect(resolveEligibleDigestAcceptance([present, cancelled], 'legacy-digest')?.exchange_id).toBe(
      'legacy-digest',
    );
  });
});
