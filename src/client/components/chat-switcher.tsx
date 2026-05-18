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

export function ChatSwitcher({ chats, activeChatId, onSelect }: ChatSwitcherProps) {
  const active = chats.find((c) => c.chat.id === activeChatId) ?? chats[0];
  if (!active) return null;

  const activeAccent = active.pinnedItemKind ? kindAccentHex[active.pinnedItemKind] : null;
  const triggerStyle: CSSProperties | undefined = activeAccent
    ? { backgroundColor: `${activeAccent}14`, color: activeAccent, borderColor: `${activeAccent}33` }
    : undefined;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-testid="chat-switcher-trigger"
          data-accent-hex={activeAccent ?? undefined}
          style={triggerStyle}
          className="inline-flex max-w-[220px] items-center gap-1.5 rounded border border-rule bg-tint/30 px-2 py-1 text-xs text-ink hover:opacity-90"
        >
          <ChatKindIcon chat={active} className="size-3 shrink-0" />
          <span className="min-w-0 truncate">{getChatLabel(active)}</span>
          <ChevronDown aria-hidden className="size-3 shrink-0 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent data-testid="chat-switcher-menu" align="start" className="w-[280px] max-w-[320px]">
        {chats.map((chat) => {
          const isActive = chat.chat.id === active.chat.id;
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
