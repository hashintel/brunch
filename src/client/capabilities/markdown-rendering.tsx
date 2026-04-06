'use client';

import type { ComponentType } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { cn } from '@/lib/utils';

export interface MarkdownRendererProps {
  children?: string;
  className?: string;
  isAnimating?: boolean;
}

const MARKDOWN_ENHANCEMENT_PATTERNS = [
  /```[\s\S]+?```/m,
  /`[^`\n]+`/,
  /(^|\n)#{1,6}\s/m,
  /(^|\n)\s*[-*+]\s/m,
  /(^|\n)\s*\d+\.\s/m,
  /(^|\n)>\s/m,
  /!\[[^\]]*\]\([^)]+\)/,
  /\[[^\]]+\]\([^)]+\)/,
  /\*\*[^*]+\*|__[^_]+__/,
  /\$\$[\s\S]+?\$\$|(^|[^$])\$[^$\n]+\$(?!\$)/,
  /(^|\n)\|.+\|/,
];

export const needsRichMarkdownRendering = (content: string) =>
  MARKDOWN_ENHANCEMENT_PATTERNS.some((pattern) => pattern.test(content));

const PlainTextRenderer = ({ className, children }: MarkdownRendererProps) => (
  <div className={cn('whitespace-pre-wrap break-words', className)} data-rendering-mode="plain">
    {children}
  </div>
);

let richMarkdownRendererPromise: Promise<ComponentType<MarkdownRendererProps>> | null = null;

const loadRichMarkdownRenderer = () => {
  if (!richMarkdownRendererPromise) {
    richMarkdownRendererPromise = import('./rich-markdown-rendering.js').then(
      (module) => module.RichMarkdownRenderer,
    );
  }

  return richMarkdownRendererPromise;
};

export const MarkdownRenderer = ({ children, ...props }: MarkdownRendererProps) => {
  const content = typeof children === 'string' ? children : '';
  const shouldEnhance = useMemo(() => needsRichMarkdownRendering(content), [content]);
  const [RichRenderer, setRichRenderer] = useState<ComponentType<MarkdownRendererProps> | null>(null);

  useEffect(() => {
    if (!shouldEnhance) {
      return;
    }

    let cancelled = false;

    void loadRichMarkdownRenderer().then((renderer) => {
      if (!cancelled) {
        setRichRenderer(() => renderer);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [shouldEnhance]);

  if (!shouldEnhance || !RichRenderer) {
    return <PlainTextRenderer {...props}>{content}</PlainTextRenderer>;
  }

  return <RichRenderer {...props}>{content}</RichRenderer>;
};
