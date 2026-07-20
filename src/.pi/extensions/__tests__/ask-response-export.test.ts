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

type CustomStep =
  | { readonly kind: 'pick'; readonly index: number }
  | { readonly kind: 'input'; readonly prompt: string; readonly value?: string };

function customInteractionSequence(steps: readonly CustomStep[]) {
  let presentation = 0;
  return vi.fn(async (factory: (...args: unknown[]) => unknown) => {
    const step = steps[presentation];
    presentation += 1;
    if (!step) throw new Error('custom component presented more times than expected');

    let result: unknown;
    const component = factory(null, theme, null, (value: unknown) => {
      result = value;
    }) as TestPickerComponent;
    const rendered = component.render(80).join('\n');
    expect(rendered).toContain('╭');
    if (step.kind === 'pick') {
      for (let index = 0; index < step.index; index += 1) component.handleInput('\x1b[B');
      component.handleInput('\r');
    } else {
      expect(rendered).toContain(step.prompt);
      if (step.value === undefined) component.handleInput('\x1b');
      else {
        component.handleInput(step.value);
        component.handleInput('\r');
      }
    }
    return result;
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
    const custom = customInteractionSequence([
      { kind: 'pick', index: 0 },
      { kind: 'input', prompt: 'Optional comment' },
      { kind: 'pick', index: 1 },
      { kind: 'input', prompt: 'Optional comment', value: '' },
    ]);

    const result = await collectAskResponse(
      params,
      askQuestionEcho(params),
      {
        hasUI: true,
        ui: { custom },
      } as never,
      undefined,
      new AbortController().signal,
    );

    expect(result.details).toMatchObject({
      exchange_id: 'exported-loop',
      answered: { choice: { id: 'second', label: 'Second path', kind: 'listed' } },
    });
    expect(result.terminate).toBeUndefined();
    expect(custom).toHaveBeenCalledTimes(4);
  });
});
