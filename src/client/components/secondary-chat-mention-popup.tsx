import { useEffect, useMemo, useRef, type KeyboardEvent } from 'react';

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/client/components/ui/command';
import { cn } from '@/client/lib/utils';

/**
 * One mentionable knowledge item, surfaced to `<SecondaryChatMentionPopup>`.
 * Sourced from `useSpecificationEntities()` in the host; the popup itself is
 * presentational so tests can drive it with synthetic items.
 */
export interface MentionItem {
  refCode: string;
  kind: string;
  content: string;
}

/**
 * Extracts the active mention query from the textarea value + cursor position.
 * Returns the substring between the most recent `#` before the cursor and the
 * cursor itself, or null when no mention is currently being typed.
 *
 * Rules (V1):
 * - The `#` must be preceded by start-of-string or whitespace (mid-word `#`
 *   is treated as literal text — e.g. markdown headings on a fresh line are
 *   still candidates, but `abc#R1` is not).
 * - Whitespace or another `#` between the `#` and the cursor closes the
 *   mention (so the popup hides as soon as the user types a space).
 */
export function computeMentionQuery(value: string, cursor: number): string | null {
  if (cursor < 1) return null;
  const before = value.slice(0, cursor);
  const hashIndex = before.lastIndexOf('#');
  if (hashIndex < 0) return null;
  // Anchor must be at start or after whitespace.
  if (hashIndex > 0 && !/\s/.test(before.charAt(hashIndex - 1))) return null;
  const slice = before.slice(hashIndex + 1);
  // Whitespace closes the mention.
  if (/\s/.test(slice)) return null;
  return slice;
}

/**
 * Replaces the active `#query` with `#refCode ` in the textarea value.
 * Returns the new value + new cursor position (positioned after the inserted
 * space so the user can keep typing the next token).
 */
export function insertMention(
  value: string,
  cursor: number,
  refCode: string,
): { value: string; cursor: number } {
  const before = value.slice(0, cursor);
  const after = value.slice(cursor);
  const hashIndex = before.lastIndexOf('#');
  if (hashIndex < 0) return { value, cursor };
  const head = before.slice(0, hashIndex);
  const insertion = `#${refCode} `;
  const next = `${head}${insertion}${after}`;
  return { value: next, cursor: head.length + insertion.length };
}

export interface SecondaryChatMentionPopupProps {
  query: string;
  items: readonly MentionItem[];
  onPick: (item: MentionItem) => void;
  onDismiss: () => void;
}

const MAX_RESULTS = 8;

export function SecondaryChatMentionPopup({
  query,
  items,
  onPick,
  onDismiss,
}: SecondaryChatMentionPopupProps) {
  const popupRef = useRef<HTMLDivElement | null>(null);

  const filtered = useMemo(() => {
    const lowered = query.toLowerCase();
    return items.filter((item) => item.refCode.toLowerCase().startsWith(lowered)).slice(0, MAX_RESULTS);
  }, [items, query]);

  // ArrowDown/ArrowUp navigation lives on the textarea via the parent
  // composer; cmdk's `Command` listens to its own keydowns when focused, but
  // since focus stays in the textarea we intercept here from the parent.
  // Esc -> dismiss; click -> pick.

  // Dismiss on outside click.
  useEffect(() => {
    function onDocumentMouseDown(event: MouseEvent) {
      const target = event.target as Node;
      if (popupRef.current && !popupRef.current.contains(target)) onDismiss();
    }
    document.addEventListener('mousedown', onDocumentMouseDown);
    return () => document.removeEventListener('mousedown', onDocumentMouseDown);
  }, [onDismiss]);

  return (
    <div
      ref={popupRef}
      data-testid="secondary-chat-mention-popup"
      data-query={query}
      className={cn('absolute z-50 mt-1 w-72 rounded-md border border-rule bg-background p-1 shadow-md')}
    >
      <Command shouldFilter={false}>
        <CommandList>
          <CommandEmpty>No matching items</CommandEmpty>
          <CommandGroup>
            {filtered.map((item) => (
              <CommandItem
                key={item.refCode}
                data-testid="secondary-chat-mention-item"
                data-ref-code={item.refCode}
                value={item.refCode}
                onSelect={() => onPick(item)}
              >
                <span className="font-mono text-xs text-hint">{item.refCode}</span>
                <span className="ml-2 truncate text-foreground">{item.content}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  );
}

/**
 * Convenience: intercept Esc / Enter on the textarea while the popup is open.
 * Returns true when the event was consumed (caller should not run its own
 * keydown logic).
 */
export function handleMentionPopupKey(
  event: KeyboardEvent<HTMLTextAreaElement>,
  query: string | null,
  filteredFirst: MentionItem | undefined,
  onPick: (item: MentionItem) => void,
  onDismiss: () => void,
): boolean {
  if (query === null) return false;
  if (event.key === 'Escape') {
    event.preventDefault();
    onDismiss();
    return true;
  }
  if (event.key === 'Enter' && filteredFirst) {
    event.preventDefault();
    onPick(filteredFirst);
    return true;
  }
  return false;
}
