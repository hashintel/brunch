import { describe, expect, it } from 'vitest';

import { projectPresentReviewSet } from '../../../../exchanges/projections/present-review-set.js';
import { projectRequestReview } from '../../../../exchanges/projections/request-response.js';
import type { ReviewSetProposalPayload } from '../../../../graph/review-set.js';
import {
  formatExchangeStructuralIllegal,
  formatPresentReviewSet,
  PRESENT_REVIEW_SET_CONTENT_ELISIONS,
} from '../present-review-set.js';
import { missingRenderedDetailsLeaves } from '../render-honesty.js';
import { formatRequestReview } from '../request-response.js';

describe('formatExchangeStructuralIllegal', () => {
  it('locks the solo diagnostic render for structurally illegal review-set results', async () => {
    await expect(formatExchangeStructuralIllegal(structuralIllegalDiagnostics)).toMatchFileSnapshot(
      '../__snapshots__/structural-illegal.md',
    );
  });

  it('renders every populated diagnostic field and message', () => {
    const rendered = formatExchangeStructuralIllegal(structuralIllegalDiagnostics);

    for (const diagnostic of structuralIllegalDiagnostics.diagnostics) {
      expect(rendered).toContain(diagnostic.field);
      expect(rendered).toContain(diagnostic.message);
    }
  });
});

describe('formatPresentReviewSet', () => {
  it('locks transcript-shaped review-set tuples', async () => {
    const accepted = renderTuple(fullSetPayload, 'approve');
    const changes = renderTuple(
      trailingGroupPayload,
      'request_changes',
      '$REQ6 is right but under-specified — name the rollback window before accepting it.',
    );
    const rejected = renderTuple(
      rejectedPayload,
      'reject',
      'This proposes the wrong boundary for the render sweep.',
    );
    const cancelled = renderTuple(fullSetPayload, 'cancelled');
    const rendered = [
      section('accepted', accepted),
      section('changes requested', changes),
      section('rejected', rejected),
      section('cancelled', cancelled),
    ].join('\n\n');

    await expect(rendered).toMatchFileSnapshot('../__snapshots__/review-set-tuples.md');
    expect(rendered).toContain('  - depends on __$REQ5__');
    expect(rendered).toContain(
      '    > the invariant is the only oracle that catches a silently dropped details leaf.',
    );
    expect(rendered).not.toContain('—exclusion→');
    expect(rendered).not.toContain('—witness [for]→');
  });

  it('declares every details leaf as rendered or intentionally elided', () => {
    const projection = projectPresentReviewSet({ exchangeId: 'review-launch', payload: fullSetPayload });
    const rendered = formatPresentReviewSet(projection);

    expect(
      missingRenderedDetailsLeaves(projection.details, rendered, {
        elisions: PRESENT_REVIEW_SET_CONTENT_ELISIONS,
        representations: {
          'review_set.nodes.*.body': [
            'The invariant walks the structured details payload.',
            'It fails when a formatter silently drops a meaningful leaf.',
          ],
        },
      }),
    ).toEqual([]);
  });
});

const structuralIllegalDiagnostics = {
  diagnostics: [
    {
      field: 'review_set.nodes[0].proposed_code',
      message: 'Proposed graph code must be unique within the review set.',
    },
    {
      field: 'review_set.edges[1].dependency.draft_id',
      message: 'Edge references draft id "missing-requirement", but no matching node draft was submitted.',
    },
  ],
};

function renderTuple(
  payload: ReviewSetProposalPayload,
  review: 'approve' | 'request_changes' | 'reject' | 'cancelled',
  comment?: string,
): string {
  const exchangeId = `review-${review}`;
  const response =
    review === 'cancelled'
      ? projectRequestReview({ exchangeId, status: 'cancelled' })
      : projectRequestReview({ exchangeId, status: 'answered', review, comment });
  return [
    formatPresentReviewSet(projectPresentReviewSet({ exchangeId, payload })),
    formatRequestReview(response),
  ].join('\n\n');
}

function section(label: string, content: string): string {
  return [`# ${label}`, content].join('\n\n');
}

const fullSetPayload = {
  schemaVersion: 1,
  lens: 'intent',
  epistemicStatus: 'asserted',
  grounding: {
    summary: 'Render sweep review set.',
    support: ['The exchange-rendering sweep needs proposal approval.'],
  },
  pitch: {
    title: 'Verification layers for the render sweep',
    narrative: 'Rationale here',
  },
  entityDrafts: [
    {
      draftId: 'goal-render-honesty',
      proposedCode: 'G2',
      plane: 'intent',
      kind: 'goal',
      title: 'Render sweep stays honest',
    },
    {
      draftId: 'req-details',
      proposedCode: 'REQ5',
      plane: 'intent',
      kind: 'requirement',
      title: 'Details leaves must be accounted for',
      body: 'Every populated details leaf is either rendered or explicitly elided.',
    },
    {
      draftId: 'check-render-honesty',
      proposedCode: 'CH3',
      plane: 'oracle',
      kind: 'check',
      title: 'Render-honesty invariant test',
      body:
        'The invariant walks the structured details payload.\n\n' +
        'It fails when a formatter silently drops a meaningful leaf.',
    },
  ],
  edgeDrafts: [
    {
      category: 'dependency',
      dependency: { draftId: 'req-details' },
      dependent: { draftId: 'goal-render-honesty' },
    },
    {
      category: 'dependency',
      dependency: { existingCode: 'MOD1' },
      dependent: { draftId: 'req-details' },
    },
    {
      category: 'witness',
      oracle: { draftId: 'check-render-honesty' },
      claim: { draftId: 'req-details' },
      stance: 'for',
      rationale: 'the invariant is the only oracle that catches a silently dropped details leaf.',
    },
  ],
} satisfies ReviewSetProposalPayload;

const trailingGroupPayload = {
  schemaVersion: 1,
  lens: 'intent',
  epistemicStatus: 'asserted',
  grounding: {
    summary: 'Rollback coverage needs reconciliation.',
    support: ['The existing boundary test already exercises rollback.'],
  },
  pitch: {
    title: 'Reconcile rollback coverage',
    narrative: 'Additional reasoning / rationale.',
  },
  entityDrafts: [
    {
      draftId: 'req-rollback-rehearsal',
      proposedCode: 'REQ6',
      plane: 'intent',
      kind: 'requirement',
      title: 'Rollback rehearsal before each release',
    },
  ],
  edgeDrafts: [
    {
      category: 'refinement',
      abstract: { existingCode: 'REQ5' },
      concrete: { draftId: 'req-rollback-rehearsal' },
    },
    {
      category: 'dependency',
      dependency: { existingCode: 'MOD1' },
      dependent: { draftId: 'req-rollback-rehearsal' },
    },
    {
      category: 'witness',
      oracle: { existingCode: 'CH1' },
      claim: { existingCode: 'REQ5' },
      stance: 'for',
      rationale: 'the boundary test already exercises the rollback path end to end.',
    },
  ],
} satisfies ReviewSetProposalPayload;

const rejectedPayload = {
  schemaVersion: 1,
  lens: 'design',
  epistemicStatus: 'asserted',
  grounding: {
    summary: 'Answering chrome should stay out of transcript rendering.',
    support: ['The frontier split keeps collection UI separate.'],
  },
  pitch: {
    title: 'Split the answering chrome from transcript rendering',
    narrative: 'One frontier became two; this draft records the boundary.',
  },
  entityDrafts: [
    {
      draftId: 'frontier-answering-chrome',
      proposedCode: 'F4',
      plane: 'plan',
      kind: 'frontier',
      title: 'Exchange answering chrome',
    },
  ],
  edgeDrafts: [
    {
      category: 'composition',
      whole: { existingCode: 'F5' },
      part: { draftId: 'frontier-answering-chrome' },
    },
  ],
} satisfies ReviewSetProposalPayload;
