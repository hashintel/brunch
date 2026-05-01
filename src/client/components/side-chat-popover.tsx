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

export interface SideChatPopoverProps {
  pinnedItem: SideChatPinnedItem;
  onDismiss: () => void;
  messages?: readonly SideChatMessage[];
  onSubmit?: (message: string) => void;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function SideChatPopover({ pinnedItem, onDismiss, messages = [], onSubmit }: SideChatPopoverProps) {
  const [draft, setDraft] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messageInputRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onDismiss();
      }
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onDismiss]);

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

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-label="Side-chat"
      data-side-chat-anchor="top-right"
      onKeyDown={handleTabTrap}
      className="fixed top-4 right-4 z-50 flex max-h-[calc(100vh-2rem)] w-[360px] flex-col gap-3 rounded-2xl border border-rule bg-background/95 p-3 shadow-xl ring-1 ring-foreground/5 backdrop-blur-md"
    >
      <header className="flex items-baseline gap-2 border-b border-rule pb-2">
        <span className="inline-flex shrink-0 items-center rounded bg-wash px-1.5 py-0.5 font-mono text-xs font-medium text-ink">
          {pinnedItem.referenceCode}
        </span>
        <p className="text-sm text-ink">{pinnedItem.content}</p>
      </header>
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
          className="inline-flex items-center justify-center rounded-md bg-foreground px-3 py-1 text-xs font-medium text-background disabled:opacity-40"
        >
          Send
        </button>
      </div>
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
