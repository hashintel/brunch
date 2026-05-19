import { useCallback, useEffect, useRef, useState } from 'react';

import type { ChatLayoutMode } from './unified-chat-shell.js';

// `'full'` is now reachable from the header toggle (renders the chat over
// the entire viewport, hiding the center workspace). Older persisted values
// resolve directly — no clamping.
export const CHAT_LAYOUT_MODE_ORDER: ReadonlyArray<ChatLayoutMode> = [
  'compact',
  'side-docked',
  'maximize',
  'full',
];

const DEFAULT_MODE: ChatLayoutMode = 'compact';

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

  // Mirror `layoutMode` into a ref so the Esc handler can derive the next
  // mode without running a side effect inside `setLayoutModeState`'s updater
  // function (React may invoke updaters more than once — e.g. Strict Mode —
  // and `localStorage.setItem` should fire exactly once per transition).
  const layoutModeRef = useRef(layoutMode);
  useEffect(() => {
    layoutModeRef.current = layoutMode;
  }, [layoutMode]);

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

  // Esc decrements one tier. Bound at document level so any focused element
  // (composer, button) still gets Esc first via stopPropagation if it wants
  // to handle Esc itself (e.g. Radix collapsibles do not).
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
