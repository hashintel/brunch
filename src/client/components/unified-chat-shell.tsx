import { Maximize2, Minimize2, Minus, PanelRight, PictureInPicture2, Send, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';

import { cn } from '@/client/lib/utils.js';
import { useSpecificationBundleData } from '@/client/routes/specification/$id/-specification-data.js';

import { ChatShellPatchPanel } from './chat-shell-patch-panel.js';
import { useChatShellPresence } from './chat-shell-presence.js';
import { ChatSwitcher } from './chat-switcher.js';
import { PendingReviewSection } from './pending-review-section.js';
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
  // Per-item secondary chats; reconciliation-pinned chats stay hidden until
  // their UX is defined.
  const itemChats = secondaryChats.filter((s) => s.chat.pinned_reconciliation_need_id === null);
  // Falls back to the most recent item-anchored chat (highest id). Null when
  // there are no item chats.
  const activeChat: (typeof itemChats)[number] | null =
    itemChats.find((c) => c.chat.id === presence?.focusedChatId) ??
    (itemChats.length > 0 ? (itemChats[itemChats.length - 1] ?? null) : null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const fadeSpring = prefersReducedMotion ? { duration: 0 } : CHAT_SHELL_SPRING;

  // "Ask Brunch" is a persistent affordance: the X button collapses the
  // shell into the same compact pill the minimize button produces, so users
  // never lose the entry point to the chat. The pill carries a small badge
  // with the number of open per-item subchats so the user can tell at a
  // glance whether there are conversations to return to.
  if (appearance === 'closed' || appearance === 'minimized') {
    const openChatCount = itemChats.length;
    return (
      <motion.button
        key="minimized"
        type="button"
        data-testid="unified-chat-shell-minimized"
        data-open-chat-count={openChatCount}
        onClick={() => setAppearance('expanded')}
        // Fade-in only — no entry slide. Hover lives on the `<Send>` icon.
        initial={prefersReducedMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={fadeSpring}
        aria-label={
          openChatCount > 0
            ? `Expand chat — ${openChatCount} open ${openChatCount === 1 ? 'conversation' : 'conversations'}`
            : 'Expand chat'
        }
        // Pill stays still; only the `<Send>` icon rotates on hover.
        className="group fixed right-4 bottom-4 z-30 inline-flex items-center gap-2 rounded-full border border-rule bg-background px-3 py-1.5 text-xs text-ink shadow-md transition-[box-shadow,background-color] duration-200 hover:bg-tint hover:shadow-lg"
      >
        <Send aria-hidden className="size-3.5 transition-transform duration-200 group-hover:rotate-[-8deg]" />
        <span>Ask Brunch</span>
        {openChatCount > 0 && (
          <span
            data-testid="unified-chat-shell-minimized-count"
            aria-hidden
            className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-tint px-1.5 py-0.5 font-mono text-[10px] leading-none text-hint"
          >
            {openChatCount}
          </span>
        )}
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
      {/* Chat controls strip. Its `border-b` is the only separator between
          the controls and the sticky pending-review/patch overlays below. */}
      <header
        data-testid="unified-chat-shell-header"
        className={cn(
          'flex h-8 items-center justify-between gap-2 border-b border-rule',
          // Tighter horizontal padding in the floating compact dock so the
          // narrow column doesn't waste rail space on chrome.
          layoutMode === 'compact' ? 'px-1.5' : 'px-3',
        )}
      >
        <div data-testid="unified-chat-shell-spine-label" className="flex min-w-0 items-center gap-2">
          {itemChats.length > 1 && (
            <ChatSwitcher
              chats={itemChats}
              activeChatId={activeChat?.chat.id ?? null}
              onSelect={(id) => presence?.focusChat(id)}
            />
          )}
        </div>
        {/*
          Header controls. Linear-style minimalism:
          - flat icon buttons sharing one shape, no segmented-pill container;
          - rest state has zero chrome (no border, no fill), only the icon at
            a quiet `text-hint`;
          - hover lifts to `text-ink` with a soft `bg-tint` and a tactile
            `active:scale-95` press;
          - active/pressed state (the current layout mode) flips to `text-ink`
            with `bg-tint` so the affordance reads without adding shadow or
            ring chrome.
          Close is grouped with a thin separator so its destructive intent
          stays distinguishable from the layout cluster.
        */}
        <div
          data-testid="unified-chat-shell-layout-buttons"
          role="group"
          aria-label="Chat controls"
          className="flex items-center"
        >
          {(() => {
            const interactive = Boolean(onLayoutModeChange);
            // Dock ↔ Compact toggle:
            // - In compact, the button shows the dock icon and switches to
            //   `'side-docked'` (the default split).
            // - In any other mode, it shows the picture-in-picture icon and
            //   switches to `'compact'` (the floating bottom-right dock).
            const dockIsCompact = layoutMode === 'compact';
            const dockNext: ChatLayoutMode = dockIsCompact ? 'side-docked' : 'compact';
            const DockIcon = dockIsCompact ? PanelRight : PictureInPicture2;
            const dockLabel = dockIsCompact ? 'Dock to side' : 'Compact';
            const dockActive = layoutMode === 'side-docked' || layoutMode === 'compact';
            // Maximize → renders the chat full-screen (`'full'` hides the
            // center workspace, so the chat owns the whole viewport).
            // Restore-from-full goes back to the default `'side-docked'`
            // split.
            const toggleIsMaxed = layoutMode === 'full';
            const toggleNext: ChatLayoutMode = toggleIsMaxed ? 'side-docked' : 'full';
            const toggleLabel = toggleIsMaxed ? 'Restore' : 'Maximize';
            const ToggleIcon = toggleIsMaxed ? Minimize2 : Maximize2;
            const togglePressed = layoutMode === 'full';
            const buttonBase =
              'inline-flex size-6 items-center justify-center rounded text-hint transition-[transform,color,background-color] duration-150 hover:bg-tint hover:text-ink active:scale-95 disabled:cursor-not-allowed disabled:opacity-50';
            const activeClass = 'bg-tint text-ink';
            return (
              <>
                <button
                  type="button"
                  data-testid="unified-chat-shell-minimize"
                  aria-label="Minimize chat"
                  title="Minimize"
                  onClick={() => setAppearance('minimized')}
                  className={buttonBase}
                >
                  <Minus aria-hidden className="size-3.5" />
                </button>
                <button
                  type="button"
                  data-testid="unified-chat-shell-layout-side-docked"
                  data-active={dockActive}
                  data-mode-target={dockNext}
                  aria-pressed={dockActive}
                  aria-label={dockLabel}
                  title={dockLabel}
                  disabled={!interactive}
                  onClick={() => onLayoutModeChange?.(dockNext)}
                  className={cn(buttonBase, dockActive && activeClass)}
                >
                  <DockIcon aria-hidden className="size-3.5" />
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
                  className={cn(buttonBase, togglePressed && activeClass)}
                >
                  <ToggleIcon aria-hidden className="size-3.5" />
                </button>
                <span aria-hidden className="mx-1 h-3.5 w-px bg-rule" />
                <button
                  type="button"
                  data-testid="unified-chat-shell-close"
                  onClick={() => setAppearance('closed')}
                  aria-label="Collapse chat"
                  className={buttonBase}
                >
                  <X aria-hidden className="size-3.5" />
                </button>
              </>
            );
          })()}
        </div>
      </header>
      <div
        data-testid="unified-chat-shell-body"
        // `pt-0` keeps the sticky overlays flush under the controls strip.
        // Compact dock uses tighter gutters so the narrow column doesn't
        // burn space on padding.
        className={cn(
          'flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pt-0',
          layoutMode === 'compact' ? 'px-1.5 pb-2' : 'px-3 pb-3',
        )}
      >
        {/* Sticky pending-review + patch stack. Each child renders null when
            empty so the overlay collapses cleanly. Edge-to-edge iOS-style
            glass surface — the negative margin matches the body's gutter so
            scrolled content stays blurred across the full width. */}
        <div
          data-testid="chat-shell-sticky-overlays"
          className={cn(
            'sticky top-0 z-20 flex flex-col gap-2 border-b border-rule/40 bg-background/70 shadow-sm backdrop-blur-md backdrop-saturate-150 supports-[backdrop-filter]:bg-background/55',
            layoutMode === 'compact' ? '-mx-1.5 px-1.5 py-1.5' : '-mx-3 px-3 py-2',
          )}
        >
          <PendingReviewSection />
          <ChatShellPatchPanel />
        </div>
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
            // Take the full body height so the collapsible inside can use
            // `flex-1` to push the composer to the bottom of the chat
            // surface. Without `flex flex-1 flex-col` here the motion.div
            // would shrink to content height and the composer would sit
            // just below the messages.
            className="flex min-h-0 flex-1 flex-col"
          >
            <SecondaryChatHost secondaryChat={activeChat} />
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
