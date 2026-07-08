import { describe, expect, it, vi } from 'vitest';

import { collectRequiredInput } from './required-input.js';
import type { StructuredExchangeUiContext } from './ui-context.js';

function ctxWithInput(input: unknown): StructuredExchangeUiContext {
  return { hasUI: true, ui: { input } } as never;
}

describe('collectRequiredInput', () => {
  it('re-prompts on empty submits until a non-blank value arrives, marking the prompt as required', async () => {
    const input = vi.fn(async () => {
      if (input.mock.calls.length === 1) return '';
      if (input.mock.calls.length === 2) return '   ';
      return '  a real value  ';
    });

    const result = await collectRequiredInput(ctxWithInput(input), 'Required comment', 'placeholder');

    expect(result).toEqual({ status: 'answered', value: 'a real value' });
    expect(input).toHaveBeenCalledTimes(3);
    expect(input.mock.calls[0]).toEqual(['Required comment', 'placeholder']);
    expect(input.mock.calls[1]).toEqual(['Required comment (required — cannot be empty)', 'placeholder']);
    expect(input.mock.calls[2]).toEqual(['Required comment (required — cannot be empty)', 'placeholder']);
  });

  it('resolves cancelled when the user dismisses the input, even after an empty re-prompt', async () => {
    const input = vi.fn(async () => (input.mock.calls.length === 1 ? '' : undefined));

    const result = await collectRequiredInput(ctxWithInput(input), 'Required comment');

    expect(result).toEqual({ status: 'cancelled' });
    expect(input).toHaveBeenCalledTimes(2);
  });

  it('resolves unavailable when the context has no input capability', async () => {
    const result = await collectRequiredInput({ hasUI: true, ui: {} } as never, 'Required comment');

    expect(result).toEqual({ status: 'unavailable' });
  });
});
