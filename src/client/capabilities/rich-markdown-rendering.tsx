'use client';

import { cjk } from '@streamdown/cjk';
import { code } from '@streamdown/code';
import { math } from '@streamdown/math';
import { mermaid } from '@streamdown/mermaid';
import { Streamdown } from 'streamdown';

import type { MarkdownRendererProps } from './markdown-rendering';

const markdownRenderingPlugins = { cjk, code, math, mermaid };

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
