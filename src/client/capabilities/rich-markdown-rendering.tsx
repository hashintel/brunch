'use client';

import { cjk } from '@streamdown/cjk';
import { math } from '@streamdown/math';
import { Streamdown } from 'streamdown';

import type { MarkdownRendererProps } from './markdown-rendering';

const markdownRenderingPlugins = { cjk, math };

export const RichMarkdownRenderer = ({
  children,
  isAnimating: _isAnimating,
  ...props
}: MarkdownRendererProps) => (
  <div data-rendering-mode="rich">
    <Streamdown plugins={markdownRenderingPlugins} {...props}>
      {children}
    </Streamdown>
  </div>
);
