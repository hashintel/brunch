import { describe, expect, it } from 'vitest';

import { missingRenderedDetailsLeaves } from '../render-honesty.js';

describe('render honesty oracle', () => {
  it('recognizes a logical value split across word-wrapped physical lines', () => {
    const details = {
      title: 'Launch safely with a deliberately long description that wraps at narrow widths',
    };
    const rendered = [
      'goal  G2  Launch safely with a deliberately',
      '          long description that wraps at',
      '          narrow widths',
    ].join('\n');

    expect(missingRenderedDetailsLeaves(details, rendered, { elisions: [] })).toEqual([]);
  });

  it.each([
    ['missing words', 'Launch safely with a long description that wraps at narrow widths'],
    ['reordered words', 'Launch safely with a description deliberately long that wraps at narrow widths'],
    ['partial value', 'Launch safely with a deliberately long description'],
    ['concatenated words', 'Launch safely with a deliberately long description that wraps at narrowwidths'],
  ])('rejects a wrapped representation with %s', (_case, rendered) => {
    const details = {
      title: 'Launch safely with a deliberately long description that wraps at narrow widths',
    };

    expect(missingRenderedDetailsLeaves(details, rendered, { elisions: [] })).toEqual([
      { path: 'title', value: details.title },
    ]);
  });

  it('does not count multi-line leaves as rendered when their lines appear in unrelated locations', () => {
    const details = {
      display: {
        body: 'First owned line.\n\nSecond owned line.',
      },
    };

    expect(
      missingRenderedDetailsLeaves(
        details,
        'First owned line.\n\nUnrelated rendered material.\n\nSecond owned line.',
        {
          elisions: [],
        },
      ),
    ).toEqual([{ path: 'display.body', value: 'First owned line.\n\nSecond owned line.' }]);
  });

  it('allows markdown quote structure between owned multi-line leaf lines', () => {
    const details = {
      display: {
        body: 'First owned line.\n\nSecond owned line.',
      },
    };

    expect(
      missingRenderedDetailsLeaves(details, '> First owned line.\n>\n> Second owned line.', {
        elisions: [],
      }),
    ).toEqual([]);
  });
});
