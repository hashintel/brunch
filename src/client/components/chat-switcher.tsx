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

// Mode icon mirrors the composer's segmented toggle:
// `MessageSquare` for explore/chat, `Sparkles` for edit/agent. The icon
// inherits `currentColor` so it stays neutral in dropdown rows and only
// picks up the accent when the parent (active tab / active row) is itself
// accent-colored — a Linear-style restraint where chrome stays quiet and
// state is signalled through one element, not stacked color cues.
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
  // when the active chat is NOT in the dropdown (e.g.
  // Home/master is selected and the dropdown holds only item chats), do
  // NOT pretend the first item is selected. Surface a neutral grey
  // "Open a chat" affordance instead so the user can pick deliberately.
  const activeInList = chats.find((c) => c.chat.id === activeChatId) ?? null;
  const triggerChat = activeInList;

  const activeAccent = triggerChat?.pinnedItemKind ? kindAccentHex[triggerChat.pinnedItemKind] : null;
  const triggerStyle: CSSProperties | undefined = activeAccent
    ? { backgroundColor: `${activeAccent}14`, color: activeAccent, borderColor: `${activeAccent}33` }
    : undefined;
  // Aggregate streaming/unread state across the dropdown's chats so the
  // trigger pulses (or quietly dots) whenever any hidden item chat has
  // activity — without this the user would miss background work now that
  // item tabs no longer sit in the top strip.
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
          {/* the trigger embeds the active chat's anchor
              refCode (and any extra anchored refCodes) inline before the
              label so the user reads the title as
              "{accent dot} G1 +D5 · Permutation goal: …" without needing a
              second pill in the header. The accent dot doubles as a tiny
              kind marker; the refCode badge takes the kind tint via the
              parent triggerStyle. When NO item chat is active we keep the
              neutral grey "Open a chat" affordance. */}
          {triggerChat ? (
            <>
              {(() => {
                const pinnedId = triggerChat.chat.pinned_item_id;
                const refCode = pinnedId !== null ? (refCodeByItemId?.get(pinnedId) ?? null) : null;
                if (refCode === null && (extraAnchorRefCodes?.length ?? 0) === 0) return null;
                return (
                  <span
                    data-testid="chat-switcher-trigger-anchor"
                    data-anchor-ref-code={refCode ?? undefined}
                    data-anchor-extra-count={(extraAnchorRefCodes?.length ?? 0) || undefined}
                    // no dashed underline, no leading
                    // `+` glyphs — the refCodes read as plain mono badges
                    // separated by spaces so the title strip stays quiet.
                    className="inline-flex shrink-0 items-baseline gap-1 font-mono text-[10px] leading-none"
                  >
                    {activeAccent && (
                      <span
                        aria-hidden
                        className="inline-block size-1.5 self-center rounded-full"
                        style={{ backgroundColor: activeAccent }}
                      />
                    )}
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
          // No item is highlighted when Home/master is the active chat —
          // that path now reads as "no selection within the dropdown".
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
