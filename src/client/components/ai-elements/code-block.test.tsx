// @vitest-environment happy-dom

import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createPlainCodeTokensMock = vi.fn((code: string) => ({
  bg: 'transparent',
  fg: 'inherit',
  tokens: [[{ color: 'inherit', content: code }]],
}));
const highlightCodeMock = vi.fn();

vi.mock('@/capabilities/code-highlighting', () => ({
  createPlainCodeTokens: createPlainCodeTokensMock,
  highlightCode: highlightCodeMock,
}));

describe('CodeBlockContent', () => {
  beforeEach(() => {
    createPlainCodeTokensMock.mockClear();
    highlightCodeMock.mockReset();
  });

  afterEach(() => {
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
      (_code: string, _language: string, callback?: (value: unknown) => void) => {
        if (callback) {
          resolveHighlight = callback as typeof resolveHighlight;
        }

        return null;
      },
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
});
