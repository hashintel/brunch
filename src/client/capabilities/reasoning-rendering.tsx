'use client';

import type { ComponentProps } from 'react';

import { MarkdownRenderer } from './markdown-rendering';

export type ReasoningRendererProps = ComponentProps<typeof MarkdownRenderer>;

export const ReasoningRenderer = (props: ReasoningRendererProps) => <MarkdownRenderer {...props} />;
