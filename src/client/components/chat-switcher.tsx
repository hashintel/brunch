import { ChevronDown, MessageCircleQuestion, PencilLine } from 'lucide-react';
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
  // Kickoff format: "Anchored to '<excerpt>'." or "Editing '<excerpt>'.".
  // Strip the leading verb so the dropdown row reads as the item excerpt.
  const match = kickoff.match(/'([^']+)'/);
  if (match?.[1]) return match[1];
  return kickoff || `Chat #${chat.chat.id}`;
}

function ChatKindIcon({ chat, className }: { chat: SecondaryChat; className?: string }) {
  const Icon = (chat.chat.mode ?? 'explore') === 'edit' ? PencilLine : MessageCircleQuestion;
  const color = chat.pinnedItemKind ? kindAccentHex[chat.pinnedItemKind] : undefined;
  return <Icon aria-hidden className={className} style={color ? { color } : undefined} />;
}

export function ChatSwitcher({ chats, activeChatId, onSelect }: ChatSwitcherProps) {
  const active = chats.find((c) => c.chat.id === activeChatId) ?? chats[0];
  if (!active) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-testid="chat-switcher-trigger"
          className="inline-flex max-w-[220px] items-center gap-1.5 rounded border border-rule bg-tint/30 px-2 py-1 text-xs text-ink hover:bg-tint"
        >
          <ChatKindIcon chat={active} className="size-3.5 shrink-0" />
          <span className="min-w-0 truncate">{getChatLabel(active)}</span>
          <ChevronDown aria-hidden className="size-3 shrink-0 text-hint" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent data-testid="chat-switcher-menu" align="start" className="w-[280px] max-w-[320px]">
        {chats.map((chat) => {
          const isActive = chat.chat.id === active.chat.id;
          return (
            <DropdownMenuItem
              key={chat.chat.id}
              data-testid={`chat-switcher-item-${chat.chat.id}`}
              data-active={isActive}
              onSelect={() => onSelect(chat.chat.id)}
              className={cn('flex items-start gap-2 text-xs', isActive && 'bg-tint/60 font-medium text-ink')}
            >
              <ChatKindIcon chat={chat} className="mt-0.5 size-3.5 shrink-0" />
              <span className="min-w-0 truncate">{getChatLabel(chat)}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
