import { useRouter } from '@tanstack/react-router';

import type { ProjectStateTurn } from '../../shared/api-types.js';
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
  const mutation = useClientMutation(
    (variables: { turnId: number; positions?: number[]; freeText?: string }) =>
      postJsonMutation<{ ok: boolean }, { positions?: number[]; freeText?: string }>(
        `/api/projects/${projectId}/turns/${variables.turnId}/select`,
        {
          ...(variables.positions?.length ? { positions: variables.positions } : {}),
          ...(variables.freeText ? { freeText: variables.freeText } : {}),
        },
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

      try {
        await mutation.run({
          turnId: turn.id,
          positions: uniquePositions.length > 0 ? uniquePositions : undefined,
          freeText: trimmedFreeText || undefined,
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
