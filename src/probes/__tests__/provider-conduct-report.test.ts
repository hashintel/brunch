import { describe, expect, it } from 'vitest';

import { projectDigestQuestionnaire, projectAsk } from '../../exchanges/projections/ask.js';
import { projectPresentDigest } from '../../exchanges/projections/present-digest.js';
import { projectPresentReviewSet } from '../../exchanges/projections/present-review-set.js';
import { projectRequestReview } from '../../exchanges/projections/request-response.js';
import { extractProviderConductReport, type ProviderConductIdentity } from '../provider-conduct-report.js';

const receipt = {
  status: 'success' as const,
  lsn: 3,
  createdNodes: { n1: { id: 1, code: 'G1' } },
  createdEdges: [],
  updatedNodes: [],
  updatedEdges: [],
  deletedNodes: [],
  deletedEdges: [],
};
const digestParams = {
  exchangeId: 'digest-1',
  heading: 'Understanding',
  digest: { abstract: 'Accepted abstract' },
};
const questions = [
  { id: 'q1', prompt: 'One?', kind: 'free-text' as const },
  { id: 'q2', prompt: 'Two?', kind: 'free-text' as const },
];
const reviewPayload = {
  schemaVersion: 1 as const,
  lens: 'intent' as const,
  epistemicStatus: 'asserted' as const,
  grounding: { summary: 'Grounded', support: ['source'] },
  pitch: { title: 'Review', narrative: 'One cohesive proposition' },
  entityDrafts: [
    { draftId: 'n1', proposedCode: 'G1', plane: 'intent' as const, kind: 'goal', title: 'Goal' },
  ],
  edgeDrafts: [],
};
const reviewParams = { exchangeId: 'review-1', payload: reviewPayload };

function pair(entry: string, callId: string, name: string, args: unknown, details: unknown) {
  return [
    {
      type: 'message',
      id: `${entry}-call`,
      parentId: null,
      timestamp: '2026-07-17T00:00:00.000Z',
      message: {
        role: 'assistant',
        provider: 'anthropic',
        model: 'model',
        content: [{ type: 'toolCall', id: callId, name, arguments: args }],
      },
    },
    {
      type: 'message',
      id: entry,
      parentId: `${entry}-call`,
      timestamp: '2026-07-17T00:00:00.000Z',
      message: { role: 'toolResult', toolName: name, toolCallId: callId, content: [], details },
    },
  ];
}
function passing() {
  const digest = projectPresentDigest(digestParams).details;
  const feedbackArgs = { continues: 'digest-1' };
  const feedback = projectAsk({
    exchangeId: 'feedback',
    question: { body: digest.continuation!.params.body },
    status: 'answered',
    answer: 'Confirmed',
  });
  const questionnaireArgs = {
    exchangeId: 'questions',
    acceptsDigest: 'digest-1',
    questions,
    body: 'Questionnaire',
  };
  const questionnaire = projectDigestQuestionnaire({
    exchangeId: 'questions',
    acceptsDigest: 'digest-1',
    acceptedAbstract: 'Accepted abstract',
    questions,
    answers: [
      { questionId: 'q1', kind: 'free-text', text: 'A' },
      { questionId: 'q2', kind: 'free-text', text: 'B' },
    ],
  });
  const advisoryArgs = {
    specId: 1,
    createSettlement: 'advisory',
    ops: [{ op: 'create_node', ref: 'a1', plane: 'intent', kind: 'goal', title: 'Source sketch' }],
  };
  const mutationResult = { ...receipt, lsn: 2, createdNodes: { a1: { id: 2, code: 'G2' } } };
  const review = projectPresentReviewSet(reviewParams).details;
  const settlementArgs = { continues: 'review-1' };
  const settlement = projectRequestReview({
    exchangeId: 'review-1',
    respondsToPresentTool: 'present_review_set',
    status: 'answered',
    review: 'approve',
    receipt,
  });
  return [
    ...pair('digest', 'c-digest', 'present_digest', digestParams, digest),
    ...pair('feedback', 'c-feedback', 'ask', feedbackArgs, feedback),
    ...pair('questions', 'c-questions', 'ask', questionnaireArgs, questionnaire),
    ...pair('advisory', 'c-advisory', 'mutate_graph', advisoryArgs, mutationResult),
    ...pair('review', 'c-review', 'present_review_set', reviewParams, review),
    ...pair('settlement', 'c-settlement', 'ask', settlementArgs, settlement),
  ];
}
const identity: ProviderConductIdentity = {
  runId: 'run',
  generatedAt: '2026-07-17T00:00:00.000Z',
  branch: 'branch',
  commit: 'abc',
  piVersion: '0.80.7',
  provider: 'anthropic',
  model: 'model',
  thinking: 'low',
  seedRef: 'seed',
  sourceSha256: 'a'.repeat(64),
  sessionPath: '/tmp/session.jsonl',
  activeLeaf: 'settlement',
  specId: 1,
  beforeLsn: 1,
  afterLsn: 3,
};
const report = (entries: unknown[]) =>
  extractProviderConductReport({
    identity,
    entries: entries as never[],
    graphReadback: { available: true, reviewLsns: [3] },
  });

describe('provider conduct report', () => {
  it('joins production-shaped calls/results and reads mutation authority from call arguments', () => {
    const value = report(passing());
    expect(value.verdict).toEqual({
      sample: 'valid',
      R8: 'pass',
      R9: 'pass',
      R10: 'pass',
      forbiddenRivals: [],
      humanJudgmentsRequired: ['digest_fidelity', 'question_materiality', 'proposition_cohesion', 'fatigue'],
    });
    expect(value.markers.digestPresented.citations).toEqual([{ entryId: 'digest', toolCallId: 'c-digest' }]);
    expect(value.markers.reviewSettlementReceipt.citations).toEqual([
      { entryId: 'settlement', toolCallId: 'c-settlement' },
    ]);
  });

  it('fails closed for malformed canonical arguments instead of admitting fixture fallbacks', () => {
    const entries = passing();
    (entries[0] as any).message.content[0].arguments = { exchangeId: 'digest-1' };
    expect(report(entries).verdict.sample).toBe('mechanically_invalid');
    expect(report(entries).verdict.R8).toBe('not_observed');
  });

  it('treats a real standalone choice ask as the R9 structural rival', () => {
    const entries = passing();
    const args = {
      exchangeId: 'choice',
      body: 'Which?',
      options: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
    };
    const details = projectAsk({
      exchangeId: 'choice',
      question: { body: 'Which?', options: args.options },
      status: 'answered',
      choice: { id: 'a', label: 'A', kind: 'listed' },
      options: args.options,
    });
    entries.splice(4, 0, ...pair('choice', 'c-choice', 'ask', args, details));
    const value = report(entries);
    expect(value.verdict.R9).toBe('fail');
    expect(value.verdict.forbiddenRivals).toContain('standalone_choice_ask');
    expect(value.verdict.humanJudgmentsRequired).toContain('question_materiality');
  });

  it('detects actual later assistant mutation calls after approval', () => {
    const entries = passing();
    entries.push(
      ...pair(
        'late',
        'c-late',
        'mutate_graph',
        { specId: 1, ops: [{ op: 'delete_node', node: { existing: 1 } }] },
        { ...receipt, lsn: 4 },
      ),
    );
    const value = report(entries);
    expect(value.verdict.R10).toBe('fail');
    expect(value.markers.postApprovalMutationRival.observed).toBe(true);
  });

  it('does not accidentally pass an orphan-result regression shape', () => {
    const orphanResults = passing().filter((entry: any) => entry.message.role === 'toolResult');
    expect(report(orphanResults).verdict.sample).toBe('mechanically_invalid');
    expect([
      report(orphanResults).verdict.R8,
      report(orphanResults).verdict.R9,
      report(orphanResults).verdict.R10,
    ]).not.toContain('pass');
  });
});
