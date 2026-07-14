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

  it('keeps persisted legacy digest approvals readable without making them new questionnaire authority', () => {
    const legacy = zRequestReviewDetails.parse(
      projectRequestReview({
        exchangeId: 'legacy-digest',
        status: 'answered',
        review: 'approve',
        acceptedAbstract: 'Persisted legacy abstract',
        respondsToPresentTool: 'present_digest',
      }),
    );
    expect(legacy).toMatchObject({ answered: { accepted_abstract: 'Persisted legacy abstract' } });
    expect(resolveEligibleDigestAcceptance([entry(legacy)], 'legacy-digest')).toBeUndefined();
  });
});
