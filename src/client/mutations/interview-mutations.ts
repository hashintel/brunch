import { useRouter } from '@tanstack/react-router';

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
  projectId,
}: {
  projectId: number;
}): SubmitPhaseIntentMutationState {
  const router = useRouter();
  const mutation = useClientMutation((request: SubmitPhaseIntentRequest) =>
    postJsonMutation<SubmitPhaseIntentResponse, SubmitPhaseIntentRequest>(
      `/api/projects/${projectId}/phase-intent`,
      request,
      'Failed to submit phase intent',
    ),
  );

  const submitIntent = async (
    request: SubmitPhaseIntentRequest,
  ): Promise<SubmitPhaseIntentResponse | null> => {
    try {
      const response = await mutation.run(request);
      await router.invalidate();
      return response;
    } catch {
      return null;
    }
  };

  return {
    submitPhaseEntry: (phase: WorkflowPhase, options?: { mode?: SpecificationMode }) =>
      submitIntent({
        kind: 'phase-entry',
        phase,
        ...(options?.mode ? { mode: options.mode } : {}),
      }),
    submitPhaseContinue: (phase: WorkflowPhase) =>
      submitIntent({
        kind: 'phase-continue',
        phase,
      }),
    isPending: mutation.isPending,
    errorMessage: mutation.errorMessage,
    clearError: mutation.clearError,
  };
}

export function useSubmitTurnResponseMutation({
  projectId,
  turn,
  sendMessage,
}: {
  projectId: number;
  turn: SpecificationTurn | undefined;
  sendMessage: (message: { text: string }) => Promise<void> | void;
}): SubmitTurnResponseMutationState {
  const router = useRouter();
  const mutation = useClientMutation((variables: { turnId: number; response: SubmitTurnResponseRequest }) =>
    postJsonMutation<SubmitTurnResponseResponse, SubmitTurnResponseRequest>(
      `/api/projects/${projectId}/turns/${variables.turnId}/response`,
      variables.response,
      'Failed to save response',
    ),
  );

  return {
    submitTurnResponse: async (
      positions: number[] = [],
      freeText?: string,
      reviewActionOverride?: ReviewAction,
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
            }
          : {
              kind: 'free-text',
              freeText: trimmedFreeText!,
            };

      try {
        const result = await mutation.run({
          turnId: turn.id,
          response,
        });
        await router.invalidate();
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
    isPending: mutation.isPending,
    errorMessage: mutation.errorMessage,
    clearError: mutation.clearError,
  };
}
