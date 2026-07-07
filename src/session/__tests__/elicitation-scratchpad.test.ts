import { describe, expect, it } from 'vitest';

import {
  BRUNCH_ELICITATION_SCRATCHPAD_CUSTOM_TYPE,
  appendElicitationScratchpadSnapshot,
  latestElicitationScratchpad,
  parseElicitationScratchpadEntryData,
  parseElicitationScratchpadItem,
  type ElicitationScratchpadEntryData,
  type ElicitationScratchpadItem,
} from '../elicitation-scratchpad.js';

function scratchpadEntry(items: readonly ElicitationScratchpadItem[]) {
  return {
    type: 'custom',
    customType: BRUNCH_ELICITATION_SCRATCHPAD_CUSTOM_TYPE,
    data: { schemaVersion: 1, items } satisfies ElicitationScratchpadEntryData,
  };
}

class FakeScratchpadSessionManager {
  entries: Array<{ type: 'custom'; customType: string; data: ElicitationScratchpadEntryData }> = [];

  getEntries() {
    return this.entries;
  }

  appendCustomEntry(customType: string, data: ElicitationScratchpadEntryData) {
    this.entries.push({ type: 'custom', customType, data });
  }
}

describe('parseElicitationScratchpadItem', () => {
  it('accepts an obligation/disposition item without meta or rationale', () => {
    expect(
      parseElicitationScratchpadItem({ id: 'a', obligation: 'ask about X', disposition: 'open' }),
    ).toEqual({
      id: 'a',
      obligation: 'ask about X',
      disposition: 'open',
    });
  });

  it('accepts rationale and meta', () => {
    const item = {
      id: 'a',
      obligation: 'ask about X',
      disposition: 'resolved',
      rationale: 'because Y',
      meta: { nodeHandle: 'G1' },
    };
    expect(parseElicitationScratchpadItem(item)).toEqual(item);
  });

  it.each([
    { id: 1, obligation: 'x', disposition: 'open' },
    { id: 'a', obligation: '', disposition: 'open' },
    { id: 'a', obligation: 'x', disposition: 'closed' },
    // CC-03 guard: exchange cancellation demotes by adding an `open`
    // obligation; it never extends the disposition enum.
    { id: 'a', obligation: 'x', disposition: 'cancelled' },
    { id: 'a', obligation: 'x', disposition: 'open', rationale: 5 },
    { id: 'a', obligation: 'x', disposition: 'open', meta: 'not-a-record' },
    { id: 'a', obligation: 'x', disposition: 'open', meta: ['not-a-record'] },
    null,
    'string',
  ])('rejects invalid item %#', (invalid) => {
    expect(parseElicitationScratchpadItem(invalid)).toBeUndefined();
  });
});

describe('parseElicitationScratchpadEntryData', () => {
  it('accepts a well-formed snapshot', () => {
    const items: ElicitationScratchpadItem[] = [{ id: 'a', obligation: 'ask about X', disposition: 'open' }];
    expect(parseElicitationScratchpadEntryData({ schemaVersion: 1, items })).toEqual({
      schemaVersion: 1,
      items,
    });
  });

  it('accepts an empty snapshot', () => {
    expect(parseElicitationScratchpadEntryData({ schemaVersion: 1, items: [] })).toEqual({
      schemaVersion: 1,
      items: [],
    });
  });

  it('rejects a wrong schema version', () => {
    expect(parseElicitationScratchpadEntryData({ schemaVersion: 2, items: [] })).toBeUndefined();
  });

  it('rejects a non-array items field', () => {
    expect(parseElicitationScratchpadEntryData({ schemaVersion: 1, items: 'nope' })).toBeUndefined();
  });

  it('rejects the whole snapshot if any item is invalid', () => {
    expect(
      parseElicitationScratchpadEntryData({
        schemaVersion: 1,
        items: [{ id: 'a', obligation: 'x', disposition: 'open' }, { id: 'bad' }],
      }),
    ).toBeUndefined();
  });
});

describe('latestElicitationScratchpad', () => {
  it('returns an empty scratchpad when no entries exist', () => {
    expect(latestElicitationScratchpad([])).toEqual([]);
  });

  it('reconstructs the current scratchpad from the last valid snapshot on the branch', () => {
    const first = scratchpadEntry([{ id: 'a', obligation: 'ask about X', disposition: 'open' }]);
    const second = scratchpadEntry([
      { id: 'a', obligation: 'ask about X', disposition: 'resolved' },
      { id: 'b', obligation: 'ask about Y', disposition: 'open' },
    ]);

    expect(latestElicitationScratchpad([first, second])).toEqual(second.data.items);
  });

  it('ignores invalid entries and falls back to the last valid snapshot', () => {
    const valid = scratchpadEntry([{ id: 'a', obligation: 'ask about X', disposition: 'open' }]);
    const invalid = {
      type: 'custom',
      customType: BRUNCH_ELICITATION_SCRATCHPAD_CUSTOM_TYPE,
      data: { schemaVersion: 1, items: [{ id: 'bad' }] },
    };

    expect(latestElicitationScratchpad([valid, invalid])).toEqual(valid.data.items);
  });

  it('ignores entries of other custom types and non-custom entries', () => {
    const other = { type: 'custom', customType: 'brunch.agent_runtime_state', data: { anything: true } };
    const message = { type: 'message', role: 'user', content: 'hi' };
    const valid = scratchpadEntry([{ id: 'a', obligation: 'ask about X', disposition: 'open' }]);

    expect(latestElicitationScratchpad([other, message, valid])).toEqual(valid.data.items);
  });
});

describe('appendElicitationScratchpadSnapshot', () => {
  it('appends a full-replacement snapshot that latestElicitationScratchpad reconstructs', () => {
    const sessionManager = new FakeScratchpadSessionManager();

    appendElicitationScratchpadSnapshot(sessionManager, [
      { id: 'a', obligation: 'ask about X', disposition: 'open' },
    ]);
    appendElicitationScratchpadSnapshot(sessionManager, [
      { id: 'a', obligation: 'ask about X', disposition: 'resolved' },
      { id: 'b', obligation: 'ask about Y', disposition: 'open' },
    ]);

    expect(latestElicitationScratchpad(sessionManager.getEntries())).toEqual([
      { id: 'a', obligation: 'ask about X', disposition: 'resolved' },
      { id: 'b', obligation: 'ask about Y', disposition: 'open' },
    ]);
  });
});
