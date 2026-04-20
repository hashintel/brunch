import { describe, expect, it } from 'vitest';

import { deserializeAssistantParts, deserializeUserParts } from '../parts.js';
import {
  createEmptyFixtureObserverEntityIds,
  createFixtureReviewQuestionInput,
  serializeFixtureAcceptedReviewUserParts,
  serializeFixtureConfirmationUserParts,
  serializeFixtureGroundingCardAssistantParts,
  serializeFixturePhaseConfirmationUserParts,
  serializeFixturePhaseProposalAssistantParts,
  serializeFixtureQuestionAssistantParts,
  serializeFixtureTurnResponseUserParts,
} from './helpers.js';

describe('fixture helpers', () => {
  it('serializes review questions with canonical review metadata and persisted review set', () => {
    const input = createFixtureReviewQuestionInput({
      phase: 'requirements',
      title: 'Requirements',
      prompt: 'Please review the current requirement set.',
      why: 'Review the whole requirement set before moving forward.',
      items: [
        {
          referenceCode: 'R1',
          content: 'Persist the active path after reload.',
          rationale: 'Resume depends on durable active-path state.',
        },
      ],
    });

    const parts = deserializeAssistantParts(
      serializeFixtureQuestionAssistantParts({
        turnId: 17,
        toolCallId: 'fixture-requirements-review',
        input,
      }),
    );

    expect(parts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'tool-ask_question',
          toolCallId: 'fixture-requirements-review',
          input,
          output: { ok: true, turnId: 17, optionCount: 2 },
        }),
        { type: 'text', text: 'Please review the current requirement set.' },
        expect.objectContaining({
          type: 'data-observer-result',
          data: { entityIds: createEmptyFixtureObserverEntityIds() },
        }),
        {
          type: 'data-review-set',
          data: input.reviewSet,
        },
      ]),
    );
  });

  it('serializes phase proposals with the current phase-summary contract', () => {
    const parts = deserializeAssistantParts(
      serializeFixturePhaseProposalAssistantParts({
        turnId: 23,
        phase: 'design',
        summary: 'The main architectural commitments are captured.',
      }),
    );

    expect(parts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'tool-propose_phase_closure',
          output: { ok: true, turnId: 23, phase: 'design' },
        }),
        {
          type: 'data-phase-summary',
          data: {
            turnId: 23,
            phase: 'design',
            summary: 'The main architectural commitments are captured.',
          },
        },
      ]),
    );
  });

  it('serializes grounding cards as persisted grounding artifacts', () => {
    const parts = deserializeAssistantParts(
      serializeFixtureGroundingCardAssistantParts({
        summary: 'Later context gathering narrowed the next move.',
        detail: 'Continue to keep moving through the same stream.',
        continueLabel: 'Continue',
      }),
    );

    expect(parts).toEqual([
      {
        type: 'data-grounding-card',
        data: {
          summary: 'Later context gathering narrowed the next move.',
          detail: 'Continue to keep moving through the same stream.',
          continueLabel: 'Continue',
        },
      },
    ]);
  });

  it('serializes generic turn responses and accepted review responses through the same seam', () => {
    expect(
      deserializeUserParts(
        serializeFixtureTurnResponseUserParts({
          text: 'Continue — Focus on the replay seam.',
          data: {
            turnId: 31,
            selectedOptionIds: [41],
            freeText: 'Focus on the replay seam.',
          },
        }),
      ),
    ).toEqual([
      { type: 'text', text: 'Continue — Focus on the replay seam.' },
      {
        type: 'data-turn-response',
        data: {
          turnId: 31,
          selectedOptionIds: [41],
          freeText: 'Focus on the replay seam.',
        },
      },
    ]);

    expect(
      deserializeUserParts(
        serializeFixtureAcceptedReviewUserParts({
          turnId: 32,
          selectedOptionIds: [51],
        }),
      ),
    ).toEqual([
      { type: 'text', text: 'Accept review' },
      {
        type: 'data-turn-response',
        data: {
          turnId: 32,
          selectedOptionIds: [51],
          reviewAction: 'accept',
        },
      },
    ]);
  });

  it('serializes explicit confirmation commands through the canonical confirmation seam', () => {
    expect(
      deserializeUserParts(
        serializeFixtureConfirmationUserParts(
          {
            kind: 'force-close-active-phase',
            phase: 'design',
          },
          'Force elicitation closure',
        ),
      ),
    ).toEqual([
      { type: 'text', text: 'Force elicitation closure' },
      {
        type: 'data-confirmation',
        data: {
          kind: 'force-close-active-phase',
          phase: 'design',
        },
      },
    ]);

    expect(
      deserializeUserParts(serializeFixturePhaseConfirmationUserParts({ phase: 'scope', proposalTurnId: 9 })),
    ).toEqual([
      { type: 'text', text: 'Confirm grounding closure' },
      {
        type: 'data-confirmation',
        data: {
          kind: 'confirm-proposed-phase-closure',
          proposalTurnId: 9,
          phase: 'scope',
        },
      },
    ]);
  });
});
