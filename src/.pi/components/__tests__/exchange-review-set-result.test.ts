import { describe, expect, it } from 'vitest';

import { projectPresentReviewSet } from '../../../exchanges/projections/present-review-set.js';
import type { ReviewSetProposalPayload } from '../../../graph/review-set.js';
import { ExchangeReviewSetResultComponent } from '../exchange-review-set-result.js';

const plainTheme = {
  fg: (_color: string, text: string) => text,
  bold: (text: string) => text,
};

const payload = {
  schemaVersion: 1,
  lens: 'intent',
  epistemicStatus: 'asserted',
  grounding: { summary: 'Review the impact ledger.', support: ['User requested the review.'] },
  pitch: { title: 'Impact review', narrative: 'Inspect the proposed set as one whole.' },
  entityDrafts: [
    {
      draftId: 'term-ledger',
      proposedCode: 'T1',
      plane: 'intent',
      kind: 'term',
      title: 'Impact Ledger',
      detail: { definition: 'A compact view of proposed graph consequences.' },
    },
    {
      draftId: 'goal-safe',
      proposedCode: 'G2',
      plane: 'intent',
      kind: 'goal',
      title: 'Launch safely with a deliberately long description that wraps at narrow widths',
    },
    {
      draftId: 'goal-clear',
      proposedCode: 'G3',
      plane: 'intent',
      kind: 'goal',
      title: 'Keep review consequences clear',
    },
    {
      draftId: 'requirement-rollback',
      proposedCode: 'REQ5',
      plane: 'intent',
      kind: 'requirement',
      title: 'Rollback is required',
    },
    {
      draftId: 'obligation-observe',
      proposedCode: 'VVO2',
      plane: 'oracle',
      kind: 'vv_obligation',
      title: 'Observe the rollback path',
    },
    {
      draftId: 'frontier-launch',
      proposedCode: 'F4',
      plane: 'plan',
      kind: 'frontier',
      title: 'Close launch readiness',
    },
  ],
  edgeDrafts: [
    {
      category: 'dependency',
      dependency: { draftId: 'requirement-rollback' },
      dependent: { draftId: 'goal-safe' },
    },
    {
      category: 'witness',
      oracle: { draftId: 'obligation-observe' },
      claim: { draftId: 'goal-safe' },
      stance: 'for',
    },
  ],
} satisfies ReviewSetProposalPayload;

const details = projectPresentReviewSet({ exchangeId: 'impact-ledger-test', payload }).details;

describe('ExchangeReviewSetResultComponent', () => {
  it('renders the borderless Impact Ledger at narrow, normal, and wide widths', () => {
    const component = new ExchangeReviewSetResultComponent(details, plainTheme);

    expect(component.render(40).join('\n')).toMatchSnapshot('narrow');
    expect(component.render(72).join('\n')).toMatchSnapshot('normal');
    expect(component.render(100).join('\n')).toMatchSnapshot('wide');
  });

  it('styles headings, kinds, codes, content, and reference rows by semantic role', () => {
    const styled: string[] = [];
    const recordingTheme = {
      fg: (color: string, text: string) => {
        styled.push(`${color}:${text}`);
        return text;
      },
      bold: (text: string) => `**${text}**`,
    };

    new ExchangeReviewSetResultComponent(details, recordingTheme).render(72);

    expect(styled).toContain('accent:**Terms**');
    expect(styled).toContain('muted:term');
    expect(styled).toContain('syntaxKeyword:T1');
    expect(styled).toContain('text:A compact view of proposed graph consequences.');
    expect(styled).toContain('muted:refs: VVO2');
    expect(styled).toContain('muted:refs: G2');
  });
});
