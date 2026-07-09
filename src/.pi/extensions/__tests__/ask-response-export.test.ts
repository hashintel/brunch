import { describe, expect, it, vi } from 'vitest';

import { askQuestionEcho } from '../../../exchanges/projections/ask.js';
import { collectAskResponse, type CollectableAskParams } from '../exchanges/ask.js';

interface TestPickerComponent {
  render(width: number): string[];
  handleInput(data: string): void;
}

const theme = {
  fg: (_color: string, text: string) => text,
  bold: (text: string) => text,
};

function customPickSequence(indexes: readonly number[]) {
  let presentation = 0;
  return vi.fn(async (factory: (...args: unknown[]) => unknown) => {
    const index = indexes[presentation];
    presentation += 1;
    if (index === undefined) throw new Error('custom picker presented more times than expected');

    let picked: unknown;
    const component = factory(null, theme, null, (result: unknown) => {
      picked = result;
    }) as TestPickerComponent;
    expect(component.render(80).join('\n')).toContain('╭');
    for (let step = 0; step < index; step += 1) component.handleInput('\x1b[B');
    component.handleInput('\r');
    return picked;
  });
}

describe('collectAskResponse export', () => {
  it('drives a picker → back → picker → answer loop over a scripted context', async () => {
    const params: CollectableAskParams = {
      exchangeId: 'exported-loop',
      body: 'Choose a direction.',
      options: [
        { id: 'first', label: 'First path' },
        { id: 'second', label: 'Second path' },
      ],
      commentPrompt: 'Optional comment',
    };
    const input = vi.fn(async () => (input.mock.calls.length === 1 ? undefined : ''));
    const custom = customPickSequence([0, 1]);

    const result = await collectAskResponse(params, askQuestionEcho(params), {
      hasUI: true,
      ui: { custom, input },
    } as never);

    expect(result.details).toMatchObject({
      exchange_id: 'exported-loop',
      answered: { choice: { id: 'second', label: 'Second path', kind: 'listed' } },
    });
    expect(result.terminate).toBeUndefined();
    expect(custom).toHaveBeenCalledTimes(2);
    expect(input).toHaveBeenNthCalledWith(1, 'Optional comment');
    expect(input).toHaveBeenNthCalledWith(2, 'Optional comment');
  });
});
