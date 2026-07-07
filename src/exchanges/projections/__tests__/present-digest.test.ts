import { describe, expect, it } from 'vitest';

import { zPresentDigestDetails } from '../../schemas/index.js';
import { projectPresentDigest } from '../present-digest.js';
import { projectRequestReview } from '../request-response.js';

describe('projectPresentDigest', () => {
  it('constructs canonical present_digest details from validated params', () => {
    const projection = projectPresentDigest({
      exchangeId: 'digest-large-source',
      heading: ' Review source digest ',
      body: ' Approve before mapping. ',
      digest: {
        abstract: ' The source asks for advisory capture before settlement. ',
        analysis: ' Digest is not graph material. ',
        recommendation: ' Approve after checking source fidelity. ',
      },
    });

    expect(zPresentDigestDetails.parse(projection.details)).toEqual(projection.details);
    expect(projection.details).toMatchObject({
      display: { heading: 'Review source digest', body: 'Approve before mapping.' },
      digest: {
        abstract: 'The source asks for advisory capture before settlement.',
        analysis: 'Digest is not graph material.',
        recommendation: 'Approve after checking source fidelity.',
      },
      tool_meta: { curr: 'present_digest', next: 'request_response' },
    });
  });

  it('constructs digest review terminals with accepted abstract echo', () => {
    const details = projectRequestReview({
      exchangeId: 'digest-large-source',
      respondsToPresentTool: 'present_digest',
      status: 'answered',
      review: 'approve',
      acceptedAbstract: 'The accepted abstract is self-contained terminal evidence.',
    });

    expect(details).toMatchObject({
      tool_meta: { prev: 'present_digest', curr: 'request_review', next: 'capture_review' },
      answered: {
        decision: 'approve',
        accepted_abstract: 'The accepted abstract is self-contained terminal evidence.',
      },
    });
  });
});
