import { describe, expect, it } from 'vitest';

import {
  CODE_SESSION_ORIENTATION_MENU,
  DETERMINISTIC_PROCESS_MOVE_AVAILABILITY,
  runAndRecordSessionOrientation,
  SESSION_ORIENTATION_MENU,
} from '../index.js';

describe('session orientation boundary', () => {
  it('exports the model-independent conservative fallback', () => {
    expect(DETERMINISTIC_PROCESS_MOVE_AVAILABILITY).toEqual({
      specify: {
        move_to_execution: false,
        prepare_execution: false,
        compile_plan: false,
        execute_plan: false,
      },
      execute: {
        move_to_execution: false,
        prepare_execution: true,
        compile_plan: false,
        execute_plan: false,
      },
    });
    expect(SESSION_ORIENTATION_MENU.items.map(({ id }) => id)).toEqual([
      'interrogate',
      'disambiguate',
      'propose',
    ]);
    expect(CODE_SESSION_ORIENTATION_MENU.items.map(({ id }) => id)).toEqual(['prepare_execution']);
  });

  it('dismissal and same-style selection write nothing', async () => {
    for (const picked of [undefined, 'Work via examples']) {
      const writes: unknown[] = [];
      const result = await runAndRecordSessionOrientation({
        hasUI: true,
        ui: { select: async () => picked },
        trigger: 'consult',
        currentStyle: 'disambiguate',
        manager: { appendCustomEntry: (type, data) => writes.push({ type, data }) },
      });
      expect(result?.appendFailed).toBe(false);
      expect(writes).toEqual([]);
    }
  });

  it('writes only the selected narrow carrier', async () => {
    const writes: unknown[] = [];
    await runAndRecordSessionOrientation({
      hasUI: true,
      ui: { select: async () => 'Work via proposals' },
      trigger: 'consult',
      manager: { appendCustomEntry: (type, data) => writes.push({ type, data }) },
    });
    expect(writes).toEqual([
      { type: 'brunch.elicitation_style', data: { schemaVersion: 1, style: 'propose' } },
    ]);
  });
});
