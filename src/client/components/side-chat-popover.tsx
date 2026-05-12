import {
  ArrowUp,
  Check,
  Highlighter,
  Loader2,
  NotebookPen,
  PanelRight,
  PencilLine,
  PictureInPicture2,
  Plus,
} from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

import type { KnowledgeKind } from '@/shared/knowledge.js';

import { ActiveCard } from './active-card.js';
import { ContentDiff } from './content-diff.js';
import { kindAccentHex } from './knowledge-card';

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

// Impact tier chip for edit patches (design §4.1). Color cues mirror the
// patch-list overlay's deferred banner family — neutral for none, blue for
// soft (direct apply), amber for hard (deferred to V3 cascade).
function ImpactChip({ impact }: { impact: 'none' | 'soft' | 'hard' }) {
  const className =
    impact === 'hard'
      ? 'rounded bg-[rgba(255,219,168,0.6)] px-1.5 py-0.5 text-[10px] font-medium text-ink'
      : impact === 'soft'
        ? 'rounded bg-[rgba(32,112,230,0.12)] px-1.5 py-0.5 text-[10px] font-medium text-[#1060d6]'
        : 'rounded bg-wash px-1.5 py-0.5 text-[10px] font-medium text-sub';
  const label = impact === 'hard' ? 'Hard impact — V3' : impact === 'soft' ? 'Soft impact' : 'No impact';
  return (
    <span className={className} aria-label={label} data-impact={impact}>
      {label}
    </span>
  );
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
  kind: 'annotate' | 'edit' | 'edge' | 'drill-down';
  summary: string;
  // For kind='edit' only: server-classified impact tier rendered as a chip
  // on the patch entry (design §4.1).
  impact?: 'none' | 'soft' | 'hard';
  // For kind='edit' only: when both are present and differ, the row exposes
  // a "View diff" expander that renders a word-level <ContentDiff> (FE-665,
  // design §4.1 "Detail expandable"). Both optional for back-compat with
  // legacy stage paths and tests that don't supply them.
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
  applyBatchId?: string | null;
  onApply?: () => void;
  onUndo?: () => void;
  onDiscardPatch?: (id: string) => void;
  // When the most recent applied batch was a deferred-only outcome (V2
  // hard-impact deferral, SIDE_CHAT.md §6.3), suppress the inline
  // "Change saved" toast here — the canonical patch-list overlay shows
  // the deferred banner instead.
  lastBatchWasDeferredOnly?: boolean;
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
  applyBatchId = null,
  lastBatchWasDeferredOnly = false,
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
  const [savedToastVisible, setSavedToastVisible] = useState(false);
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

  // Show the saved toast only on a real apply event during this popover's lifetime.
  // We watch for `canUndo` flipping false → true (with `stagedPatches` empty and not currently
  // applying) — the precise moment a successful apply registers a fresh undo handle. We can't
  // drive this off the `isApplying: true → false` transition because React 18 batches the
  // `APPLY_START` and `APPLY_SUCCESS` dispatches in a single async chain, so the intermediate
  // `isApplying=true` render is often skipped. Initializing the ref to the current `canUndo`
  // also prevents the toast from flashing on mount when the patch-list still carries a stale
  // undo handle from a prior batch on this spec (the original V1.2-E bug).
  const prevCanUndoRef = useRef(canUndo);
  const lastToastBatchIdRef = useRef(applyBatchId);

  useEffect(() => {
    const prevCanUndo = prevCanUndoRef.current;
    prevCanUndoRef.current = canUndo;
    const sawNewBatch = applyBatchId !== null && applyBatchId !== lastToastBatchIdRef.current;
    if (sawNewBatch) {
      lastToastBatchIdRef.current = applyBatchId;
    }
    if (
      ((sawNewBatch && canUndo) || (!prevCanUndo && canUndo)) &&
      !isApplying &&
      stagedPatches.length === 0 &&
      !lastBatchWasDeferredOnly
    ) {
      setSavedToastVisible(true);
      const id = window.setTimeout(() => setSavedToastVisible(false), 5000);
      return () => window.clearTimeout(id);
    }
  }, [applyBatchId, canUndo, isApplying, stagedPatches.length, lastBatchWasDeferredOnly]);

  useEffect(() => {
    if (!canUndo) {
      setSavedToastVisible(false);
    }
  }, [canUndo]);

  useEffect(() => {
    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
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
          background: kindAccent ?? '#5424ff',
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

        {isApplying ? (
          <div role="status" className="text-xs text-hint">
            Saving change…
          </div>
        ) : null}

        {!isApplying && stagedPatches.length > 0 ? (
          <section
            aria-label="Staged changes"
            data-staged-patch-count={stagedPatches.length}
            className="flex flex-col gap-1.5 rounded-md bg-wash/60 p-2 text-xs text-ink"
          >
            <header className="flex items-center justify-between">
              <span className="font-medium">
                {stagedPatches.length} pending change{stagedPatches.length === 1 ? '' : 's'}
              </span>
            </header>
            <ul className="flex flex-col gap-1">
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
                    className="flex flex-col gap-1 rounded bg-background px-2 py-1"
                  >
                    <div className="flex items-start gap-2">
                      {hasDiff ? (
                        <details className="group min-w-0 flex-1">
                          <summary
                            className="flex cursor-pointer list-none items-center gap-1.5 text-ink"
                            title={patch.summary}
                          >
                            <span
                              aria-hidden
                              className="font-mono text-[10px] text-hint transition-transform group-open:rotate-90"
                            >
                              ›
                            </span>
                            <span className="flex-1 truncate">{patch.summary}</span>
                          </summary>
                          <div className="mt-1.5 ml-3 border-l border-rule pl-2">
                            <ContentDiff before={patch.currentContent ?? ''} after={patch.newContent ?? ''} />
                          </div>
                        </details>
                      ) : (
                        <span className="flex-1 truncate" title={patch.summary}>
                          {patch.summary}
                        </span>
                      )}
                      {patch.kind === 'edit' && patch.impact ? <ImpactChip impact={patch.impact} /> : null}
                      {onDiscardPatch ? (
                        <button
                          type="button"
                          aria-label={`Discard staged change: ${patch.summary}`}
                          onClick={() => onDiscardPatch(patch.id)}
                          className="text-hint hover:text-ink"
                        >
                          ×
                        </button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="flex items-center justify-end gap-2 pt-1">
              {canUndo && onUndo ? (
                <button
                  type="button"
                  onClick={onUndo}
                  className="rounded-md bg-white px-2 py-0.5 text-xs text-ink shadow-[0_4px_4px_-2px_rgba(0,0,0,0.02),0_2px_2px_-1px_rgba(0,0,0,0.02),0_0_0_1px_rgba(0,0,0,0.08)] hover:bg-[#fafafa]"
                >
                  Undo
                </button>
              ) : null}
              {onApply ? (
                <button
                  type="button"
                  onClick={onApply}
                  className="rounded-md bg-[linear-gradient(180deg,#3484fa,#2070e6)] px-2 py-0.5 text-xs font-medium text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_1px_2px_rgba(0,0,0,0.1)] ring-1 ring-[#1060d6]"
                >
                  Apply
                </button>
              ) : null}
            </div>
          </section>
        ) : null}

        {annotateMode ? (
          <form
            aria-label="Annotation composer"
            onSubmit={(event) => {
              event.preventDefault();
              submitAnnotate();
            }}
            className="flex flex-col gap-2 rounded-md bg-white p-2 shadow-[0_4px_4px_-2px_rgba(0,0,0,0.02),0_2px_2px_-1px_rgba(0,0,0,0.02),0_0_0_1px_rgba(0,0,0,0.08)]"
          >
            <input
              ref={annotateSummaryRef}
              aria-label="Annotation summary"
              placeholder="Summary"
              value={annotateSummary}
              onChange={(event) => setAnnotateSummary(event.target.value)}
              className="rounded-md bg-[#fafafa] px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
            />
            <textarea
              aria-label="Annotation body"
              placeholder="Note body"
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
                className="rounded-md bg-[linear-gradient(180deg,#3484fa,#2070e6)] px-3 py-1 text-xs font-medium text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_1px_2px_rgba(0,0,0,0.1)] ring-1 ring-[#1060d6] disabled:opacity-40"
              >
                Save
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="relative flex items-center justify-between gap-2">
              {existingAnnotations.length > 0 ? (
                <button
                  type="button"
                  aria-label={`${notesOpen ? 'Hide' : 'Show'} existing notes`}
                  aria-expanded={notesOpen}
                  onClick={() => setNotesOpen((open) => !open)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-sub hover:text-ink"
                >
                  <span
                    className={`text-hint transition-transform duration-200 ${notesOpen ? 'rotate-90' : ''}`}
                  >
                    ›
                  </span>
                  <span>Notes ({existingAnnotations.length})</span>
                </button>
              ) : (
                <span aria-hidden />
              )}
              <div className="flex items-center gap-1">
                {onAnnotateRequest ? (
                  <button
                    type="button"
                    aria-label="Annotate item"
                    disabled={annotateButtonDisabled}
                    onClick={onAnnotateRequest}
                    className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-medium text-ink shadow-[0_4px_4px_-2px_rgba(0,0,0,0.02),0_2px_2px_-1px_rgba(0,0,0,0.02),0_0_0_1px_rgba(0,0,0,0.08)] hover:bg-[#fafafa] disabled:opacity-40"
                  >
                    <NotebookPen className="size-3.5" aria-hidden />
                    Annotate
                  </button>
                ) : null}
                {onModeChange ? (
                  <button
                    type="button"
                    aria-label="Edit mode"
                    aria-pressed={mode === 'edit'}
                    title={
                      mode === 'edit'
                        ? 'Edit mode active — switch back to explore'
                        : 'Switch to edit mode (LLM proposes edits)'
                    }
                    onClick={() => onModeChange(mode === 'edit' ? 'explore' : 'edit')}
                    className={
                      mode === 'edit'
                        ? 'inline-flex items-center gap-1 rounded-md bg-[#2070e6] px-2 py-1 text-xs font-medium text-white shadow-[0_4px_4px_-2px_rgba(0,0,0,0.02),0_2px_2px_-1px_rgba(0,0,0,0.02),0_0_0_1px_rgba(16,96,214,0.6)] hover:bg-[#1a5fcc]'
                        : 'inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-medium text-ink shadow-[0_4px_4px_-2px_rgba(0,0,0,0.02),0_2px_2px_-1px_rgba(0,0,0,0.02),0_0_0_1px_rgba(0,0,0,0.08)] hover:bg-[#fafafa]'
                    }
                  >
                    <PencilLine className="size-3.5" aria-hidden />
                    Edit
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    aria-label="Edit unavailable"
                    title="Edit unavailable in this context"
                    className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-medium text-[#a6a6a6] shadow-[0_4px_4px_-2px_rgba(0,0,0,0.02),0_2px_2px_-1px_rgba(0,0,0,0.02),0_0_0_1px_rgba(0,0,0,0.08)]"
                  >
                    <PencilLine className="size-3.5" aria-hidden />
                    Edit
                  </button>
                )}
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
                            aria-label={`Add ${annotation.summary} to chat context`}
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
            {!annotateMode && spanHint ? (
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
            <div className="flex flex-col gap-2 rounded-md bg-white p-3 shadow-[0_4px_4px_-2px_rgba(0,0,0,0.02),0_2px_2px_-1px_rgba(0,0,0,0.02),0_0_0_1px_rgba(0,0,0,0.08)]">
              <textarea
                ref={messageInputRef}
                aria-label="Message"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder="Ask me anything..."
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
                {savedToastVisible && !isApplying && stagedPatches.length === 0 && canUndo ? (
                  <div
                    role="status"
                    aria-label="Change saved"
                    className="pointer-events-none absolute top-1/2 right-9 left-9 flex h-6 -translate-y-1/2 items-center justify-between gap-2 rounded-md bg-wash/40 px-2 text-xs"
                  >
                    <span className="inline-flex items-center gap-1 font-medium text-ink">
                      <Check className="size-3" aria-hidden />
                      Change saved
                    </span>
                    {onUndo ? (
                      <button
                        type="button"
                        onClick={onUndo}
                        className="pointer-events-auto rounded-md bg-white px-2 py-0.5 text-xs text-ink shadow-[0_4px_4px_-2px_rgba(0,0,0,0.02),0_2px_2px_-1px_rgba(0,0,0,0.02),0_0_0_1px_rgba(0,0,0,0.08)] hover:bg-[#fafafa]"
                      >
                        Undo
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </>
        )}

        <div className="absolute top-3 right-3 flex items-center gap-0.5">
          <button
            type="button"
            aria-label={layout === 'docked' ? 'Float side-chat' : 'Dock side-chat to right'}
            title={layout === 'docked' ? 'Float' : 'Dock to right'}
            onClick={() => onLayoutChange?.(layout === 'docked' ? 'floating' : 'docked')}
            className="flex size-6 items-center justify-center rounded-md text-hint hover:bg-[rgba(0,0,0,0.04)] hover:text-ink focus-visible:ring-2 focus-visible:ring-foreground/30"
          >
            {layout === 'docked' ? (
              <PictureInPicture2 className="size-3.5" aria-hidden />
            ) : (
              <PanelRight className="size-3.5" aria-hidden />
            )}
          </button>
          <button
            type="button"
            aria-label="Close side-chat"
            onClick={onDismiss}
            className="flex size-6 items-center justify-center rounded-md text-hint hover:bg-[rgba(0,0,0,0.04)] hover:text-ink focus-visible:ring-2 focus-visible:ring-foreground/30"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}
