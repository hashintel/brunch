'use client';

import { cjk } from '@streamdown/cjk';
import { code } from '@streamdown/code';
import { math } from '@streamdown/math';
import { mermaid } from '@streamdown/mermaid';
import type { ComponentProps } from 'react';
import { Streamdown } from 'streamdown';

const markdownRenderingPlugins = { cjk, code, math, mermaid };

export type MarkdownRendererProps = ComponentProps<typeof Streamdown>;

export const MarkdownRenderer = (props: MarkdownRendererProps) => (
  <Streamdown plugins={markdownRenderingPlugins} {...props} />
);
