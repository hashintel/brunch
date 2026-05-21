import { useCallback, useEffect, useRef, useState } from 'react';

import type { ChatLayoutMode } from './unified-chat-shell.js';

export const CHAT_LAYOUT_MODE_ORDER: ReadonlyArray<ChatLayoutMode> = [
  'compact',
  'side-docked',
  'maximize',
  'full',
];

// FE-716 shell brief opens the chat in the split Side-docked layout so the
// workspace and chat share the viewport on first visit. Compact / Maximize /
// Full remain reachable via the header toggle and persist per spec.
const DEFAULT_MODE: ChatLayoutMode = 'side-docked';

function isChatLayoutMode(value: unknown): value is ChatLayoutMode {
  return typeof value === 'string' && (CHAT_LAYOUT_MODE_ORDER as readonly string[]).includes(value);
}

export function chatLayoutModeStorageKey(specificationId: number | string): string {
  return `brunch:chat-layout-mode:${specificationId}`;
}

function readPersistedMode(specificationId: number | string): ChatLayoutMode {
  if (typeof window === 'undefined') return DEFAULT_MODE;
  try {
    const stored = window.localStorage.getItem(chatLayoutModeStorageKey(specificationId));
    if (isChatLayoutMode(stored)) {
      return stored;
    }
  } catch {
    // ignore
  }
  return DEFAULT_MODE;
}

function writePersistedMode(specificationId: number | string, mode: ChatLayoutMode): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(chatLayoutModeStorageKey(specificationId), mode);
  } catch {
    // ignore
  }
}

/**
 * Decrement the mode one tier (Full → Maximize → Side-docked → Compact).
 * Returns the same mode when already at the smallest tier.
 */
export function decrementChatLayoutMode(mode: ChatLayoutMode): ChatLayoutMode {
  const index = CHAT_LAYOUT_MODE_ORDER.indexOf(mode);
  if (index <= 0) return mode;
  return CHAT_LAYOUT_MODE_ORDER[index - 1]!;
}

export interface UseChatLayoutModeResult {
  readonly layoutMode: ChatLayoutMode;
  readonly setLayoutMode: (mode: ChatLayoutMode) => void;
}

export function useChatLayoutMode(specificationId: number | string): UseChatLayoutModeResult {
  const [layoutMode, setLayoutModeState] = useState<ChatLayoutMode>(() => readPersistedMode(specificationId));

  // Ref keeps Esc handler out of setState updaters so localStorage writes fire exactly once.
  const layoutModeRef = useRef(layoutMode);
  useEffect(() => {
    layoutModeRef.current = layoutMode;
  }, [layoutMode]);

  // Re-hydrate from the new spec's storage slot on route navigation.
  useEffect(() => {
    setLayoutModeState(readPersistedMode(specificationId));
  }, [specificationId]);

  const setLayoutMode = useCallback(
    (mode: ChatLayoutMode) => {
      setLayoutModeState(mode);
      writePersistedMode(specificationId, mode);
    },
    [specificationId],
  );

  // Document-level Esc decrement; focused elements can stopPropagation first.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (event.defaultPrevented) return;
      const current = layoutModeRef.current;
      const next = decrementChatLayoutMode(current);
      if (next === current) return;
      layoutModeRef.current = next;
      writePersistedMode(specificationId, next);
      setLayoutModeState(next);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [specificationId]);

  return { layoutMode, setLayoutMode };
}
