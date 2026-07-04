import { describe, expect, it } from 'vitest';

import { projectPresentDigest } from '../../../../exchanges/projections/present-digest.js';
import { projectRequestReview } from '../../../../exchanges/projections/request-response.js';
import { formatPresentDigest, PRESENT_DIGEST_CONTENT_ELISIONS } from '../present-digest.js';
import { missingRenderedDetailsLeaves } from '../render-honesty.js';
import { formatRequestReview } from '../request-response.js';

const acceptedAbstract =
  'The source says large raw material should be summarized before graph mapping; accepted summaries are advisory input, not graph truth.';

function projection() {
  return projectPresentDigest({
    exchangeId: 'digest-large-source',
    heading: 'Review source digest',
    body: 'Approve, request changes, or reject this digest before mapping.',
    digest: {
      abstract: acceptedAbstract,
      analysis:
        'The digest preserves the distinction between source-derived material and committed graph claims.',
      recommendation: 'Approve once the source constraints are accurately represented.',
    },
  });
}

describe('formatPresentDigest', () => {
  it('locks transcript-shaped digest tuples', async () => {
    const present = projection();
    const accepted = projectRequestReview({
      exchangeId: 'digest-large-source',
      respondsToPresentTool: 'present_digest',
      status: 'answered',
      review: 'approve',
      acceptedAbstract,
    });
    const changesRequested = projectRequestReview({
      exchangeId: 'digest-large-source',
      respondsToPresentTool: 'present_digest',
      status: 'answered',
      review: 'request_changes',
      comment: 'Include the source limitation about advisory settlement.',
    });
    const rejected = projectRequestReview({
      exchangeId: 'digest-large-source',
      respondsToPresentTool: 'present_digest',
      status: 'answered',
      review: 'reject',
      comment: 'This digest overstates graph commitments.',
    });
    const cancelled = projectRequestReview({
      exchangeId: 'digest-large-source',
      respondsToPresentTool: 'present_digest',
      status: 'cancelled',
    });

    const markdown = [
      section('accepted', formatPresentDigest(present), formatRequestReview(accepted)),
      section('changes requested', formatPresentDigest(present), formatRequestReview(changesRequested)),
      section('rejected', formatPresentDigest(present), formatRequestReview(rejected)),
      section('cancelled', formatPresentDigest(present), formatRequestReview(cancelled)),
    ].join('\n\n');

    await expect(markdown).toMatchFileSnapshot('../__snapshots__/digest-tuples.md');
  });

  it('declares every details leaf as rendered or intentionally elided', () => {
    const present = projection();
    const content = formatPresentDigest(present);

    expect(
      missingRenderedDetailsLeaves(present.details, content, {
        elisions: PRESENT_DIGEST_CONTENT_ELISIONS,
      }),
    ).toEqual([]);
  });
});

function section(label: string, ...entries: readonly string[]): string {
  return [`# ${label}`, ...entries].join('\n\n');
}
