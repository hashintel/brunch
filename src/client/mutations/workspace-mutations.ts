import { useRouter } from '@tanstack/react-router';

import type { ProjectStateTurn } from '../../shared/api-types.js';
import { formatTurnResponseText } from '../../shared/chat.js';
import { findTurnOptionByPosition } from '../workspace/workspace-controller-core.js';
import { postJsonMutation, useClientMutation } from './client-mutation.js';

export function useSelectTurnOptionMutation({
  projectId,
  turn,
  sendMessage,
}: {
  projectId: number;
  turn: ProjectStateTurn | undefined;
  sendMessage: (message: { text: string }) => Promise<void> | void;
}) {
  const router = useRouter();
  const mutation = useClientMutation((variables: { turnId: number; position: number; freeText?: string }) =>
    postJsonMutation<{ ok: boolean }, { position: number; freeText?: string }>(
      `/api/projects/${projectId}/turns/${variables.turnId}/select`,
      { position: variables.position, ...(variables.freeText ? { freeText: variables.freeText } : {}) },
      'Failed to save selection',
    ),
  );

  return {
    selectOption: async (position: number, freeText?: string) => {
      const selected = findTurnOptionByPosition(turn, position);
      if (!selected || !turn) {
        return;
      }
      const trimmedFreeText = freeText?.trim();

      try {
        await mutation.run({ turnId: turn.id, position, freeText: trimmedFreeText || undefined });
        await router.invalidate();
        await sendMessage({
          text: formatTurnResponseText({
            selectedOptionContents: [selected.content],
            freeText: trimmedFreeText,
          }),
        });
      } catch {
        // The shared mutation hook surfaces the failure state in the UI.
      }
    },
    isPending: mutation.isPending,
    errorMessage: mutation.errorMessage,
    clearError: mutation.clearError,
  };
}
