import { Maximize2, Minimize2, Minus, PanelRight, Send, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';

import { cn } from '@/client/lib/utils.js';
import { useSpecificationBundleData } from '@/client/routes/specification/$id/-specification-data.js';

import { useChatShellPresence } from './chat-shell-presence.js';
import { ChatSwitcher } from './chat-switcher.js';
import { SecondaryChatHost } from './secondary-chat-host.js';
import { CHAT_SHELL_SPRING, usePrefersReducedMotion } from './use-prefers-reduced-motion.js';

export type ChatLayoutMode = 'compact' | 'side-docked' | 'maximize' | 'full';

type LocalAppearance = 'expanded' | 'minimized' | 'closed';

export interface UnifiedChatShellProps {
  readonly layoutMode?: ChatLayoutMode;
  readonly onLayoutModeChange?: (mode: ChatLayoutMode) => void;
}

export function UnifiedChatShell({ layoutMode = 'side-docked', onLayoutModeChange }: UnifiedChatShellProps) {
  const specificationState = useSpecificationBundleData();
  const presence = useChatShellPresence();
  const [localAppearance, setLocalAppearance] = useState<LocalAppearance>('expanded');
  const appearance: LocalAppearance = presence ? presence.appearance : localAppearance;
  const setAppearance = (next: LocalAppearance) => {
    if (presence) {
      if (next === 'expanded') presence.expand();
      else if (next === 'minimized') presence.minimize();
      else presence.close();
    } else {
      setLocalAppearance(next);
    }
  };

  const secondaryChats = specificationState.secondaryChats ?? [];
  // FE-716 C26: per-item secondary chats; reconciliation-pinned chats stay
  // hidden until Track 3 defines their UX.
  const itemChats = secondaryChats.filter((s) => s.chat.pinned_reconciliation_need_id === null);
  // Active chat: presence.focusedChatId, falling back to the most recent
  // item-anchored chat (highest id). Null when there are no item chats.
  const activeChat: (typeof itemChats)[number] | null =
    itemChats.find((c) => c.chat.id === presence?.focusedChatId) ??
    (itemChats.length > 0 ? (itemChats[itemChats.length - 1] ?? null) : null);
  const specName = specificationState.specification.name;
  const prefersReducedMotion = usePrefersReducedMotion();
  const fadeSpring = prefersReducedMotion ? { duration: 0 } : CHAT_SHELL_SPRING;

  if (appearance === 'closed') {
    return null;
  }

  if (appearance === 'minimized') {
    return (
      <motion.button
        key="minimized"
        type="button"
        data-testid="unified-chat-shell-minimized"
        onClick={() => setAppearance('expanded')}
        initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={fadeSpring}
        aria-label="Expand chat"
        className="fixed right-4 bottom-4 z-30 inline-flex items-center gap-2 rounded-full border border-rule bg-background px-3 py-1.5 text-xs text-ink shadow-md hover:bg-tint"
      >
        <Send aria-hidden className="size-3.5" />
        <span>Ask Brunch</span>
      </motion.button>
    );
  }

  return (
    <motion.div
      key="expanded"
      data-testid="unified-chat-shell"
      data-layout-mode={layoutMode}
      initial={prefersReducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={fadeSpring}
      className="flex h-full min-h-0 flex-col border-l border-rule bg-background"
    >
      <header
        data-testid="unified-chat-shell-header"
        className="flex items-center justify-between gap-2 border-b border-rule px-3 py-2"
      >
        <div data-testid="unified-chat-shell-spine-label" className="flex min-w-0 items-center gap-2">
          <span className="text-xs tracking-wide text-hint uppercase">Chat</span>
          <span className="min-w-0 truncate text-sm text-ink">{specName}</span>
          {itemChats.length > 1 && (
            <ChatSwitcher
              chats={itemChats}
              activeChatId={activeChat?.chat.id ?? null}
              onSelect={(id) => presence?.focusChat(id)}
            />
          )}
        </div>
        <div className="flex items-center gap-1">
          <div
            data-testid="unified-chat-shell-layout-buttons"
            role="group"
            aria-label="Chat layout"
            className="inline-flex items-center gap-0.5 rounded border border-rule bg-tint/40 p-0.5"
          >
            {(() => {
              const interactive = Boolean(onLayoutModeChange);
              const sideDockedActive = layoutMode === 'side-docked';
              const toggleIsMaxed = layoutMode === 'maximize';
              const toggleNext: ChatLayoutMode = toggleIsMaxed ? 'compact' : 'maximize';
              const toggleLabel = toggleIsMaxed ? 'Compact' : 'Maximize';
              const ToggleIcon = toggleIsMaxed ? Minimize2 : Maximize2;
              const togglePressed = layoutMode === 'compact' || layoutMode === 'maximize';
              return (
                <>
                  <button
                    type="button"
                    data-testid="unified-chat-shell-minimize"
                    aria-label="Minimize chat"
                    title="Minimize"
                    onClick={() => setAppearance('minimized')}
                    className="rounded px-1.5 py-1 text-xs text-hint transition-colors hover:bg-background hover:text-ink"
                  >
                    <Minus aria-hidden className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    data-testid="unified-chat-shell-layout-side-docked"
                    data-active={sideDockedActive}
                    aria-pressed={sideDockedActive}
                    aria-label="Side-docked"
                    title="Side-docked"
                    disabled={!interactive}
                    onClick={() => onLayoutModeChange?.('side-docked')}
                    className={cn(
                      'rounded px-1.5 py-1 text-xs transition-colors',
                      sideDockedActive
                        ? 'bg-background text-ink shadow-sm'
                        : 'text-hint hover:bg-background hover:text-ink',
                      !interactive && 'opacity-60',
                    )}
                  >
                    <PanelRight aria-hidden className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    data-testid="unified-chat-shell-layout-toggle"
                    data-active={togglePressed}
                    data-mode-target={toggleNext}
                    aria-pressed={togglePressed}
                    aria-label={toggleLabel}
                    title={toggleLabel}
                    disabled={!interactive}
                    onClick={() => onLayoutModeChange?.(toggleNext)}
                    className={cn(
                      'rounded px-1.5 py-1 text-xs transition-colors',
                      togglePressed
                        ? 'bg-background text-ink shadow-sm'
                        : 'text-hint hover:bg-background hover:text-ink',
                      !interactive && 'opacity-60',
                    )}
                  >
                    <ToggleIcon aria-hidden className="size-3.5" />
                  </button>
                </>
              );
            })()}
          </div>
          <button
            type="button"
            data-testid="unified-chat-shell-close"
            onClick={() => setAppearance('closed')}
            aria-label="Collapse chat"
            className="rounded p-1 text-hint hover:bg-tint hover:text-ink"
          >
            <X aria-hidden className="size-3.5" />
          </button>
        </div>
      </header>
      <div
        data-testid="unified-chat-shell-body"
        className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-3"
      >
        {activeChat === null ? (
          <p data-testid="unified-chat-shell-empty" className="text-xs text-hint">
            Open one from a knowledge item to start a conversation.
          </p>
        ) : (
          <motion.div
            key={activeChat.chat.id}
            layout={!prefersReducedMotion}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={fadeSpring}
          >
            <SecondaryChatHost secondaryChat={activeChat} />
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
