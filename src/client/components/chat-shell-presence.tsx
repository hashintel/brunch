import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { useSpecPersistedEnum, type SpecPersistedEnumConfig } from './use-spec-persisted-enum.js';

const HIGHLIGHT_CLASS = 'ring-2 ring-ink/40 ring-offset-2 ring-offset-background';
const HIGHLIGHT_DURATION_MS = 1500;

export type ChatShellAppearance = 'expanded' | 'minimized' | 'closed';

const APPEARANCE_PERSISTENCE: SpecPersistedEnumConfig<ChatShellAppearance> = {
  slug: 'chat-shell-appearance',
  fallback: 'closed',
  decode: (raw) => (raw === 'expanded' || raw === 'minimized' || raw === 'closed' ? raw : null),
};

export interface ChatShellPresenceValue {
  readonly appearance: ChatShellAppearance;
  readonly isCollapsed: boolean;
  readonly collapse: () => void;
  readonly minimize: () => void;
  readonly close: () => void;
  readonly expand: () => void;
  readonly focusedChatId: number | null;
  readonly focusChat: (chatId: number) => void;
  readonly clearFocus: () => void;
  /**
   * Scrolls the workspace-center pane to the artifact bearing
   * `data-anchor-turn-id={turnId}` and briefly applies a highlight ring.
   * No-op when the turn is not in the DOM (e.g. unrendered phase).
   */
  readonly jumpToAnchor: (turnId: number) => void;
}

const ChatShellPresenceContext = createContext<ChatShellPresenceValue | null>(null);

export function useChatShellPresence(): ChatShellPresenceValue | null {
  return useContext(ChatShellPresenceContext);
}

export function ChatShellPresenceProvider({
  children,
  specificationId,
}: {
  children: ReactNode;
  specificationId: number | string;
}) {
  const [appearance, setAppearance] = useSpecPersistedEnum(specificationId, APPEARANCE_PERSISTENCE);
  const [focusedChatId, setFocusedChatId] = useState<number | null>(null);

  const expand = useCallback(() => setAppearance('expanded'), [setAppearance]);
  const minimize = useCallback(() => setAppearance('minimized'), [setAppearance]);
  const close = useCallback(() => setAppearance('closed'), [setAppearance]);
  const collapse = minimize;

  const focusChat = useCallback(
    (chatId: number) => {
      setAppearance('expanded');
      setFocusedChatId(chatId);
    },
    [setAppearance],
  );

  const clearFocus = useCallback(() => setFocusedChatId(null), []);

  const jumpToAnchor = useCallback((turnId: number) => {
    if (typeof document === 'undefined') return;
    const target = document.querySelector<HTMLElement>(`[data-anchor-turn-id="${turnId}"]`);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const ringClasses = HIGHLIGHT_CLASS.split(' ');
    target.classList.add(...ringClasses);
    window.setTimeout(() => {
      target.classList.remove(...ringClasses);
    }, HIGHLIGHT_DURATION_MS);
  }, []);

  const isCollapsed = appearance !== 'expanded';
  const value = useMemo<ChatShellPresenceValue>(
    () => ({
      appearance,
      isCollapsed,
      collapse,
      minimize,
      close,
      expand,
      focusedChatId,
      focusChat,
      clearFocus,
      jumpToAnchor,
    }),
    [
      appearance,
      clearFocus,
      close,
      collapse,
      expand,
      focusChat,
      focusedChatId,
      isCollapsed,
      jumpToAnchor,
      minimize,
    ],
  );

  return <ChatShellPresenceContext.Provider value={value}>{children}</ChatShellPresenceContext.Provider>;
}
