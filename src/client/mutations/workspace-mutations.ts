import { useRouter } from '@tanstack/react-router';

import type { ProjectStateTurn } from '../../shared/api-types.js';
import { formatTurnResponseText } from '../../shared/chat.js';
import { findTurnOptionByPosition } from '../workspace/workspace-controller-core.js';
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
  const mutation = useClientMutation((variables: { turnId: number; position?: number; freeText?: string }) =>
    postJsonMutation<{ ok: boolean }, { position?: number; freeText?: string }>(
      `/api/projects/${projectId}/turns/${variables.turnId}/select`,
      {
        ...(typeof variables.position === 'number' ? { position: variables.position } : {}),
        ...(variables.freeText ? { freeText: variables.freeText } : {}),
      },
      'Failed to save response',
    ),
  );

  return {
    submitTurnResponse: async (position?: number, freeText?: string) => {
      if (!turn) {
        return;
      }
      const selected = typeof position === 'number' ? findTurnOptionByPosition(turn, position) : undefined;
      if (typeof position === 'number' && !selected) {
        return;
      }
      const trimmedFreeText = freeText?.trim();
      const responseText = formatTurnResponseText({
        selectedOptionContents: selected ? [selected.content] : [],
        freeText: trimmedFreeText,
      });
      if (!responseText) {
        return;
      }

      try {
        await mutation.run({ turnId: turn.id, position, freeText: trimmedFreeText || undefined });
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
