import { ArrowUp, Highlighter, MessageSquare, Sparkles, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { z } from 'zod/v4';

import { cn } from '@/client/lib/utils';
import type { secondaryChatStateSchema } from '@/shared/api-types.js';
import { knowledgeKindReferencePrefixes } from '@/shared/knowledge.js';
import { composerTextFromPersistedUserParts } from '@/shared/persisted-user-parts.js';

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
import { ProposeChangeChips } from './propose-change-chips.js';
import { SecondaryChatAnchorManager } from './secondary-chat-anchor-manager.js';
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
  streamingAssistantText?: string;
  /**
   * Optimistic user-message text rendered during the submit → onFinish
   * window so the user's message doesn't disappear from the transcript
   * while the assistant streams. Null/undefined when there's nothing to
   * surface; the bundle's persisted turns take over once invalidation
   * completes.
   */
  pendingUserText?: string | null;
  isStreaming?: boolean;
  /**
   * Optional: when provided, the fresh-state hero shows three "How to start"
   * chips that call this with the prompt text. Without it, the hero renders
   * the centered greeting alone.
   */
  onPickStartSuggestion?: (prompt: string) => void;
}

// Static "How to start" prompts — discoverable + instant, not personalized.
const FRESH_START_CHIPS: readonly { readonly label: string; readonly prompt: string }[] = [
  { label: 'Summarize this spec', prompt: 'Summarize the current spec so I can orient myself.' },
  { label: 'What needs attention?', prompt: 'What in this spec needs the most attention right now?' },
  { label: 'Suggest next steps', prompt: 'Suggest three concrete next steps for this spec.' },
];

// Transcript-only surface. Composer + mode toggle live in <SecondaryChatComposerPanel>
// so the shell can portal the composer into its footer slot.
export function SecondaryChatCollapsible({
  secondaryChat,
  streamingAssistantText,
  pendingUserText,
  isStreaming,
  onPickStartSuggestion,
}: SecondaryChatCollapsibleProps) {
  const mode = secondaryChat.chat.mode ?? 'explore';
  const reconciliationKind = secondaryChat.pinnedReconciliationNeed?.kind ?? null;
  const kickoffContent = secondaryChat.kickoffTurn?.assistant_parts ?? '';
  const prefersReducedMotion = usePrefersReducedMotion();
  const pinnedAccent = secondaryChat.pinnedItemKind ? kindAccentHex[secondaryChat.pinnedItemKind] : null;

  // Autoscroll on new content only. Primitive deps + `block: 'nearest'` keep
  // unrelated re-renders (mode toggles, panel expansions) from re-scrolling.
  const bottomAnchorRef = useRef<HTMLDivElement>(null);
  const turnCount = secondaryChat.turns.length;
  const streamingLength = streamingAssistantText?.length ?? 0;
  useEffect(() => {
    bottomAnchorRef.current?.scrollIntoView({ block: 'nearest' });
  }, [turnCount, streamingLength]);

  const hasReconciliation = secondaryChat.pinnedReconciliationNeed !== null;
  const hasKickoff = Boolean(kickoffContent);
  const hasTurns = secondaryChat.turns.length > 0;
  const hasStreaming = Boolean(isStreaming) && streamingAssistantText !== undefined;
  const isTurnZero = !hasTurns && !hasStreaming;

  return (
    <div
      data-testid="secondary-chat-collapsible"
      data-secondary-chat-id={secondaryChat.chat.id}
      data-accent-hex={pinnedAccent ?? undefined}
      className="flex min-h-0 flex-col px-1 py-1 text-sm"
    >
      <div
        data-testid="secondary-chat-collapsible-body"
        className="flex min-h-0 flex-1 flex-col gap-2 text-foreground"
      >
        {hasReconciliation && secondaryChat.pinnedReconciliationNeed && (
          <SecondaryChatReconciliationPanel need={secondaryChat.pinnedReconciliationNeed} />
        )}
        {hasKickoff && <div className="whitespace-pre-wrap">{kickoffContent}</div>}
        {isTurnZero ? (
          <SecondaryChatFreshStateHero
            onPick={onPickStartSuggestion}
            prefersReducedMotion={prefersReducedMotion}
            pinnedAccent={pinnedAccent}
            mode={mode}
            reconciliationKind={reconciliationKind}
            hasPinnedContext={hasReconciliation || hasKickoff}
          />
        ) : (
          <>
            <Conversation className="relative flex max-h-none flex-1 flex-col overflow-visible">
              {/* more breathing room between turns —
                  bumped gap-2 → gap-4 so user/assistant rows read as
                  cleanly separated exchanges, not a dense block. */}
              <ConversationContent className="flex flex-col gap-4 p-0">
                {secondaryChat.turns.map((turn) => (
                  <SecondaryChatTurnRow key={turn.id} turn={turn} pinnedAccent={pinnedAccent} />
                ))}
                {pendingUserText && (
                  <SecondaryChatPendingUserBubble text={pendingUserText} pinnedAccent={pinnedAccent} />
                )}
                {hasStreaming && (
                  <SecondaryChatStreamingAssistant
                    text={streamingAssistantText ?? ''}
                    isStreaming={Boolean(isStreaming)}
                    prefersReducedMotion={prefersReducedMotion}
                  />
                )}
              </ConversationContent>
            </Conversation>
            <div
              ref={bottomAnchorRef}
              aria-hidden
              data-testid="secondary-chat-bottom-anchor"
              className="h-px"
            />
          </>
        )}
      </div>
    </div>
  );
}

export interface SecondaryChatComposerPanelProps {
  secondaryChat: SecondaryChat;
  onSubmitMessage: (message: string) => void;
  onSetMode?: (mode: SecondaryChatMode) => void;
  isModeUpdating?: boolean;
  isStreaming?: boolean;
  mentionableItems?: readonly MentionItem[];
  /** Lookup so the AnchorManager chip can render referenceCode instead of raw id. */
  refCodeByItemId?: ReadonlyMap<number, string>;
}

function composerPlaceholder(mode: SecondaryChatMode, isTurnZero: boolean, isItemPinned: boolean): string {
  if (isTurnZero) {
    if (mode === 'edit') return isItemPinned ? 'Propose a change…' : 'Propose a change to your spec…';
    return isItemPinned ? 'Ask about this item…' : 'Ask brunch about your spec…';
  }
  return mode === 'edit' ? 'Propose any change…' : 'Ask a follow-up…';
}

// Sibling of <SecondaryChatCollapsible>; portalled into the shell footer.
export function SecondaryChatComposerPanel({
  secondaryChat,
  onSubmitMessage,
  onSetMode,
  isModeUpdating,
  isStreaming,
  mentionableItems,
  refCodeByItemId,
}: SecondaryChatComposerPanelProps) {
  const mode = secondaryChat.chat.mode ?? 'explore';
  const [draft, setDraft] = useState('');
  const pinnedAccent = secondaryChat.pinnedItemKind ? kindAccentHex[secondaryChat.pinnedItemKind] : null;
  const isItemPinned = secondaryChat.chat.pinned_item_id !== null;
  const isTurnZero = secondaryChat.turns.length === 0;
  // Edit mode keeps propose-change chips above the composer for step-through iteration.
  // Turn-zero suppresses them so the hero suggestions stay the sole prompt affordance.
  const showProposeChangeChips = mode === 'edit' && isItemPinned && !isTurnZero;

  return (
    <div
      data-testid="secondary-chat-composer-sticky"
      // Descendant overrides strip the InputGroup focus ring so the composer reads as one quiet outline.
      className="relative flex flex-col gap-1.5 bg-background/95 px-3 pt-2 pb-2 backdrop-blur-sm [&_[data-slot=input-group]]:!ring-0 [&_[data-slot=input-group]]:focus-within:!border-input"
    >
      {showProposeChangeChips && (
        <div
          data-testid="secondary-chat-composer-suggestions-overlay"
          className="pointer-events-auto flex flex-wrap gap-1.5 px-1 pb-1"
        >
          <ProposeChangeChips
            onPick={(prompt) => {
              setDraft('');
              onSubmitMessage(prompt);
            }}
            disabled={isStreaming}
            pinnedAccent={pinnedAccent}
          />
        </div>
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
        anchoredItemIds={secondaryChat.anchoredItemIds}
        refCodeByItemId={refCodeByItemId}
        isTurnZero={isTurnZero}
        isItemPinned={isItemPinned}
      />
    </div>
  );
}

function SecondaryChatFreshStateHero({
  onPick,
  prefersReducedMotion,
  pinnedAccent,
  mode,
  reconciliationKind,
  hasPinnedContext,
}: {
  onPick?: (prompt: string) => void;
  prefersReducedMotion: boolean;
  pinnedAccent: string | null;
  mode: SecondaryChatMode;
  reconciliationKind: 'supersedes' | 'needs_confirmation' | null;
  hasPinnedContext: boolean;
}) {
  // The server-rendered kickoff ("Hi! How can I help with #G1?") and the
  // reconciliation panel already greet the user with the turn-zero prompt
  // for pinned-context chats. Rendering a second "Where would you like to
  // begin?" title underneath was a duplicate prompt — suppress the title
  // when context is pinned and only keep it for the master-chat surface.
  const title = hasPinnedContext ? null : 'Ask brunch about your spec';
  return (
    <motion.div
      data-testid="secondary-chat-fresh-state"
      initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-4 py-6 text-center"
    >
      {title !== null && (
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
          data-testid="secondary-chat-fresh-state-title"
          className="text-sm font-medium text-ink"
        >
          {title}
        </motion.div>
      )}
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
        className="flex w-full flex-wrap justify-center gap-1.5"
      >
        {hasPinnedContext ? (
          <SecondaryChatSuggestions
            mode={mode}
            reconciliationKind={reconciliationKind}
            onPick={(prompt) => onPick?.(prompt)}
            disabled={!onPick}
          />
        ) : (
          FRESH_START_CHIPS.map((chip) => (
            <button
              key={chip.label}
              type="button"
              data-testid={`secondary-chat-fresh-chip-${chip.label.toLowerCase().replace(/\s+/g, '-')}`}
              disabled={!onPick}
              onClick={() => onPick?.(chip.prompt)}
              style={pinnedAccent ? { borderColor: `${pinnedAccent}33`, color: pinnedAccent } : undefined}
              className="inline-flex items-center gap-1 rounded-full border border-rule bg-background px-2 py-0.5 text-[11px] text-hint transition-[transform,background-color,color] duration-150 hover:enabled:bg-tint hover:enabled:text-ink active:enabled:scale-95 disabled:opacity-50"
            >
              {chip.label}
            </button>
          ))
        )}
      </motion.div>
    </motion.div>
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

// Matches inline reference codes like `#R1`, `#G2`, `#CTX3`, etc.
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

const REF_PREFIX_TO_ACCENT_HEX: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const [kind, prefix] of Object.entries(knowledgeKindReferencePrefixes)) {
    const accent = kindAccentHex[kind as keyof typeof kindAccentHex];
    if (accent) out[prefix] = accent;
  }
  return out;
})();

// In-chat accent rule: dim to 80% (alpha cc) so kind colors read as a soft echo, not a stamp.
const IN_CHAT_ACCENT_ALPHA = 'cc';

function dimAccentForChat(accent: string | null): string | null {
  if (!accent) return null;
  return `${accent}${IN_CHAT_ACCENT_ALPHA}`;
}

function SecondaryChatPendingUserBubble({
  text,
  pinnedAccent,
}: {
  text: string;
  pinnedAccent: string | null;
}) {
  const dimmed = dimAccentForChat(pinnedAccent);
  const userBubbleStyle = dimmed ? { backgroundColor: `${pinnedAccent}14`, color: dimmed } : undefined;
  return (
    <Message data-testid="secondary-chat-pending-user-bubble" from="user">
      <MessageContent className="text-foreground" style={userBubbleStyle}>
        <span className="whitespace-pre-wrap">{renderWithMentionChips(text)}</span>
      </MessageContent>
    </Message>
  );
}

function SecondaryChatTurnRow({
  turn,
  pinnedAccent,
}: {
  turn: SecondaryChatTurn;
  pinnedAccent: string | null;
}) {
  if (turn.user_parts !== null && turn.user_parts !== undefined) {
    const dimmed = dimAccentForChat(pinnedAccent);
    const userBubbleStyle = dimmed ? { backgroundColor: `${pinnedAccent}14`, color: dimmed } : undefined;
    return (
      <Message data-testid="secondary-chat-user-turn" from="user">
        <MessageContent className="text-foreground" style={userBubbleStyle}>
          <span className="whitespace-pre-wrap">
            {renderWithMentionChips(composerTextFromPersistedUserParts(turn.user_parts))}
          </span>
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

const SPAN_HINT_PREVIEW_LEN = 80;

function previewSpanHint(text: string): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= SPAN_HINT_PREVIEW_LEN) return collapsed;
  return `${collapsed.slice(0, SPAN_HINT_PREVIEW_LEN - 1).trimEnd()}…`;
}

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

function ComposerAnchorChip({ draft, spanHint }: { draft: string; spanHint: string | null }) {
  const mentions = useMemo(() => extractMentionRefs(draft), [draft]);
  // Local dismissal: the user can clear the highlighted-text chip without
  // touching the server-pinned `pinned_span_hint`. Dismissal resets whenever
  // the underlying hint changes (e.g. a new selection arrives).
  const [dismissedHint, setDismissedHint] = useState<string | null>(null);
  useEffect(() => {
    if (spanHint !== dismissedHint) setDismissedHint(null);
    // Only re-run when the incoming hint changes — the dismissedHint update
    // itself is a consequence, not a trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spanHint]);
  const showSpanHint = Boolean(spanHint && spanHint.length > 0 && spanHint !== dismissedHint);
  if (mentions.length === 0 && !showSpanHint) return null;
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
      {showSpanHint && spanHint && (
        <span
          data-testid="secondary-chat-composer-anchor-span"
          className="group/anchor-span inline-flex min-w-0 items-center gap-1 rounded-md border border-rule/60 bg-wash/60 px-1.5 py-0.5"
          title={spanHint}
        >
          <Highlighter aria-hidden className="size-3 shrink-0 text-hint" />
          <span className="min-w-0 truncate text-[11px] leading-none text-sub">
            {previewSpanHint(spanHint)}
          </span>
          <button
            type="button"
            data-testid="secondary-chat-composer-anchor-span-remove"
            aria-label="Remove highlighted text"
            onClick={() => setDismissedHint(spanHint)}
            className="inline-flex size-3 shrink-0 items-center justify-center rounded-full text-hint opacity-0 transition-opacity duration-150 group-hover/anchor-span:opacity-100 hover:text-ink focus-visible:opacity-100"
          >
            <X aria-hidden className="size-2.5" strokeWidth={1.75} />
          </button>
        </span>
      )}
    </div>
  );
}

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
  anchoredItemIds,
  refCodeByItemId,
  isTurnZero,
  isItemPinned,
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
  anchoredItemIds?: readonly number[];
  refCodeByItemId?: ReadonlyMap<number, string>;
  isTurnZero?: boolean;
  isItemPinned?: boolean;
}) {
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const filteredMentions = useMemo(() => {
    if (mentionQuery === null) return [] as readonly MentionItem[];
    const lowered = mentionQuery.toLowerCase();
    return mentionableItems.filter((item) => item.refCode.toLowerCase().startsWith(lowered));
  }, [mentionQuery, mentionableItems]);

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
    // Shift+Tab toggles Ask↔Edit before the textarea's Enter logic so we
    // don't submit a draft when the user only meant to switch modes.
    if (event.key === 'Tab' && event.shiftKey && onSetMode && !isModeUpdating) {
      event.preventDefault();
      onSetMode(mode === 'edit' ? 'explore' : 'edit');
    }
  };

  return (
    <div className="relative text-sm">
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
            placeholder={composerPlaceholder(mode, isTurnZero ?? false, isItemPinned ?? false)}
            disabled={disabled}
            onKeyDown={handleKeyDown}
            value={draft}
            onChange={(event) => {
              const next = event.currentTarget.value;
              setDraft(next);
              const cursor = event.currentTarget.selectionStart ?? next.length;
              setMentionQuery(computeMentionQuery(next, cursor));
            }}
            className="rounded-full px-4"
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
            {mode === 'edit' && (
              <SecondaryChatAnchorManager
                anchoredItemIds={anchoredItemIds ?? []}
                pinnedAccent={pinnedAccent ?? null}
                refCodeByItemId={refCodeByItemId}
              />
            )}
          </PromptInputTools>
          <PromptInputSubmit
            data-testid="secondary-chat-composer-send"
            disabled={disabled}
            title="Send message"
            style={pinnedAccent && !disabled ? { backgroundColor: pinnedAccent } : undefined}
            className={cn(
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

  const accent = pinnedAccent ?? DEFAULT_TOGGLE_ACCENT_HEX;
  const segmentBase = cn(
    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 transition-[transform,background-color,color] duration-200',
    (!interactive || disabled) && 'opacity-60',
  );
  const activeStyle = { backgroundColor: accent };
  const activeClass = 'text-white scale-[1.04]';
  const inactiveClass = 'text-hint hover:text-ink scale-100';

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
        className={cn(segmentBase, mode === 'explore' ? activeClass : inactiveClass)}
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
        className={cn(segmentBase, mode === 'edit' ? activeClass : inactiveClass)}
        style={mode === 'edit' ? activeStyle : undefined}
      >
        <Sparkles aria-hidden className="size-3" />
        <span>{MODE_LABEL.edit}</span>
      </button>
    </span>
  );
}
