import { describe, expect, it } from 'vitest';

import { accumulateChoiceLines } from '../choice-row.js';

describe('accumulateChoiceLines', () => {
  it('tracks the active rendered row across variable-height choices', () => {
    const result = accumulateChoiceLines({
      choices: [
        { label: 'First', lines: ['first', 'first detail'] },
        { label: 'Second', lines: ['second'] },
        { label: 'Third', lines: ['third', 'third detail'] },
      ],
      activeIndex: 2,
      renderChoice: (choice) => choice.lines,
    });

    expect(result).toEqual({
      choiceLines: ['first', 'first detail', 'second', 'third', 'third detail'],
      activeLineIndex: 3,
    });
  });
});
