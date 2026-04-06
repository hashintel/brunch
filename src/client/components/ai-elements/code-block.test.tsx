// @vitest-environment happy-dom

import { act, render, screen, waitFor } from '@testing-library/react';
import type { BundledLanguage } from 'shiki';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createHighlighterMock = vi.fn();

vi.mock('shiki', () => ({
  createHighlighter: createHighlighterMock,
}));

describe('CodeBlockContent', () => {
  beforeEach(() => {
    createHighlighterMock.mockReset();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('renders plain code immediately before async highlighting completes', async () => {
    let resolveHighlighter:
      | ((value: {
          getLoadedLanguages: () => BundledLanguage[];
          codeToTokens: (
            code: string,
            options: unknown,
          ) => {
            bg: string;
            fg: string;
            tokens: Array<Array<{ content: string; color: string }>>;
          };
        }) => void)
      | null = null;

    createHighlighterMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveHighlighter = resolve;
        }),
    );

    const { CodeBlockContent } = await import('./code-block.js');

    const { container } = render(
      <CodeBlockContent code={'const answer = 42'} language={'typescript' as BundledLanguage} />,
    );

    const pre = container.querySelector('pre');
    expect(pre).toBeTruthy();
    expect(screen.getByText('const answer = 42')).toBeTruthy();
    expect(pre?.style.backgroundColor).toBe('transparent');

    await act(async () => {
      resolveHighlighter?.({
        getLoadedLanguages: () => ['typescript' as BundledLanguage],
        codeToTokens: () => ({
          bg: '#111111',
          fg: '#eeeeee',
          tokens: [
            [
              { color: '#ff0000', content: 'const' },
              { color: '#00ff00', content: ' answer = 42' },
            ],
          ],
        }),
      });
    });

    await waitFor(() => {
      expect(pre?.style.backgroundColor).toBe('#111111');
      expect(pre?.style.color).toBe('#eeeeee');
    });
  });
});
