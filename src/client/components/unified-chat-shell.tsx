import { ArrowDown, Maximize2, Minimize2, Minus, PanelRight, PictureInPicture2, Send, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { z } from 'zod/v4';

import { cn } from '@/client/lib/utils.js';
import {
  useSpecificationBundleData,
  useSpecificationEntities,
  useSpecificationOpenReconciliationNeeds,
} from '@/client/routes/specification/$id/-specification-data.js';
import type { secondaryChatStateSchema } from '@/shared/api-types.js';

import { ChatShellAppliedToast } from './chat-shell-applied-toast.js';
import { ChatShellPatchPanel } from './chat-shell-patch-panel.js';
import { useChatShellPresence } from './chat-shell-presence.js';
import { ChatTabs } from './chat-tabs.js';
import { kindAccentHex } from './knowledge-card.js';
import { usePatchListState } from './patch-list-host.js';
import { PendingReviewSection } from './pending-review-section.js';
import { buildRefCodeByItemId, SecondaryChatHost } from './secondary-chat-host.js';
import { CHAT_SHELL_SPRING, usePrefersReducedMotion } from './use-prefers-reduced-motion.js';

export type ChatLayoutMode = 'compact' | 'side-docked' | 'maximize' | 'full';

type SecondaryChat = z.infer<typeof secondaryChatStateSchema>;
type LocalAppearance = 'expanded' | 'minimized' | 'closed';

export interface UnifiedChatShellProps {
  readonly layoutMode?: ChatLayoutMode;
  readonly onLayoutModeChange?: (mode: ChatLayoutMode) => void;
}

function isMasterChat(chat: SecondaryChat): boolean {
  return chat.chat.pinned_item_id === null && chat.chat.pinned_reconciliation_need_id === null;
}

function hexWithAlpha(hex: string, alpha: number): string {
  // Tiny local helper so we can stamp the active-chat accent onto custom
  // scrollbar thumbs without dragging a color util in.
  const normalized = hex.replace('#', '');
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function isItemChat(chat: SecondaryChat): boolean {
  return chat.chat.pinned_item_id !== null;
}

function pickDefaultActiveChat(chats: readonly SecondaryChat[]): SecondaryChat | null {
  if (chats.length === 0) return null;
  // Master (lowest-id empty) takes precedence; otherwise the most recent
  // item-anchored chat (highest id) wins.
  const masters = chats.filter(isMasterChat).sort((a, b) => a.chat.id - b.chat.id);
  if (masters.length > 0) return masters[0]!;
  const items = chats.filter(isItemChat).sort((a, b) => a.chat.id - b.chat.id);
  if (items.length > 0) return items[items.length - 1]!;
  return chats[0] ?? null;
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
  // Reconciliation-pinned chats stay hidden until their UX is defined.
  const visibleChats = secondaryChats.filter((c) => c.chat.pinned_reconciliation_need_id === null);
  const itemChats = visibleChats.filter(isItemChat);

  // The sticky-overlays bar collapses entirely when neither pending reviews
  // nor staged patches have content — the user doesn't want an empty
  // wrapper holding shell vertical space.
  const openReconciliationNeeds = useSpecificationOpenReconciliationNeeds();
  const patchListState = usePatchListState();
  const hasOverlayContent = openReconciliationNeeds.length > 0 || patchListState.count > 0;

  const [localActiveId, setLocalActiveId] = useState<number | null>(null);
  const defaultActive = useMemo(() => pickDefaultActiveChat(visibleChats), [visibleChats]);
  const activeChatId: number | null = (() => {
    const fromPresence = presence?.focusedChatId ?? null;
    if (fromPresence !== null && visibleChats.some((c) => c.chat.id === fromPresence)) return fromPresence;
    if (localActiveId !== null && visibleChats.some((c) => c.chat.id === localActiveId)) return localActiveId;
    return defaultActive?.chat.id ?? null;
  })();
  const activeChat =
    activeChatId !== null ? (visibleChats.find((c) => c.chat.id === activeChatId) ?? null) : null;

  // Look up the active chat's pinned-item + any additional anchored-item
  // reference codes (e.g. "G1", "D5") so the ChatSwitcher trigger can render
  // them inline next to the chat title. The anchor lives in the title, not
  // as a separate composer-footer chip strip.
  const entities = useSpecificationEntities();
  const refCodeByItemId = useMemo(() => buildRefCodeByItemId(entities), [entities]);
  const extraAnchorRefCodes: readonly string[] = useMemo(() => {
    const ids = activeChat?.anchoredItemIds ?? [];
    const pinnedId = activeChat?.chat.pinned_item_id ?? null;
    const codes: string[] = [];
    for (const id of ids) {
      if (id === pinnedId) continue;
      const code = refCodeByItemId.get(id);
      if (code) codes.push(code);
    }
    return codes;
  }, [activeChat, refCodeByItemId]);

  const handleSelectChat = useCallback(
    (id: number) => {
      if (presence) presence.focusChat(id);
      else setLocalActiveId(id);
    },
    [presence],
  );

  // Streaming + unread tracking across all mounted hosts. The shell drives
  // ChatTabs's streaming/unread dots from these sets; hosts publish via the
  // onStreamingChange / onAssistantTurnArrival callbacks.
  const [streamingChatIds, setStreamingChatIds] = useState<ReadonlySet<number>>(new Set());
  const [unreadChatIds, setUnreadChatIds] = useState<ReadonlySet<number>>(new Set());

  const activeChatIdRef = useRef(activeChatId);
  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  const handleStreamingChange = useCallback((chatId: number, isStreaming: boolean) => {
    setStreamingChatIds((prev) => {
      const has = prev.has(chatId);
      if (has === isStreaming) return prev;
      const next = new Set(prev);
      if (isStreaming) next.add(chatId);
      else next.delete(chatId);
      return next;
    });
  }, []);

  const handleAssistantTurnArrival = useCallback((chatId: number) => {
    const isActive = activeChatIdRef.current === chatId;
    // Active chat now always renders the transcript, so the user always sees
    // the turn arrive for the active chat; only background tabs accumulate
    // unread state.
    if (isActive) return;
    setUnreadChatIds((prev) => {
      if (prev.has(chatId)) return prev;
      const next = new Set(prev);
      next.add(chatId);
      return next;
    });
  }, []);

  // Clear unread whenever the user switches to an unread chat — the
  // transcript is always visible, so simply being active is enough to mark
  // the chat as read.
  useEffect(() => {
    if (activeChatId === null) return;
    if (!unreadChatIds.has(activeChatId)) return;
    setUnreadChatIds((prev) => {
      if (!prev.has(activeChatId)) return prev;
      const next = new Set(prev);
      next.delete(activeChatId);
      return next;
    });
  }, [activeChatId, unreadChatIds]);

  const composerSlotRef = useRef<HTMLDivElement | null>(null);
  const [composerSlot, setComposerSlot] = useState<HTMLDivElement | null>(null);
  const handleComposerSlotRef = useCallback((node: HTMLDivElement | null) => {
    composerSlotRef.current = node;
    setComposerSlot(node);
  }, []);

  // Scroll-to-bottom overlay arrow. The arrow surfaces only when the user is
  // scrolled up past ~50% of the body's scroll height (per feedback) so it
  // stays unobtrusive during normal reading.
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const handleBodyScroll = useCallback(() => {
    const el = bodyRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const threshold = Math.max(120, el.clientHeight * 0.5);
    setShowScrollToBottom(distanceFromBottom > threshold);
  }, []);
  const scrollToBottom = useCallback(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, []);

  const prefersReducedMotion = usePrefersReducedMotion();
  const fadeSpring = prefersReducedMotion ? { duration: 0 } : CHAT_SHELL_SPRING;

  if (appearance === 'closed' || appearance === 'minimized') {
    const openChatCount = itemChats.length;
    return (
      <motion.button
        key="minimized"
        type="button"
        data-testid="unified-chat-shell-minimized"
        data-open-chat-count={openChatCount}
        onClick={(event) => {
          // clicking the pill on a graph view was letting
          // the click bubble through to underlying canvas / list listeners
          // (causing unwanted graph scrolls / item activation). Stop the
          // propagation here — the pill's job is to expand the chat, not
          // double-dispatch.
          event.stopPropagation();
          setAppearance('expanded');
        }}
        initial={prefersReducedMotion ? false : { opacity: 0, y: 8, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={prefersReducedMotion ? undefined : { opacity: 0, y: 8, scale: 0.95 }}
        transition={fadeSpring}
        aria-label={
          openChatCount > 0
            ? `Expand chat — ${openChatCount} open ${openChatCount === 1 ? 'conversation' : 'conversations'}`
            : 'Expand chat'
        }
        // the pill itself no longer scales on hover/press
        // — only the leading icon animates so the button stays anchored in
        // place. Background tint + shadow lift still signal hover.
        className="group fixed right-4 bottom-4 z-30 inline-flex items-center gap-2 rounded-full border border-rule/50 bg-background px-3 py-1.5 text-xs text-ink shadow-md transition-[box-shadow,background-color] duration-200 hover:bg-tint hover:shadow-lg"
      >
        <Send
          aria-hidden
          className="size-3.5 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:rotate-[-8deg] group-active:translate-y-0"
        />
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

  const backgroundChats = visibleChats.filter((c) => c.chat.id !== activeChatId);

  // C32 tab strip (latest redirection): the strip shows ONLY the master
  // (Home) tab — every item chat flows through the ChatSwitcher dropdown.
  // Setting the visible-item cap to 0 keeps the dropdown as the sole item
  // entry point so the strip never grows a second tab.
  const computedMaxVisibleItems = 0;

  return (
    <motion.div
      key="expanded"
      data-testid="unified-chat-shell"
      data-layout-mode={layoutMode}
      initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.985 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={fadeSpring}
      // Soft container chrome: a faint left divider + a deep low-opacity
      // shadow so the shell reads as a floating surface, not a hard panel
      // split against the workspace.
      className="flex h-full min-h-0 flex-col border-l border-rule/20 bg-background shadow-[-4px_0_24px_-10px_rgba(0,0,0,0.16),-1px_0_2px_-1px_rgba(0,0,0,0.04)]"
    >
      <header
        data-testid="unified-chat-shell-header"
        // more breathing room for the top controls. Bumped
        // from h-8 / gap-2 to h-9 / gap-3 so the strip feels uncramped.
        className={cn(
          'flex h-9 items-center justify-between gap-3 border-b border-rule/40',
          layoutMode === 'compact' ? 'px-2' : 'px-3.5',
        )}
      >
        <div data-testid="unified-chat-shell-tabs" className="flex min-w-0 items-center gap-2">
          {visibleChats.length > 0 && (
            <ChatTabs
              chats={visibleChats}
              activeChatId={activeChatId}
              onSelect={handleSelectChat}
              streamingChatIds={streamingChatIds}
              unreadChatIds={unreadChatIds}
              maxVisibleItems={computedMaxVisibleItems}
              refCodeByItemId={refCodeByItemId}
              extraAnchorRefCodes={extraAnchorRefCodes}
            />
          )}
        </div>
        <div
          data-testid="unified-chat-shell-layout-buttons"
          role="group"
          aria-label="Chat controls"
          // small gap between controls (was zero) so the
          // top-bar icons read as distinct affordances instead of a fused
          // strip.
          className="flex items-center gap-0.5"
        >
          {(() => {
            const interactive = Boolean(onLayoutModeChange);
            const dockIsCompact = layoutMode === 'compact';
            const dockNext: ChatLayoutMode = dockIsCompact ? 'side-docked' : 'compact';
            const DockIcon = dockIsCompact ? PanelRight : PictureInPicture2;
            const dockLabel = dockIsCompact ? 'Dock to side' : 'Compact';
            const dockActive = layoutMode === 'side-docked' || layoutMode === 'compact';
            const toggleIsMaxed = layoutMode === 'full';
            const toggleNext: ChatLayoutMode = toggleIsMaxed ? 'side-docked' : 'full';
            const toggleLabel = toggleIsMaxed ? 'Restore' : 'Maximize';
            const ToggleIcon = toggleIsMaxed ? Minimize2 : Maximize2;
            const togglePressed = layoutMode === 'full';
            const buttonBase =
              'inline-flex size-6 items-center justify-center rounded-md text-hint transition-[transform,color,background-color] duration-150 hover:bg-tint/60 hover:text-ink active:scale-95 disabled:cursor-not-allowed disabled:opacity-50';
            const activeClass = 'bg-tint/70 text-ink';
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
                  <Minus aria-hidden className="size-3.5" strokeWidth={1.5} />
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
                  <DockIcon aria-hidden className="size-3.5" strokeWidth={1.5} />
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
                  <ToggleIcon aria-hidden className="size-3.5" strokeWidth={1.5} />
                </button>
                <span aria-hidden className="mx-1 h-3.5 w-px bg-rule/60" />
                <button
                  type="button"
                  data-testid="unified-chat-shell-close"
                  onClick={() => setAppearance('closed')}
                  aria-label="Collapse chat"
                  className={buttonBase}
                >
                  <X aria-hidden className="size-3.5" strokeWidth={1.5} />
                </button>
              </>
            );
          })()}
        </div>
      </header>
      <div
        ref={bodyRef}
        onScroll={handleBodyScroll}
        data-testid="unified-chat-shell-body"
        // Custom scrollbar: when an item chat is active, color the thumb with
        // the item's kind accent at 50% opacity so the scrollbar quietly
        // echoes the active context; otherwise fall back to a slightly more
        // generous neutral gray than the browser default.
        style={
          activeChat?.pinnedItemKind
            ? ({
                // 20% accent opacity per feedback — scrollbar should be a
                // quiet echo of the active context, not a chromatic accent.
                scrollbarColor: `${hexWithAlpha(kindAccentHex[activeChat.pinnedItemKind], 0.2)} transparent`,
                scrollbarWidth: 'thin',
              } as React.CSSProperties)
            : ({
                scrollbarColor: 'rgba(115,115,115,0.2) transparent',
                scrollbarWidth: 'thin',
              } as React.CSSProperties)
        }
        className={cn(
          'flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pt-0',
          // more breathing room on the sides of the
          // transcript in compact mode (was px-1.5 / ~6px → now px-3 / 12px)
          // so the bubbles don't crowd the shell edges.
          layoutMode === 'compact' ? 'px-3 pb-2' : 'px-4 pb-3',
        )}
      >
        {hasOverlayContent && (
          <div
            data-testid="chat-shell-sticky-overlays"
            className={cn(
              'sticky top-0 z-20 flex flex-col gap-2 border-b border-rule/40 bg-background/70 shadow-sm backdrop-blur-md backdrop-saturate-150 supports-[backdrop-filter]:bg-background/55',
              layoutMode === 'compact' ? '-mx-3 px-3 py-1.5' : '-mx-4 px-4 py-2',
            )}
          >
            <PendingReviewSection />
            <ChatShellPatchPanel />
          </div>
        )}
        {visibleChats.length === 0 ? (
          <p data-testid="unified-chat-shell-empty" className="text-xs text-hint">
            Open one from a knowledge item to start a conversation.
          </p>
        ) : activeChat ? (
          <motion.div
            key={activeChat.chat.id}
            layout={!prefersReducedMotion}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={fadeSpring}
            className="flex min-h-0 flex-1 flex-col"
          >
            {/* Single host instance for the active chat — transcript renders
                here, composer portals into the footer slot. Previously two
                parallel instances each owned their own useChat, which broke
                streaming because the composer's send fired on a different
                instance than the transcript was reading from. */}
            <SecondaryChatHost
              secondaryChat={activeChat}
              renderTranscript
              renderComposer
              composerPortalTarget={composerSlot}
              onStreamingChange={handleStreamingChange}
              onAssistantTurnArrival={handleAssistantTurnArrival}
            />
          </motion.div>
        ) : null}
        {/* Background hosts for every non-active chat — keep useChat alive so
            streaming + unread badges fire on inactive tabs. */}
        {backgroundChats.map((chat) => (
          <div
            key={`bg-${chat.chat.id}`}
            data-testid={`unified-chat-shell-background-host-${chat.chat.id}`}
            hidden
          >
            <SecondaryChatHost
              secondaryChat={chat}
              renderTranscript={false}
              renderComposer={false}
              onStreamingChange={handleStreamingChange}
              onAssistantTurnArrival={handleAssistantTurnArrival}
            />
          </div>
        ))}
        <ChatShellAppliedToast />
      </div>
      {/* Footer slot owns no horizontal padding — the portaled composer-sticky
          child manages its own spacing so the textarea + chips don't get
          double-padded into a cramped column. */}
      <div
        ref={handleComposerSlotRef}
        data-testid="unified-chat-shell-footer"
        // no divider between transcript and composer.
        className="relative flex flex-col"
      >
        {showScrollToBottom && (
          <button
            type="button"
            data-testid="unified-chat-shell-scroll-to-bottom"
            aria-label="Scroll to latest"
            title="Scroll to latest"
            onClick={scrollToBottom}
            className="pointer-events-auto absolute -top-9 left-1/2 inline-flex size-7 -translate-x-1/2 items-center justify-center rounded-full border border-rule/40 bg-background/90 text-hint shadow-md backdrop-blur transition-[transform,background-color,color] duration-150 hover:scale-105 hover:bg-background hover:text-ink active:scale-95"
          >
            <ArrowDown aria-hidden className="size-3.5" strokeWidth={1.5} />
          </button>
        )}
      </div>
    </motion.div>
  );
}
