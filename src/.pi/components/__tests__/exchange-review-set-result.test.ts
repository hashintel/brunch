import { describe, expect, it } from 'vitest';

import { missingRenderedDetailsLeaves } from '../../../agents/contexts/exchanges/render-honesty.js';
import type { RenderElision } from '../../../agents/contexts/exchanges/render-honesty.js';
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

const IMPACT_LEDGER_DETAILS_ELISIONS: readonly RenderElision[] = [
  { path: 'schema', reason: 'structural details schema tag' },
  { path: 'v', reason: 'structural details schema version' },
  { path: 'exchange_id', reason: 'structural exchange correlation id' },
  { path: 'tool_meta.*', reason: 'machine-facing tool-chain marker' },
  { path: 'display.*', reason: 'Impact Ledger replaces generic display framing' },
  { path: 'continuation.tool', reason: 'machine-facing response wiring' },
  { path: 'continuation.params.*', reason: 'machine-facing response wiring' },
  { path: 'continuation.params.options.*.*', reason: 'machine-facing response wiring' },
  { path: 'review_set.nodes.*.draft_id', reason: 'local ids are represented by proposed codes' },
  { path: 'review_set.nodes.*.plane', reason: 'concern groups replace storage planes' },
  { path: 'review_set.nodes.0.title', reason: 'term definition replaces its title' },
  { path: 'review_set.edges.*.category', reason: 'connections are represented as refs rows' },
  { path: 'review_set.edges.*.stance', reason: 'connection semantics are collapsed into refs rows' },
  { path: 'review_set.edges.*.*.*', reason: 'edge endpoints are represented by graph codes in refs rows' },
];

describe('ExchangeReviewSetResultComponent', () => {
  it('renders the borderless Impact Ledger at narrow, normal, and wide widths', () => {
    const component = new ExchangeReviewSetResultComponent(details, plainTheme);

    expect(component.render(40).join('\n')).toMatchSnapshot('narrow');
    expect(component.render(72).join('\n')).toMatchSnapshot('normal');
    expect(component.render(100).join('\n')).toMatchSnapshot('wide');
  });

  it('accounts for every populated leaf in long Impact Ledger output', () => {
    const rendered = new ExchangeReviewSetResultComponent(details, plainTheme).render(40).join('\n');

    expect(
      missingRenderedDetailsLeaves(details, rendered, {
        elisions: IMPACT_LEDGER_DETAILS_ELISIONS,
        representations: {
          'review_set.nodes.4.kind': ['obligation'],
        },
      }),
    ).toEqual([]);
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
