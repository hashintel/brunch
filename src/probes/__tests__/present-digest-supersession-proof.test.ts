import { describe, expect, it } from 'vitest';

import { projectPresentDigest } from '../../exchanges/projections/present-digest.js';
import { projectRequestReview } from '../../exchanges/projections/request-response/review.js';
import type { RequestReviewDetails } from '../../exchanges/schemas/index.js';
import type { TranscriptEntryLike } from '../../projections/session/continuity-entry-classifier.js';
import { projectCaptureSweepWindow } from '../../projections/session/sweep-watermark.js';

function presentDigest(exchangeId: string, abstract: string): TranscriptEntryLike {
  const projection = projectPresentDigest({
    exchangeId,
    heading: 'Review digest',
    digest: { abstract },
  });
  return toolResult('present_digest', projection.details);
}

function digestReview(details: RequestReviewDetails): TranscriptEntryLike {
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
    const acceptedAbstract = answered.accepted_abstract;
    return typeof acceptedAbstract === 'string' ? [acceptedAbstract] : [];
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
      digestReview(
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

    expect(toolNames(tail)).toEqual(['request_response', 'request_response', 'request_response']);
    expect(digestPayloads(tail)).toEqual(['Final accepted abstract for sweep capture.']);
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

    expect(toolNames(tail)).toEqual(['request_response']);
    expect(digestPayloads(tail)).toEqual([]);
  });
});

function messageRecord(entry: TranscriptEntryLike): Record<string, unknown> | undefined {
  return isRecord(entry.message) ? entry.message : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
