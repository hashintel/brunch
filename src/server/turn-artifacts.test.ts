import { describe, expect, it } from 'vitest';

import type { ReviewSetData } from '@/shared/chat.js';

import {
  getRuntimeGroundingCard,
  getRuntimeReviewMetadata,
  materializeTurnArtifacts,
} from './turn-artifacts.js';

function createReviewSet(phase: 'requirements' | 'criteria' = 'requirements'): ReviewSetData {
  return {
    phase,
    title: phase === 'requirements' ? 'Requirements' : 'Acceptance Criteria',
    items: [
      {
        reviewItemId: `${phase}:1`,
        referenceCode: phase === 'requirements' ? 'R1' : 'C1',
        content: 'Persist durable replay artifacts',
      },
    ],
  };
}

describe('turn-artifacts', () => {
  it('extracts runtime-owned review metadata from the interviewer output', () => {
    const reviewSet = createReviewSet();

    const metadata = getRuntimeReviewMetadata('requirements', {
      parts: [
        {
          type: 'tool-ask_question',
          toolCallId: 'tool-review',
          state: 'output-available',
          input: {
            question: 'Please review the current requirement set.',
            why: 'Review keeps the accepted set truthful.',
            impact: 'high',
            options: [
              { content: 'Accept review', is_recommended: true },
              { content: 'Request changes', is_recommended: false },
            ],
            reviewActions: [
              { action: 'accept', optionPosition: 0 },
              { action: 'request-changes', optionPosition: 1 },
            ],
            reviewSet,
          },
          output: { ok: true, turnId: 1, optionCount: 2 },
        },
      ],
    });

    expect(metadata).toEqual(
      expect.objectContaining({
        reviewSet,
        reviewQuestionPart: expect.objectContaining({
          type: 'tool-ask_question',
          input: expect.objectContaining({ reviewSet }),
        }),
      }),
    );
  });

  it('materializes durable activity, review, and closure artifacts from interviewer output', () => {
    const reviewSet = createReviewSet();

    const artifacts = materializeTurnArtifacts({
      phase: 'requirements',
      elapsedMs: 1_200,
      responseMessage: {
        parts: [
          { type: 'reasoning', text: 'Thinking through the review set.' },
          { type: 'text', text: 'Please review the current requirement set.' },
          {
            type: 'tool-ask_question',
            toolCallId: 'tool-review',
            state: 'output-available',
            input: {
              question: 'Please review the current requirement set.',
              why: 'Review keeps the accepted set truthful.',
              impact: 'high',
              options: [
                { content: 'Accept review', is_recommended: true },
                { content: 'Request changes', is_recommended: false },
              ],
              reviewActions: [
                { action: 'accept', optionPosition: 0 },
                { action: 'request-changes', optionPosition: 1 },
              ],
              reviewSet,
            },
            output: { ok: true, turnId: 1, optionCount: 2 },
          },
          {
            type: 'data-review-set',
            data: {
              phase: 'requirements',
              title: 'Fallback requirements',
              items: [
                {
                  reviewItemId: 'requirements:9',
                  referenceCode: 'R9',
                  content: 'Do not keep this stale fallback set',
                },
              ],
            },
          },
          {
            type: 'data-phase-summary',
            data: {
              turnId: 1,
              phase: 'requirements',
              summary: 'Requirements are ready for confirmation.',
            },
          },
        ],
      },
    });

    expect(artifacts).toEqual([
      {
        type: 'data-activity-summary',
        data: {
          seconds: 2,
          tools: [],
        },
      },
      { type: 'text', text: 'Please review the current requirement set.' },
      {
        type: 'data-phase-summary',
        data: {
          turnId: 1,
          phase: 'requirements',
          summary: 'Requirements are ready for confirmation.',
        },
      },
      expect.objectContaining({
        type: 'tool-ask_question',
        input: expect.objectContaining({ reviewSet }),
      }),
      {
        type: 'data-review-set',
        data: reviewSet,
      },
    ]);
  });

  it('materializes durable grounding-card artifacts instead of persisting the tool call', () => {
    const groundingCard = getRuntimeGroundingCard({
      parts: [
        {
          type: 'tool-present_grounding_card',
          toolCallId: 'tool-grounding-card',
          state: 'output-available',
          input: {
            summary: 'The repo already uses SQLite-backed local persistence.',
            detail: 'This is provisional context before the next substantive move.',
            continueLabel: 'Continue',
          },
          output: { ok: true, turnId: 7 },
        },
      ],
    });

    expect(groundingCard).toEqual({
      type: 'data-grounding-card',
      data: {
        summary: 'The repo already uses SQLite-backed local persistence.',
        detail: 'This is provisional context before the next substantive move.',
        continueLabel: 'Continue',
      },
    });
    if (!groundingCard) {
      throw new Error('Expected grounding card metadata');
    }

    const artifacts = materializeTurnArtifacts({
      phase: 'grounding',
      responseMessage: {
        parts: [
          {
            type: 'tool-present_grounding_card',
            toolCallId: 'tool-grounding-card',
            state: 'output-available',
            input: groundingCard.data,
            output: { ok: true, turnId: 7 },
          },
        ],
      },
    });

    expect(artifacts).toEqual([groundingCard]);
  });

  it('uses the provided fallback review set when the interviewer output has no review metadata', () => {
    const fallbackReviewSet = createReviewSet('criteria');

    expect(
      materializeTurnArtifacts({
        phase: 'criteria',
        fallbackReviewSet,
        responseMessage: {
          parts: [{ type: 'text', text: 'Please review the current criterion set.' }],
        },
      }),
    ).toEqual([
      { type: 'text', text: 'Please review the current criterion set.' },
      {
        type: 'data-review-set',
        data: fallbackReviewSet,
      },
    ]);
  });
});
