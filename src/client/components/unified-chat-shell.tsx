import { Maximize2, Minimize2, PanelRight, Square, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';

import { cn } from '@/client/lib/utils.js';
import { useSpecificationBundleData } from '@/client/routes/specification/$id/-specification-data.js';

import { useChatShellPresence } from './chat-shell-presence.js';
import { SecondaryChatHost } from './secondary-chat-host.js';
import { CHAT_SHELL_SPRING, usePrefersReducedMotion } from './use-prefers-reduced-motion.js';

/**
 * UnifiedChatShell — V1 unified chat surface per UNIFIED_CHAT_UX.md §4 + §6.
 *
 * C12 lands the skeleton:
 *  - Reads the specification bundle via `useSpecificationBundleData()`.
 *  - Header strip with the interview-spine label and four inert layout-mode
 *    buttons + a close affordance that collapses the shell to a bar.
 *  - Body lists every active secondary chat as a `<SecondaryChatHost>`,
 *    ordered by `chat.id` ascending (== creation order, since the server
 *    projection in `listSecondaryChatsForSpecification` already sorts by id).
 *
 * Layout mode persistence (C13), trigger auto-expand (C14), and motion
 * transitions (C15) land in later cards. The header buttons are inert in C12
 * but data-testids are stable for C13 to wire into.
 */

export type ChatLayoutMode = 'compact' | 'side-docked' | 'maximize' | 'full';

const LAYOUT_MODE_BUTTONS: ReadonlyArray<{
  readonly mode: ChatLayoutMode;
  readonly label: string;
  readonly Icon: typeof Minimize2;
}> = [
  { mode: 'compact', label: 'Compact', Icon: Minimize2 },
  { mode: 'side-docked', label: 'Side-docked', Icon: PanelRight },
  { mode: 'maximize', label: 'Maximize', Icon: Maximize2 },
  { mode: 'full', label: 'Full', Icon: Square },
];

export interface UnifiedChatShellProps {
  /**
   * Current layout mode. C12 callers can omit and default to side-docked;
   * C13 will thread the persisted mode from `useChatLayoutMode`.
   */
  readonly layoutMode?: ChatLayoutMode;
  /** Invoked when a layout-mode button is clicked. Inert when omitted. */
  readonly onLayoutModeChange?: (mode: ChatLayoutMode) => void;
}

export function UnifiedChatShell({ layoutMode = 'side-docked', onLayoutModeChange }: UnifiedChatShellProps) {
  const specificationState = useSpecificationBundleData();
  // FE-716 C14: when mounted under <ChatShellPresenceProvider>, the
  // collapse state lives in context so triggers / hotkeys can expand the
  // shell. When the provider is absent (e.g. isolated tests), fall back to
  // component-local state.
  const presence = useChatShellPresence();
  const [localCollapsed, setLocalCollapsed] = useState(false);
  const isCollapsed = presence ? presence.isCollapsed : localCollapsed;
  const setCollapsed = (next: boolean) => {
    if (presence) {
      if (next) presence.collapse();
      else presence.expand();
    } else {
      setLocalCollapsed(next);
    }
  };

  const secondaryChats = specificationState.secondaryChats ?? [];
  const specName = specificationState.specification.name;
  // FE-716 C15: spring per UNIFIED_CHAT_UX.md §7 dec 5; held neutral when
  // the user prefers reduced motion (animations resolve as instant).
  const prefersReducedMotion = usePrefersReducedMotion();
  const fadeSpring = prefersReducedMotion ? { duration: 0 } : CHAT_SHELL_SPRING;

  if (isCollapsed) {
    return (
      <motion.div
        key="collapsed"
        data-testid="unified-chat-shell-collapsed"
        initial={prefersReducedMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={fadeSpring}
        className="flex h-full flex-col items-center justify-start border-l border-rule bg-tint/30 px-2 py-3"
      >
        <button
          type="button"
          data-testid="unified-chat-shell-expand"
          onClick={() => setCollapsed(false)}
          className="rounded border border-rule bg-background px-2 py-1 text-xs text-ink hover:bg-tint"
          aria-label="Expand chat"
        >
          <PanelRight aria-hidden className="size-4" />
        </button>
      </motion.div>
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
        </div>
        <div className="flex items-center gap-1">
          <div
            data-testid="unified-chat-shell-layout-buttons"
            role="group"
            aria-label="Chat layout"
            className="inline-flex items-center gap-0.5 rounded border border-rule bg-tint/40 p-0.5"
          >
            {LAYOUT_MODE_BUTTONS.map(({ mode, label, Icon }) => {
              const active = layoutMode === mode;
              const interactive = Boolean(onLayoutModeChange);
              return (
                <button
                  key={mode}
                  type="button"
                  data-testid={`unified-chat-shell-layout-${mode}`}
                  data-active={active}
                  aria-pressed={active}
                  aria-label={label}
                  title={label}
                  disabled={!interactive}
                  onClick={() => onLayoutModeChange?.(mode)}
                  className={cn(
                    'rounded px-1.5 py-1 text-xs transition-colors',
                    active
                      ? 'bg-background text-ink shadow-sm'
                      : 'text-hint hover:bg-background hover:text-ink',
                    !interactive && 'opacity-60',
                  )}
                >
                  <Icon aria-hidden className="size-3.5" />
                </button>
              );
            })}
          </div>
          <button
            type="button"
            data-testid="unified-chat-shell-close"
            onClick={() => setCollapsed(true)}
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
        {secondaryChats.length === 0 ? (
          <p data-testid="unified-chat-shell-empty" className="text-xs text-hint">
            No open chats. Open one from a knowledge item or a reconciliation row.
          </p>
        ) : (
          <AnimatePresence initial={false}>
            {secondaryChats.map((secondaryChat) => (
              <motion.div
                key={secondaryChat.chat.id}
                layout={!prefersReducedMotion}
                initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                transition={fadeSpring}
              >
                <SecondaryChatHost secondaryChat={secondaryChat} />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
}
