import { useRouter } from '@tanstack/react-router';

import type { ProjectStateTurn } from '../../shared/api-types.js';
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
  const mutation = useClientMutation((variables: { turnId: number; position: number }) =>
    postJsonMutation<{ ok: boolean }, { position: number }>(
      `/api/projects/${projectId}/turns/${variables.turnId}/select`,
      { position: variables.position },
      'Failed to save selection',
    ),
  );

  return {
    selectOption: async (position: number) => {
      const selected = findTurnOptionByPosition(turn, position);
      if (!selected || !turn) {
        return;
      }

      try {
        await mutation.run({ turnId: turn.id, position });
        await router.invalidate();
        await sendMessage({ text: selected.content });
      } catch {
        // The shared mutation hook surfaces the failure state in the UI.
      }
    },
    isPending: mutation.isPending,
    errorMessage: mutation.errorMessage,
    clearError: mutation.clearError,
  };
}
