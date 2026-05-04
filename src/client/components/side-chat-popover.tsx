import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

export interface SideChatPinnedItem {
  referenceCode: string;
  content: string;
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

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onDismiss();
      }
    }
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [onDismiss]);

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

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-label="Side-chat"
      data-side-chat-anchor="top-right"
      onKeyDown={handleTabTrap}
      className="fixed top-4 right-4 z-50 flex max-h-[calc(100vh-2rem)] w-[360px] flex-col gap-3 rounded-2xl border-[1.5px] border-[#5424ff]/55 bg-white/70 p-3 shadow-xl backdrop-blur-md before:pointer-events-none before:absolute before:-inset-3 before:-z-10 before:rounded-3xl before:bg-[linear-gradient(90deg,#5424ff,#fdb975,#fe5dd3,#ff00ae)] before:opacity-25 before:blur-xl before:content-['']"
    >
      <header className="flex items-start gap-2 border-b border-rule pb-2">
        <span className="inline-flex shrink-0 items-center rounded-[4px] bg-[rgba(0,0,0,0.03)] px-1.5 py-0.5 font-mono text-xs font-medium text-ink">
          {pinnedItem.referenceCode}
        </span>
        <p className="flex-1 text-sm text-ink">{pinnedItem.content}</p>
        {onAnnotateRequest ? (
          <button
            type="button"
            aria-label="Annotate item"
            disabled={annotateButtonDisabled}
            onClick={onAnnotateRequest}
            className="inline-flex shrink-0 items-center rounded-md bg-wash px-2 py-0.5 text-xs font-medium text-[#a6a6a6] hover:text-ink disabled:opacity-40"
          >
            Annotate
          </button>
        ) : null}
      </header>

      {existingAnnotations.length > 0 ? (
        <details aria-label="Existing notes on this item" className="group/notes" open>
          <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-sub hover:text-ink">
            <span className="text-hint transition-transform group-open/notes:rotate-90">›</span>
            <span>Notes ({existingAnnotations.length})</span>
          </summary>
          <ul className="mt-1 flex flex-col gap-1">
            {existingAnnotations.map((annotation) => {
              const hasBody = annotation.body && annotation.body !== annotation.summary;
              return (
                <li
                  key={annotation.id}
                  data-annotation-id={annotation.id}
                  className="overflow-hidden rounded bg-wash/60 text-xs text-ink"
                >
                  {hasBody ? (
                    <details className="group/note">
                      <summary className="flex cursor-pointer list-none items-center gap-1 px-2 py-1 font-medium hover:bg-wash">
                        <span className="text-hint transition-transform group-open/note:rotate-90">›</span>
                        <span className="flex-1">{annotation.summary}</span>
                      </summary>
                      <div className="border-t border-rule px-2 py-1 text-sub">{annotation.body}</div>
                    </details>
                  ) : (
                    <div className="px-2 py-1 font-medium">{annotation.summary}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </details>
      ) : null}

      <ul role="log" aria-label="Side-chat messages" className="flex flex-1 flex-col gap-2 overflow-y-auto">
        {messages.map((message, index) => {
          const baseClass = message.error
            ? 'max-w-[85%] rounded-lg bg-red-50 px-3 py-1.5 text-sm text-red-900 ring-1 ring-red-200'
            : message.role === 'user'
              ? 'self-end max-w-[85%] rounded-lg bg-wash px-3 py-1.5 text-sm text-ink'
              : 'max-w-[85%] rounded-lg px-3 py-1.5 text-sm text-ink';
          return (
            <li
              key={index}
              data-message-role={message.role}
              data-message-pending={message.pending ? 'true' : undefined}
              data-message-error={message.error ? 'true' : undefined}
              className={baseClass}
            >
              {message.text}
            </li>
          );
        })}
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
              className="rounded-md bg-wash px-2 py-0.5 text-xs text-[#a6a6a6] hover:text-ink"
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
              {stagedPatches.length} pending annotation{stagedPatches.length === 1 ? '' : 's'}
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
                className="rounded-md bg-wash px-2 py-0.5 text-xs text-[#a6a6a6] hover:text-ink"
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
          className="flex flex-col gap-2 rounded-md border border-rule p-2"
        >
          <input
            ref={annotateSummaryRef}
            aria-label="Annotation summary"
            placeholder="Summary"
            value={annotateSummary}
            onChange={(event) => setAnnotateSummary(event.target.value)}
            className="rounded-md border border-rule bg-background px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-foreground/30"
          />
          <textarea
            aria-label="Annotation body"
            placeholder="Note body"
            value={annotateBody}
            onChange={(event) => setAnnotateBody(event.target.value)}
            className="min-h-16 resize-none rounded-md border border-rule bg-background px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-foreground/30"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onAnnotateCancel}
              className="rounded-md bg-wash px-3 py-1 text-xs text-[#a6a6a6] hover:text-ink"
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
          <textarea
            ref={messageInputRef}
            aria-label="Message"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleInputKeyDown}
            className="min-h-12 resize-none rounded-md border border-rule bg-background px-2 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-foreground/30"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={sendDisabled}
              onClick={submit}
              className="inline-flex items-center justify-center rounded-md bg-[linear-gradient(180deg,#3484fa,#2070e6)] px-3 py-1 text-xs font-medium text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_1px_2px_rgba(0,0,0,0.1)] ring-1 ring-[#1060d6] disabled:opacity-40"
            >
              Send
            </button>
          </div>
        </>
      )}

      <button
        type="button"
        aria-label="Close side-chat"
        onClick={onDismiss}
        className="absolute top-2 right-2 flex size-6 items-center justify-center rounded text-hint hover:bg-wash hover:text-ink focus-visible:ring-2 focus-visible:ring-foreground/30"
      >
        ×
      </button>
    </div>
  );
}
