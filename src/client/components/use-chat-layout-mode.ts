import { useCallback, useEffect, useRef } from 'react';

import type { ChatLayoutMode } from './unified-chat-shell.js';
import {
  specPersistedEnumStorageKey,
  useSpecPersistedEnum,
  type SpecPersistedEnumConfig,
} from './use-spec-persisted-enum.js';

export const CHAT_LAYOUT_MODE_ORDER: ReadonlyArray<ChatLayoutMode> = [
  'compact',
  'side-docked',
  'maximize',
  'full',
];

// FE-716 shell brief opens the chat in the split Side-docked layout so the
// workspace and chat share the viewport on first visit.
const DEFAULT_MODE: ChatLayoutMode = 'side-docked';

function isChatLayoutMode(value: unknown): value is ChatLayoutMode {
  return typeof value === 'string' && (CHAT_LAYOUT_MODE_ORDER as readonly string[]).includes(value);
}

export function chatLayoutModeStorageKey(specificationId: number | string): string {
  return specPersistedEnumStorageKey('chat-layout-mode', specificationId);
}

const LAYOUT_MODE_PERSISTENCE: SpecPersistedEnumConfig<ChatLayoutMode> = {
  slug: 'chat-layout-mode',
  fallback: DEFAULT_MODE,
  decode: (raw) => (isChatLayoutMode(raw) ? raw : null),
};

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
  const [layoutMode, setLayoutMode] = useSpecPersistedEnum(specificationId, LAYOUT_MODE_PERSISTENCE);

  // Ref keeps the Esc handler reading the latest mode without re-binding.
  const layoutModeRef = useRef(layoutMode);
  useEffect(() => {
    layoutModeRef.current = layoutMode;
  }, [layoutMode]);

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
      setLayoutMode(next);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setLayoutMode]);

  return { layoutMode, setLayoutMode };
}
