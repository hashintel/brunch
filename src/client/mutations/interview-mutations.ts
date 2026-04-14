import { useRouter } from '@tanstack/react-router';

import type {
  ProjectStateTurn,
  SubmitTurnResponseRequest,
  SubmitTurnResponseResponse,
} from '@/shared/api-types.js';
import { formatTurnResponseText } from '@/shared/chat.js';

import { findTurnOptionsByPositions } from '../routes/project/$id/_view/-interview-controller-core.js';
import { postJsonMutation, useClientMutation } from './client-mutation.js';

export interface SubmitTurnResponseMutationState {
  readonly submitTurnResponse: (positions?: number[], freeText?: string) => Promise<boolean>;
  readonly isPending: boolean;
  readonly errorMessage: string | null;
  readonly clearError: () => void;
}

export function useSubmitTurnResponseMutation({
  projectId,
  turn,
  sendMessage,
}: {
  projectId: number;
  turn: ProjectStateTurn | undefined;
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
    submitTurnResponse: async (positions: number[] = [], freeText?: string) => {
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

      const response: SubmitTurnResponseRequest =
        uniquePositions.length > 0
          ? {
              kind: 'select-options',
              positions: uniquePositions,
              ...(trimmedFreeText ? { freeText: trimmedFreeText } : {}),
            }
          : {
              kind: 'free-text',
              freeText: trimmedFreeText!,
            };

      try {
        await mutation.run({
          turnId: turn.id,
          response,
        });
        await router.invalidate();
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
