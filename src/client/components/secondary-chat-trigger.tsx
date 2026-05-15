import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';

import { postJsonMutation, useClientMutation } from '@/client/mutations/client-mutation.js';
import {
  useInvalidateSpecificationQueryDomains,
  useSpecificationBundleData,
} from '@/client/routes/specification/$id/-specification-data.js';
import type { KnowledgeKind } from '@/shared/knowledge.js';

export interface CreateSecondaryChatRequest {
  parentChatId: number;
  invokedInTurnId: number;
  itemKind: KnowledgeKind;
  itemId: number;
  spanHint?: string;
}

export interface CreateSecondaryChatResponse {
  chatId: number;
  kickoffTurnId: number;
}

export function useCreateSecondaryChatMutation(specificationId: number) {
  const { invalidateSpecificationBundle } = useInvalidateSpecificationQueryDomains();
  const mutation = useClientMutation((request: CreateSecondaryChatRequest) =>
    postJsonMutation<CreateSecondaryChatResponse, CreateSecondaryChatRequest>(
      `/api/specifications/${specificationId}/secondary-chats`,
      request,
      'Failed to open secondary chat',
    ),
  );

  const create = useCallback(
    async (request: CreateSecondaryChatRequest): Promise<CreateSecondaryChatResponse | null> => {
      try {
        const response = await mutation.run(request);
        await invalidateSpecificationBundle();
        return response;
      } catch {
        return null;
      }
    },
    [invalidateSpecificationBundle, mutation],
  );

  return {
    create,
    isPending: mutation.isPending,
    errorMessage: mutation.errorMessage,
    clearError: mutation.clearError,
  };
}

export interface SecondaryChatTriggerItem {
  kind: KnowledgeKind;
  id: number;
}

export interface SecondaryChatTriggerValue {
  readonly canCreate: boolean;
  readonly isPending: boolean;
  readonly create: (item: SecondaryChatTriggerItem) => Promise<CreateSecondaryChatResponse | null>;
}

const SecondaryChatTriggerContext = createContext<SecondaryChatTriggerValue | null>(null);

export function useSecondaryChatTrigger(): SecondaryChatTriggerValue | null {
  return useContext(SecondaryChatTriggerContext);
}

/**
 * Provides the inline-secondary-chat creation callback to descendants. Reads the
 * specification bundle for `primary_chat_id` (parent chat) and `active_turn_id`
 * (anchor turn). When either is missing, `canCreate` is false and `create` rejects.
 */
export function SecondaryChatTriggerProvider({ children }: { children: ReactNode }) {
  const specificationState = useSpecificationBundleData();
  const specificationId = specificationState.specification.id;
  const parentChatId = specificationState.specification.primary_chat_id ?? null;
  const activeTurnId = specificationState.specification.active_turn_id;
  const mutation = useCreateSecondaryChatMutation(specificationId);

  const canCreate = parentChatId !== null && activeTurnId !== null;

  const create = useCallback(
    async (item: SecondaryChatTriggerItem) => {
      if (parentChatId === null || activeTurnId === null) {
        return null;
      }
      return mutation.create({
        parentChatId,
        invokedInTurnId: activeTurnId,
        itemKind: item.kind,
        itemId: item.id,
      });
    },
    [activeTurnId, mutation, parentChatId],
  );

  const value = useMemo<SecondaryChatTriggerValue>(
    () => ({ canCreate, isPending: mutation.isPending, create }),
    [canCreate, create, mutation.isPending],
  );

  return (
    <SecondaryChatTriggerContext.Provider value={value}>{children}</SecondaryChatTriggerContext.Provider>
  );
}
