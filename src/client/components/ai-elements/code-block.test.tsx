// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createPlainCodeTokensMock = vi.fn((code: string) => ({
  bg: 'transparent',
  fg: 'inherit',
  tokens: [[{ color: 'inherit', content: code }]],
}));
const getCachedHighlightedCodeMock = vi.fn(() => null);
const highlightCodeMock = vi.fn();
const preloadRichCodeHighlighterMock = vi.fn();

vi.mock('@/capabilities/code-highlighting', () => ({
  createPlainCodeTokens: createPlainCodeTokensMock,
  getCachedHighlightedCode: getCachedHighlightedCodeMock,
  highlightCode: highlightCodeMock,
  preloadRichCodeHighlighter: preloadRichCodeHighlighterMock,
}));

describe('CodeBlockContent', () => {
  beforeEach(() => {
    createPlainCodeTokensMock.mockClear();
    getCachedHighlightedCodeMock.mockReset();
    getCachedHighlightedCodeMock.mockReturnValue(null);
    highlightCodeMock.mockReset();
    preloadRichCodeHighlighterMock.mockReset();
    highlightCodeMock.mockResolvedValue({
      bg: '#111111',
      fg: '#eeeeee',
      tokens: [[{ color: '#ff0000', content: 'const answer = 42' }]],
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('renders plain code immediately before async highlighting completes', async () => {
    let resolveHighlight:
      | ((value: {
          bg: string;
          fg: string;
          tokens: Array<Array<{ content: string; color: string }>>;
        }) => void)
      | null = null;

    highlightCodeMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveHighlight = resolve as typeof resolveHighlight;
        }),
    );

    const { CodeBlockContent } = await import('./code-block.js');

    const { container } = render(<CodeBlockContent code={'const answer = 42'} language={'typescript'} />);

    const pre = container.querySelector('pre');
    expect(pre).toBeTruthy();
    expect(screen.getByText('const answer = 42')).toBeTruthy();
    expect(pre?.style.backgroundColor).toBe('transparent');

    await act(async () => {
      resolveHighlight?.({
        bg: '#111111',
        fg: '#eeeeee',
        tokens: [
          [
            { color: '#ff0000', content: 'const' },
            { color: '#00ff00', content: ' answer = 42' },
          ],
        ],
      });
    });

    await waitFor(() => {
      expect(pre?.style.backgroundColor).toBe('#111111');
      expect(pre?.style.color).toBe('#eeeeee');
    });
  });

  it('ignores stale async highlighting results after the code changes', async () => {
    const pendingHighlights = new Map<
      string,
      (value: { bg: string; fg: string; tokens: Array<Array<{ content: string; color: string }>> }) => void
    >();

    highlightCodeMock.mockImplementation(
      (code: string) =>
        new Promise((resolve) => {
          pendingHighlights.set(
            code,
            resolve as (value: {
              bg: string;
              fg: string;
              tokens: Array<Array<{ content: string; color: string }>>;
            }) => void,
          );
        }),
    );

    const { CodeBlockContent } = await import('./code-block.js');

    const { rerender } = render(<CodeBlockContent code={'const first = 1'} language={'typescript'} />);
    expect(screen.getByText('const first = 1')).toBeTruthy();

    rerender(<CodeBlockContent code={'const second = 2'} language={'typescript'} />);
    expect(screen.getByText('const second = 2')).toBeTruthy();

    await act(async () => {
      pendingHighlights.get('const first = 1')?.({
        bg: '#111111',
        fg: '#eeeeee',
        tokens: [[{ color: '#ff0000', content: 'STALE RESULT' }]],
      });
    });

    expect(screen.queryByText('STALE RESULT')).toBeNull();
    expect(screen.getByText('const second = 2')).toBeTruthy();

    await act(async () => {
      pendingHighlights.get('const second = 2')?.({
        bg: '#222222',
        fg: '#ffffff',
        tokens: [[{ color: '#00ff00', content: 'const second = 2' }]],
      });
    });

    await waitFor(() => {
      expect(screen.getByText('const second = 2')).toBeTruthy();
    });
  });

  it('preloads the rich highlighter when the user signals intent on the container', async () => {
    const { CodeBlockContainer } = await import('./code-block.js');

    const { container } = render(
      <CodeBlockContainer language="typescript">
        <button type="button">Focus me</button>
      </CodeBlockContainer>,
    );

    const codeBlock = container.querySelector('[data-language="typescript"]');
    expect(codeBlock).toBeTruthy();

    fireEvent.pointerEnter(codeBlock!);
    fireEvent.focus(screen.getByRole('button', { name: 'Focus me' }));

    expect(preloadRichCodeHighlighterMock).toHaveBeenCalledTimes(2);
  });

  it('clears the copy-reset timer on unmount', async () => {
    vi.useFakeTimers();
    const writeTextMock = vi.fn(async () => {});
    vi.stubGlobal('navigator', { clipboard: { writeText: writeTextMock } });

    const { CodeBlock, CodeBlockCopyButton } = await import('./code-block.js');

    const { container, unmount } = render(
      <CodeBlock code={'const answer = 42'} language={'typescript'}>
        <CodeBlockCopyButton />
      </CodeBlock>,
    );

    await act(async () => {
      fireEvent.click(container.querySelector('[data-slot="button"]')!);
      await Promise.resolve();
    });

    expect(writeTextMock).toHaveBeenCalledWith('const answer = 42');

    unmount();

    expect(() => {
      vi.runAllTimers();
    }).not.toThrow();
  });
});
