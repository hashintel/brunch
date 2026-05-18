import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

/**
 * FE-716 C14 — chat-shell presence + focus context.
 *
 * Provides three primitives consumed by `<UnifiedChatShell>`,
 * `<SecondaryChatHost>` / `<SecondaryChatCollapsible>`, and the
 * `SecondaryChatTriggerProvider`:
 *
 *  - `isCollapsed` + `expand` — controls whether the shell is collapsed to a
 *    bar or showing the full body. Creating a chat from a workspace trigger
 *    must expand the shell first (per UNIFIED_CHAT_UX.md flow §4 + brief
 *    intent: "you see the chat where it happens").
 *  - `focusedChatId` + `focusChat` — the most recently focused chat id (set
 *    by a successful trigger create). `<SecondaryChatHost>` reads it to
 *    force its collapsible open, so a freshly-created chat is auto-expanded
 *    even though the collapsible is otherwise uncontrolled.
 *  - `jumpToAnchor(turnId)` — scrolls the workspace center pane to the
 *    artifact bearing `data-anchor-turn-id={turnId}` and briefly highlights
 *    it. Used by the per-chat "Jump to anchor" header link.
 *
 * The provider is mounted in `_view/route.tsx` above both the workspace
 * center and the shell so all three consumers share one source of truth.
 */

const HIGHLIGHT_CLASS = 'ring-2 ring-ink/40 ring-offset-2 ring-offset-background';
const HIGHLIGHT_DURATION_MS = 1500;

export interface ChatShellPresenceValue {
  readonly isCollapsed: boolean;
  readonly collapse: () => void;
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

export function ChatShellPresenceProvider({ children }: { children: ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [focusedChatId, setFocusedChatId] = useState<number | null>(null);

  const expand = useCallback(() => setIsCollapsed(false), []);
  const collapse = useCallback(() => setIsCollapsed(true), []);

  const focusChat = useCallback((chatId: number) => {
    setIsCollapsed(false); // ensure shell visible
    setFocusedChatId(chatId);
  }, []);

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

  const value = useMemo<ChatShellPresenceValue>(
    () => ({ isCollapsed, collapse, expand, focusedChatId, focusChat, clearFocus, jumpToAnchor }),
    [clearFocus, collapse, expand, focusChat, focusedChatId, isCollapsed, jumpToAnchor],
  );

  return <ChatShellPresenceContext.Provider value={value}>{children}</ChatShellPresenceContext.Provider>;
}
