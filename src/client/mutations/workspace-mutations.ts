import { useRouter } from '@tanstack/react-router';

import {
  submitTurnResponseResponseSchema,
  type ProjectStateTurn,
  type SubmitTurnResponseRequest,
  type SubmitTurnResponseResponse,
} from '../../shared/api-types.js';
import { formatTurnResponseText } from '../../shared/chat.js';
import { findTurnOptionsByPositions } from '../workspace/workspace-controller-core.js';
import { postJsonMutation, useClientMutation } from './client-mutation.js';

export function useSubmitTurnResponseMutation({
  projectId,
  turn,
  sendMessage,
}: {
  projectId: number;
  turn: ProjectStateTurn | undefined;
  sendMessage: (message: { text: string }) => Promise<void> | void;
}) {
  const router = useRouter();
  const mutation = useClientMutation((variables: { turnId: number; response: SubmitTurnResponseRequest }) =>
    postJsonMutation<SubmitTurnResponseResponse, SubmitTurnResponseRequest>(
      `/api/projects/${projectId}/turns/${variables.turnId}/response`,
      variables.response,
      submitTurnResponseResponseSchema,
      'Failed to save response',
    ),
  );

  return {
    submitTurnResponse: async (positions: number[] = [], freeText?: string) => {
      if (!turn) {
        return;
      }
      const uniquePositions = [...new Set(positions)];
      const selectedOptions = findTurnOptionsByPositions(turn, uniquePositions);
      if (selectedOptions.length !== uniquePositions.length) {
        return;
      }
      const trimmedFreeText = freeText?.trim();
      const responseText = formatTurnResponseText({
        selectedOptionContents: selectedOptions.map((option) => option.content),
        freeText: trimmedFreeText,
      });
      if (!responseText) {
        return;
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
      } catch {
        // The shared mutation hook surfaces the failure state in the UI.
      }
    },
    isPending: mutation.isPending,
    errorMessage: mutation.errorMessage,
    clearError: mutation.clearError,
  };
}
