import { ArrowUp, Mic, NotebookPen, PanelRight, PencilLine, PictureInPicture2, Plus } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

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

import type { KnowledgeKind } from '@/shared/knowledge.js';

import { kindAccentHex } from './knowledge-card';

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
  kind: 'annotate';
  summary: string;
}

export interface SideChatExistingAnnotation {
  id: number;
  summary: string;
  body: string;
}

export interface SideChatPopoverProps {
  pinnedItem: SideChatPinnedItem;
  onDismiss: () => void;
  messages?: readonly SideChatMessage[];
  onSubmit?: (message: string) => void;
  // ---- Annotate (Card C) ----
  annotateMode?: boolean;
  onAnnotateRequest?: () => void;
  onAnnotateCancel?: () => void;
  onAnnotateSubmit?: (summary: string, body: string) => void;
  // ---- Inline patch list (Card C, secondary surface per design §4) ----
  stagedPatches?: readonly SideChatStagedPatchSummary[];
  canUndo?: boolean;
  isApplying?: boolean;
  onApply?: () => void;
  onUndo?: () => void;
  onDiscardPatch?: (id: string) => void;
  // ---- Existing annotations on the pinned item ----
  existingAnnotations?: readonly SideChatExistingAnnotation[];
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const LAYOUT_STORAGE_KEY = 'brunch.side-chat.layout';

export function SideChatPopover({
  pinnedItem,
  onDismiss,
  messages = [],
  onSubmit,
  annotateMode = false,
  onAnnotateRequest,
  onAnnotateCancel,
  onAnnotateSubmit,
  stagedPatches = [],
  canUndo = false,
  isApplying = false,
  onApply,
  onUndo,
  onDiscardPatch,
  existingAnnotations = [],
}: SideChatPopoverProps) {
  const [draft, setDraft] = useState('');
  const [annotateSummary, setAnnotateSummary] = useState('');
  const [annotateBody, setAnnotateBody] = useState('');
  const [notesOpen, setNotesOpen] = useState(false);
  const [layout, setLayout] = useState<'docked' | 'floating'>(() => {
    if (typeof window === 'undefined') return 'docked';
    const stored = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
    return stored === 'floating' ? 'floating' : 'docked';
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(LAYOUT_STORAGE_KEY, layout);
  }, [layout]);
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

  function handleTabTrap(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Tab' || !containerRef.current) {
      return;
    }
    const focusables = containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    if (focusables.length === 0) {
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  const trimmedDraft = draft.trim();
  const isStreaming = messages.some((message) => message.pending === true);
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
        onKeyDown={handleTabTrap}
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
          {messages.map((message, index) => (
            <MessageBubble key={index} message={message} />
          ))}
        </ul>

        {isApplying ? (
          <div role="status" className="text-xs text-hint">
            Saving annotation…
          </div>
        ) : null}

        {!isApplying && stagedPatches.length === 0 && canUndo ? (
          <div
            role="status"
            aria-label="Annotation saved"
            className="flex items-center justify-between rounded-md bg-wash/40 px-2 py-1.5 text-xs"
          >
            <span className="font-medium text-ink">✓ Annotation saved</span>
            {onUndo ? (
              <button
                type="button"
                onClick={onUndo}
                className="rounded-md bg-white px-2 py-0.5 text-xs text-ink shadow-[0_4px_4px_-2px_rgba(0,0,0,0.02),0_2px_2px_-1px_rgba(0,0,0,0.02),0_0_0_1px_rgba(0,0,0,0.08)] hover:bg-[#fafafa]"
              >
                Undo
              </button>
            ) : null}
          </div>
        ) : null}

        {!isApplying && stagedPatches.length > 0 ? (
          <section
            aria-label="Staged annotations"
            data-staged-patch-count={stagedPatches.length}
            className="flex flex-col gap-1.5 rounded-md bg-wash/60 p-2 text-xs text-ink"
          >
            <header className="flex items-center justify-between">
              <span className="font-medium">
                {stagedPatches.length} pending annotation{stagedPatches.length === 1 ? '' : 's'} (retry?)
              </span>
            </header>
            <ul className="flex flex-col gap-1">
              {stagedPatches.map((patch) => (
                <li
                  key={patch.id}
                  data-staged-patch-id={patch.id}
                  className="flex items-center gap-2 rounded bg-background px-2 py-1"
                >
                  <span className="flex-1 truncate" title={patch.summary}>
                    {patch.summary}
                  </span>
                  {onDiscardPatch ? (
                    <button
                      type="button"
                      aria-label={`Discard staged annotation: ${patch.summary}`}
                      onClick={() => onDiscardPatch(patch.id)}
                      className="text-hint hover:text-ink"
                    >
                      ×
                    </button>
                  ) : null}
                </li>
              ))}
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
                  Retry
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
                <button
                  type="button"
                  disabled
                  aria-label="Edit (coming in V2)"
                  title="Edit — coming in V2"
                  className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-medium text-[#a6a6a6] shadow-[0_4px_4px_-2px_rgba(0,0,0,0.02),0_2px_2px_-1px_rgba(0,0,0,0.02),0_0_0_1px_rgba(0,0,0,0.08)]"
                >
                  <PencilLine className="size-3.5" aria-hidden />
                  Edit
                </button>
              </div>
              {notesOpen && existingAnnotations.length > 0 ? (
                <div className="absolute right-0 bottom-full left-0 mb-2">
                  <ul className="scrollbar-thin flex max-h-64 flex-col divide-y divide-[rgba(0,0,0,0.06)] overflow-y-auto rounded-md bg-white px-2 shadow-[0_8px_16px_-4px_rgba(0,0,0,0.08),0_4px_8px_-2px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.08)]">
                    {existingAnnotations.map((annotation) => {
                      const hasBody = annotation.body && annotation.body !== annotation.summary;
                      return (
                        <li
                          key={annotation.id}
                          data-annotation-id={annotation.id}
                          className="overflow-hidden text-xs text-ink"
                        >
                          {hasBody ? (
                            <details className="group/note">
                              <summary className="flex cursor-pointer list-none items-center gap-1 py-1.5 font-medium hover:text-ink">
                                <span className="text-hint transition-transform group-open/note:rotate-90">
                                  ›
                                </span>
                                <span className="flex-1">{annotation.summary}</span>
                              </summary>
                              <div className="pb-1.5 pl-3 text-sub">{annotation.body}</div>
                            </details>
                          ) : (
                            <div className="py-1.5 font-medium">{annotation.summary}</div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
            </div>
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
              <div className="flex items-center justify-between">
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
                  <button
                    type="button"
                    disabled
                    aria-label="Voice (coming soon)"
                    title="Voice — coming soon"
                    className="inline-flex size-7 items-center justify-center rounded-md text-[#a6a6a6] disabled:opacity-60"
                  >
                    <Mic className="size-4" aria-hidden />
                  </button>
                </div>
                <button
                  type="button"
                  aria-label="Send message"
                  disabled={sendDisabled}
                  onClick={submit}
                  className="inline-flex size-7 items-center justify-center rounded-md bg-[#202020] text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_0_0_1px_#101010] transition-transform duration-150 hover:enabled:scale-105 disabled:bg-[#e3e3e3] disabled:text-[#a6a6a6] disabled:shadow-none"
                >
                  <ArrowUp className="size-4" strokeWidth={2.5} aria-hidden />
                </button>
              </div>
            </div>
          </>
        )}

        <div className="absolute top-3 right-3 flex items-center gap-0.5">
          <button
            type="button"
            aria-label={layout === 'docked' ? 'Float side-chat' : 'Dock side-chat to right'}
            title={layout === 'docked' ? 'Float' : 'Dock to right'}
            onClick={() => setLayout((mode) => (mode === 'docked' ? 'floating' : 'docked'))}
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
