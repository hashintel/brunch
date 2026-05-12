import {
  ArrowUp,
  Check,
  ChevronRight,
  CornerDownRight,
  Highlighter,
  Link2,
  Loader2,
  NotebookPen,
  PanelRight,
  PencilLine,
  PictureInPicture2,
  Plus,
  StickyNote,
  Undo2,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

import type { KnowledgeKind } from '@/shared/knowledge.js';

import { ActiveCard } from './active-card.js';
import { DEFAULT_ACCENT, DiffPopover } from './diff-popover.js';
import { ImpactChip } from './impact-chip.js';
import { kindAccentHex } from './knowledge-card';

type StagedPatchKind = 'annotate' | 'edit' | 'edge' | 'drill-down';

const STAGED_KIND_LABEL: Record<StagedPatchKind, string> = {
  annotate: 'note',
  edit: 'edit',
  edge: 'edge',
  'drill-down': 'drill',
};

function StagedKindChip({ kind, accent }: { kind: StagedPatchKind; accent: string }): React.ReactElement {
  const Icon =
    kind === 'annotate'
      ? StickyNote
      : kind === 'edit'
        ? PencilLine
        : kind === 'edge'
          ? Link2
          : CornerDownRight;
  return (
    <span
      data-kind-chip={kind}
      className="inline-flex shrink-0 items-center gap-1 rounded px-1 py-0.5 font-mono text-[10px] leading-none font-medium uppercase"
      style={{ backgroundColor: `${accent}14`, color: accent }}
    >
      <Icon className="size-3" aria-hidden />
      {STAGED_KIND_LABEL[kind]}
    </span>
  );
}

function useTypewriter(target: string, animate: boolean, charDelayMs = 15): string {
  const [displayed, setDisplayed] = useState(target);
  useEffect(() => {
    if (!animate) {
      if (displayed !== target) setDisplayed(target);
      return;
    }
    if (displayed.length > target.length) {
      setDisplayed(target);
      return;
    }
    if (displayed.length === target.length) return;
    const remaining = target.length - displayed.length;
    const charsToAdd = remaining > 40 ? Math.ceil(remaining / 20) : 1;
    const id = window.setTimeout(() => {
      setDisplayed(target.slice(0, displayed.length + charsToAdd));
    }, charDelayMs);
    return () => window.clearTimeout(id);
  }, [target, displayed, animate, charDelayMs]);
  return displayed;
}

function MessageBubble({ message }: { message: SideChatMessage }) {
  const animate = message.role === 'assistant' && !message.error && message.pending === true;
  const displayed = useTypewriter(message.text, animate);
  const baseClass = message.error
    ? 'max-w-[85%] rounded-lg bg-red-50 px-3 py-1.5 text-sm text-red-900 ring-1 ring-red-200'
    : message.role === 'user'
      ? 'self-end max-w-[85%] rounded-lg bg-[rgba(0,0,0,0.03)] px-3 py-1.5 text-sm text-ink'
      : 'max-w-[85%] rounded-lg px-3 py-1.5 text-sm whitespace-pre-wrap text-ink';
  return (
    <li
      data-message-role={message.role}
      data-message-pending={message.pending ? 'true' : undefined}
      data-message-error={message.error ? 'true' : undefined}
      className={baseClass}
    >
      {message.role === 'assistant' && !message.error ? displayed : message.text}
    </li>
  );
}

export interface SideChatPinnedItem {
  referenceCode: string;
  content: string;
  kind?: KnowledgeKind;
}

export interface SideChatMessage {
  role: 'user' | 'assistant';
  text: string;
  pending?: true;
  error?: true;
}

export interface SideChatStagedPatchSummary {
  id: string;
  kind: StagedPatchKind;
  summary: string;
  // For kind='edit' only: server-classified impact tier rendered as a chip
  // on the patch entry (design §4.1).
  impact?: 'none' | 'soft' | 'hard';
  // For kind='edit' only: when both are present and differ, the row exposes
  // a "View diff" chip that opens a <DiffPopover> with the word-level diff
  // (Card 4, replaces the FE-665 inline <details> expander).
  currentContent?: string;
  newContent?: string;
}

export interface SideChatExistingAnnotation {
  id: number;
  summary: string;
  body: string;
}

export type SideChatThreadItem =
  | { kind: 'message'; id: string; message: SideChatMessage; timestamp: number }
  | {
      kind: 'card';
      id: string;
      annotationId: number;
      summary: string;
      body: string;
      itemKind: KnowledgeKind;
      referenceCode: string;
      inContext: boolean;
      timestamp: number;
    };

export interface SideChatPopoverProps {
  pinnedItem: SideChatPinnedItem;
  onDismiss: () => void;
  threadItems?: readonly SideChatThreadItem[];
  onSubmit?: (message: string) => void;
  onDismissCard?: (annotationId: number) => void;
  // ---- Annotate (Card C) ----
  annotateMode?: boolean;
  onAnnotateRequest?: () => void;
  onAnnotateCancel?: () => void;
  onAnnotateSubmit?: (summary: string, body: string) => void;
  // ---- Edit mode toggle (V2 chat-driven Edit) ----
  mode?: 'explore' | 'edit';
  onModeChange?: (mode: 'explore' | 'edit') => void;
  // ---- Inline patch list (Card C, secondary surface per design §4) ----
  stagedPatches?: readonly SideChatStagedPatchSummary[];
  canUndo?: boolean;
  isApplying?: boolean;
  onApply?: () => void;
  onUndo?: () => void;
  onDiscardPatch?: (id: string) => void;
  // ---- Existing annotations on the pinned item ----
  existingAnnotations?: readonly SideChatExistingAnnotation[];
  // ---- Promote-from-drawer (deferred §8 from the design spec) ----
  onPromoteAnnotation?: (annotationId: number) => void;
  activeAnnotationIds?: readonly number[];
  // ---- Layout (docked = full-height right; floating = Gmail-style bottom-right) ----
  layout?: 'docked' | 'floating';
  onLayoutChange?: (layout: 'docked' | 'floating') => void;
  // ---- Span hint chip (Chat path V1.2-E) ----
  spanHint?: string | null;
  onClearSpanHint?: () => void;
}

export function SideChatPopover({
  pinnedItem,
  onDismiss,
  threadItems = [],
  onSubmit,
  onDismissCard,
  annotateMode = false,
  onAnnotateRequest,
  onAnnotateCancel,
  onAnnotateSubmit,
  mode = 'explore',
  onModeChange,
  stagedPatches = [],
  canUndo = false,
  isApplying = false,
  onApply,
  onUndo,
  onDiscardPatch,
  existingAnnotations = [],
  onPromoteAnnotation,
  activeAnnotationIds,
  layout = 'docked',
  onLayoutChange,
  spanHint = null,
  onClearSpanHint,
}: SideChatPopoverProps) {
  const messagesForState: readonly SideChatMessage[] = threadItems.flatMap((item) =>
    item.kind === 'message' ? [item.message] : [],
  );
  const [draft, setDraft] = useState('');
  const [annotateSummary, setAnnotateSummary] = useState('');
  const [annotateBody, setAnnotateBody] = useState('');
  const [notesOpen, setNotesOpen] = useState(false);
  // Card 4 / S2: staged-patch row diff is shown via an anchored DiffPopover
  // triggered by the per-row "↗ view diff" chip. We track which patch id is
  // currently open and the chip element it's anchored to.
  const [diffPopoverPatchId, setDiffPopoverPatchId] = useState<string | null>(null);
  const diffAnchorRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (diffPopoverPatchId === null) return;
    if (!stagedPatches.some((patch) => patch.id === diffPopoverPatchId)) {
      setDiffPopoverPatchId(null);
      diffAnchorRef.current = null;
    }
  }, [stagedPatches, diffPopoverPatchId]);

  const containerRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const annotateSummaryRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (annotateMode) {
      annotateSummaryRef.current?.focus();
    } else {
      setAnnotateSummary('');
      setAnnotateBody('');
      messageInputRef.current?.focus();
    }
  }, [annotateMode]);

  // Card 4 follow-up: the "Change saved" toast moved out of the side-chat
  // composer (where it overlapped the input row) into <PatchListOverlay /> so
  // it sits with the staged-changes / pending-review surfaces just under the
  // kind chips. The popover no longer tracks toast visibility.

  useEffect(() => {
    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        // The DiffPopover handles its own ESC at capture phase and stops
        // propagation, so this only fires when no popover is open.
        event.preventDefault();
        if (annotateMode && onAnnotateCancel) {
          onAnnotateCancel();
        } else {
          onDismiss();
        }
      }
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [annotateMode, onAnnotateCancel, onDismiss]);

  const trimmedDraft = draft.trim();
  const isStreaming = messagesForState.some((message) => message.pending === true);
  const sendDisabled = trimmedDraft.length === 0 || isStreaming;

  const trimmedAnnotateSummary = annotateSummary.trim();
  const trimmedAnnotateBody = annotateBody.trim();
  const annotateSubmitDisabled =
    trimmedAnnotateSummary.length === 0 || trimmedAnnotateBody.length === 0 || isApplying;

  function submit() {
    if (sendDisabled || !onSubmit) {
      return;
    }
    onSubmit(trimmedDraft);
    setDraft('');
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  function submitAnnotate() {
    if (annotateSubmitDisabled || !onAnnotateSubmit) {
      return;
    }
    onAnnotateSubmit(trimmedAnnotateSummary, trimmedAnnotateBody);
    setAnnotateSummary('');
    setAnnotateBody('');
  }

  const annotateButtonDisabled = isStreaming || annotateMode;
  const kindAccent = pinnedItem.kind ? kindAccentHex[pinnedItem.kind] : null;
  const accent = kindAccent ?? DEFAULT_ACCENT;
  const isEditMode = mode === 'edit';
  const editToggleDisabled = !onModeChange;
  const activeDiffPatch = diffPopoverPatchId
    ? (stagedPatches.find((p) => p.id === diffPopoverPatchId) ?? null)
    : null;

  return (
    <div
      className={`pointer-events-none fixed right-4 z-50 ${
        layout === 'docked'
          ? 'top-4 bottom-4 w-[588px]'
          : 'bottom-4 h-[min(640px,calc(100vh-2rem))] w-[420px]'
      }`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-[6px] rounded-[20px]"
        style={{
          background: kindAccent ?? DEFAULT_ACCENT,
          filter: 'blur(28px)',
          opacity: 0.18,
        }}
      />
      <div
        ref={containerRef}
        role="dialog"
        aria-label="Side-chat"
        data-side-chat-anchor="top-right"
        data-side-chat-layout={layout}
        data-kind={pinnedItem.kind ?? undefined}
        style={{
          background: kindAccent
            ? `linear-gradient(180deg, ${kindAccent}1f 0%, ${kindAccent}10 50%, ${kindAccent}06 100%), #ffffff`
            : '#ffffff',
          borderColor: kindAccent ? `${kindAccent}33` : 'rgba(84,36,255,0.15)',
        }}
        className="pointer-events-auto absolute inset-0 flex flex-col gap-3 rounded-2xl border p-3"
      >
        <header className="flex items-start gap-2 border-b border-rule pr-16 pb-2">
          <span
            className="inline-flex shrink-0 items-center rounded-[4px] px-1.5 py-0.5 font-mono text-xs font-medium"
            style={
              kindAccent
                ? { backgroundColor: `${kindAccent}14`, color: kindAccent }
                : { backgroundColor: 'rgba(0,0,0,0.03)' }
            }
          >
            {pinnedItem.referenceCode}
          </span>
          <p className="flex-1 text-sm text-ink">{pinnedItem.content}</p>
        </header>

        <ul
          role="log"
          aria-label="Side-chat messages"
          className="scrollbar-thin flex flex-1 flex-col gap-2 overflow-y-auto"
        >
          {threadItems.map((item) =>
            item.kind === 'message' ? (
              <MessageBubble key={item.id} message={item.message} />
            ) : (
              <ActiveCard
                key={item.id}
                annotationId={item.annotationId}
                referenceCode={item.referenceCode}
                itemKind={item.itemKind}
                summary={item.summary}
                body={item.body}
                inContext={item.inContext}
                onDismiss={onDismissCard ?? (() => {})}
              />
            ),
          )}
        </ul>

        {stagedPatches.length > 0 ? (
          <section
            aria-label="Staged changes"
            data-staged-patch-count={stagedPatches.length}
            className="flex flex-col gap-1.5 rounded-md p-2 text-xs text-ink"
            style={{
              backgroundColor: `${accent}0a`,
              boxShadow: `inset 0 0 0 1px ${accent}1f`,
            }}
          >
            <header className="flex items-center justify-between px-1">
              <span className="font-medium">
                {stagedPatches.length} pending change{stagedPatches.length === 1 ? '' : 's'}
              </span>
            </header>
            <ul className="flex flex-col gap-0.5">
              {stagedPatches.map((patch) => {
                const hasDiff =
                  patch.kind === 'edit' &&
                  typeof patch.currentContent === 'string' &&
                  typeof patch.newContent === 'string' &&
                  patch.currentContent !== patch.newContent;
                return (
                  <li
                    key={patch.id}
                    data-staged-patch-id={patch.id}
                    className="group/staged-row flex items-center gap-2 rounded px-1.5 py-1 transition-colors"
                    style={{ backgroundColor: 'transparent' }}
                    onMouseEnter={(event) => {
                      (event.currentTarget as HTMLLIElement).style.backgroundColor = `${accent}05`;
                    }}
                    onMouseLeave={(event) => {
                      (event.currentTarget as HTMLLIElement).style.backgroundColor = 'transparent';
                    }}
                  >
                    <StagedKindChip kind={patch.kind} accent={accent} />
                    <span className="min-w-0 flex-1 truncate text-ink" title={patch.summary}>
                      {patch.summary}
                    </span>
                    {hasDiff ? (
                      <button
                        type="button"
                        aria-label={`View diff for ${patch.summary}`}
                        data-view-diff-chip
                        onClick={(event) => {
                          diffAnchorRef.current = event.currentTarget;
                          setDiffPopoverPatchId(patch.id);
                        }}
                        className="inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-medium text-hint hover:bg-[rgba(0,0,0,0.04)] hover:text-ink"
                        style={
                          diffPopoverPatchId === patch.id
                            ? { backgroundColor: `${accent}14`, color: accent }
                            : undefined
                        }
                      >
                        <ChevronRight className="size-3 -rotate-45" aria-hidden />
                        view diff
                      </button>
                    ) : null}
                    {patch.kind === 'edit' && patch.impact ? <ImpactChip impact={patch.impact} /> : null}
                    {onDiscardPatch ? (
                      <button
                        type="button"
                        aria-label={`Discard staged change: ${patch.summary}`}
                        onClick={() => onDiscardPatch(patch.id)}
                        className="inline-flex size-3.5 shrink-0 items-center justify-center rounded text-hint opacity-0 transition-opacity group-hover/staged-row:opacity-100 hover:bg-[rgba(0,0,0,0.06)] hover:text-ink focus-visible:opacity-100"
                      >
                        <X className="size-3" aria-hidden />
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            <div className="flex items-center justify-end gap-2 pt-1">
              {isApplying ? (
                <span role="status" className="text-[11px] text-hint">
                  Saving change…
                </span>
              ) : null}
              {canUndo && onUndo ? (
                <button
                  type="button"
                  onClick={onUndo}
                  aria-label="Undo last change"
                  title="Undo"
                  className="inline-flex size-7 items-center justify-center rounded-md text-ink transition-colors"
                  onMouseEnter={(event) => {
                    (event.currentTarget as HTMLButtonElement).style.backgroundColor = `${accent}14`;
                  }}
                  onMouseLeave={(event) => {
                    (event.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                  }}
                >
                  <Undo2 className="size-3.5" aria-hidden />
                  <span className="sr-only">Undo</span>
                </button>
              ) : null}
              {onApply ? (
                <button
                  type="button"
                  disabled={isApplying}
                  onClick={onApply}
                  aria-label={`Apply ${stagedPatches.length} change${stagedPatches.length === 1 ? '' : 's'}`}
                  title="Apply"
                  className="inline-flex size-7 items-center justify-center rounded-md text-white shadow-[0_1px_2px_rgba(0,0,0,0.12)] transition-transform hover:scale-105 disabled:pointer-events-none disabled:opacity-50"
                  style={{ backgroundColor: accent }}
                >
                  <Check className="size-3.5" aria-hidden strokeWidth={2.5} />
                  <span className="sr-only">Apply</span>
                </button>
              ) : null}
            </div>
          </section>
        ) : isApplying ? (
          <div role="status" className="text-xs text-hint">
            Saving change…
          </div>
        ) : null}

        {annotateMode ? (
          <form
            aria-label="Note composer"
            onSubmit={(event) => {
              event.preventDefault();
              submitAnnotate();
            }}
            className="flex flex-col gap-2 rounded-md bg-white p-2 shadow-[0_4px_4px_-2px_rgba(0,0,0,0.02),0_2px_2px_-1px_rgba(0,0,0,0.02),0_0_0_1px_rgba(0,0,0,0.08)]"
          >
            <input
              ref={annotateSummaryRef}
              aria-label="Annotation summary"
              placeholder="Title"
              value={annotateSummary}
              onChange={(event) => setAnnotateSummary(event.target.value)}
              className="rounded-md bg-[#fafafa] px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
            />
            <textarea
              aria-label="Annotation body"
              placeholder="Details"
              value={annotateBody}
              onChange={(event) => setAnnotateBody(event.target.value)}
              className="min-h-16 resize-none rounded-md bg-[#fafafa] px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onAnnotateCancel}
                className="rounded-md bg-white px-3 py-1 text-xs text-ink shadow-[0_4px_4px_-2px_rgba(0,0,0,0.02),0_2px_2px_-1px_rgba(0,0,0,0.02),0_0_0_1px_rgba(0,0,0,0.08)] hover:bg-[#fafafa]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={annotateSubmitDisabled}
                className="rounded-md px-3 py-1 text-xs font-medium text-white shadow-[0_1px_2px_rgba(0,0,0,0.12)] disabled:opacity-40"
                style={{ backgroundColor: accent }}
              >
                Save
              </button>
            </div>
          </form>
        ) : (
          <>
            {spanHint ? (
              <div
                data-span-hint-chip
                className="inline-flex items-center gap-1.5 self-start rounded bg-[rgba(0,0,0,0.04)] px-1.5 py-1 text-xs text-ink"
              >
                <Highlighter className="size-3 shrink-0 text-hint" aria-hidden />
                <span className="max-w-[280px] truncate" title={spanHint}>
                  «{spanHint}»
                </span>
                {onClearSpanHint ? (
                  <button
                    type="button"
                    aria-label="Clear span hint"
                    onClick={onClearSpanHint}
                    className="ml-0.5 text-hint hover:text-ink"
                  >
                    ×
                  </button>
                ) : null}
              </div>
            ) : null}
            <div className="relative flex flex-col gap-2 rounded-md bg-white p-3 shadow-[0_4px_4px_-2px_rgba(0,0,0,0.02),0_2px_2px_-1px_rgba(0,0,0,0.02),0_0_0_1px_rgba(0,0,0,0.08)]">
              <textarea
                ref={messageInputRef}
                aria-label="Message"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder={isEditMode ? 'Suggest an edit…' : 'Ask me anything...'}
                className="min-h-10 w-full resize-none bg-transparent text-sm text-ink outline-none placeholder:text-[#a6a6a6]"
              />
              <div className="relative flex h-7 items-center justify-between">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled
                    aria-label="Attach (coming soon)"
                    title="Attach — coming soon"
                    className="inline-flex size-7 items-center justify-center rounded-md bg-[#f2f2f2] text-ink disabled:opacity-60"
                  >
                    <Plus className="size-4" aria-hidden />
                  </button>
                  {onAnnotateRequest ? (
                    <button
                      type="button"
                      aria-label="Add a note"
                      title="Add a note"
                      disabled={annotateButtonDisabled}
                      onClick={onAnnotateRequest}
                      className="inline-flex size-6 items-center justify-center rounded-md text-hint hover:bg-[rgba(0,0,0,0.04)] hover:text-ink disabled:opacity-40"
                    >
                      <NotebookPen className="size-3.5" aria-hidden />
                      <span className="sr-only">Note</span>
                    </button>
                  ) : null}
                  {existingAnnotations.length > 0 ? (
                    <button
                      type="button"
                      aria-label={`${notesOpen ? 'Hide' : 'Show'} existing notes`}
                      aria-expanded={notesOpen}
                      onClick={() => setNotesOpen((open) => !open)}
                      className="inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-xs font-medium text-sub hover:bg-[rgba(0,0,0,0.04)] hover:text-ink"
                    >
                      <span
                        className={`text-hint transition-transform duration-200 ${
                          notesOpen ? 'rotate-90' : ''
                        }`}
                      >
                        ›
                      </span>
                      Notes ({existingAnnotations.length})
                    </button>
                  ) : null}
                </div>
                <button
                  type="button"
                  aria-label={isStreaming ? 'Sending…' : 'Send message'}
                  disabled={sendDisabled}
                  onClick={submit}
                  className={`inline-flex size-7 items-center justify-center rounded-md bg-[#202020] text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_0_0_1px_#101010] transition-transform duration-150 ${
                    isStreaming
                      ? ''
                      : 'hover:enabled:scale-105 disabled:bg-[#e3e3e3] disabled:text-[#a6a6a6] disabled:shadow-none'
                  }`}
                >
                  {isStreaming ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  ) : (
                    <ArrowUp className="size-4" strokeWidth={2.5} aria-hidden />
                  )}
                </button>
              </div>
              {notesOpen && existingAnnotations.length > 0 ? (
                <div className="absolute right-0 bottom-full left-0 mb-2">
                  <div className="overflow-hidden rounded-md bg-white shadow-[0_8px_16px_-4px_rgba(0,0,0,0.08),0_4px_8px_-2px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.08)]">
                    <header className="flex items-center justify-between border-b border-[rgba(0,0,0,0.06)] bg-white/80 px-3 py-1.5 backdrop-blur">
                      <span className="text-xxs font-medium tracking-wide text-sub uppercase">
                        Notes ({existingAnnotations.length})
                      </span>
                      <button
                        type="button"
                        aria-label="Hide notes"
                        onClick={() => setNotesOpen(false)}
                        className="text-hint hover:text-ink"
                      >
                        ×
                      </button>
                    </header>
                    <ul className="scrollbar-thin h-72 divide-y divide-dotted divide-[rgba(0,0,0,0.08)] overflow-x-hidden overflow-y-auto overscroll-contain">
                      {existingAnnotations.map((annotation) => {
                        const hasBody = annotation.body && annotation.body !== annotation.summary;
                        const isActive = (activeAnnotationIds ?? []).includes(annotation.id);
                        const actionSlot = isActive ? (
                          <span
                            className="inline-flex shrink-0 items-center gap-0.5 text-[10px] text-hint"
                            title="Already in chat context"
                          >
                            <Check className="size-3" aria-hidden />
                          </span>
                        ) : onPromoteAnnotation ? (
                          <button
                            type="button"
                            aria-label={`Add ${annotation.summary} to context`}
                            onClick={() => onPromoteAnnotation(annotation.id)}
                            className="inline-flex size-5 shrink-0 items-center justify-center rounded text-hint opacity-0 transition-opacity group-hover/note-item:opacity-100 hover:bg-[rgba(0,0,0,0.04)] hover:text-ink focus-visible:opacity-100"
                          >
                            <Plus className="size-3" aria-hidden />
                          </button>
                        ) : null;
                        return (
                          <li
                            key={annotation.id}
                            data-annotation-id={annotation.id}
                            className="group/note-item overflow-hidden text-xs text-ink hover:bg-[rgba(0,0,0,0.02)]"
                          >
                            {hasBody ? (
                              <details className="group/note">
                                <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 font-medium hover:text-ink">
                                  <span className="shrink-0 text-hint transition-transform group-open/note:rotate-90">
                                    ›
                                  </span>
                                  <span className="min-w-0 flex-1 truncate" title={annotation.summary}>
                                    {annotation.summary}
                                  </span>
                                  {actionSlot}
                                </summary>
                                <div className="pt-1 pr-3 pb-3 pl-7 text-sm leading-relaxed text-sub">
                                  {annotation.body}
                                </div>
                              </details>
                            ) : (
                              <div className="flex items-center gap-1.5 px-3">
                                <span
                                  className="min-w-0 flex-1 truncate py-2 font-medium"
                                  title={annotation.summary}
                                >
                                  {annotation.summary}
                                </span>
                                {actionSlot}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              ) : null}
            </div>
            {/* Edit-mode strip — thin row below the input card. */}
            <div
              data-edit-mode-strip
              className="flex h-7 items-center justify-between rounded-md px-2 text-xs"
              style={
                isEditMode
                  ? { backgroundColor: `${accent}10`, color: accent }
                  : { backgroundColor: 'transparent', color: 'var(--text-hint, #6b6b6b)' }
              }
            >
              <span className="inline-flex items-center gap-1.5">
                <PencilLine className="size-3.5" aria-hidden />
                <span className="font-medium">Edit mode</span>
              </span>
              {editToggleDisabled ? (
                <button
                  type="button"
                  disabled
                  aria-label="Edit unavailable"
                  aria-pressed="false"
                  title="Edit unavailable in this context"
                  className="inline-flex h-5 items-center rounded-full bg-[rgba(0,0,0,0.05)] px-2 text-[10px] font-medium text-[#a6a6a6]"
                >
                  Off
                </button>
              ) : (
                <button
                  type="button"
                  aria-label="Edit mode"
                  aria-pressed={isEditMode}
                  title="Toggle edit mode — your messages propose changes for review"
                  onClick={() => onModeChange?.(isEditMode ? 'explore' : 'edit')}
                  className={`inline-flex h-5 items-center rounded-full px-2 text-[10px] font-medium transition-colors ${
                    isEditMode ? 'text-white' : 'text-ink'
                  }`}
                  style={isEditMode ? { backgroundColor: accent } : { backgroundColor: 'rgba(0,0,0,0.05)' }}
                >
                  {isEditMode ? 'Edit on' : 'Off'}
                </button>
              )}
            </div>
          </>
        )}

        <div className="absolute top-3 right-3 flex items-center gap-0.5">
          <button
            type="button"
            aria-label={layout === 'docked' ? 'Float side-chat' : 'Dock side-chat to right'}
            title={layout === 'docked' ? 'Float' : 'Dock to right'}
            onClick={() => onLayoutChange?.(layout === 'docked' ? 'floating' : 'docked')}
            className="flex size-5 items-center justify-center rounded-md text-hint hover:bg-[rgba(0,0,0,0.04)] hover:text-ink focus-visible:ring-2 focus-visible:ring-foreground/30"
          >
            {layout === 'docked' ? (
              <PictureInPicture2 className="size-3" aria-hidden />
            ) : (
              <PanelRight className="size-3" aria-hidden />
            )}
          </button>
          <button
            type="button"
            aria-label="Close side-chat"
            onClick={onDismiss}
            className="flex size-5 items-center justify-center rounded-md text-hint hover:bg-[rgba(0,0,0,0.04)] hover:text-ink focus-visible:ring-2 focus-visible:ring-foreground/30"
          >
            ×
          </button>
        </div>

        {activeDiffPatch &&
        typeof activeDiffPatch.currentContent === 'string' &&
        typeof activeDiffPatch.newContent === 'string' ? (
          <DiffPopover
            open
            onClose={() => {
              setDiffPopoverPatchId(null);
              diffAnchorRef.current = null;
            }}
            anchor={diffAnchorRef.current}
            before={activeDiffPatch.currentContent}
            after={activeDiffPatch.newContent}
            title={activeDiffPatch.summary}
            kindAccent={accent}
            kindChip={<StagedKindChip kind={activeDiffPatch.kind} accent={accent} />}
          />
        ) : null}
      </div>
    </div>
  );
}
