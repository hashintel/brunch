import { ArrowUp, Highlighter, MessageSquare, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { z } from 'zod/v4';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/client/components/ui/collapsible';
import { cn } from '@/client/lib/utils';
import type { secondaryChatStateSchema } from '@/shared/api-types.js';
import { knowledgeKindReferencePrefixes } from '@/shared/knowledge.js';

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
import { Shimmer } from './ai-elements/shimmer.js';
import { kindAccentHex } from './knowledge-card.js';
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
   * read-only (some popover tests render the collapsible without a mutation
   * context).
   */
  onSetMode?: (mode: SecondaryChatMode) => void;
  isModeUpdating?: boolean;
  onSubmitMessage?: (message: string) => void;
  streamingAssistantText?: string;
  isStreaming?: boolean;
  /**
   * Slot rendered inside the collapsible body, after persisted turns and any
   * in-flight assistant text but before the composer. Used to mount the
   * per-chat staging strip without coupling the presentational collapsible
   * to the patch-list module.
   */
  bodyExtras?: ReactNode;
  /**
   * Controlled open state. When provided, the collapsible delegates open/close
   * to the parent via `onOpenChange`; the host uses this to auto-expand the
   * focused chat after a trigger creates a new chat.
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * Mention-able knowledge items. When non-empty AND the composer is mounted,
   * typing `#` opens an autocomplete popup. Server-side resolution of
   * `#REF-CODE` lives elsewhere — this prop only powers the UI affordance.
   */
  mentionableItems?: readonly MentionItem[];
  /**
   * Optional summary of the card this chat is pinned to. When provided, the
   * header shows `[Action] [REF-CODE] trimmed name…` — so the user sees at a
   * glance which artifact the chat is anchored on.
   */
  pinnedItemSummary?: {
    refCode: string;
    content: string;
  } | null;
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
  mentionableItems,
  pinnedItemSummary,
}: SecondaryChatCollapsibleProps) {
  const kickoffContent = secondaryChat.kickoffTurn?.assistant_parts ?? '';
  const mode = secondaryChat.chat.mode ?? 'explore';
  const collapsibleProps = open !== undefined ? { open, ...(onOpenChange ? { onOpenChange } : {}) } : {};
  const prefersReducedMotion = usePrefersReducedMotion();
  // Lifted composer draft so the turn-zero suggestion row can populate it.
  // Cleared after a successful submit.
  const [draft, setDraft] = useState('');
  // Turn-zero = the chat has only its kickoff turn (kickoffTurn is excluded
  // from `turns`). First user submit drops `turns.length` above 0 once the
  // bundle invalidates, hiding the suggestions row.
  const isTurnZero = secondaryChat.turns.length === 0;
  const reconciliationKind = secondaryChat.pinnedReconciliationNeed?.kind ?? null;
  const pinnedAccent = secondaryChat.pinnedItemKind ? kindAccentHex[secondaryChat.pinnedItemKind] : null;
  const accentPanelStyle = pinnedAccent
    ? { borderColor: `${pinnedAccent}33`, backgroundColor: `${pinnedAccent}0a` }
    : undefined;

  // Autoscroll the chat surface to the latest message as turns arrive or
  // streaming text grows. The scroll ancestor is the shell body
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
      data-accent-hex={pinnedAccent ?? undefined}
      style={accentPanelStyle}
      // `flex min-h-0 flex-col` makes the body a flex column so the composer
      // can be pushed to the bottom of the available chat surface.
      className={cn(
        'flex min-h-0 flex-col rounded-lg border border-rule bg-tint/50 px-3 py-2 text-sm',
        pinnedAccent ? 'bg-transparent' : undefined,
      )}
      {...collapsibleProps}
    >
      <div className="flex w-full items-center justify-between gap-2">
        <CollapsibleTrigger
          data-testid="secondary-chat-collapsible-trigger"
          style={pinnedAccent ? { ['--tw-ring-color' as never]: `${pinnedAccent}4D` } : undefined}
          className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded text-left text-sub outline-none focus-visible:ring-2"
        >
          <SecondaryChatTitle
            mode={mode}
            pinnedItemSummary={pinnedItemSummary ?? null}
            pinnedAccent={pinnedAccent}
          />
          <span aria-hidden className="shrink-0 text-hint">
            ▾
          </span>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent
        data-testid="secondary-chat-collapsible-body"
        className="flex min-h-0 flex-1 flex-col gap-2 pt-2 text-foreground"
      >
        {secondaryChat.pinnedReconciliationNeed && (
          <SecondaryChatReconciliationPanel need={secondaryChat.pinnedReconciliationNeed} />
        )}
        {kickoffContent && <div className="whitespace-pre-wrap">{kickoffContent}</div>}
        <Conversation className="relative flex max-h-none flex-1 flex-col overflow-visible">
          <ConversationContent className="flex flex-col gap-2 p-0">
            {secondaryChat.turns.map((turn) => (
              <SecondaryChatTurnRow key={turn.id} turn={turn} pinnedAccent={pinnedAccent} />
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
            // `mt-auto` pushes the composer to the bottom of the flex column
            // when the conversation is shorter than the available height;
            // `sticky bottom-0` keeps it pinned when scrolling through a long
            // transcript.
            className="sticky -mx-3 mt-auto -mb-2 flex flex-col gap-2 border-t border-rule/40 bg-background/95 px-3 pt-3 pb-2 backdrop-blur-sm"
            style={{ bottom: 0 }}
          >
            {isTurnZero && (
              <SecondaryChatSuggestions
                mode={mode}
                reconciliationKind={reconciliationKind}
                // Picking a suggestion sends the prompt immediately so the
                // user doesn't have to press Enter — the suggestion row is a
                // shortcut for "I want to start with this exact prompt".
                onPick={(prompt) => {
                  setDraft('');
                  onSubmitMessage(prompt);
                }}
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
              pinnedAccent={pinnedAccent}
              pinnedSpanHint={secondaryChat.chat.pinned_span_hint}
            />
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

function SecondaryChatStreamingAssistant({
  text,
  isStreaming,
  prefersReducedMotion,
}: {
  text: string;
  isStreaming: boolean;
  prefersReducedMotion: boolean;
}) {
  // Before the first token arrives we show a "Thinking…" shimmer so the
  // user has immediate feedback that the request is in-flight, matching
  // the ai-elements shimmer pattern used elsewhere for pre-stream affordance.
  // Reduced-motion users get a static label so they don't see the running
  // gradient animation.
  const hasText = text.length > 0;
  if (!hasText && isStreaming) {
    return (
      <div data-testid="secondary-chat-streaming-thinking" className="text-sub italic">
        {prefersReducedMotion ? (
          <span className="text-hint">Thinking…</span>
        ) : (
          <Shimmer as="span" className="text-xs">
            Thinking…
          </Shimmer>
        )}
      </div>
    );
  }
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

// Cap the pinned item's content shown in the header so long requirements
// don't blow up the trigger row. The full content is still available once
// the user expands the chat and views the underlying card.
const PINNED_NAME_MAX_LEN = 48;

function trimPinnedName(content: string): string {
  const collapsed = content.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= PINNED_NAME_MAX_LEN) return collapsed;
  return `${collapsed.slice(0, PINNED_NAME_MAX_LEN - 1).trimEnd()}…`;
}

function SecondaryChatTitle({
  pinnedItemSummary,
  pinnedAccent,
}: {
  mode: SecondaryChatMode;
  pinnedItemSummary: { refCode: string; content: string } | null;
  pinnedAccent: string | null;
}) {
  // The mode (Chat/Agent) icon lives in the composer's segmented toggle and
  // in the ChatSwitcher tabs, so the title only carries the pinned-item
  // identity (refCode + trimmed name). The refCode chip color mirrors the
  // pinned-card accent when available so the header reads as a single
  // composition with the rest of the chat surface.
  const codeStyle = pinnedAccent
    ? { color: pinnedAccent, borderColor: `${pinnedAccent}40`, backgroundColor: `${pinnedAccent}14` }
    : undefined;
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      {pinnedItemSummary && (
        <>
          <span
            data-testid="secondary-chat-pinned-code"
            data-ref-code={pinnedItemSummary.refCode}
            className={cn(
              'inline-flex shrink-0 items-center rounded-md border px-1 font-mono text-[11px] leading-[1.35] font-medium',
              pinnedAccent ? '' : 'border-rule/60 bg-background text-ink',
            )}
            style={codeStyle}
          >
            {pinnedItemSummary.refCode}
          </span>
          <span
            data-testid="secondary-chat-pinned-name"
            className="min-w-0 truncate text-xs text-ink"
            title={pinnedItemSummary.content}
          >
            {trimPinnedName(pinnedItemSummary.content)}
          </span>
        </>
      )}
    </span>
  );
}

function SecondaryChatReconciliationPanel({ need }: { need: SecondaryChatPinnedReconciliationNeed }) {
  return (
    <div
      data-testid="secondary-chat-reconciliation-panel"
      data-reconciliation-need-id={need.needId}
      data-reconciliation-kind={need.kind}
      className="flex flex-col gap-1 rounded-lg border border-rule/60 bg-background/70 px-2 py-1.5 text-xs"
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

// Matches inline reference codes like `#R1`, `#G2`, `#CTX3`, etc. The prefix
// (uppercase letters) maps to a KnowledgeKind via `knowledgeKindReferencePrefixes`;
// we render each match as a colored chip so mentions pop visually in the chat.
const REF_CODE_PATTERN = /#([A-Z]+)(\d+)/g;

function renderWithMentionChips(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  REF_CODE_PATTERN.lastIndex = 0;
  while ((match = REF_CODE_PATTERN.exec(text)) !== null) {
    const [whole, prefix] = match;
    const start = match.index;
    if (start > lastIndex) nodes.push(text.slice(lastIndex, start));
    const refCode = whole.slice(1);
    const accent = REF_PREFIX_TO_ACCENT_HEX[prefix] ?? null;
    nodes.push(
      <span
        key={`${start}-${refCode}`}
        data-testid="secondary-chat-mention-chip"
        data-ref-code={refCode}
        className="inline-flex items-center rounded-md border border-rule bg-wash px-1 align-baseline font-mono text-[11px] leading-[1.35] font-medium"
        style={
          accent ? { color: accent, borderColor: `${accent}33`, backgroundColor: `${accent}14` } : undefined
        }
      >
        {whole}
      </span>,
    );
    lastIndex = start + whole.length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

// Reverse lookup: reference-code prefix → accent hex. Built from the project's
// knowledge registry so chips stay in sync with badge colors elsewhere.
const REF_PREFIX_TO_ACCENT_HEX: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const [kind, prefix] of Object.entries(knowledgeKindReferencePrefixes)) {
    const accent = kindAccentHex[kind as keyof typeof kindAccentHex];
    if (accent) out[prefix] = accent;
  }
  return out;
})();

function SecondaryChatTurnRow({
  turn,
  pinnedAccent,
}: {
  turn: SecondaryChatTurn;
  pinnedAccent: string | null;
}) {
  if (turn.user_parts !== null && turn.user_parts !== undefined) {
    // User bubble carries a slight wash of the chat's pinned-item accent
    // (~8% alpha + a faint border at ~25%) so the message column stays in
    // the same color family as the title chip, the focus ring, and the
    // submit button. Falls back to the default `bg-secondary` from
    // <MessageContent> when there's no accent.
    const userBubbleStyle = pinnedAccent
      ? { backgroundColor: `${pinnedAccent}14`, borderColor: `${pinnedAccent}40`, borderWidth: 1 }
      : undefined;
    return (
      <Message data-testid="secondary-chat-user-turn" from="user">
        <MessageContent className="text-foreground" style={userBubbleStyle}>
          {/* Wrap in a single span so the chips stay inline. MessageContent
              is `flex flex-col`, which would otherwise stretch each direct
              child to full width. */}
          <span className="whitespace-pre-wrap">{renderWithMentionChips(turn.user_parts)}</span>
        </MessageContent>
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

// Trim the span hint shown in the composer chip — long highlights would
// otherwise blow up the row; the full text is in the `title` attribute on
// hover.
const SPAN_HINT_PREVIEW_LEN = 80;

function previewSpanHint(text: string): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= SPAN_HINT_PREVIEW_LEN) return collapsed;
  return `${collapsed.slice(0, SPAN_HINT_PREVIEW_LEN - 1).trimEnd()}…`;
}

/**
 * Extract every distinct `#REF-CODE` mention from the draft, in first-seen
 * order. The kind prefix is captured so the chip can be retinted to the
 * matching knowledge-kind accent.
 */
function extractMentionRefs(draft: string): readonly { refCode: string; prefix: string }[] {
  const seen = new Set<string>();
  const out: { refCode: string; prefix: string }[] = [];
  REF_CODE_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = REF_CODE_PATTERN.exec(draft)) !== null) {
    const [whole, prefix] = match;
    const refCode = whole.slice(1);
    if (seen.has(refCode)) continue;
    seen.add(refCode);
    out.push({ refCode, prefix });
  }
  return out;
}

/**
 * "Anchor chip" row rendered above the composer textarea. Surfaces the
 * volatile, message-scoped context the user is composing against:
 *
 * - Inserted `#REF-CODE` mentions from the draft appear as colored chips so
 *   the user can see at a glance which items they've cited — adapted from
 *   the side-chat injection pattern.
 * - The highlighted span (`pinned_span_hint`) from the trigger surfaces as
 *   a separate chip when present.
 *
 * The chat's *pinned* item is intentionally NOT shown here — that identity
 * already lives in the collapsible title, so duplicating it in the composer
 * was redundant.
 */
function ComposerAnchorChip({ draft, spanHint }: { draft: string; spanHint: string | null }) {
  const mentions = useMemo(() => extractMentionRefs(draft), [draft]);
  if (mentions.length === 0 && !spanHint) return null;
  return (
    <div
      data-testid="secondary-chat-composer-anchor-chip"
      className="mb-1.5 flex max-w-full flex-wrap items-center gap-1.5 text-xs text-sub"
    >
      {mentions.map(({ refCode, prefix }) => {
        const accent = REF_PREFIX_TO_ACCENT_HEX[prefix] ?? null;
        return (
          <span
            key={refCode}
            data-testid="secondary-chat-composer-mention-chip"
            data-ref-code={refCode}
            className={cn(
              'inline-flex items-center rounded-md border bg-background/60 px-1.5 py-0.5 font-mono text-[11px] leading-none font-medium',
              accent ? '' : 'border-rule/60 text-ink',
            )}
            style={
              accent
                ? { color: accent, borderColor: `${accent}40`, backgroundColor: `${accent}14` }
                : undefined
            }
          >
            #{refCode}
          </span>
        );
      })}
      {spanHint && spanHint.length > 0 && (
        <span
          data-testid="secondary-chat-composer-anchor-span"
          className="inline-flex min-w-0 items-center gap-1 rounded-md border border-rule/60 bg-wash/60 px-1.5 py-0.5"
          title={spanHint}
        >
          <Highlighter aria-hidden className="size-3 shrink-0 text-hint" />
          <span className="min-w-0 truncate text-[11px] leading-none text-sub italic">
            «{previewSpanHint(spanHint)}»
          </span>
        </span>
      )}
    </div>
  );
}

/**
 * Composer built on `<PromptInput>`. `Shift+Tab` inside the textarea flips
 * Ask↔Edit so keyboard-only flows can change mode without leaving the input.
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
  pinnedAccent,
  pinnedSpanHint,
}: {
  mode: SecondaryChatMode;
  onSubmitMessage: (message: string) => void;
  disabled?: boolean;
  onSetMode?: (mode: SecondaryChatMode) => void;
  isModeUpdating?: boolean;
  draft: string;
  setDraft: (draft: string) => void;
  mentionableItems: readonly MentionItem[];
  pinnedAccent?: string | null;
  pinnedSpanHint?: string | null;
}) {
  // `mentionQuery === null` means inactive; empty string means the user just
  // typed `#` (show all candidates).
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const filteredMentions = useMemo(() => {
    if (mentionQuery === null) return [] as readonly MentionItem[];
    const lowered = mentionQuery.toLowerCase();
    return mentionableItems.filter((item) => item.refCode.toLowerCase().startsWith(lowered));
  }, [mentionQuery, mentionableItems]);

  // Snap the highlight back to the first item whenever the candidate set
  // changes — so the user always starts on a real, in-range row.
  useEffect(() => {
    setHighlightedIndex(0);
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

  const activeMention = filteredMentions[highlightedIndex] ?? filteredMentions[0] ?? null;

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Mention popup intercepts arrow keys / Enter / Esc first so the user can
    // navigate + pick + dismiss without triggering the textarea's own logic.
    if (
      handleMentionPopupKey(
        event,
        mentionQuery,
        filteredMentions,
        highlightedIndex,
        setHighlightedIndex,
        pickMention,
        dismissMention,
      )
    ) {
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
    // Wrap in a relative div so the mention popup can be a sibling of the
    // PromptInput form. The PromptInput renders an InputGroup with
    // `overflow-hidden` internally, which would otherwise clip an absolutely
    // positioned popup placed inside it.
    //
    // Overriding `--ring` on this wrapper retints the InputGroup's
    // focus-visible border + ring (which read `ring-ring/50` / `border-ring`)
    // so the composer's focused outline matches the chat's pinned-item
    // accent — same family as the submit button and the title chip.
    <div
      className="relative text-sm"
      style={pinnedAccent ? { ['--ring' as never]: pinnedAccent } : undefined}
    >
      <ComposerAnchorChip draft={draft} spanHint={pinnedSpanHint ?? null} />
      <PromptInput
        data-testid="secondary-chat-composer"
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
            // `selection:` retints native text highlight to the pinned-item
            // accent (falls back to a neutral wash so unpinned chats still
            // get a soft selection color instead of the OS default).
            style={pinnedAccent ? { ['--selection-bg' as never]: `${pinnedAccent}40` } : undefined}
            className={cn(
              'rounded-full px-4',
              pinnedAccent
                ? 'selection:bg-(--selection-bg) selection:text-ink'
                : 'selection:bg-foreground/15 selection:text-ink',
            )}
          />
        </PromptInputBody>
        <PromptInputFooter>
          <PromptInputTools>
            <SecondaryChatModeToggle
              mode={mode}
              onSetMode={onSetMode}
              disabled={isModeUpdating}
              pinnedAccent={pinnedAccent ?? null}
            />
          </PromptInputTools>
          <PromptInputSubmit
            data-testid="secondary-chat-composer-send"
            disabled={disabled}
            title="Send message"
            // Inline backgroundColor overrides Tailwind's `disabled:bg-*`,
            // so we only apply the accent fill when the button is actually
            // enabled. When disabled, the inline style drops and the
            // Tailwind tokens take over — the icon then reads against a
            // neutral tint instead of looking like a washed-out icon over
            // a colored background.
            style={pinnedAccent && !disabled ? { backgroundColor: pinnedAccent } : undefined}
            className={cn(
              // Fully circular send button with an upward arrow — reads as
              // a classic "send / submit" affordance shared with most modern
              // chat UIs (iMessage, ChatGPT, etc.). No hard outline: a soft
              // drop shadow + subtle inset top highlight give the button
              // depth without the heavy black 1-px ring.
              //
              // Microinteractions: on hover the shadow grows and the button
              // lifts a hair (scale 1.05); on press it sinks to scale 0.92.
              // The arrow icon nudges up `-translate-y-0.5` on hover so the
              // "send" intent reads with a tiny kinetic cue.
              'group/send relative rounded-full text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),0_2px_6px_-1px_rgba(0,0,0,0.25)] transition-[transform,background-color,box-shadow] duration-200 hover:enabled:scale-105 hover:enabled:shadow-[inset_0_1px_1px_rgba(255,255,255,0.3),0_4px_10px_-2px_rgba(0,0,0,0.3)] active:enabled:scale-95 active:enabled:duration-100',
              'disabled:bg-tint disabled:text-hint disabled:shadow-none',
              pinnedAccent ? 'hover:enabled:brightness-105' : 'bg-[#202020] hover:enabled:bg-[#000]',
            )}
          >
            <ArrowUp
              className="size-4 transition-transform duration-200 group-hover/send:-translate-y-0.5"
              strokeWidth={2.5}
              aria-hidden
            />
          </PromptInputSubmit>
        </PromptInputFooter>
      </PromptInput>
      {mentionQuery !== null && mentionableItems.length > 0 && (
        <SecondaryChatMentionPopup
          query={mentionQuery}
          items={mentionableItems}
          activeRefCode={activeMention?.refCode ?? null}
          anchorRef={textareaRef}
          onPick={pickMention}
          onDismiss={dismissMention}
        />
      )}
    </div>
  );
}

const MODE_HOVER_COPY: Record<SecondaryChatMode, string> = {
  explore: 'Ask — discuss the item, get analysis, no changes to the spec',
  edit: 'Agent — proposes structured changes you can review and apply',
};

const MODE_LABEL: Record<SecondaryChatMode, string> = {
  explore: 'Ask',
  edit: 'Agent',
};

// Fallback gray when the chat isn't pinned to a known knowledge-item kind.
// Mid-gray reads as a neutral active state against white text on the segmented
// pill, and matches the muted palette used elsewhere in the shell.
const DEFAULT_TOGGLE_ACCENT_HEX = '#525252';

function SecondaryChatModeToggle({
  mode,
  onSetMode,
  disabled,
  pinnedAccent,
}: {
  mode: SecondaryChatMode;
  onSetMode?: (mode: SecondaryChatMode) => void;
  disabled?: boolean;
  pinnedAccent?: string | null;
}) {
  const interactive = Boolean(onSetMode);
  const handleClick = (next: SecondaryChatMode) => () => {
    if (!onSetMode || disabled || mode === next) return;
    onSetMode(next);
  };

  // Segmented pill toggle: one rounded-full container holds both halves;
  // only the active half is filled — color mirrors the chat's pinned-item
  // accent so the active state stays in the same family as the title chip
  // and submit button; falls back to a neutral gray when the chat has no
  // matching knowledge-item kind.
  const accent = pinnedAccent ?? DEFAULT_TOGGLE_ACCENT_HEX;
  const segmentBase = cn(
    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 transition-colors',
    (!interactive || disabled) && 'opacity-60',
  );
  const activeStyle = { backgroundColor: accent };
  const inactiveClass = 'text-hint hover:text-ink';

  return (
    <span
      data-testid="secondary-chat-mode-toggle"
      data-mode={mode}
      role="group"
      aria-label="Chat or Agent mode"
      className="inline-flex items-center rounded-full border border-rule bg-background p-0.5 text-xs"
    >
      <button
        type="button"
        data-testid="secondary-chat-mode-ask"
        aria-pressed={mode === 'explore'}
        disabled={!interactive || disabled}
        onClick={handleClick('explore')}
        title={MODE_HOVER_COPY.explore}
        className={cn(segmentBase, mode === 'explore' ? 'text-white' : inactiveClass)}
        style={mode === 'explore' ? activeStyle : undefined}
      >
        <MessageSquare aria-hidden className="size-3" />
        <span>{MODE_LABEL.explore}</span>
      </button>
      <button
        type="button"
        data-testid="secondary-chat-mode-edit"
        aria-pressed={mode === 'edit'}
        disabled={!interactive || disabled}
        onClick={handleClick('edit')}
        title={MODE_HOVER_COPY.edit}
        className={cn(segmentBase, mode === 'edit' ? 'text-white' : inactiveClass)}
        style={mode === 'edit' ? activeStyle : undefined}
      >
        <Sparkles aria-hidden className="size-3" />
        <span>{MODE_LABEL.edit}</span>
      </button>
    </span>
  );
}
