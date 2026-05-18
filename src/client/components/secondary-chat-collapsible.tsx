import { Crosshair, MessageCircleQuestion, PencilLine } from 'lucide-react';
import { motion } from 'motion/react';
import { useState, type ReactNode } from 'react';
import type { z } from 'zod/v4';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/client/components/ui/collapsible';
import { cn } from '@/client/lib/utils';
import type { secondaryChatStateSchema } from '@/shared/api-types.js';

import type { SecondaryChatMode } from './secondary-chat-trigger.js';
import { usePrefersReducedMotion } from './use-prefers-reduced-motion.js';

type SecondaryChat = z.infer<typeof secondaryChatStateSchema>;
type SecondaryChatTurn = SecondaryChat['turns'][number];
type SecondaryChatPinnedReconciliationNeed = NonNullable<SecondaryChat['pinnedReconciliationNeed']>;

const RECONCILIATION_KIND_LABEL: Record<SecondaryChatPinnedReconciliationNeed['kind'], string> = {
  supersedes: 'Supersedes',
  needs_confirmation: 'Needs confirmation',
};

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
  /**
   * Optional slot rendered inside the collapsible body, after persisted turns
   * and any in-flight assistant text but before the composer. Used by
   * `<SecondaryChatHost>` to mount the per-chat staging strip
   * (`<SecondaryChatStagingStrip />`) without coupling the presentational
   * collapsible to the patch-list module.
   */
  bodyExtras?: ReactNode;
  /**
   * Optional controlled open state (FE-716 C14). When provided, the
   * collapsible delegates open/close to the parent via `onOpenChange`; the
   * `SecondaryChatHost` uses this to auto-expand the focused chat after a
   * trigger creates a new chat.
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * Optional jump-to-anchor handler (FE-716 C14). When supplied AND the
   * chat has a non-null `invoked_in_turn_id`, the header renders a small
   * "Jump to anchor" affordance that scrolls the workspace center pane.
   */
  onJumpToAnchor?: (turnId: number) => void;
}

export function SecondaryChatCollapsible({
  secondaryChat,
  onSetMode,
  isModeUpdating,
  onSubmitMessage,
  streamingAssistantText,
  isStreaming,
  bodyExtras,
  open,
  onOpenChange,
  onJumpToAnchor,
}: SecondaryChatCollapsibleProps) {
  const kickoffContent = secondaryChat.kickoffTurn?.assistant_parts ?? '';
  const mode = secondaryChat.chat.mode ?? 'explore';
  const invokedInTurnId = secondaryChat.chat.invoked_in_turn_id;
  const collapsibleProps = open !== undefined ? { open, ...(onOpenChange ? { onOpenChange } : {}) } : {};
  // FE-716 C15: streaming live-state pulse per UNIFIED_CHAT_UX.md §8.
  // Honors `prefers-reduced-motion` by holding opacity steady at 1.
  const prefersReducedMotion = usePrefersReducedMotion();
  const streamingPulseAnimate = prefersReducedMotion ? { opacity: 1 } : { opacity: [0.5, 1, 0.5] };
  const streamingPulseTransition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 1.4, repeat: Infinity, ease: 'easeInOut' as const };

  return (
    <Collapsible
      data-testid="secondary-chat-collapsible"
      data-secondary-chat-id={secondaryChat.chat.id}
      className={cn('rounded-md border border-rule bg-tint/50 px-3 py-2 text-sm')}
      {...collapsibleProps}
    >
      <div className="flex w-full items-center justify-between gap-2">
        <CollapsibleTrigger
          data-testid="secondary-chat-collapsible-trigger"
          className="flex flex-1 items-center justify-between text-left text-sub"
        >
          <SecondaryChatKindChip mode={mode} />
          <span aria-hidden className="text-hint">
            ▾
          </span>
        </CollapsibleTrigger>
        {onJumpToAnchor && invokedInTurnId !== null && (
          <button
            type="button"
            data-testid="secondary-chat-jump-to-anchor"
            data-anchor-turn-id={invokedInTurnId}
            onClick={() => onJumpToAnchor(invokedInTurnId)}
            title="Jump to anchor"
            aria-label="Jump to anchor turn"
            className="inline-flex items-center gap-1 rounded border border-rule/60 bg-background px-1.5 py-0.5 text-xs text-hint hover:text-ink"
          >
            <Crosshair aria-hidden className="size-3" />
            <span>Jump</span>
          </button>
        )}
        <SecondaryChatModeToggle mode={mode} onSetMode={onSetMode} disabled={isModeUpdating} />
      </div>
      <CollapsibleContent
        data-testid="secondary-chat-collapsible-body"
        className="flex flex-col gap-2 pt-2 text-foreground"
      >
        {secondaryChat.pinnedReconciliationNeed && (
          <SecondaryChatReconciliationPanel need={secondaryChat.pinnedReconciliationNeed} />
        )}
        {kickoffContent && <div className="whitespace-pre-wrap">{kickoffContent}</div>}
        {secondaryChat.turns.map((turn) => (
          <SecondaryChatTurnRow key={turn.id} turn={turn} />
        ))}
        {isStreaming && streamingAssistantText !== undefined && (
          <motion.div
            data-testid="secondary-chat-streaming-assistant"
            className="whitespace-pre-wrap text-sub"
            animate={streamingPulseAnimate}
            transition={streamingPulseTransition}
          >
            {streamingAssistantText}
          </motion.div>
        )}
        {bodyExtras}
        {onSubmitMessage && (
          <SecondaryChatComposer onSubmitMessage={onSubmitMessage} disabled={isStreaming} />
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

function SecondaryChatKindChip({ mode }: { mode: SecondaryChatMode }) {
  const isEdit = mode === 'edit';
  const Icon = isEdit ? PencilLine : MessageCircleQuestion;
  const label = isEdit ? 'Edit' : 'Ask';
  return (
    <span
      data-testid="secondary-chat-kind-chip"
      data-kind={isEdit ? 'edit' : 'ask'}
      className="inline-flex items-center gap-1 rounded border border-rule/60 bg-background px-1.5 py-0.5 text-xs text-ink"
    >
      <Icon aria-hidden className="size-3" />
      <span>{label}</span>
    </span>
  );
}

function SecondaryChatReconciliationPanel({ need }: { need: SecondaryChatPinnedReconciliationNeed }) {
  return (
    <div
      data-testid="secondary-chat-reconciliation-panel"
      data-reconciliation-need-id={need.needId}
      data-reconciliation-kind={need.kind}
      className="flex flex-col gap-1 rounded border border-rule/60 bg-background/70 px-2 py-1.5 text-xs"
    >
      <div className="flex items-center gap-2">
        <span className="rounded bg-tint px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-ink uppercase">
          {RECONCILIATION_KIND_LABEL[need.kind]}
        </span>
        <span className="text-hint">Elements being reconciled</span>
      </div>
      <SecondaryChatReconciliationEndpoint
        role="source"
        refCode={need.sourceRefCode}
        excerpt={need.sourceExcerpt}
        fallbackId={need.sourceItemId}
      />
      <SecondaryChatReconciliationEndpoint
        role="target"
        refCode={need.targetRefCode}
        excerpt={need.targetExcerpt}
        fallbackId={need.targetItemId}
      />
    </div>
  );
}

function SecondaryChatReconciliationEndpoint({
  role,
  refCode,
  excerpt,
  fallbackId,
}: {
  role: 'source' | 'target';
  refCode: string | null;
  excerpt: string | null;
  fallbackId: number;
}) {
  return (
    <div
      data-testid={`secondary-chat-reconciliation-${role}`}
      className="flex items-baseline gap-1 text-foreground"
    >
      <span className="font-mono text-[10px] text-hint uppercase">{role}</span>
      <span className="font-mono text-hint">{refCode ?? `#${fallbackId}`}</span>
      {excerpt !== null && excerpt.length > 0 && (
        <>
          <span className="text-hint">·</span>
          <span className="min-w-0 truncate">{excerpt}</span>
        </>
      )}
    </div>
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
