import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';

import {
  ClientMutationError,
  postJsonMutation,
  useClientMutation,
} from '@/client/mutations/client-mutation.js';
import {
  useInvalidateSpecificationQueryDomains,
  useSpecificationBundleData,
} from '@/client/routes/specification/$id/-specification-data.js';
import type { MutationErrorResponse } from '@/shared/api-types.js';
import type { KnowledgeKind } from '@/shared/knowledge.js';
import {
  getCurrentOpenPhase,
  getPhaseRoutePath,
  groundingWorkflowPhase,
} from '@/shared/phase-descriptors.js';

export type SecondaryChatMode = 'explore' | 'edit';

async function patchJsonMutation<TResponse, TRequest>(
  url: string,
  body: TRequest,
  fallbackMessage: string,
): Promise<TResponse> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ClientMutationError(fallbackMessage);
  }
  if (!response.ok) {
    let message = fallbackMessage;
    try {
      const payload = (await response.json()) as MutationErrorResponse;
      if (typeof payload.error === 'string' && payload.error.trim().length > 0) {
        message = payload.error;
      }
    } catch {
      // ignore
    }
    throw new ClientMutationError(message, response.status);
  }
  try {
    return (await response.json()) as TResponse;
  } catch {
    throw new ClientMutationError(fallbackMessage, response.status);
  }
}

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
  /**
   * Optional highlighted span from the source row — when present, the server
   * persists it as `pinned_span_hint` on the new chat so the kickoff turn can
   * focus the conversation on that excerpt (mirrors the legacy
   * `useSideChat().openWithSpanHint` path).
   */
  spanHint?: string;
}

export interface InlineChatRoute {
  /** TanStack-Router `to` path for the route that renders inline chats. */
  readonly to: string;
  /** Route params required for `to` (currently just the specification id). */
  readonly params: { readonly id: string };
}

export interface SecondaryChatTriggerValue {
  readonly canCreate: boolean;
  readonly isPending: boolean;
  readonly create: (item: SecondaryChatTriggerItem) => Promise<CreateSecondaryChatResponse | null>;
  /**
   * Route descriptor that surfaces the newly-created inline chat. Callers that
   * render outside the transcript view (e.g. the graph / structured list) should
   * navigate here after a successful `create`, since only the transcript view
   * renders `SecondaryChatCollapsible`. Always set, even when `canCreate` is
   * false — that way callers can compute it once during render.
   */
  readonly inlineChatRoute: InlineChatRoute;
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
        ...(item.spanHint ? { spanHint: item.spanHint } : {}),
      });
    },
    [activeTurnId, mutation, parentChatId],
  );

  const inlineChatRoute = useMemo<InlineChatRoute>(() => {
    const activePhase = getCurrentOpenPhase(specificationState.workflow.phases) ?? groundingWorkflowPhase;
    return {
      to: getPhaseRoutePath(activePhase),
      params: { id: String(specificationId) },
    };
  }, [specificationId, specificationState.workflow.phases]);

  const value = useMemo<SecondaryChatTriggerValue>(
    () => ({ canCreate, isPending: mutation.isPending, create, inlineChatRoute }),
    [canCreate, create, inlineChatRoute, mutation.isPending],
  );

  return (
    <SecondaryChatTriggerContext.Provider value={value}>{children}</SecondaryChatTriggerContext.Provider>
  );
}

export interface SetSecondaryChatModeRequest {
  mode: SecondaryChatMode;
}

export interface SetSecondaryChatModeResponse {
  chatId: number;
  mode: SecondaryChatMode;
}

export function useSetSecondaryChatModeMutation(specificationId: number, chatId: number) {
  const { invalidateSpecificationBundle } = useInvalidateSpecificationQueryDomains();
  const mutation = useClientMutation((request: SetSecondaryChatModeRequest) =>
    patchJsonMutation<SetSecondaryChatModeResponse, SetSecondaryChatModeRequest>(
      `/api/specifications/${specificationId}/secondary-chats/${chatId}/mode`,
      request,
      'Failed to update secondary chat mode',
    ),
  );

  const setMode = useCallback(
    async (mode: SecondaryChatMode): Promise<SetSecondaryChatModeResponse | null> => {
      try {
        const response = await mutation.run({ mode });
        await invalidateSpecificationBundle();
        return response;
      } catch {
        return null;
      }
    },
    [invalidateSpecificationBundle, mutation],
  );

  return {
    setMode,
    isPending: mutation.isPending,
    errorMessage: mutation.errorMessage,
    clearError: mutation.clearError,
  };
}
