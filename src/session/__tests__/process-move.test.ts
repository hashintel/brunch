import { describe, expect, it } from 'vitest';

import { BRUNCH_ELICITATION_STYLE_CUSTOM_TYPE } from '../elicitation-style.js';
import {
  BRUNCH_PROCESS_MOVE_CUSTOM_TYPE,
  freshProcessMove,
  parseProcessMoveEntryData,
} from '../process-move.js';

const move = (value: string) => ({
  type: 'custom',
  customType: BRUNCH_PROCESS_MOVE_CUSTOM_TYPE,
  data: { schemaVersion: 1, move: value },
});

describe('process move', () => {
  it('accepts exactly four canonical moves and fails closed', () => {
    for (const value of ['move_to_execution', 'prepare_execution', 'compile_plan', 'execute_plan'])
      expect(parseProcessMoveEntryData({ schemaVersion: 1, move: value })).toEqual({
        schemaVersion: 1,
        move: value,
      });
    for (const value of ['proceed', 'backfill', 'continue', 'dismissed', undefined])
      expect(parseProcessMoveEntryData({ schemaVersion: 1, move: value })).toBeUndefined();
  });

  it('is fresh only after the latest kick and is consumed by the next kick', () => {
    const entries = [move('prepare_execution')];
    expect(freshProcessMove(entries, 'brunch.kick')).toBe('prepare_execution');
    expect(
      freshProcessMove([...entries, { type: 'custom_message', customType: 'brunch.kick' }], 'brunch.kick'),
    ).toBeUndefined();
  });

  it('does not fold style entries as moves', () => {
    expect(
      freshProcessMove(
        [
          {
            type: 'custom',
            customType: BRUNCH_ELICITATION_STYLE_CUSTOM_TYPE,
            data: { schemaVersion: 1, style: 'propose' },
          },
          move('execute_plan'),
        ],
        'brunch.kick',
      ),
    ).toBe('execute_plan');
  });
});
