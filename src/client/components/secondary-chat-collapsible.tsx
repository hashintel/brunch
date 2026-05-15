import type { z } from 'zod/v4';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/client/components/ui/collapsible';
import { cn } from '@/client/lib/utils';
import type { secondaryChatStateSchema } from '@/shared/api-types.js';

import type { SecondaryChatMode } from './secondary-chat-trigger.js';

type SecondaryChat = z.infer<typeof secondaryChatStateSchema>;

export interface SecondaryChatCollapsibleProps {
  secondaryChat: SecondaryChat;
  /**
   * Optional handler for mode toggle. When omitted, the mode chip is rendered
   * read-only (V3.1 popover tests render the collapsible without a mutation context).
   */
  onSetMode?: (mode: SecondaryChatMode) => void;
  isModeUpdating?: boolean;
}

export function SecondaryChatCollapsible({
  secondaryChat,
  onSetMode,
  isModeUpdating,
}: SecondaryChatCollapsibleProps) {
  const kickoffContent = secondaryChat.kickoffTurn?.assistant_parts ?? '';
  const mode = secondaryChat.chat.mode ?? 'explore';

  return (
    <Collapsible
      data-testid="secondary-chat-collapsible"
      data-secondary-chat-id={secondaryChat.chat.id}
      className={cn('rounded-md border border-rule bg-tint/50 px-3 py-2 text-sm')}
    >
      <div className="flex w-full items-center justify-between gap-2">
        <CollapsibleTrigger
          data-testid="secondary-chat-collapsible-trigger"
          className="flex flex-1 items-center justify-between text-left text-sub"
        >
          <span>Secondary chat</span>
          <span aria-hidden className="text-hint">
            ▾
          </span>
        </CollapsibleTrigger>
        <SecondaryChatModeToggle mode={mode} onSetMode={onSetMode} disabled={isModeUpdating} />
      </div>
      <CollapsibleContent
        data-testid="secondary-chat-collapsible-body"
        className="pt-2 whitespace-pre-wrap text-foreground"
      >
        {kickoffContent}
      </CollapsibleContent>
    </Collapsible>
  );
}

function SecondaryChatModeToggle({
  mode,
  onSetMode,
  disabled,
}: {
  mode: SecondaryChatMode;
  onSetMode?: (mode: SecondaryChatMode) => void;
  disabled?: boolean;
}) {
  const interactive = Boolean(onSetMode);
  const handleClick = (next: SecondaryChatMode) => () => {
    if (!onSetMode || disabled || mode === next) return;
    onSetMode(next);
  };

  return (
    <span
      data-testid="secondary-chat-mode-toggle"
      data-mode={mode}
      className="inline-flex items-center gap-0.5 rounded border border-rule bg-background p-0.5 text-xs"
    >
      <button
        type="button"
        data-testid="secondary-chat-mode-ask"
        aria-pressed={mode === 'explore'}
        disabled={!interactive || disabled}
        onClick={handleClick('explore')}
        className={cn(
          'rounded px-1.5 py-0.5 transition-colors',
          mode === 'explore' ? 'bg-tint text-ink' : 'text-hint hover:bg-wash hover:text-ink',
          (!interactive || disabled) && 'opacity-60',
        )}
      >
        Ask
      </button>
      <button
        type="button"
        data-testid="secondary-chat-mode-edit"
        aria-pressed={mode === 'edit'}
        disabled={!interactive || disabled}
        onClick={handleClick('edit')}
        className={cn(
          'rounded px-1.5 py-0.5 transition-colors',
          mode === 'edit' ? 'bg-tint text-ink' : 'text-hint hover:bg-wash hover:text-ink',
          (!interactive || disabled) && 'opacity-60',
        )}
      >
        Edit
      </button>
    </span>
  );
}
