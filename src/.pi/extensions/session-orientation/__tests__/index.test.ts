import { describe, expect, it } from 'vitest';

import {
  buildSessionOrientationMenu,
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
    expect(CODE_SESSION_ORIENTATION_MENU).toMatchObject({
      title: 'Choose a process move for Execute mode',
      items: [{ id: 'prepare_execution', label: 'Prepare execution' }],
    });
  });

  it('builds exact mode-appropriate menus from fallback or explicit availability', () => {
    expect(buildSessionOrientationMenu({ mode: 'specify', currentStyle: 'disambiguate' })).toMatchObject({
      initialSelectedId: 'disambiguate',
      items: [
        { id: 'interrogate', label: 'Work via intent' },
        { id: 'disambiguate', label: 'Work via examples', current: true },
        { id: 'propose', label: 'Work via proposals' },
      ],
    });
    expect(
      buildSessionOrientationMenu({
        mode: 'specify',
        availability: { move_to_execution: true },
      }).items.map(({ id, label }) => ({ id, label })),
    ).toEqual([
      { id: 'interrogate', label: 'Work via intent' },
      { id: 'disambiguate', label: 'Work via examples' },
      { id: 'propose', label: 'Work via proposals' },
      { id: 'move_to_execution', label: 'Move to execution' },
    ]);
    expect(buildSessionOrientationMenu({ mode: 'execute' }).items.map(({ id }) => id)).toEqual([
      'prepare_execution',
    ]);
    expect(
      buildSessionOrientationMenu({
        mode: 'execute',
        availability: { compile_plan: true, execute_plan: true, move_to_execution: true },
      }).items.map(({ id, label }) => ({ id, label })),
    ).toEqual([
      { id: 'prepare_execution', label: 'Prepare execution' },
      { id: 'compile_plan', label: 'Compile a plan' },
      { id: 'execute_plan', label: 'Execute the plan' },
    ]);
  });

  it.each([undefined, null, new Error('failed'), { compile_plan: true }])(
    'uses conservative fallback for absent or failure-shaped availability',
    (availability) => {
      expect(
        buildSessionOrientationMenu({ mode: 'specify', availability: availability as never }).items.map(
          ({ id }) => id,
        ),
      ).toEqual(['interrogate', 'disambiguate', 'propose']);
    },
  );

  it('dismissal yields no choice and writes nothing', async () => {
    const writes: unknown[] = [];
    const result = await runAndRecordSessionOrientation({
      hasUI: true,
      ui: { select: async () => undefined },
      trigger: 'consult',
      currentStyle: 'disambiguate',
      manager: { appendCustomEntry: (type, data) => writes.push({ type, data }) },
    });
    expect(result).toBeUndefined();
    expect(writes).toEqual([]);
  });

  it('same-style selection remains a choice but writes nothing', async () => {
    const writes: unknown[] = [];
    const result = await runAndRecordSessionOrientation({
      hasUI: true,
      ui: { select: async () => 'Work via examples' },
      trigger: 'consult',
      currentStyle: 'disambiguate',
      manager: { appendCustomEntry: (type, data) => writes.push({ type, data }) },
    });
    expect(result).toEqual({ choice: 'disambiguate', recorded: false, appendFailed: false });
    expect(writes).toEqual([]);
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
