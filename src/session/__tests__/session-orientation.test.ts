import { describe, expect, it } from 'vitest';

import {
  BRUNCH_SESSION_ORIENTATION_CUSTOM_TYPE,
  appendSessionOrientationEntry,
  freshSessionOrientationChoice,
  latestSessionOrientation,
  parseSessionOrientationEntryData,
  type SessionOrientationChoice,
  type SessionOrientationEntryData,
  type SessionOrientationTrigger,
} from '../session-orientation.js';

const KICK_CUSTOM_TYPE = 'brunch.kick';

function orientationEntry(choice: SessionOrientationChoice, trigger: SessionOrientationTrigger) {
  return {
    type: 'custom',
    customType: BRUNCH_SESSION_ORIENTATION_CUSTOM_TYPE,
    data: { schemaVersion: 1, choice, trigger } satisfies SessionOrientationEntryData,
  };
}

function kickEntry() {
  return { type: 'custom_message', customType: KICK_CUSTOM_TYPE, content: 'kick', details: {} };
}

class FakeOrientationSessionManager {
  entries: Array<{ type: 'custom'; customType: string; data: SessionOrientationEntryData }> = [];

  appendCustomEntry(customType: string, data: SessionOrientationEntryData) {
    this.entries.push({ type: 'custom', customType, data });
  }
}

describe('parseSessionOrientationEntryData', () => {
  it('accepts a well-formed SPEC-side resolution', () => {
    expect(
      parseSessionOrientationEntryData({ schemaVersion: 1, choice: 'ingest', trigger: 'consult' }),
    ).toEqual({
      schemaVersion: 1,
      choice: 'ingest',
      trigger: 'consult',
    });
  });

  it('accepts a well-formed CODE-side resolution on the same carrier', () => {
    expect(
      parseSessionOrientationEntryData({ schemaVersion: 1, choice: 'design_first', trigger: 'mode-switch' }),
    ).toEqual({
      schemaVersion: 1,
      choice: 'design_first',
      trigger: 'mode-switch',
    });
  });

  it('accepts an inert dismissed resolution (escape/timeout)', () => {
    expect(
      parseSessionOrientationEntryData({ schemaVersion: 1, choice: 'dismissed', trigger: 'entry' }),
    ).toEqual({
      schemaVersion: 1,
      choice: 'dismissed',
      trigger: 'entry',
    });
  });

  it.each([
    { schemaVersion: 2, choice: 'continue', trigger: 'entry' },
    { schemaVersion: 1, choice: 'not-a-choice', trigger: 'entry' },
    { schemaVersion: 1, choice: 'continue', trigger: 'not-a-trigger' },
    null,
    'string',
  ])('rejects invalid data %#', (invalid) => {
    expect(parseSessionOrientationEntryData(invalid)).toBeUndefined();
  });
});

describe('latestSessionOrientation', () => {
  it('returns undefined when no entries exist', () => {
    expect(latestSessionOrientation([])).toBeUndefined();
  });

  it('reconstructs the latest resolution from the branch', () => {
    const first = orientationEntry('elicit_decisions', 'entry');
    const second = orientationEntry('ingest', 'consult');

    const result = latestSessionOrientation([first, second]);
    expect(result?.data).toEqual(second.data);
    expect(result?.index).toBe(1);
  });

  it('ignores invalid entries and falls back to the last valid one', () => {
    const valid = orientationEntry('propose_intent', 'tree');
    const invalid = {
      type: 'custom',
      customType: BRUNCH_SESSION_ORIENTATION_CUSTOM_TYPE,
      data: { schemaVersion: 1, choice: 'bogus', trigger: 'entry' },
    };

    expect(latestSessionOrientation([valid, invalid])?.data).toEqual(valid.data);
  });

  it('ignores entries of other custom types and non-custom entries', () => {
    const other = { type: 'custom', customType: 'brunch.agent_runtime_state', data: { anything: true } };
    const message = { type: 'message', role: 'user', content: 'hi' };
    const valid = orientationEntry('propose_oracle', 'abort');

    expect(latestSessionOrientation([other, message, valid])?.data).toEqual(valid.data);
  });
});

describe('freshSessionOrientationChoice', () => {
  it('returns undefined when no orientation entry exists', () => {
    expect(freshSessionOrientationChoice([], KICK_CUSTOM_TYPE)).toBeUndefined();
  });

  it('returns the choice when no kick has fired since', () => {
    const entries = [orientationEntry('elicit_examples', 'entry')];
    expect(freshSessionOrientationChoice(entries, KICK_CUSTOM_TYPE)).toBe('elicit_examples');
  });

  it('returns the choice when it was recorded after the last kick', () => {
    const entries = [kickEntry(), orientationEntry('propose_design', 'consult')];
    expect(freshSessionOrientationChoice(entries, KICK_CUSTOM_TYPE)).toBe('propose_design');
  });

  it('treats a choice recorded before the last kick as stale — never re-routes a later kick', () => {
    const entries = [orientationEntry('ingest', 'entry'), kickEntry()];
    expect(freshSessionOrientationChoice(entries, KICK_CUSTOM_TYPE)).toBeUndefined();
  });
});

describe('appendSessionOrientationEntry', () => {
  it('appends a resolution that latestSessionOrientation reconstructs', () => {
    const sessionManager = new FakeOrientationSessionManager();

    appendSessionOrientationEntry(sessionManager, { choice: 'continue', trigger: 'entry' });
    appendSessionOrientationEntry(sessionManager, { choice: 'elicit_decisions', trigger: 'tree' });

    expect(latestSessionOrientation(sessionManager.entries)?.data).toEqual({
      schemaVersion: 1,
      choice: 'elicit_decisions',
      trigger: 'tree',
    });
  });
});
