import { Network, Plus, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { cn } from '@/client/lib/utils.js';

export interface SecondaryChatAnchorManagerProps {
  readonly anchoredItemIds: readonly number[];
  readonly onRemove?: (itemId: number) => void;
  readonly onAdd?: () => void;
  readonly pinnedAccent?: string | null;
  /**
   * Lookup so the chip renders the knowledge-item referenceCode (e.g. "G1",
   * "D5") instead of the raw numeric id. Falls back to `#{itemId}` when no
   * code is registered.
   */
  readonly refCodeByItemId?: ReadonlyMap<number, string>;
}

/**
 * Compact icon-button + popover for managing the set of knowledge items
 * anchored to an Agent-mode chat. Visible only when the parent composer is
 * in Agent (edit) mode.
 *
 * Visual posture matches the pending-reviews surface: rounded panel with a
 * soft border + shadow, one row per anchored item rendered as a ref-code
 * chip (kind accent tints the chip when known), and a bottom "+" affordance
 * that — in this iteration — stubs the knowledge-item picker behind a TODO
 * so the affordance is discoverable while the picker is being designed.
 */
export function SecondaryChatAnchorManager({
  anchoredItemIds,
  onRemove,
  onAdd,
  pinnedAccent,
  refCodeByItemId,
}: SecondaryChatAnchorManagerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocPointerDown = (event: PointerEvent) => {
      if (!containerRef.current) return;
      if (containerRef.current.contains(event.target as Node)) return;
      setOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDocPointerDown);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('pointerdown', onDocPointerDown);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  const triggerStyle = pinnedAccent ? { color: pinnedAccent } : undefined;
  // Minimalist chip per design feedback: accent-colored text + a barely-there
  // border (20% accent alpha) and no background fill. Reads as a tinted
  // mono ref-code with a soft outline rather than a filled pill.
  const chipStyle = pinnedAccent
    ? {
        color: pinnedAccent,
        borderColor: `${pinnedAccent}33`,
      }
    : undefined;

  return (
    <div ref={containerRef} className="relative inline-flex">
      <button
        type="button"
        data-testid="secondary-chat-anchor-manager-trigger"
        data-anchor-count={anchoredItemIds.length}
        aria-label={`Manage anchored items (${anchoredItemIds.length})`}
        title={`Manage anchored items (${anchoredItemIds.length})`}
        onClick={() => setOpen((v) => !v)}
        style={triggerStyle}
        className={cn(
          'inline-flex h-6 items-center gap-1 rounded-md border border-transparent px-1.5 text-hint',
          'transition-[transform,background-color,color] duration-150',
          'hover:bg-tint/40 hover:text-ink active:scale-95',
          open && 'bg-tint/40 text-ink',
        )}
      >
        <Network aria-hidden className="size-3.5" strokeWidth={1.5} />
        {anchoredItemIds.length > 0 && (
          <span className="font-mono text-[10px] text-hint">{anchoredItemIds.length}</span>
        )}
      </button>
      {open && (
        <div
          data-testid="secondary-chat-anchor-manager-popover"
          role="dialog"
          aria-label="Anchored items"
          className="absolute bottom-full left-0 z-30 mb-1.5 flex w-64 flex-col gap-1.5 rounded-lg border border-rule/40 bg-background p-2 text-xs shadow-lg"
        >
          <div className="flex items-center justify-between gap-2 px-1">
            <span className="text-[10px] tracking-wide text-hint uppercase">Anchored context</span>
            <button
              type="button"
              data-testid="secondary-chat-anchor-manager-add"
              aria-label="Add anchored item"
              title="Add item"
              onClick={() => {
                // TODO: open a knowledge-item picker; stub for now so the
                // affordance is discoverable while we design the picker.
                onAdd?.();
              }}
              className="inline-flex size-5 items-center justify-center rounded-md text-hint transition-[transform,background-color,color] duration-150 hover:bg-tint/60 hover:text-ink active:scale-95"
            >
              <Plus aria-hidden className="size-3" strokeWidth={1.5} />
            </button>
          </div>
          {anchoredItemIds.length === 0 ? (
            <p
              data-testid="secondary-chat-anchor-manager-empty"
              className="px-1 py-1 text-[11px] text-hint italic"
            >
              No items anchored.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-1" role="list">
              {anchoredItemIds.map((itemId) => {
                const refCode = refCodeByItemId?.get(itemId) ?? null;
                return (
                  <li
                    key={itemId}
                    data-testid={`secondary-chat-anchor-manager-row-${itemId}`}
                    data-anchor-item-id={itemId}
                    data-anchor-ref-code={refCode ?? undefined}
                    className="group/anchor-row inline-flex items-center"
                  >
                    <span
                      className="inline-flex items-center gap-1 rounded-full border bg-transparent px-1.5 py-0.5 font-mono text-[10px]"
                      style={chipStyle}
                    >
                      {refCode ?? `#${itemId}`}
                      <button
                        type="button"
                        data-testid={`secondary-chat-anchor-manager-remove-${itemId}`}
                        aria-label={`Remove anchored item ${itemId}`}
                        onClick={() => onRemove?.(itemId)}
                        className="inline-flex size-3 items-center justify-center rounded-full text-hint opacity-0 transition-opacity duration-150 group-hover/anchor-row:opacity-100 hover:text-ink focus-visible:opacity-100"
                      >
                        <X aria-hidden className="size-2.5" strokeWidth={1.5} />
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
