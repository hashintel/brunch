import { describe, expect, it } from 'vitest';

import { missingRenderedDetailsLeaves } from '../render-honesty.js';

describe('render honesty oracle', () => {
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
