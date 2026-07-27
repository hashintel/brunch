import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';

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
  /**
   * The element the popup anchors against (usually the composer textarea).
   * Position is computed from its viewport rect; the popup is rendered via a
   * portal at `document.body` so no ancestor `overflow:hidden` or stacking
   * context can clip it.
   */
  anchorRef: RefObject<HTMLElement | null>;
  onPick: (item: MentionItem) => void;
  onDismiss: () => void;
}

// Cap is generous so the list relies on its own scroll rather than truncating
// silently — keeps long collections discoverable.
const MAX_RESULTS = 50;

// Gap between the popup and its anchor on either placement (px).
const POPUP_ANCHOR_GAP = 6;
// Minimum vertical breathing room before the popup chooses to flip — keeps it
// from hugging the viewport edge.
const POPUP_VIEWPORT_MARGIN = 8;
// Lower bound on the visible popup height so it stays scrollable even when
// the chosen placement is tight; the list itself scrolls inside.
const POPUP_MIN_HEIGHT = 140;
// Soft cap so the popup doesn't grow past the natural list height.
const POPUP_MAX_HEIGHT = 320;
const POPUP_WIDTH = 352; // matches w-[22rem]

interface PopupPosition {
  /** Either `top` (below placement) or `bottom` (above placement). */
  top?: number;
  bottom?: number;
  left: number;
  maxHeight: number;
  placement: 'above' | 'below';
}

function computePopupPosition(anchor: HTMLElement): PopupPosition {
  const rect = anchor.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;
  const spaceAbove = rect.top - POPUP_VIEWPORT_MARGIN;
  const spaceBelow = viewportHeight - rect.bottom - POPUP_VIEWPORT_MARGIN;
  // Prefer placing the popup above the input (chat composer convention), but
  // flip below when there's noticeably more room there — keeps the popup
  // fully visible when the chat shell sits near the top of the screen.
  const preferAbove = spaceAbove >= POPUP_MIN_HEIGHT + POPUP_ANCHOR_GAP || spaceAbove >= spaceBelow;
  const placement: 'above' | 'below' = preferAbove ? 'above' : 'below';
  const availableHeight = (placement === 'above' ? spaceAbove : spaceBelow) - POPUP_ANCHOR_GAP;
  const maxHeight = Math.max(POPUP_MIN_HEIGHT, Math.min(POPUP_MAX_HEIGHT, availableHeight));
  // Keep the popup horizontally inside the viewport even on narrow widths.
  const left = Math.max(
    POPUP_VIEWPORT_MARGIN,
    Math.min(rect.left, viewportWidth - POPUP_WIDTH - POPUP_VIEWPORT_MARGIN),
  );
  // For 'above', anchor by `bottom` instead of `top`. This pins the popup's
  // bottom edge a constant gap above the textarea, so the popup hugs the
  // input regardless of how few items it ends up rendering. Previously we
  // pre-allocated `maxHeight` worth of space above the textarea, which made
  // short popups (e.g. one filtered match) float far above the composer with
  // a big visible gap.
  if (placement === 'above') {
    const bottom = Math.max(POPUP_VIEWPORT_MARGIN, viewportHeight - rect.top + POPUP_ANCHOR_GAP);
    return { bottom, left, maxHeight, placement };
  }
  const top = Math.min(viewportHeight - POPUP_VIEWPORT_MARGIN - maxHeight, rect.bottom + POPUP_ANCHOR_GAP);
  return { top, left, maxHeight, placement };
}

export function SecondaryChatMentionPopup({
  query,
  items,
  activeRefCode,
  anchorRef,
  onPick,
  onDismiss,
}: SecondaryChatMentionPopupProps) {
  const popupRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<PopupPosition | null>(null);

  const filtered = useMemo(() => {
    const lowered = query.toLowerCase();
    return items.filter((item) => item.refCode.toLowerCase().startsWith(lowered)).slice(0, MAX_RESULTS);
  }, [items, query]);

  // Recompute position whenever the anchor moves (scroll, resize, layout
  // shifts from the chat surface). `useLayoutEffect` ensures the popup is
  // painted at the right place on the very first frame instead of jumping.
  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const update = () => setPosition(computePopupPosition(anchor));
    update();
    // `capture: true` so we catch scroll events from any ancestor (the chat
    // shell body is the actual scroll container, not window).
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [anchorRef, query, filtered.length]);

  useEffect(() => {
    function onDocumentMouseDown(event: MouseEvent) {
      const target = event.target as Node;
      if (popupRef.current && !popupRef.current.contains(target)) onDismiss();
    }
    document.addEventListener('mousedown', onDocumentMouseDown);
    return () => document.removeEventListener('mousedown', onDocumentMouseDown);
  }, [onDismiss]);

  if (typeof document === 'undefined') return null;

  const popupNode = (
    <div
      ref={popupRef}
      data-testid="secondary-chat-mention-popup"
      data-query={query}
      data-placement={position?.placement ?? 'above'}
      className={cn(
        'fixed z-[60] flex flex-col overflow-hidden rounded-xl border border-rule bg-popover text-popover-foreground shadow-card-ring',
      )}
      style={{
        // Pin by `bottom` for above-placement so the popup hugs the
        // textarea regardless of its rendered height. Otherwise pin by
        // `top` (below-placement).
        top: position?.placement === 'below' ? position.top : undefined,
        bottom: position?.placement === 'above' ? position.bottom : undefined,
        left: position?.left ?? -9999,
        width: POPUP_WIDTH,
        maxHeight: position?.maxHeight ?? POPUP_MAX_HEIGHT,
        // Until the position is computed, keep the popup invisible so it
        // doesn't flash at the document origin.
        visibility: position ? 'visible' : 'hidden',
      }}
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
        className="flex min-h-0 flex-1 flex-col bg-transparent p-0"
      >
        <CommandList className="flex-1 overflow-y-auto overscroll-contain p-1">
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

  // Portal to document.body so no ancestor `overflow:hidden`/`overflow-y:auto`
  // or stacking context can clip the popup — the chat-shell body scrolls and
  // would otherwise hide the popup when it extends above the input.
  return createPortal(popupNode, document.body);
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
