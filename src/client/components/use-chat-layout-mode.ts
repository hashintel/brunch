import { useCallback, useEffect, useState } from 'react';

import type { ChatLayoutMode } from './unified-chat-shell.js';

/**
 * Persisted chat-layout mode hook (FE-716 C13).
 *
 * Backs the unified chat shell's layout-mode toggle with localStorage so the
 * choice survives reload per `UNIFIED_CHAT_UX.md` §4. The storage key is
 * scoped per specification id; switching specifications restores that
 * specification's mode (defaulting to `side-docked`).
 *
 * Per `UNIFIED_CHAT_UX.md` §10, pressing Esc decrements the layout one tier
 * (Full → Maximize → Side-docked → Compact). Decrementing past Compact is a
 * no-op (it's the smallest mode). The Esc handler is keyed to bubble-phase
 * keydown so any focused element (composer, etc.) sees Esc first.
 */

export const CHAT_LAYOUT_MODE_ORDER: ReadonlyArray<ChatLayoutMode> = [
  'compact',
  'side-docked',
  'maximize',
  'full',
];

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
    if (isChatLayoutMode(stored)) return stored;
  } catch {
    // localStorage may throw in restricted contexts; fall back to default
  }
  return DEFAULT_MODE;
}

function writePersistedMode(specificationId: number | string, mode: ChatLayoutMode): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(chatLayoutModeStorageKey(specificationId), mode);
  } catch {
    // ignore quota / SecurityError
  }
}

/**
 * Decrement the mode one tier (Full → Maximize → Side-docked → Compact).
 * Returns the same mode when already at the smallest tier (Compact).
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

  // When the specification id changes (route navigation across specs),
  // re-hydrate from that spec's storage slot.
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

  // Esc decrements one tier (§10). Bound at document level so any focused
  // element (composer, button) still gets Esc first via stopPropagation if it
  // wants to handle Esc itself (e.g. Radix collapsibles do not).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (event.defaultPrevented) return;
      setLayoutModeState((current) => {
        const next = decrementChatLayoutMode(current);
        if (next === current) return current;
        writePersistedMode(specificationId, next);
        return next;
      });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [specificationId]);

  return { layoutMode, setLayoutMode };
}
