// DiffPopover — anchored, viewport-aware popover that renders a <ContentDiff>
// (Card 4 / Figma alignment). Used by:
//
//   - side-chat-popover.tsx staged-patches strip → "↗ view diff" chip per row.
//   - pending-review-section.tsx → "↗ view source diff" chip per row.
//
// Renders into a portal on document.body so the popover escapes the side-chat
// dialog's transformed/clipped ancestors. Anchors near the chip: prefers BELOW
// the anchor (so the chip stays in view) and only flips ABOVE when there isn't
// room. Horizontally aligns the popover's right edge with the anchor's right
// edge so the chip-to-popover relationship reads as one element. Click-outside
// and ESC close. v1 is read-only; slice 7 can extend with a `footer?` slot.

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { ContentDiff } from './content-diff.js';

const DEFAULT_ACCENT = '#5424ff';

export interface DiffPopoverProps {
  open: boolean;
  onClose: () => void;
  anchor: HTMLElement | null;
  before: string;
  after: string;
  title: string;
  kindChip?: ReactNode;
  kindAccent?: string | null;
}

interface ComputedPosition {
  top: number;
  left: number;
  placement: 'above' | 'below';
}

const POPOVER_MAX_WIDTH = 480;
const POPOVER_GAP = 6;
const VIEWPORT_MARGIN = 8;

function computePosition(anchor: HTMLElement, popoverHeight: number): ComputedPosition {
  const rect = anchor.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;
  const spaceBelow = viewportHeight - rect.bottom;
  const spaceAbove = rect.top;
  // Prefer below: keeps the chip visible while reading. Flip above only when
  // below truly doesn't fit and above does.
  const fitsBelow = spaceBelow >= popoverHeight + POPOVER_GAP + VIEWPORT_MARGIN;
  const fitsAbove = spaceAbove >= popoverHeight + POPOVER_GAP + VIEWPORT_MARGIN;
  const placement: 'above' | 'below' = fitsBelow || !fitsAbove ? 'below' : 'above';
  const top =
    placement === 'below'
      ? Math.min(viewportHeight - popoverHeight - VIEWPORT_MARGIN, rect.bottom + POPOVER_GAP)
      : Math.max(VIEWPORT_MARGIN, rect.top - popoverHeight - POPOVER_GAP);
  // Right-align with the anchor; clamp into viewport on either side.
  const idealLeft = rect.right - POPOVER_MAX_WIDTH;
  const left = Math.max(
    VIEWPORT_MARGIN,
    Math.min(viewportWidth - POPOVER_MAX_WIDTH - VIEWPORT_MARGIN, idealLeft),
  );
  return { top, left, placement };
}

export function DiffPopover({
  open,
  onClose,
  anchor,
  before,
  after,
  title,
  kindChip,
  kindAccent,
}: DiffPopoverProps): React.ReactElement | null {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<ComputedPosition | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Initial measurement uses an estimated height. The layout effect below
  // re-measures once the popover is in the DOM with real content and updates
  // the position before the user can perceive a flash.
  useEffect(() => {
    if (!open || !anchor) {
      setPosition(null);
      return;
    }
    setPosition(computePosition(anchor, 160));
  }, [open, anchor]);

  useLayoutEffect(() => {
    if (!open || !anchor || !popoverRef.current) return;
    const measured = popoverRef.current.getBoundingClientRect();
    const next = computePosition(anchor, measured.height);
    setPosition((prev) => {
      if (
        prev &&
        Math.abs(prev.top - next.top) < 1 &&
        Math.abs(prev.left - next.left) < 1 &&
        prev.placement === next.placement
      ) {
        return prev;
      }
      return next;
    });
  }, [open, anchor, before, after, title]);

  useEffect(() => {
    if (!open) return;
    function handleKeydown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeydown, true);
    return () => document.removeEventListener('keydown', handleKeydown, true);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      if (popoverRef.current?.contains(target)) return;
      if (anchor?.contains(target)) return;
      onClose();
    }
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open, onClose, anchor]);

  // Reposition on window resize/scroll while open so the popover follows the
  // anchor instead of drifting offscreen when the user scrolls the side-chat.
  useEffect(() => {
    if (!open || !anchor) return;
    function reposition() {
      if (!popoverRef.current || !anchor) return;
      const measured = popoverRef.current.getBoundingClientRect();
      setPosition(computePosition(anchor, measured.height));
    }
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open, anchor]);

  if (!open || !anchor || !position || !mounted) return null;

  const accent = kindAccent ?? DEFAULT_ACCENT;

  const popoverNode = (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label={`Diff: ${title}`}
      data-diff-popover
      data-placement={position.placement}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        width: POPOVER_MAX_WIDTH,
        borderColor: `${accent}1f`,
      }}
      className="z-[60] flex flex-col overflow-hidden rounded-lg border bg-background shadow-[0_8px_32px_-8px_rgba(0,0,0,0.18),0_4px_8px_-2px_rgba(0,0,0,0.06)]"
    >
      <header className="flex items-center gap-2 px-3 py-1.5" style={{ backgroundColor: `${accent}10` }}>
        {kindChip}
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-ink" title={title}>
          {title}
        </span>
        <button
          type="button"
          aria-label="Close diff"
          onClick={onClose}
          className="flex size-5 items-center justify-center rounded text-hint hover:bg-[rgba(0,0,0,0.04)] hover:text-ink"
        >
          ×
        </button>
      </header>
      <div className="px-3 py-2">
        <ContentDiff before={before} after={after} />
      </div>
    </div>
  );

  // Render into the body so ancestor transforms/filters/clips on the side-chat
  // dialog don't capture the fixed positioning context.
  return createPortal(popoverNode, document.body);
}
