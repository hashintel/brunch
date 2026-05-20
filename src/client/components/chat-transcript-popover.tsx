import { useCallback, type ReactNode } from 'react';

import { PopoverContent } from './ui/popover.js';

export interface ChatTranscriptPopoverContentProps {
  /**
   * Callback ref the shell uses to capture the transcript portal target.
   * Mirrors the composer-slot setter pattern in <UnifiedChatShell>:
   * <SecondaryChatHost> portals its collapsible into this slot so the
   * per-chat useChat instance stays mounted across popover open/close
   * cycles.
   */
  readonly slotRef: (node: HTMLDivElement | null) => void;
  /**
   * Sticky overlay band (patches + pending-review). Rendered inside the
   * popover body. (The original C32 Slice 6 plan to relocate them to a
   * permanent workspace strip was retired 2026-05-19 along with Slice 5;
   * this is the canonical home.)
   */
  readonly overlaysSlot?: ReactNode;
}

/**
 * Transient transcript popover anchored to the active tab in <ChatTabs>.
 * Wraps Radix `<PopoverContent>`. The surrounding `<Popover>` root and
 * `<PopoverAnchor>` live in <UnifiedChatShell> (tabs opt into the anchor
 * via `popoverAnchorActiveTab`); the root owns open/onOpenChange so this
 * component stays purely presentational.
 *
 * The transcript itself isn't a child here: <SecondaryChatHost> portals
 * its collapsible into `slotRef`'s slot div.
 */
export function ChatTranscriptPopoverContent({ slotRef, overlaysSlot }: ChatTranscriptPopoverContentProps) {
  // Stable ref setter so consumers don't see ref churn when the popover
  // toggles open/closed.
  const setRef = useCallback(
    (node: HTMLDivElement | null) => {
      slotRef(node);
    },
    [slotRef],
  );

  return (
    <PopoverContent
      data-testid="chat-transcript-popover-content"
      align="start"
      side="top"
      sideOffset={8}
      className="flex max-h-[60vh] w-[420px] flex-col gap-2 overflow-hidden p-0"
      onOpenAutoFocus={(event) => {
        // Default Radix behavior pulls focus to the first focusable in
        // the content. The composer lives in the shell footer (portaled),
        // not here, so suppress the auto-focus shift to keep the user's
        // textarea selection intact across auto-opens.
        event.preventDefault();
      }}
    >
      {overlaysSlot && (
        <div data-testid="chat-transcript-popover-overlays" className="px-3 pt-3">
          {overlaysSlot}
        </div>
      )}
      <div
        ref={setRef}
        data-testid="chat-transcript-popover-slot"
        className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-3"
      />
    </PopoverContent>
  );
}
