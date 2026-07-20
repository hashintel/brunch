import { describe, expect, it } from 'vitest';

import {
  BRUNCH_ELICITATION_STYLE_CUSTOM_TYPE,
  appendElicitationStyleEntry,
  latestElicitationStyle,
  parseElicitationStyleEntryData,
} from '../elicitation-style.js';

const entry = (style: string) => ({
  type: 'custom',
  customType: BRUNCH_ELICITATION_STYLE_CUSTOM_TYPE,
  data: { schemaVersion: 1, style },
});

describe('elicitation style', () => {
  it('accepts exactly the three canonical values and fails closed', () => {
    for (const style of ['interrogate', 'disambiguate', 'propose'])
      expect(parseElicitationStyleEntryData({ schemaVersion: 1, style })).toEqual({
        schemaVersion: 1,
        style,
      });
    for (const style of ['elicit_examples', 'ingest', 'continue', 'proceed', '', undefined])
      expect(parseElicitationStyleEntryData({ schemaVersion: 1, style })).toBeUndefined();
  });

  it('folds the last valid entry on the supplied active branch across kicks and sibling rivals', () => {
    const root = entry('interrogate');
    const active = [
      root,
      { type: 'custom_message', customType: 'brunch.kick' },
      entry('disambiguate'),
      { type: 'custom_message', customType: 'brunch.kick' },
    ];
    expect(latestElicitationStyle(active)).toBe('disambiguate');
    expect(latestElicitationStyle([root, entry('propose')])).toBe('propose');
    expect(latestElicitationStyle(active)).toBe('disambiguate');
  });

  it('appends the narrow carrier', () => {
    const writes: unknown[] = [];
    appendElicitationStyleEntry(
      { appendCustomEntry: (type, data) => writes.push({ type, data }) },
      'propose',
    );
    expect(writes).toEqual([
      { type: BRUNCH_ELICITATION_STYLE_CUSTOM_TYPE, data: { schemaVersion: 1, style: 'propose' } },
    ]);
  });
});
