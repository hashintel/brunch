import { useEffect, useMemo, useRef, type KeyboardEvent } from 'react';

import { kindColor } from '@/client/components/knowledge-card';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/client/components/ui/command';
import { cn } from '@/client/lib/utils';
import type { KnowledgeKind } from '@/shared/knowledge.js';

const KNOWLEDGE_KIND_KEYS: ReadonlySet<KnowledgeKind> = new Set([
  'goal',
  'term',
  'context',
  'constraint',
  'assumption',
  'decision',
  'requirement',
  'criterion',
]);

function asKnowledgeKind(kind: string): KnowledgeKind | null {
  return KNOWLEDGE_KIND_KEYS.has(kind as KnowledgeKind) ? (kind as KnowledgeKind) : null;
}

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
 * Rules:
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
  /** RefCode of the currently highlighted item — drives cmdk's data-selected. */
  activeRefCode: string | null;
  onPick: (item: MentionItem) => void;
  onDismiss: () => void;
}

// Cap is generous so the list relies on its own scroll rather than truncating
// silently — keeps long collections discoverable.
const MAX_RESULTS = 50;

export function SecondaryChatMentionPopup({
  query,
  items,
  activeRefCode,
  onPick,
  onDismiss,
}: SecondaryChatMentionPopupProps) {
  const popupRef = useRef<HTMLDivElement | null>(null);

  const filtered = useMemo(() => {
    const lowered = query.toLowerCase();
    return items.filter((item) => item.refCode.toLowerCase().startsWith(lowered)).slice(0, MAX_RESULTS);
  }, [items, query]);

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
      className={cn(
        'absolute bottom-full z-50 mb-2 w-[22rem] overflow-hidden rounded-xl border border-rule bg-popover text-popover-foreground shadow-card-ring',
      )}
      // Keep the textarea focused when picking with a mouse — without this the
      // mousedown blurs the textarea before onSelect fires, which can cause the
      // outside-click dismiss to race the pick.
      onMouseDown={(event) => event.preventDefault()}
    >
      <div className="flex items-center justify-between border-b border-rule/70 px-3 py-1.5 text-[10px] font-medium tracking-wide text-hint uppercase">
        <span>Mention</span>
        <span className="font-mono tracking-normal normal-case">
          {query.length === 0 ? '#…' : `#${query}`}
        </span>
      </div>
      <Command
        shouldFilter={false}
        // Controlled selection — keyboard handler in the composer drives this.
        value={activeRefCode ?? undefined}
        className="bg-transparent p-0"
      >
        <CommandList className="max-h-64 overflow-y-auto overscroll-contain p-1">
          <CommandEmpty className="px-3 py-6 text-center text-xs text-hint">No matching items</CommandEmpty>
          <CommandGroup className="p-0">
            {filtered.map((item) => {
              const knownKind = asKnowledgeKind(item.kind);
              const badgeClass = knownKind ? kindColor[knownKind] : 'bg-wash text-sub';
              return (
                <CommandItem
                  key={item.refCode}
                  data-testid="secondary-chat-mention-item"
                  data-ref-code={item.refCode}
                  value={item.refCode}
                  onSelect={() => onPick(item)}
                  // Fire on mousedown so the click registers before the textarea
                  // blur dismiss path; pair with the wrapper's preventDefault.
                  onMouseDown={(event) => {
                    event.preventDefault();
                    onPick(item);
                  }}
                  className="cursor-pointer gap-2 rounded-md px-2 py-1.5 data-selected:bg-wash data-selected:text-ink"
                >
                  <span
                    className={cn(
                      'inline-flex h-5 min-w-[2.25rem] items-center justify-center rounded-sm px-1.5 font-mono text-[10px] leading-none font-medium tracking-wide',
                      badgeClass,
                    )}
                  >
                    {item.refCode}
                  </span>
                  <span className="flex-1 truncate text-sm text-ink">{item.content}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  );
}

/**
 * Intercept popup-relevant keys on the textarea while the popup is open.
 *
 * - ArrowUp / ArrowDown move the highlight (wrapping at the ends).
 * - Enter picks the currently highlighted item.
 * - Escape dismisses the popup.
 *
 * Returns true when the event was consumed (caller should not run its own
 * keydown logic).
 */
export function handleMentionPopupKey(
  event: KeyboardEvent<HTMLTextAreaElement>,
  query: string | null,
  filtered: readonly MentionItem[],
  highlightedIndex: number,
  setHighlightedIndex: (index: number) => void,
  onPick: (item: MentionItem) => void,
  onDismiss: () => void,
): boolean {
  if (query === null) return false;
  if (event.key === 'Escape') {
    event.preventDefault();
    onDismiss();
    return true;
  }
  if (filtered.length === 0) return false;
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    setHighlightedIndex((highlightedIndex + 1) % filtered.length);
    return true;
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault();
    setHighlightedIndex((highlightedIndex - 1 + filtered.length) % filtered.length);
    return true;
  }
  if (event.key === 'Enter') {
    const target = filtered[highlightedIndex] ?? filtered[0];
    if (!target) return false;
    event.preventDefault();
    onPick(target);
    return true;
  }
  return false;
}
