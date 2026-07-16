import { formatPresentReviewSet } from '../../agents/contexts/exchanges/present-review-set.js';
import { projectPresentReviewSet } from '../../exchanges/projections/present-review-set.js';
import type { ReviewSetProposalPayload } from '../../graph/review-set.js';

// Recovered verbatim from the human-witnessed FE-1187 comparison prototype.
export const WITNESSED_REVIEW_SET_PAYLOAD = {
  schemaVersion: 1,
  lens: 'design',
  epistemicStatus: 'asserted',
  grounding: {
    summary: 'Review the proposed review-set reading before changing the settlement interaction.',
    support: [
      'FE-1187 asks for a fair current-versus-proposed comparison.',
      'The existing transcript renderer is the current production baseline.',
    ],
  },
  pitch: {
    title: 'Whole-set review readability',
    narrative:
      'Assess these seventeen proposed graph claims and eleven relations as one review-set decision.',
  },
  entityDrafts: [
    {
      draftId: 'goal-review',
      proposedCode: 'G1',
      plane: 'intent',
      kind: 'goal',
      title: 'Review this proposed set as one coherent decision before settlement changes are made',
    },
    {
      draftId: 'req-decision',
      proposedCode: 'REQ1',
      plane: 'intent',
      kind: 'requirement',
      title: 'The settlement interaction should preserve one whole-set decision for reviewers',
    },
    {
      draftId: 'decision-hierarchy',
      proposedCode: 'D1',
      plane: 'intent',
      kind: 'decision',
      title: 'Compare the information hierarchy before committing to a settlement interaction',
    },
    {
      draftId: 'constraint-payload',
      proposedCode: 'CON1',
      plane: 'intent',
      kind: 'constraint',
      title: 'Retain exact persisted details so compact review views never conceal evidence',
    },
    {
      draftId: 'criterion-scan',
      proposedCode: 'AC1',
      plane: 'intent',
      kind: 'criterion',
      title: 'Make the first-pass scope and its consequences legible during review',
    },
    {
      draftId: 'module-review',
      proposedCode: 'MOD1',
      plane: 'design',
      kind: 'module',
      title: 'The review-set result component presents proposed graph changes to a reviewer',
    },
    {
      draftId: 'interface-decision',
      proposedCode: 'API1',
      plane: 'design',
      kind: 'interface',
      title: 'The whole-set decision control records approval, requested changes, or rejection',
    },
    {
      draftId: 'sketch-brief',
      proposedCode: 'SKT1',
      plane: 'design',
      kind: 'sketch',
      title: 'A proposition brief layout tests whether commitments can lead the reading order',
    },
    {
      draftId: 'check-counts',
      proposedCode: 'CH1',
      plane: 'oracle',
      kind: 'check',
      title: 'Render the mixed review set at supported widths and compare its visible inventory',
    },
    {
      draftId: 'evidence-renderer',
      proposedCode: 'E1',
      plane: 'oracle',
      kind: 'evidence',
      title: 'The component-playground comparison showed lifecycle labels were not user-legible',
    },
    {
      draftId: 'obligation-inspection',
      proposedCode: 'O1',
      plane: 'oracle',
      kind: 'vv_obligation',
      title: 'Legacy obligation: prove exact-payload inspection before accepting the renderer',
    },
    {
      draftId: 'method-renderer',
      proposedCode: 'VV1',
      plane: 'oracle',
      kind: 'vv_method',
      title: 'Use fixture inventory comparison plus a normal-width human visual review',
    },
    {
      draftId: 'term-impact',
      proposedCode: 'T1',
      plane: 'intent',
      kind: 'term',
      title: 'Impact means the consequences of accepting the proposed graph set',
      detail: {
        definition: 'The consequences of accepting the proposed graph set as one commitment.',
        aliases: ['review impact'],
      },
    },
    {
      draftId: 'entity-review-item',
      proposedCode: 'ENT1',
      plane: 'design',
      kind: 'entity',
      title: 'A review item carries one proposed code, kind, title, details, and relations',
    },
    {
      draftId: 'milestone-review',
      proposedCode: 'M1',
      plane: 'plan',
      kind: 'milestone',
      title: 'Close the walkthrough chapter after the review interaction is legible and witnessed',
    },
    {
      draftId: 'frontier-fe1187',
      proposedCode: 'F1',
      plane: 'plan',
      kind: 'frontier',
      title: 'FE-1187 compares whole-set review readings before the production interaction changes',
    },
    {
      draftId: 'scope-review',
      proposedCode: 'SCP1',
      plane: 'plan',
      kind: 'scope',
      title: 'Choose and verify one compact concern-grouped review reading',
    },
  ],
  edgeDrafts: [
    {
      category: 'rationale',
      support: { draftId: 'goal-review' },
      claim: { draftId: 'req-decision' },
      stance: 'for',
      rationale: 'The whole-set goal motivates the interaction requirement.',
    },
    {
      category: 'dependency',
      dependency: { draftId: 'constraint-payload' },
      dependent: { draftId: 'decision-hierarchy' },
      rationale: 'Hierarchy must not hide persisted detail.',
    },
    {
      category: 'rationale',
      support: { draftId: 'evidence-renderer' },
      claim: { draftId: 'decision-hierarchy' },
      stance: 'for',
      rationale: 'The observed comparison supports concern-based grouping.',
    },
    {
      category: 'realization',
      abstract: { draftId: 'req-decision' },
      concrete: { draftId: 'module-review' },
      rationale: 'The result component realizes the review requirement.',
    },
    {
      category: 'realization',
      abstract: { draftId: 'req-decision' },
      concrete: { draftId: 'interface-decision' },
      rationale: 'The whole-set control realizes the review requirement.',
    },
    {
      category: 'composition',
      whole: { draftId: 'module-review' },
      part: { draftId: 'entity-review-item' },
      rationale: 'Review items compose the rendered set.',
    },
    {
      category: 'witness',
      oracle: { draftId: 'criterion-scan' },
      claim: { draftId: 'req-decision' },
      stance: 'for',
      rationale: 'The criterion judges the interaction requirement.',
    },
    {
      category: 'realization',
      abstract: { draftId: 'criterion-scan' },
      concrete: { draftId: 'check-counts' },
      rationale: 'The concrete check operationalizes the criterion.',
    },
    {
      category: 'realization',
      abstract: { draftId: 'method-renderer' },
      concrete: { draftId: 'check-counts' },
      rationale: 'The concrete check applies the comparison method.',
    },
    {
      category: 'composition',
      whole: { draftId: 'milestone-review' },
      part: { draftId: 'frontier-fe1187' },
      rationale: 'The frontier is part of walkthrough closure.',
    },
    {
      category: 'composition',
      whole: { draftId: 'frontier-fe1187' },
      part: { draftId: 'scope-review' },
      rationale: 'The review work is one scope inside the frontier.',
    },
  ],
} satisfies ReviewSetProposalPayload;

export const witnessedReviewSetFixture = (() => {
  const projection = projectPresentReviewSet({
    exchangeId: 'review-set-fe-1187-r10',
    payload: WITNESSED_REVIEW_SET_PAYLOAD,
  });
  return {
    payload: WITNESSED_REVIEW_SET_PAYLOAD,
    projection,
    result: {
      content: [{ type: 'text' as const, text: formatPresentReviewSet(projection) }],
      details: projection.details,
    },
  };
})();
