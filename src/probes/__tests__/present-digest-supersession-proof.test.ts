import { describe, expect, it } from 'vitest';

import { projectDigestQuestionnaire } from '../../exchanges/projections/ask.js';
import { projectPresentDigest } from '../../exchanges/projections/present-digest.js';
import { projectRequestReview } from '../../exchanges/projections/request-response/review.js';
import type { TranscriptEntryLike } from '../../projections/session/continuity-entry-classifier.js';
import { projectCaptureSweepWindow } from '../../projections/session/sweep-watermark.js';
import { acceptedResponseFromParams } from '../../session/structured-exchange-loop/accepted-response.js';

function presentDigest(exchangeId: string, abstract: string): TranscriptEntryLike {
  const projection = projectPresentDigest({
    exchangeId,
    heading: 'Review digest',
    digest: { abstract },
  });
  return toolResult('present_digest', projection.details);
}

// Live terminals persist under toolName 'ask' (D116-L): the declared digest
// continuation and the RPC-minted accepted response both ride the ask tool.
function digestReview(details: unknown): TranscriptEntryLike {
  return toolResult('ask', details);
}

// Pre-cutover transcripts persist terminals under the retired collection tool
// name; sweep reads must keep honoring them.
function legacyDigestReview(details: unknown): TranscriptEntryLike {
  return toolResult('request_response', details);
}

function toolResult(toolName: string, details: unknown): TranscriptEntryLike {
  return { type: 'message', message: { role: 'toolResult', toolName, details } };
}

function digestPayloads(entries: readonly TranscriptEntryLike[]): readonly string[] {
  return entries.flatMap((entry) => {
    const message = messageRecord(entry);
    const details = message?.details;
    if (!isRecord(details)) return [];
    const answered = details.answered;
    if (!isRecord(answered)) return [];
    return typeof answered.accepted_abstract === 'string' ? [answered.accepted_abstract] : [];
  });
}

function toolNames(entries: readonly TranscriptEntryLike[]): readonly (string | undefined)[] {
  return entries.map((entry) => {
    const toolName = messageRecord(entry)?.toolName;
    return typeof toolName === 'string' ? toolName : undefined;
  });
}

describe('present_digest supersession proof', () => {
  it('feeds the capture sweep with only the accepted digest terminal echo after regeneration', () => {
    const entries = [
      presentDigest('digest-1', 'Initial abstract that should remain only transcript history.'),
      digestReview(
        projectRequestReview({
          exchangeId: 'digest-1',
          status: 'answered',
          review: 'request_changes',
          comment: 'Narrow the source claim before mapping.',
          respondsToPresentTool: 'present_digest',
        }),
      ),
      presentDigest('digest-2', 'Revised abstract that is still superseded.'),
      legacyDigestReview(
        projectRequestReview({
          exchangeId: 'digest-2',
          status: 'answered',
          review: 'request_changes',
          comment: 'One more pass: separate observation from recommendation.',
          respondsToPresentTool: 'present_digest',
        }),
      ),
      presentDigest('digest-3', 'Final accepted abstract for sweep capture.'),
      digestReview(
        projectRequestReview({
          exchangeId: 'digest-3',
          status: 'answered',
          review: 'approve',
          acceptedAbstract: 'Final accepted abstract for sweep capture.',
          respondsToPresentTool: 'present_digest',
        }),
      ),
    ];

    const tail = projectCaptureSweepWindow(entries).conversationalTail;

    expect(toolNames(tail)).toEqual(['ask', 'request_response', 'ask']);
    expect(digestPayloads(tail)).toEqual(['Final accepted abstract for sweep capture.']);
  });

  it('feeds the capture sweep from a product-minted accepted digest terminal', () => {
    const accepted = acceptedResponseFromParams(
      {
        exchangeId: 'digest-product-minted',
        lens: 'intent',
        mode: 'review',
        prompt: 'Review source digest',
        options: [],
        note: { allowed: true },
        respondsToPresentTool: 'present_digest',
        digestAbstract: 'Product-minted accepted abstract for sweep capture.',
      },
      {
        exchangeId: 'digest-product-minted',
        answer: { review: { decision: 'approve' } },
      },
    );
    if (!accepted.ok) throw new Error(accepted.message);

    const tail = projectCaptureSweepWindow([
      presentDigest('digest-product-minted', 'Product-minted accepted abstract for sweep capture.'),
      // The minted message itself, not a re-wrap: this pins the real persisted
      // toolName ('ask') flowing through the sweep classifier.
      { type: 'message', message: accepted.toolResultMessage as never },
    ]).conversationalTail;

    expect(toolNames(tail)).toEqual(['ask']);
    expect(digestPayloads(tail)).toEqual(['Product-minted accepted abstract for sweep capture.']);
  });

  it('normalizes the witnessed large-source correction into one final questionnaire carrier', () => {
    const finalAbstract = 'The 17-node/11-edge source separates settled intent from advisory sketches.';
    const entries = [
      presentDigest('witness-draft', 'Initial source digest.'),
      toolResult('ask', {
        schema: 'brunch.structured_exchange.request',
        v: 1,
        exchange_id: 'feedback',
        tool_meta: { curr: 'ask', next: 'capture_answer' },
        question: { body: 'Does this sound right?' },
        answered: { text: 'Separate observation from recommendation.' },
      }),
      presentDigest('witness-final', finalAbstract),
      toolResult(
        'ask',
        projectDigestQuestionnaire({
          exchangeId: 'witness-questionnaire',
          acceptsDigest: 'witness-final',
          acceptedAbstract: finalAbstract,
          questions: [
            { id: 'scope', kind: 'free-text', prompt: 'What scope should map?' },
            {
              id: 'settlement',
              kind: 'single-select',
              prompt: 'How should sketches route?',
              options: [{ id: 'advisory', label: 'Advisory' }],
            },
          ],
          answers: [
            { questionId: 'scope', kind: 'free-text', text: 'Map the complete source.' },
            { questionId: 'settlement', kind: 'single-select', optionId: 'advisory' },
          ],
        }),
      ),
    ];

    const tail = projectCaptureSweepWindow(entries).conversationalTail;
    expect(toolNames(tail)).toEqual(['ask', 'ask']);
    expect(digestPayloads(tail)).toEqual([finalAbstract]);
  });

  it('does not feed cancelled digest offer payloads into the capture sweep', () => {
    const entries = [
      presentDigest('digest-cancelled', 'Cancelled abstract must not become sweep material.'),
      digestReview(
        projectRequestReview({
          exchangeId: 'digest-cancelled',
          status: 'cancelled',
          respondsToPresentTool: 'present_digest',
        }),
      ),
    ];

    const tail = projectCaptureSweepWindow(entries).conversationalTail;

    expect(toolNames(tail)).toEqual(['ask']);
    expect(digestPayloads(tail)).toEqual([]);
  });
});

function messageRecord(entry: TranscriptEntryLike): Record<string, unknown> | undefined {
  return isRecord(entry.message) ? entry.message : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
