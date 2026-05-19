import { ChevronDown, MessageSquare, Sparkles } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { z } from 'zod/v4';

import { cn } from '@/client/lib/utils.js';
import type { secondaryChatStateSchema } from '@/shared/api-types.js';

import { kindAccentHex } from './knowledge-card.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu.js';

type SecondaryChat = z.infer<typeof secondaryChatStateSchema>;

export interface ChatSwitcherProps {
  readonly chats: readonly SecondaryChat[];
  readonly activeChatId: number | null;
  readonly onSelect: (chatId: number) => void;
  /** Chat IDs currently streaming; surfaces a pulse dot on the trigger. */
  readonly streamingChatIds?: ReadonlySet<number>;
  /** Chat IDs with an unread assistant turn; suppressed while the same id is streaming. */
  readonly unreadChatIds?: ReadonlySet<number>;
  /**
   * Map of knowledge-item id → referenceCode (e.g. "G1", "D5") so the trigger
   * can render the active chat's anchor refCode badge next to the label.
   * Looking it up by the active chat's `pinned_item_id` keeps the trigger
   * itself ignorant of how codes are derived.
   */
  readonly refCodeByItemId?: ReadonlyMap<number, string>;
  /** Extra anchored-item refCodes (excluding the pinned one) for the title strip. */
  readonly extraAnchorRefCodes?: readonly string[];
}

function getChatLabel(chat: SecondaryChat): string {
  const kickoff = chat.kickoffTurn?.assistant_parts ?? '';
  const match = kickoff.match(/'([^']+)'/);
  if (match?.[1]) return match[1];
  return kickoff || `Chat #${chat.chat.id}`;
}

// Mirrors the composer's segmented toggle: MessageSquare for explore, Sparkles for edit.
function ChatKindIcon({ chat, className }: { chat: SecondaryChat; className?: string }) {
  const Icon = (chat.chat.mode ?? 'explore') === 'edit' ? Sparkles : MessageSquare;
  return <Icon aria-hidden className={className} />;
}

export function ChatSwitcher({
  chats,
  activeChatId,
  onSelect,
  streamingChatIds,
  unreadChatIds,
  refCodeByItemId,
  extraAnchorRefCodes,
}: ChatSwitcherProps) {
  if (chats.length === 0) return null;
  // Surface a neutral "Open a chat" trigger when no dropdown item is active.
  const activeInList = chats.find((c) => c.chat.id === activeChatId) ?? null;
  const triggerChat = activeInList;

  const activeAccent = triggerChat?.pinnedItemKind ? kindAccentHex[triggerChat.pinnedItemKind] : null;
  const triggerStyle: CSSProperties | undefined = activeAccent
    ? { backgroundColor: `${activeAccent}14`, color: activeAccent, borderColor: `${activeAccent}33` }
    : undefined;
  // Aggregate streaming/unread state so the trigger surfaces hidden-chat activity.
  const aggregateStreaming = chats.some((c) => streamingChatIds?.has(c.chat.id) ?? false);
  const aggregateUnread = !aggregateStreaming && chats.some((c) => unreadChatIds?.has(c.chat.id) ?? false);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-testid="chat-switcher-trigger"
          data-accent-hex={activeAccent ?? undefined}
          data-streaming={aggregateStreaming}
          data-unread={aggregateUnread}
          style={triggerStyle}
          className="relative inline-flex max-w-[220px] items-center gap-1.5 rounded-md border border-rule/50 bg-tint/30 px-2 py-1 text-xs text-ink transition-[transform,box-shadow] duration-150 hover:opacity-90 active:scale-95"
        >
          {triggerChat ? (
            <>
              {(() => {
                const pinnedId = triggerChat.chat.pinned_item_id;
                const refCode = pinnedId !== null ? (refCodeByItemId?.get(pinnedId) ?? null) : null;
                if (refCode === null && (extraAnchorRefCodes?.length ?? 0) === 0) return null;
                // Mode-aware glyph: MessageSquare = Ask, Sparkles = Agent
                // (Edit). Replaces the prior bare accent dot so the active
                // selection at the top conveys what the chat *does*, not just
                // its anchor color.
                const triggerMode = triggerChat.chat.mode ?? 'explore';
                const TriggerModeIcon = triggerMode === 'edit' ? Sparkles : MessageSquare;
                const triggerModeLabel = triggerMode === 'edit' ? 'Agent' : 'Ask';
                return (
                  <span
                    data-testid="chat-switcher-trigger-anchor"
                    data-anchor-ref-code={refCode ?? undefined}
                    data-anchor-extra-count={(extraAnchorRefCodes?.length ?? 0) || undefined}
                    data-mode={triggerMode}
                    className="inline-flex shrink-0 items-baseline gap-1 font-mono text-[10px] leading-none"
                  >
                    <TriggerModeIcon
                      aria-label={triggerModeLabel}
                      data-testid="chat-switcher-trigger-mode-icon"
                      className="size-3 shrink-0 self-center"
                      strokeWidth={1.5}
                      style={activeAccent ? { color: activeAccent } : undefined}
                    />
                    {refCode !== null && <span>{refCode}</span>}
                    {extraAnchorRefCodes?.map((code) => (
                      <span
                        key={code}
                        data-testid={`chat-switcher-trigger-anchor-extra-${code}`}
                        className="opacity-70"
                      >
                        {code}
                      </span>
                    ))}
                  </span>
                );
              })()}
              <span className="min-w-0 truncate">{getChatLabel(triggerChat)}</span>
            </>
          ) : (
            <span className="min-w-0 truncate text-hint">Open a chat</span>
          )}
          <ChevronDown aria-hidden className="size-3 shrink-0 opacity-60" />
          {aggregateStreaming ? (
            <span
              data-testid="chat-switcher-streaming-dot"
              aria-hidden
              className="absolute -top-0.5 -right-0.5 inline-block size-1.5 animate-pulse rounded-full bg-emerald-500"
            />
          ) : aggregateUnread ? (
            <span
              data-testid="chat-switcher-unread-dot"
              aria-hidden
              className="absolute -top-0.5 -right-0.5 inline-block size-1.5 rounded-full bg-sky-500"
            />
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent data-testid="chat-switcher-menu" align="start" className="w-[280px] max-w-[320px]">
        {chats.map((chat) => {
          const isActive = triggerChat !== null && chat.chat.id === triggerChat.chat.id;
          const accent = chat.pinnedItemKind ? kindAccentHex[chat.pinnedItemKind] : null;
          const rowStyle: CSSProperties | undefined =
            isActive && accent ? { backgroundColor: `${accent}14`, color: accent } : undefined;
          return (
            <DropdownMenuItem
              key={chat.chat.id}
              data-testid={`chat-switcher-item-${chat.chat.id}`}
              data-active={isActive}
              data-accent-hex={isActive ? (accent ?? undefined) : undefined}
              style={rowStyle}
              onSelect={() => onSelect(chat.chat.id)}
              className={cn('flex items-start gap-2 text-xs', isActive && 'font-medium')}
            >
              <ChatKindIcon chat={chat} className="mt-0.5 size-3 shrink-0" />
              <span className="min-w-0 truncate">{getChatLabel(chat)}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
