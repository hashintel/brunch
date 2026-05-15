import { useState } from 'react';
import type { z } from 'zod/v4';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/client/components/ui/collapsible';
import { cn } from '@/client/lib/utils';
import type { secondaryChatStateSchema } from '@/shared/api-types.js';

import type { SecondaryChatMode } from './secondary-chat-trigger.js';

type SecondaryChat = z.infer<typeof secondaryChatStateSchema>;
type SecondaryChatTurn = SecondaryChat['turns'][number];

export interface SecondaryChatCollapsibleProps {
  secondaryChat: SecondaryChat;
  /**
   * Optional handler for mode toggle. When omitted, the mode chip is rendered
   * read-only (V3.1 popover tests render the collapsible without a mutation context).
   */
  onSetMode?: (mode: SecondaryChatMode) => void;
  isModeUpdating?: boolean;
  /**
   * Optional composer hook. When provided, a single-line composer is rendered
   * below the persisted turns; submitting calls `onSubmitMessage` with the
   * trimmed input. The host (`SecondaryChatHost`) wires this to the C5a route.
   */
  onSubmitMessage?: (message: string) => void;
  /**
   * Optional in-flight assistant text to render after persisted turns while a
   * stream is mid-flight. Disappears when the bundle invalidates and the
   * persisted assistant turn replaces it.
   */
  streamingAssistantText?: string;
  isStreaming?: boolean;
}

export function SecondaryChatCollapsible({
  secondaryChat,
  onSetMode,
  isModeUpdating,
  onSubmitMessage,
  streamingAssistantText,
  isStreaming,
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
        className="flex flex-col gap-2 pt-2 text-foreground"
      >
        {kickoffContent && <div className="whitespace-pre-wrap">{kickoffContent}</div>}
        {secondaryChat.turns.map((turn) => (
          <SecondaryChatTurnRow key={turn.id} turn={turn} />
        ))}
        {isStreaming && streamingAssistantText !== undefined && (
          <div data-testid="secondary-chat-streaming-assistant" className="whitespace-pre-wrap text-sub">
            {streamingAssistantText}
          </div>
        )}
        {onSubmitMessage && (
          <SecondaryChatComposer onSubmitMessage={onSubmitMessage} disabled={isStreaming} />
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

function SecondaryChatTurnRow({ turn }: { turn: SecondaryChatTurn }) {
  if (turn.user_parts !== null && turn.user_parts !== undefined) {
    return (
      <div data-testid="secondary-chat-user-turn" className="whitespace-pre-wrap text-foreground">
        {turn.user_parts}
      </div>
    );
  }
  if (turn.assistant_parts !== null && turn.assistant_parts !== undefined) {
    return (
      <div data-testid="secondary-chat-assistant-turn" className="whitespace-pre-wrap text-sub">
        {turn.assistant_parts}
      </div>
    );
  }
  return null;
}

function SecondaryChatComposer({
  onSubmitMessage,
  disabled,
}: {
  onSubmitMessage: (message: string) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState('');

  return (
    <form
      data-testid="secondary-chat-composer"
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = draft.trim();
        if (trimmed.length === 0 || disabled) return;
        onSubmitMessage(trimmed);
        setDraft('');
      }}
      className="flex items-center gap-2 pt-1"
    >
      <input
        data-testid="secondary-chat-composer-input"
        type="text"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        disabled={disabled}
        placeholder="Ask a follow-up…"
        className="flex-1 rounded border border-rule bg-background px-2 py-1 text-sm focus:ring-1 focus:ring-rule focus:outline-none"
      />
      <button
        type="submit"
        data-testid="secondary-chat-composer-send"
        disabled={disabled || draft.trim().length === 0}
        className="rounded border border-rule bg-tint px-2 py-1 text-xs text-ink disabled:opacity-50"
      >
        Send
      </button>
    </form>
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
