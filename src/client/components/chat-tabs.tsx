import { Home, MessageSquare, Plus, Sparkles } from 'lucide-react';
import { Fragment, forwardRef, useMemo, type CSSProperties, type ForwardedRef } from 'react';
import type { z } from 'zod/v4';

import { cn } from '@/client/lib/utils.js';
import type { secondaryChatStateSchema } from '@/shared/api-types.js';

import { ChatSwitcher } from './chat-switcher.js';
import { kindAccentHex } from './knowledge-card.js';
import { PopoverAnchor } from './ui/popover.js';

type SecondaryChat = z.infer<typeof secondaryChatStateSchema>;

export interface ChatTabsProps {
  readonly chats: readonly SecondaryChat[];
  readonly activeChatId: number | null;
  readonly onSelect: (chatId: number) => void;
  readonly streamingChatIds?: ReadonlySet<number>;
  /** Membership in `streamingChatIds` suppresses the unread dot. */
  readonly unreadChatIds?: ReadonlySet<number>;
  readonly onActiveTabClick?: () => void;
  readonly popoverAnchorActiveTab?: boolean;
  readonly chatRefCodes?: ReadonlyMap<number, string>;
  /**
   * Full knowledge-item id → referenceCode map (e.g. `{20: 'G1'}`) handed to
   * the overflow `ChatSwitcher` so its trigger can render the active chat's
   * anchor refCode badge inline next to the chat title.
   */
  readonly refCodeByItemId?: ReadonlyMap<number, string>;
  /** Extra anchored-item refCodes (excluding the pinned one) for the title strip. */
  readonly extraAnchorRefCodes?: readonly string[];
  /**
   * Override the default item-visibility rule with a hard cap. When provided,
   * up to `maxVisibleItems` item tabs are surfaced first-by-id (active item is
   * forced into the visible set when applicable); the remainder flow through
   * the ChatSwitcher overflow. Default omitted = "all visible when items≤2,
   * else 1 promoted item" (the chat-tabs internal rule).
   */
  readonly maxVisibleItems?: number;
  /**
   * Optional handler for the "+" button rendered after the visible tab strip.
   * When provided, the button is shown and dispatches on click.
   */
  readonly onCreateEmpty?: () => void;
}

function isEmptyChat(chat: SecondaryChat): boolean {
  return chat.chat.pinned_item_id === null && chat.chat.pinned_reconciliation_need_id === null;
}

interface OrderedChats {
  readonly empties: readonly SecondaryChat[];
  readonly items: readonly SecondaryChat[];
}

function partition(chats: readonly SecondaryChat[]): OrderedChats {
  const sorted = [...chats].sort((a, b) => a.chat.id - b.chat.id);
  return {
    empties: sorted.filter(isEmptyChat),
    items: sorted.filter((c) => !isEmptyChat(c)),
  };
}

export function ChatTabs({
  chats,
  activeChatId,
  onSelect,
  streamingChatIds,
  unreadChatIds,
  onActiveTabClick,
  popoverAnchorActiveTab,
  chatRefCodes,
  refCodeByItemId,
  extraAnchorRefCodes,
  maxVisibleItems,
  onCreateEmpty,
}: ChatTabsProps) {
  const isStreaming = (chatId: number): boolean => streamingChatIds?.has(chatId) ?? false;
  const isUnread = (chatId: number): boolean => (unreadChatIds?.has(chatId) ?? false) && !isStreaming(chatId);
  const handleClick = (chatId: number): void => {
    if (chatId === activeChatId && onActiveTabClick) {
      onActiveTabClick();
      return;
    }
    onSelect(chatId);
  };
  const { empties, items } = useMemo(() => partition(chats), [chats]);

  // Promote one empty (active or first) plus item tabs into the visible strip.
  // When there are 1–2 item chats, surface them all. Once items.length ≥ 3,
  // collapse to a single visible item slot (the active item, else the most
  // recent by id) and route the rest through the ChatSwitcher overflow.
  const { visible, overflow } = useMemo<{
    visible: readonly SecondaryChat[];
    overflow: readonly SecondaryChat[];
  }>(() => {
    const promotedEmpty: SecondaryChat | null =
      empties.find((c) => c.chat.id === activeChatId) ?? empties[0] ?? null;
    const visibleItems: readonly SecondaryChat[] = (() => {
      if (maxVisibleItems !== undefined) {
        // Cap of 0 hides every item tab — caller wants the dropdown to be
        // the sole item entry point. Treat it as a hard floor without the
        // usual active-promotion that nudges the count back to 1.
        if (maxVisibleItems === 0) return [];
        if (items.length <= maxVisibleItems) return items;
        const head = items.slice(0, maxVisibleItems);
        const activeItem = items.find((c) => c.chat.id === activeChatId) ?? null;
        if (!activeItem || head.includes(activeItem)) return head;
        // Active item is past the cap → swap the last visible slot for it so
        // the user's current selection always stays visible.
        return [...head.slice(0, maxVisibleItems - 1), activeItem];
      }
      if (items.length <= 2) return items;
      const promotedItem = items.find((c) => c.chat.id === activeChatId) ?? items[items.length - 1]!;
      return [promotedItem];
    })();
    const visibleIds = new Set<number>();
    if (promotedEmpty) visibleIds.add(promotedEmpty.chat.id);
    for (const i of visibleItems) visibleIds.add(i.chat.id);
    const vis: SecondaryChat[] = [];
    if (promotedEmpty) vis.push(promotedEmpty);
    for (const i of visibleItems) vis.push(i);
    const over = [...empties, ...items].filter((c) => !visibleIds.has(c.chat.id));
    return { visible: vis, overflow: over };
  }, [activeChatId, empties, items, maxVisibleItems]);

  if (chats.length === 0 && !onCreateEmpty) return null;

  return (
    <div
      data-testid="chat-tabs"
      role="tablist"
      aria-label="Chats"
      className="flex min-w-0 items-center gap-1"
    >
      {visible.map((chat) => {
        const isActive = activeChatId === chat.chat.id;
        const empty = isEmptyChat(chat);
        const tab = empty ? (
          <EmptyTab
            chat={chat}
            active={isActive}
            streaming={isStreaming(chat.chat.id)}
            unread={isUnread(chat.chat.id)}
            onSelect={() => handleClick(chat.chat.id)}
          />
        ) : (
          <ItemTab
            chat={chat}
            active={isActive}
            streaming={isStreaming(chat.chat.id)}
            unread={isUnread(chat.chat.id)}
            refCode={chatRefCodes?.get(chat.chat.id) ?? null}
            onSelect={() => handleClick(chat.chat.id)}
          />
        );
        if (isActive && popoverAnchorActiveTab) {
          return (
            <PopoverAnchor key={chat.chat.id} asChild>
              {tab}
            </PopoverAnchor>
          );
        }
        return <Fragment key={chat.chat.id}>{tab}</Fragment>;
      })}
      {overflow.length > 0 && (
        <ChatSwitcher
          chats={overflow}
          activeChatId={activeChatId}
          onSelect={onSelect}
          streamingChatIds={streamingChatIds}
          unreadChatIds={unreadChatIds}
          refCodeByItemId={refCodeByItemId}
          extraAnchorRefCodes={extraAnchorRefCodes}
        />
      )}
      {onCreateEmpty && (
        <button
          type="button"
          data-testid="chat-tabs-create-empty"
          aria-label="New empty chat"
          title="New empty chat"
          onClick={onCreateEmpty}
          className="inline-flex size-6 shrink-0 items-center justify-center rounded-md border border-transparent text-hint transition-colors hover:bg-tint/40 hover:text-ink"
        >
          <Plus aria-hidden className="size-3.5" />
        </button>
      )}
    </div>
  );
}

interface EmptyTabProps {
  chat: SecondaryChat;
  active: boolean;
  streaming: boolean;
  unread: boolean;
  onSelect: () => void;
}

const EmptyTab = forwardRef(function EmptyTab(
  { chat, active, streaming, unread, onSelect }: EmptyTabProps,
  ref: ForwardedRef<HTMLButtonElement>,
) {
  return (
    <button
      ref={ref}
      type="button"
      role="tab"
      aria-selected={active}
      aria-label="Master chat"
      title="Master chat"
      data-testid={`chat-tabs-empty-${chat.chat.id}`}
      data-chat-id={chat.chat.id}
      data-active={active}
      data-streaming={streaming}
      data-unread={unread}
      onClick={onSelect}
      className={cn(
        'relative inline-flex size-6 shrink-0 items-center justify-center rounded-md border border-transparent',
        'transition-[transform,background-color,color,box-shadow] duration-200 active:scale-95',
        active ? 'scale-[1.04] bg-tint/60 text-ink' : 'text-hint hover:bg-tint/40 hover:text-ink',
        streaming && 'shadow-[inset_0_0_0_1px_rgba(16,185,129,0.45)]',
      )}
    >
      <Home aria-hidden className="size-3.5" strokeWidth={1.5} />
      {streaming ? <StreamingDot /> : unread ? <UnreadDot /> : null}
    </button>
  );
});

interface ItemTabProps {
  chat: SecondaryChat;
  active: boolean;
  streaming: boolean;
  unread: boolean;
  refCode: string | null;
  onSelect: () => void;
}

function ItemTab({ chat, active, streaming, unread, refCode, onSelect }: ItemTabProps) {
  const accent = chat.pinnedItemKind ? kindAccentHex[chat.pinnedItemKind] : null;
  const Icon = (chat.chat.mode ?? 'explore') === 'edit' ? Sparkles : MessageSquare;
  // Active item tabs pick up the kind accent as a soft wash + text/border tint
  // so the user can see which knowledge item this conversation is anchored on.
  const style: CSSProperties | undefined =
    active && accent
      ? { backgroundColor: `${accent}14`, color: accent, borderColor: `${accent}33` }
      : undefined;
  const label = refCode ?? `Chat #${chat.chat.id}`;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-label={label}
      title={label}
      data-testid={`chat-tabs-item-${chat.chat.id}`}
      data-chat-id={chat.chat.id}
      data-active={active}
      data-streaming={streaming}
      data-unread={unread}
      data-accent-hex={active && accent ? accent : undefined}
      style={style}
      onClick={onSelect}
      className={cn(
        'relative inline-flex h-6 max-w-[140px] min-w-0 shrink items-center gap-1 rounded-md border border-transparent px-1.5 text-xs',
        'transition-[transform,background-color,color,box-shadow] duration-200 active:scale-95',
        active ? 'scale-[1.03] text-ink' : 'text-hint hover:bg-tint/40 hover:text-ink',
        streaming && 'shadow-[inset_0_0_0_1px_rgba(16,185,129,0.45)]',
      )}
    >
      <Icon aria-hidden className="size-3 shrink-0" strokeWidth={1.5} />
      {refCode ? <span className="min-w-0 truncate font-mono text-[10px]">{refCode}</span> : null}
      {streaming ? <StreamingDot /> : unread ? <UnreadDot /> : null}
    </button>
  );
}

function StreamingDot() {
  return (
    <span
      data-testid="chat-tabs-streaming-dot"
      aria-hidden
      className="absolute -top-0.5 -right-0.5 inline-block size-1.5 animate-pulse rounded-full bg-emerald-500"
    />
  );
}

function UnreadDot() {
  return (
    <span
      data-testid="chat-tabs-unread-dot"
      aria-hidden
      className="absolute -top-0.5 -right-0.5 inline-block size-1.5 rounded-full bg-sky-500"
    />
  );
}
