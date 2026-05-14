import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { queryClient } from '@/client/query-client.js';
import { specificationQueryKeys } from '@/client/routes/specification/$id/-specification-data.js';
import type { SpecificationState } from '@/shared/api-types.js';
import type { KnowledgeKind } from '@/shared/knowledge.js';

export interface SideChatPinnableItem {
  kind: KnowledgeKind;
  id: number;
  referenceCode: string;
  content: string;
}

interface SideChatContextValue {
  openFor: (item: SideChatPinnableItem) => void;
  /** When set, the ThreadCollapsible for this item should expand, scroll into view, and focus its input. */
  focusedThreadItemId: number | null;
  clearFocusedThread: () => void;
}

const SideChatContext = createContext<SideChatContextValue | null>(null);

export function useSideChat(): SideChatContextValue | null {
  return useContext(SideChatContext);
}

export function SideChatHost({
  specificationId,
  children,
}: {
  specificationId: number;
  children: ReactNode;
}) {
  const [focusedThreadItemId, setFocusedThreadItemId] = useState<number | null>(null);

  const clearFocusedThread = useCallback(() => {
    setFocusedThreadItemId(null);
  }, []);

  const openFor = useCallback(
    (item: SideChatPinnableItem) => {
      // Check if an inline side-chat thread already exists for this item.
      const specState = queryClient.getQueryData(specificationQueryKeys.bundle(String(specificationId))) as
        | SpecificationState
        | undefined;
      const existingThread = specState?.threads?.find(
        (t) => t.kind === 'side' && t.target_item_id === item.id && t.status === 'open',
      );
      if (existingThread) {
        setFocusedThreadItemId(item.id);
        return;
      }

      // No thread yet — create one eagerly so the ThreadCollapsible appears
      // in the transcript immediately.
      void (async () => {
        try {
          const res = await fetch(`/api/specifications/${specificationId}/threads`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetItemId: item.id }),
          });
          if (!res.ok) return;
          await queryClient.invalidateQueries({
            queryKey: specificationQueryKeys.bundle(String(specificationId)),
          });
          setFocusedThreadItemId(item.id);
        } catch {
          // Network error — silently degrade; the user can retry.
        }
      })();
    },
    [specificationId],
  );

  const sideChatContextValue = useMemo(
    () => ({
      openFor,
      focusedThreadItemId,
      clearFocusedThread,
    }),
    [openFor, focusedThreadItemId, clearFocusedThread],
  );

  return <SideChatContext.Provider value={sideChatContextValue}>{children}</SideChatContext.Provider>;
}
