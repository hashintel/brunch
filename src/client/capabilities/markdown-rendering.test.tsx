// @vitest-environment happy-dom

import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@streamdown/cjk', () => ({ cjk: {} }));
vi.mock('@streamdown/code', () => ({ code: {} }));
vi.mock('@streamdown/math', () => ({ math: {} }));
vi.mock('@streamdown/mermaid', () => ({ mermaid: {} }));
vi.mock('streamdown', () => ({
  Streamdown: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div {...props}>{children}</div>
  ),
}));

describe('MarkdownRenderer', () => {
  it('keeps plain text on the immediate rendering path', async () => {
    const { MarkdownRenderer, needsRichMarkdownRendering } = await import('./markdown-rendering.js');

    expect(needsRichMarkdownRendering('Just a plain answer.')).toBe(false);

    render(<MarkdownRenderer>Just a plain answer.</MarkdownRenderer>);

    expect(screen.getByText('Just a plain answer.').closest('[data-rendering-mode="plain"]')).toBeTruthy();

    await Promise.resolve();

    expect(screen.queryByText('Just a plain answer.')?.closest('[data-rendering-mode="rich"]')).toBeNull();
  });

  it('renders fenced code as plain text first, then upgrades to rich rendering', async () => {
    const { MarkdownRenderer, needsRichMarkdownRendering } = await import('./markdown-rendering.js');
    const content = '```typescript\nconst answer = 42\n```';

    expect(needsRichMarkdownRendering(content)).toBe(true);
    expect(needsRichMarkdownRendering('```mermaid\ngraph TD\nA-->B\n```')).toBe(true);

    render(<MarkdownRenderer>{content}</MarkdownRenderer>);

    expect(screen.getByText(/const answer = 42/).closest('[data-rendering-mode="plain"]')).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText(/const answer = 42/).closest('[data-rendering-mode="rich"]')).toBeTruthy();
    });
  });
});
