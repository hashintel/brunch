import {
  filterAssistantParts,
  prefaceSchema,
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

export function getRuntimePreface(
  message: Pick<BrunchUIMessage, 'parts'>,
): Extract<BrunchAssistantPart, { type: 'data-preface' }> | null {
  const prefacePart = message.parts.find(
    (part): part is Extract<BrunchUIMessage['parts'][number], { type: 'tool-present_preface' }> =>
      part.type === 'tool-present_preface' && 'input' in part,
  );
  if (!prefacePart) {
    return null;
  }

  const parsedInput = prefaceSchema.safeParse(prefacePart.input);
  if (!parsedInput.success) {
    return null;
  }

  return {
    type: 'data-preface',
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
  const persistedPreface = getRuntimePreface(responseMessage);
  const persistedReviewSet = persistedReviewMetadata?.reviewSet ?? fallbackReviewSet ?? null;

  return [
    ...assistantParts.filter(
      (part) =>
        part.type !== 'data-observer-result' &&
        part.type !== 'data-review-set' &&
        part.type !== 'data-preface',
    ),
    ...(persistedReviewMetadata ? [persistedReviewMetadata.reviewQuestionPart] : []),
    ...(persistedPreface ? [persistedPreface] : []),
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
