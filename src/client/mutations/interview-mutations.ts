import { useCallback, useMemo } from 'react';

import { useInvalidateSpecificationQueryDomains } from '@/client/routes/specification/$id/-specification-data.js';
import type {
  ReviewAction,
  SubmitPhaseIntentRequest,
  SubmitPhaseIntentResponse,
  SubmitTurnResponseRequest,
  SubmitTurnResponseResponse,
  WorkflowPhase,
} from '@/shared/api-types.js';
import { formatTurnResponseText } from '@/shared/chat.js';
import {
  findTurnOptionsByPositions,
  getReviewActionForSelectedPositions,
} from '@/shared/specification-state.js';
import type { SpecificationMode, SpecificationTurn } from '@/shared/specification.js';

import { postJsonMutation, useClientMutation } from './client-mutation.js';

export interface SubmitTurnResponseMutationState {
  readonly submitTurnResponse: (
    positions?: number[],
    freeText?: string,
    reviewAction?: ReviewAction,
    itemComments?: Array<{ reviewItemId: string; comment: string }>,
  ) => Promise<boolean>;
  readonly isPending: boolean;
  readonly errorMessage: string | null;
  readonly clearError: () => void;
}

export interface SubmitPhaseIntentMutationState {
  readonly submitPhaseEntry: (
    phase: WorkflowPhase,
    options?: { mode?: SpecificationMode },
  ) => Promise<SubmitPhaseIntentResponse | null>;
  readonly submitPhaseContinue: (phase: WorkflowPhase) => Promise<SubmitPhaseIntentResponse | null>;
  readonly isPending: boolean;
  readonly errorMessage: string | null;
  readonly clearError: () => void;
}

export function useSubmitPhaseIntentMutation({
  specificationId,
}: {
  specificationId: number;
}): SubmitPhaseIntentMutationState {
  const { invalidateSpecificationBundle } = useInvalidateSpecificationQueryDomains();
  const { clearError, errorMessage, isPending, run } = useClientMutation(
    (request: SubmitPhaseIntentRequest) =>
      postJsonMutation<SubmitPhaseIntentResponse, SubmitPhaseIntentRequest>(
        `/api/specifications/${specificationId}/phase-intent`,
        request,
        'Failed to submit phase intent',
      ),
  );

  const submitIntent = useCallback(
    async (request: SubmitPhaseIntentRequest): Promise<SubmitPhaseIntentResponse | null> => {
      try {
        const response = await run(request);
        await invalidateSpecificationBundle();
        return response;
      } catch {
        return null;
      }
    },
    [invalidateSpecificationBundle, run],
  );

  const submitPhaseEntry = useCallback(
    (phase: WorkflowPhase, options?: { mode?: SpecificationMode }) =>
      submitIntent({
        kind: 'phase-entry',
        phase,
        ...(options?.mode ? { mode: options.mode } : {}),
      }),
    [submitIntent],
  );

  const submitPhaseContinue = useCallback(
    (phase: WorkflowPhase) =>
      submitIntent({
        kind: 'phase-continue',
        phase,
      }),
    [submitIntent],
  );

  return useMemo(
    () => ({
      submitPhaseEntry,
      submitPhaseContinue,
      isPending,
      errorMessage,
      clearError,
    }),
    [clearError, errorMessage, isPending, submitPhaseContinue, submitPhaseEntry],
  );
}

export function useSubmitTurnResponseMutation({
  specificationId,
  turn,
  sendMessage,
}: {
  specificationId: number;
  turn: SpecificationTurn | undefined;
  sendMessage: (message: { text: string }) => Promise<void> | void;
}): SubmitTurnResponseMutationState {
  const { invalidateSpecificationBundle } = useInvalidateSpecificationQueryDomains();
  const { clearError, errorMessage, isPending, run } = useClientMutation(
    (variables: { turnId: number; response: SubmitTurnResponseRequest }) =>
      postJsonMutation<SubmitTurnResponseResponse, SubmitTurnResponseRequest>(
        `/api/specifications/${specificationId}/turns/${variables.turnId}/response`,
        variables.response,
        'Failed to save response',
      ),
  );

  const submitTurnResponse = useCallback(
    async (
      positions: number[] = [],
      freeText?: string,
      reviewActionOverride?: ReviewAction,
      itemComments?: Array<{ reviewItemId: string; comment: string }>,
    ) => {
      if (!turn) {
        return false;
      }
      const uniquePositions = [...new Set(positions)];
      const selectedOptions = findTurnOptionsByPositions(turn, uniquePositions);
      if (selectedOptions.length !== uniquePositions.length) {
        return false;
      }
      const trimmedFreeText = freeText?.trim();
      const responseText = formatTurnResponseText({
        selectedOptionContents: selectedOptions.map((option) => option.content),
        freeText: trimmedFreeText,
      });
      if (!responseText) {
        return false;
      }

      const reviewAction = reviewActionOverride ?? getReviewActionForSelectedPositions(turn, uniquePositions);
      const response: SubmitTurnResponseRequest =
        uniquePositions.length > 0
          ? {
              kind: 'select-options',
              positions: uniquePositions,
              ...(trimmedFreeText ? { freeText: trimmedFreeText } : {}),
              ...(reviewAction ? { reviewAction } : {}),
              ...(itemComments?.length ? { itemComments } : {}),
            }
          : {
              kind: 'free-text',
              freeText: trimmedFreeText!,
            };

      try {
        const result = await run({
          turnId: turn.id,
          response,
        });
        await invalidateSpecificationBundle();
        if (result.advancedToPhase || result.workflowCompleted) {
          return true;
        }
        await sendMessage({ text: responseText });
        return true;
      } catch {
        // The shared mutation hook surfaces the failure state in the UI.
        return false;
      }
    },
    [invalidateSpecificationBundle, run, sendMessage, turn],
  );

  return useMemo(
    () => ({
      submitTurnResponse,
      isPending,
      errorMessage,
      clearError,
    }),
    [clearError, errorMessage, isPending, submitTurnResponse],
  );
}
