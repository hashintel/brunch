import { useEffect, useRef } from 'react';

import type { BrunchUIMessage } from '../../shared/chat.js';

export type ChatHydrationReason = 'initial-project-entry' | 'project-navigation' | 'same-project-refresh';

export function getChatHydrationReason(
  lastHydratedProjectId: number | undefined,
  nextProjectId: number,
): ChatHydrationReason {
  if (lastHydratedProjectId === undefined) {
    return 'initial-project-entry';
  }

  if (lastHydratedProjectId !== nextProjectId) {
    return 'project-navigation';
  }

  return 'same-project-refresh';
}

export function useChatHydrationBoundary(
  projectId: number,
  seedMessages: BrunchUIMessage[],
  setMessages: (messages: BrunchUIMessage[]) => void,
) {
  const lastHydratedProjectId = useRef<number | undefined>(undefined);

  useEffect(() => {
    const hydrationReason = getChatHydrationReason(lastHydratedProjectId.current, projectId);

    if (hydrationReason === 'same-project-refresh') {
      return;
    }

    setMessages(seedMessages);
    lastHydratedProjectId.current = projectId;
  }, [projectId, seedMessages, setMessages]);
}
