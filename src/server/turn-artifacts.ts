import {
  filterAssistantParts,
  groundingCardSchema,
  structuredQuestionSchema,
  type BrunchAssistantPart,
  type BrunchUIMessage,
  type ReviewSetData,
} from '@/shared/chat.js';

import type { Turn } from './db.js';

export function getRuntimeReviewMetadata(
  phase: Turn['phase'],
  message: Pick<BrunchUIMessage, 'parts'>,
): {
  reviewQuestionPart: Extract<BrunchAssistantPart, { type: 'tool-ask_question' }>;
  reviewSet: ReviewSetData;
} | null {
  if (phase !== 'requirements' && phase !== 'criteria') {
    return null;
  }

  const reviewQuestionPart = message.parts.find(
    (part): part is Extract<BrunchAssistantPart, { type: 'tool-ask_question' }> =>
      part.type === 'tool-ask_question' && 'input' in part,
  );
  if (!reviewQuestionPart) {
    return null;
  }

  const parsedInput = structuredQuestionSchema.safeParse(reviewQuestionPart.input);
  if (!parsedInput.success || !parsedInput.data.reviewSet || parsedInput.data.reviewSet.phase !== phase) {
    return null;
  }

  return {
    reviewQuestionPart: {
      ...reviewQuestionPart,
      input: parsedInput.data,
    },
    reviewSet: parsedInput.data.reviewSet,
  };
}

export function getRuntimeGroundingCard(
  message: Pick<BrunchUIMessage, 'parts'>,
): Extract<BrunchAssistantPart, { type: 'data-grounding-card' }> | null {
  const groundingCardPart = message.parts.find(
    (part): part is Extract<BrunchUIMessage['parts'][number], { type: 'tool-present_grounding_card' }> =>
      part.type === 'tool-present_grounding_card' && 'input' in part,
  );
  if (!groundingCardPart) {
    return null;
  }

  const parsedInput = groundingCardSchema.safeParse(groundingCardPart.input);
  if (!parsedInput.success) {
    return null;
  }

  return {
    type: 'data-grounding-card',
    data: parsedInput.data,
  };
}

export function materializeTurnArtifacts({
  phase,
  responseMessage,
  elapsedMs,
  fallbackReviewSet,
}: {
  phase: Turn['phase'];
  responseMessage: Pick<BrunchUIMessage, 'parts'>;
  elapsedMs?: number;
  fallbackReviewSet?: ReviewSetData | null;
}): BrunchAssistantPart[] {
  const assistantParts = filterAssistantParts(responseMessage.parts, { elapsedMs });
  const persistedReviewMetadata = getRuntimeReviewMetadata(phase, responseMessage);
  const persistedGroundingCard = getRuntimeGroundingCard(responseMessage);
  const persistedReviewSet = persistedReviewMetadata?.reviewSet ?? fallbackReviewSet ?? null;

  return [
    ...assistantParts.filter(
      (part) =>
        part.type !== 'data-observer-result' &&
        part.type !== 'data-review-set' &&
        part.type !== 'data-grounding-card',
    ),
    ...(persistedReviewMetadata ? [persistedReviewMetadata.reviewQuestionPart] : []),
    ...(persistedGroundingCard ? [persistedGroundingCard] : []),
    ...(persistedReviewSet
      ? [
          {
            type: 'data-review-set' as const,
            data: persistedReviewSet,
          },
        ]
      : []),
  ];
}
