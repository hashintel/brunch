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
    <div className={cn('relative', className)}>
      {/* Top fade-out gradient */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-5 bg-gradient-to-b from-background to-transparent" />
      {/* Scrolling container — 4 lines of text-xs ≈ 4rem */}
      <div ref={scrollRef} className="h-16 overflow-hidden text-xs leading-4 text-muted-foreground">
        <p className="break-words whitespace-pre-wrap">{text}</p>
      </div>
    </div>
  );
});

ThinkingTokenScroll.displayName = 'ThinkingTokenScroll';
