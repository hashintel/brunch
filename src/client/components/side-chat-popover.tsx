import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

export interface SideChatPinnedItem {
  referenceCode: string;
  content: string;
}

export interface SideChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

export interface SideChatPopoverProps {
  pinnedItem: SideChatPinnedItem;
  onDismiss: () => void;
  messages?: readonly SideChatMessage[];
  pendingAssistantText?: string | null;
  onSubmit?: (message: string) => void;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function SideChatPopover({
  pinnedItem,
  onDismiss,
  messages = [],
  pendingAssistantText = null,
  onSubmit,
}: SideChatPopoverProps) {
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
  const isStreaming = pendingAssistantText !== null;
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
    <div ref={containerRef} role="dialog" aria-label="Side-chat" onKeyDown={handleTabTrap}>
      <header>
        <span>{pinnedItem.referenceCode}</span>
        <p>{pinnedItem.content}</p>
      </header>
      <ul role="log" aria-label="Side-chat messages">
        {messages.map((message, index) => (
          <li key={index} data-message-role={message.role}>
            {message.text}
          </li>
        ))}
        {isStreaming && (
          <li data-message-role="assistant" data-message-pending="true">
            {pendingAssistantText ?? ''}
          </li>
        )}
      </ul>
      <textarea
        ref={messageInputRef}
        aria-label="Message"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleInputKeyDown}
      />
      <button type="button" disabled={sendDisabled} onClick={submit}>
        Send
      </button>
      <button type="button" aria-label="Close side-chat" onClick={onDismiss}>
        ×
      </button>
    </div>
  );
}
