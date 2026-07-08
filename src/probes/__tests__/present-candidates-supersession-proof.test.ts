import { describe, expect, it } from 'vitest';

import { projectPresentCandidates } from '../../exchanges/projections/present-candidates.js';
import { projectRequestChoice } from '../../exchanges/projections/request-response/choice.js';
import type { TranscriptEntryLike } from '../../projections/session/continuity-entry-classifier.js';
import { projectCaptureSweepWindow } from '../../projections/session/sweep-watermark.js';
import { acceptedResponseFromParams } from '../../session/structured-exchange-loop/accepted-response.js';

function presentCandidates(exchangeId: string, firstTitle: string, secondTitle: string): TranscriptEntryLike {
  const projection = projectPresentCandidates({
    exchangeId,
    heading: 'Pick a candidate direction',
    body: 'Choose the best fit before mapping.',
    candidates: [candidate('local', firstTitle), candidate('remote', secondTitle)],
  });
  return toolResult('present_candidates', projection.details);
}

function candidate(id: string, title: string) {
  return {
    id,
    title,
    user_rubric: {
      core_bet: `${title} core bet.`,
      best_fit: `${title} best fit.`,
      cost_complexity: `${title} cost.`,
      covers_well: `${title} coverage.`,
      main_risks: `${title} risk.`,
      lock_in_constraints: `${title} lock-in.`,
      recommendation: `${title} recommendation.`,
    },
    meta_rubric: {},
    graph_refs: [{ node_id: `${id}-candidate-node` }],
  };
}

// Live terminals persist under toolName 'ask' (D116-L): declared candidate
// continuations and RPC-minted accepted responses both ride the ask tool.
function candidateChoice(details: unknown): TranscriptEntryLike {
  return toolResult('ask', details);
}

// Pre-cutover transcripts persist terminals under the retired collection tool
// name; sweep reads must keep honoring them.
function legacyCandidateChoice(details: unknown): TranscriptEntryLike {
  return toolResult('request_response', details);
}

function toolResult(toolName: string, details: unknown): TranscriptEntryLike {
  return { type: 'message', message: { role: 'toolResult', toolName, details } };
}

function candidatePayloads(entries: readonly TranscriptEntryLike[]) {
  return entries.flatMap((entry) => {
    const answered = messageRecord(entry)?.details;
    if (!isRecord(answered) || !isRecord(answered.answered)) return [];
    const choice = answered.answered.choice;
    const options = answered.answered.options;
    if (!isRecord(choice) || !Array.isArray(options)) return [];
    return [
      {
        choice: choice.id,
        options: options.flatMap((option) => {
          if (!isRecord(option) || typeof option.content !== 'string') return [];
          return [option.content];
        }),
      },
    ];
  });
}

function toolNames(entries: readonly TranscriptEntryLike[]): readonly (string | undefined)[] {
  return entries.map((entry) => {
    const toolName = messageRecord(entry)?.toolName;
    return typeof toolName === 'string' ? toolName : undefined;
  });
}

describe('present_candidates supersession proof', () => {
  it('feeds the capture sweep with only the accepted candidate terminal after regeneration', () => {
    const entries = [
      presentCandidates('candidate-1', 'Local workbench draft', 'Remote workbench draft'),
      presentCandidates('candidate-2', 'Local workbench revised', 'Remote workbench revised'),
      presentCandidates('candidate-3', 'Local workbench final', 'Remote workbench final'),
      candidateChoice(
        projectRequestChoice({
          exchangeId: 'candidate-3',
          respondsToPresentTool: 'present_candidates',
          status: 'answered',
          choice: { id: 'remote', label: 'Remote workbench final', kind: 'listed' },
          options: [
            { id: 'local', content: 'Local workbench final' },
            { id: 'remote', content: 'Remote workbench final' },
          ],
        }),
      ),
    ];

    const tail = projectCaptureSweepWindow(entries).conversationalTail;

    expect(toolNames(tail)).toEqual(['ask']);
    expect(candidatePayloads(tail)).toEqual([
      { choice: 'remote', options: ['Local workbench final', 'Remote workbench final'] },
    ]);
  });

  it('does not feed cancelled candidate offer payloads into the capture sweep', () => {
    const entries = [
      presentCandidates('candidate-cancelled', 'Cancelled local candidate', 'Cancelled remote candidate'),
      legacyCandidateChoice(
        projectRequestChoice({
          exchangeId: 'candidate-cancelled',
          respondsToPresentTool: 'present_candidates',
          status: 'cancelled',
        }),
      ),
    ];

    const tail = projectCaptureSweepWindow(entries).conversationalTail;

    expect(toolNames(tail)).toEqual(['request_response']);
    expect(candidatePayloads(tail)).toEqual([]);
  });

  it('feeds the capture sweep from a product-minted accepted candidate terminal', () => {
    const accepted = acceptedResponseFromParams(
      {
        exchangeId: 'candidate-product-minted',
        lens: 'intent',
        mode: 'single-select',
        prompt: 'Pick a candidate direction',
        options: [
          { id: 'local', label: 'Local workbench', content: 'Local workbench' },
          { id: 'remote', label: 'Remote workbench', content: 'Remote workbench' },
        ],
        note: { allowed: true },
        respondsToPresentTool: 'present_candidates',
      },
      {
        exchangeId: 'candidate-product-minted',
        answer: { optionId: 'local' },
      },
    );
    if (!accepted.ok) throw new Error(accepted.message);

    const tail = projectCaptureSweepWindow([
      presentCandidates('candidate-product-minted', 'Local workbench', 'Remote workbench'),
      // The minted message itself, not a re-wrap: this pins the real persisted
      // toolName ('ask') flowing through the sweep classifier.
      { type: 'message', message: accepted.toolResultMessage as never },
    ]).conversationalTail;

    expect(toolNames(tail)).toEqual(['ask']);
    expect(candidatePayloads(tail)).toEqual([
      { choice: 'local', options: ['Local workbench', 'Remote workbench'] },
    ]);
  });
});

function messageRecord(entry: TranscriptEntryLike): Record<string, unknown> | undefined {
  return isRecord(entry.message) ? entry.message : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
