import { Crosshair, MessageCircleQuestion, PencilLine } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { z } from 'zod/v4';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/client/components/ui/collapsible';
import { cn } from '@/client/lib/utils';
import type { secondaryChatStateSchema } from '@/shared/api-types.js';

import { Conversation, ConversationContent } from './ai-elements/conversation.js';
import { Message, MessageContent, MessageResponse } from './ai-elements/message.js';
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from './ai-elements/prompt-input.js';
import { Reasoning, ReasoningContent, ReasoningTrigger } from './ai-elements/reasoning.js';
import {
  computeMentionQuery,
  handleMentionPopupKey,
  insertMention,
  SecondaryChatMentionPopup,
  type MentionItem,
} from './secondary-chat-mention-popup.js';
import { SecondaryChatSuggestions } from './secondary-chat-suggestions.js';
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
  /**
   * Optional list of mention-able knowledge items (FE-716 C25). When non-empty
   * AND the composer is mounted, typing `#` opens an autocomplete popup.
   * Server-side resolution of `#REF-CODE` is owned by C6 — this prop only
   * powers the UI affordance.
   */
  mentionableItems?: readonly MentionItem[];
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
  mentionableItems,
}: SecondaryChatCollapsibleProps) {
  const kickoffContent = secondaryChat.kickoffTurn?.assistant_parts ?? '';
  const mode = secondaryChat.chat.mode ?? 'explore';
  const invokedInTurnId = secondaryChat.chat.invoked_in_turn_id;
  const collapsibleProps = open !== undefined ? { open, ...(onOpenChange ? { onOpenChange } : {}) } : {};
  // FE-716 C22: streaming live-state uses ai-elements `<Reasoning>` so the
  // typing pulse matches the interview spine. `prefers-reduced-motion` short-
  // circuits the Reasoning shimmer to a static text block.
  const prefersReducedMotion = usePrefersReducedMotion();
  // FE-716 C23: lifted composer draft so the turn-zero suggestion row can
  // populate it. Cleared after a successful submit.
  const [draft, setDraft] = useState('');
  // Turn-zero = the chat has only its kickoff turn (kickoffTurn is excluded
  // from `turns`). First user submit drops `turns.length` above 0 once the
  // bundle invalidates, hiding the suggestions row.
  const isTurnZero = secondaryChat.turns.length === 0;
  const reconciliationKind = secondaryChat.pinnedReconciliationNeed?.kind ?? null;

  // FE-716 C28: autoscroll the chat surface to the latest message as turns
  // arrive or streaming text grows. The scroll ancestor is the shell body
  // (`unified-chat-shell-body`); `scrollIntoView` walks up to find it.
  const bottomAnchorRef = useRef<HTMLDivElement>(null);
  const turnCount = secondaryChat.turns.length;
  const streamingLength = streamingAssistantText?.length ?? 0;
  useEffect(() => {
    bottomAnchorRef.current?.scrollIntoView({ block: 'end' });
  }, [turnCount, streamingLength]);

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
      </div>
      <CollapsibleContent
        data-testid="secondary-chat-collapsible-body"
        className="flex flex-col gap-2 pt-2 text-foreground"
      >
        {secondaryChat.pinnedReconciliationNeed && (
          <SecondaryChatReconciliationPanel need={secondaryChat.pinnedReconciliationNeed} />
        )}
        {kickoffContent && <div className="whitespace-pre-wrap">{kickoffContent}</div>}
        <Conversation className="relative flex max-h-none flex-1 flex-col overflow-visible">
          <ConversationContent className="flex flex-col gap-2 p-0">
            {secondaryChat.turns.map((turn) => (
              <SecondaryChatTurnRow key={turn.id} turn={turn} />
            ))}
            {isStreaming && streamingAssistantText !== undefined && (
              <SecondaryChatStreamingAssistant
                text={streamingAssistantText}
                isStreaming={isStreaming}
                prefersReducedMotion={prefersReducedMotion}
              />
            )}
          </ConversationContent>
        </Conversation>
        {bodyExtras}
        <div ref={bottomAnchorRef} aria-hidden data-testid="secondary-chat-bottom-anchor" className="h-px" />
        {onSubmitMessage && (
          <div
            data-testid="secondary-chat-composer-sticky"
            className="sticky -mx-3 mt-1 -mb-2 border-t border-rule/40 bg-background/95 px-3 pt-2 pb-2 backdrop-blur-sm"
            style={{ bottom: 0 }}
          >
            {isTurnZero && (
              <SecondaryChatSuggestions
                mode={mode}
                reconciliationKind={reconciliationKind}
                onPick={(prompt) => setDraft(prompt)}
                disabled={isStreaming}
              />
            )}
            <SecondaryChatComposer
              mode={mode}
              onSubmitMessage={onSubmitMessage}
              disabled={isStreaming}
              onSetMode={onSetMode}
              isModeUpdating={isModeUpdating}
              draft={draft}
              setDraft={setDraft}
              mentionableItems={mentionableItems ?? []}
            />
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * Streaming-assistant live state. FE-716 C22 swapped the bespoke `motion.div`
 * pulse for ai-elements `<Reasoning>` so the typing indicator matches the
 * interview spine (shimmer "Thinking…" header + revealed streaming text
 * inside the collapsible body). `prefers-reduced-motion` short-circuits to
 * a static text block.
 */
function SecondaryChatStreamingAssistant({
  text,
  isStreaming,
  prefersReducedMotion,
}: {
  text: string;
  isStreaming: boolean;
  prefersReducedMotion: boolean;
}) {
  if (prefersReducedMotion) {
    return (
      <div data-testid="secondary-chat-streaming-assistant" className="whitespace-pre-wrap text-sub">
        {text}
      </div>
    );
  }
  return (
    <Reasoning
      data-testid="secondary-chat-streaming-assistant"
      className="mb-0"
      isStreaming={isStreaming}
      defaultOpen
    >
      <ReasoningTrigger />
      <ReasoningContent className="mt-1">{text}</ReasoningContent>
    </Reasoning>
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
      <Message data-testid="secondary-chat-user-turn" from="user">
        <MessageContent className="whitespace-pre-wrap text-foreground">{turn.user_parts}</MessageContent>
      </Message>
    );
  }
  if (turn.assistant_parts !== null && turn.assistant_parts !== undefined) {
    return (
      <Message data-testid="secondary-chat-assistant-turn" from="assistant">
        <MessageContent className="text-sub">
          <MessageResponse className="text-sub">{turn.assistant_parts}</MessageResponse>
        </MessageContent>
      </Message>
    );
  }
  return null;
}

/**
 * Composer built on `<PromptInput>` (FE-716 C21). The mode toggle lives in
 * the composer footer per UNIFIED_CHAT_UX.md §2; `Shift+Tab` inside the
 * textarea flips Ask↔Edit so keyboard-only flows can change mode without
 * leaving the input. The form root receives `data-testid="secondary-chat-composer"`
 * via `<PromptInput>`'s `...props` spread onto the underlying `<form>`.
 */
function SecondaryChatComposer({
  mode,
  onSubmitMessage,
  disabled,
  onSetMode,
  isModeUpdating,
  draft,
  setDraft,
  mentionableItems,
}: {
  mode: SecondaryChatMode;
  onSubmitMessage: (message: string) => void;
  disabled?: boolean;
  onSetMode?: (mode: SecondaryChatMode) => void;
  isModeUpdating?: boolean;
  draft: string;
  setDraft: (draft: string) => void;
  mentionableItems: readonly MentionItem[];
}) {
  // FE-716 C25: mention popup state. `mentionQuery === null` means inactive;
  // empty string means the user just typed `#` (show all candidates).
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const filteredMentions = useMemo(() => {
    if (mentionQuery === null) return [] as readonly MentionItem[];
    const lowered = mentionQuery.toLowerCase();
    return mentionableItems.filter((item) => item.refCode.toLowerCase().startsWith(lowered));
  }, [mentionQuery, mentionableItems]);

  const dismissMention = () => setMentionQuery(null);

  const pickMention = (item: MentionItem) => {
    const textarea = textareaRef.current;
    const cursor = textarea?.selectionStart ?? draft.length;
    const { value, cursor: nextCursor } = insertMention(draft, cursor, item.refCode);
    setDraft(value);
    setMentionQuery(null);
    // Restore focus + place cursor right after the inserted refcode.
    requestAnimationFrame(() => {
      const t = textareaRef.current;
      if (t) {
        t.focus();
        t.setSelectionRange(nextCursor, nextCursor);
      }
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Mention popup intercepts Esc/Enter first so the user can pick / dismiss
    // without triggering the textarea's submit-on-Enter.
    if (handleMentionPopupKey(event, mentionQuery, filteredMentions[0], pickMention, dismissMention)) {
      return;
    }
    // Shift+Tab toggles Ask↔Edit; capture before the textarea's Enter logic so
    // we don't accidentally submit a draft when the user only meant to switch modes.
    if (event.key === 'Tab' && event.shiftKey && onSetMode && !isModeUpdating) {
      event.preventDefault();
      onSetMode(mode === 'edit' ? 'explore' : 'edit');
    }
  };

  return (
    <PromptInput
      data-testid="secondary-chat-composer"
      className="relative text-sm"
      onSubmit={(message) => {
        const trimmed = message.text.trim();
        if (trimmed.length === 0 || disabled) return;
        onSubmitMessage(trimmed);
        setDraft('');
        setMentionQuery(null);
      }}
    >
      <PromptInputBody>
        <PromptInputTextarea
          ref={textareaRef}
          data-testid="secondary-chat-composer-input"
          placeholder="Ask a follow-up…"
          disabled={disabled}
          onKeyDown={handleKeyDown}
          value={draft}
          onChange={(event) => {
            const next = event.currentTarget.value;
            setDraft(next);
            const cursor = event.currentTarget.selectionStart ?? next.length;
            setMentionQuery(computeMentionQuery(next, cursor));
          }}
        />
      </PromptInputBody>
      <PromptInputFooter>
        <PromptInputTools>
          <SecondaryChatModeToggle mode={mode} onSetMode={onSetMode} disabled={isModeUpdating} />
        </PromptInputTools>
        <PromptInputSubmit data-testid="secondary-chat-composer-send" disabled={disabled} />
      </PromptInputFooter>
      {mentionQuery !== null && mentionableItems.length > 0 && (
        <SecondaryChatMentionPopup
          query={mentionQuery}
          items={mentionableItems}
          onPick={pickMention}
          onDismiss={dismissMention}
        />
      )}
    </PromptInput>
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
