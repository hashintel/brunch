import { ArrowDownIcon } from 'lucide-react';
import { ScrollArea as ScrollAreaPrimitive } from 'radix-ui';
import { useCallback, useRef } from 'react';
import { useStickToBottom } from 'use-stick-to-bottom';

import { Button } from '@/client/components/ui/button';
import { ScrollBar } from '@/client/components/ui/scroll-area';
import { cn } from '@/client/lib/utils';

export function ChatScroll({ children, className }: { children: React.ReactNode; className?: string }) {
  const { scrollRef, contentRef, scrollToBottom, isAtBottom } = useStickToBottom({
    resize: 'smooth',
    initial: false,
  });

  const viewportRef = useRef<HTMLDivElement>(null);
  const mergedViewportRef = useCallback(
    (node: HTMLDivElement | null) => {
      viewportRef.current = node;
      scrollRef(node);
    },
    [scrollRef],
  );

  const handleScrollToBottom = useCallback(() => {
    void scrollToBottom();
  }, [scrollToBottom]);

  return (
    <ScrollAreaPrimitive.Root className={cn('relative overflow-hidden', className)}>
      <ScrollAreaPrimitive.Viewport ref={mergedViewportRef} className="size-full rounded-[inherit]">
        <div ref={contentRef}>{children}</div>
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      <ScrollAreaPrimitive.Corner />

      {!isAtBottom && (
        <Button
          className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full"
          onClick={handleScrollToBottom}
          size="icon"
          type="button"
          variant="outline"
        >
          <ArrowDownIcon className="size-4" />
        </Button>
      )}
    </ScrollAreaPrimitive.Root>
  );
}
