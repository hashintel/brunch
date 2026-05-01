import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

export interface SideChatPinnedItem {
  referenceCode: string;
  content: string;
}

export interface SideChatPopoverProps {
  pinnedItem: SideChatPinnedItem;
  onDismiss: () => void;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function SideChatPopover({ pinnedItem, onDismiss }: SideChatPopoverProps) {
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

  const sendDisabled = draft.trim().length === 0;

  return (
    <div ref={containerRef} role="dialog" aria-label="Side-chat" onKeyDown={handleTabTrap}>
      <header>
        <span>{pinnedItem.referenceCode}</span>
        <p>{pinnedItem.content}</p>
      </header>
      <ul role="log" aria-label="Side-chat messages" />
      <textarea
        ref={messageInputRef}
        aria-label="Message"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
      <button type="button" disabled={sendDisabled}>
        Send
      </button>
      <button type="button" aria-label="Close side-chat" onClick={onDismiss}>
        ×
      </button>
    </div>
  );
}
