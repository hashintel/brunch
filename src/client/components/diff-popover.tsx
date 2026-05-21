import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { ContentDiff } from './content-diff.js';

export const DEFAULT_ACCENT = '#5424ff';

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

/**
 * When the anchor sits inside the chat shell (e.g. a "view source diff"
 * trigger inside a pending-review row) we want the popover centered
 * horizontally inside that container, not aligned right-of-anchor against
 * the viewport. Walking up from the anchor finds the nearest such surface.
 */
function findContainingChatShell(anchor: HTMLElement): HTMLElement | null {
  return anchor.closest<HTMLElement>('[data-testid="unified-chat-shell"]');
}

function computePosition(anchor: HTMLElement, popoverHeight: number): ComputedPosition {
  const rect = anchor.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;
  const spaceBelow = viewportHeight - rect.bottom;
  const spaceAbove = rect.top;
  const fitsBelow = spaceBelow >= popoverHeight + POPOVER_GAP + VIEWPORT_MARGIN;
  const fitsAbove = spaceAbove >= popoverHeight + POPOVER_GAP + VIEWPORT_MARGIN;
  const placement: 'above' | 'below' = fitsBelow || !fitsAbove ? 'below' : 'above';
  const top =
    placement === 'below'
      ? Math.min(viewportHeight - popoverHeight - VIEWPORT_MARGIN, rect.bottom + POPOVER_GAP)
      : Math.max(VIEWPORT_MARGIN, rect.top - popoverHeight - POPOVER_GAP);
  // Center the popover horizontally inside the chat shell
  // when the anchor lives there, instead of always right-aligning to the
  // anchor and drifting to wherever the trigger sits. Fall back to the old
  // anchor-right behavior outside the shell so other call sites (e.g. the
  // workspace) keep their existing alignment.
  const shell = findContainingChatShell(anchor);
  const shellRect = shell?.getBoundingClientRect();
  const idealLeft = shellRect
    ? shellRect.left + (shellRect.width - POPOVER_MAX_WIDTH) / 2
    : rect.right - POPOVER_MAX_WIDTH;
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
  const [measureEpoch, setMeasureEpoch] = useState(0);

  useEffect(() => {
    if (!open || !anchor) {
      setPosition(null);
      return;
    }
    setPosition(computePosition(anchor, 160));
    setMeasureEpoch((e) => e + 1);
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
  }, [open, anchor, before, after, title, measureEpoch]);

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

  useEffect(() => {
    if (!open || !anchor) return;
    function reposition() {
      if (!popoverRef.current || !anchor) return;
      const measured = popoverRef.current.getBoundingClientRect();
      const next = computePosition(anchor, measured.height);
      setPosition((prev) => {
        if (
          prev &&
          Math.abs(prev.top - next.top) < 0.5 &&
          Math.abs(prev.left - next.left) < 0.5 &&
          prev.placement === next.placement
        ) {
          return prev;
        }
        return next;
      });
    }
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open, anchor]);

  if (!open || !anchor || !position) return null;

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
      className="z-[60] flex max-h-[min(70vh,40rem)] flex-col overflow-hidden rounded-lg border bg-background shadow-[0_8px_32px_-8px_rgba(0,0,0,0.18),0_4px_8px_-2px_rgba(0,0,0,0.06)]"
    >
      <header
        className="flex shrink-0 items-center gap-2 px-3 py-1.5"
        style={{ backgroundColor: `${accent}10` }}
      >
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
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        <ContentDiff before={before} after={after} />
      </div>
    </div>
  );

  return createPortal(popoverNode, document.body);
}
