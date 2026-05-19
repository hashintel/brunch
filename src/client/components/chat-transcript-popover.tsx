import { PopoverContent } from './ui/popover.js';

export interface ChatTranscriptPopoverContentProps {
  readonly slotRef: (el: HTMLDivElement | null) => void;
}

export function ChatTranscriptPopoverContent({ slotRef }: ChatTranscriptPopoverContentProps) {
  return (
    <PopoverContent
      data-testid="chat-transcript-popover-content"
      side="bottom"
      align="start"
      sideOffset={8}
      className="flex max-h-[60vh] w-[min(36rem,calc(100vw-2rem))] flex-col overflow-hidden p-0"
    >
      <div
        ref={slotRef}
        data-testid="chat-transcript-popover-slot"
        className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3"
      />
    </PopoverContent>
  );
}
