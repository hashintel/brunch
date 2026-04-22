'use client';

import { memo, useEffect, useRef } from 'react';

import { cn } from '@/client/lib/utils';

export interface ThinkingTokenScrollProps {
  /** The live-streaming reasoning text from the model. */
  text: string;
  /** Optional className for the outer container. */
  className?: string;
}

/**
 * A compact, ~4-line scrolling window that streams reasoning tokens.
 *
 * Auto-scrolls to the bottom as new text arrives and renders a top
 * fade-out gradient so the most recent tokens are always visible.
 */
export const ThinkingTokenScroll = memo(({ text, className }: ThinkingTokenScrollProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [text]);

  return (
    <div ref={scrollRef} className={cn('h-16 overflow-hidden text-xs leading-4 text-muted-foreground', className)}>
      <p className="break-words whitespace-pre-wrap">{text}</p>
    </div>
  );
});

ThinkingTokenScroll.displayName = 'ThinkingTokenScroll';
