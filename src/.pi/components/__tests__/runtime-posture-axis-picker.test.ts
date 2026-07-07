import { describe, expect, it } from 'vitest';

import {
  OPERATIONAL_MODE_IDS,
  operationalModeLabel,
  type OperationalModeId,
} from '../../../session/schema/kinds.js';
import { createTestLabTheme } from '../../__tests__/support/tui-theme.js';
import { createRuntimeModePickerComponent } from '../runtime-posture/axis-picker.js';

const theme = createTestLabTheme();

describe('runtime posture picker overlays', () => {
  it('renders every mode and highlights the current projection', () => {
    const component = createRuntimeModePickerComponent({
      current: 'execute',
      theme,
      onDone: () => {},
    });

    const text = component.render(120).join('\n');

    expect(text).toContain('Choose Brunch mode');
    for (const mode of OPERATIONAL_MODE_IDS) {
      expect(text).toContain(operationalModeLabel(mode));
    }
    expect(text).toContain(`\x1b[48;5;34m\x1b[30m ${operationalModeLabel('execute')} `);
    expect(text).toContain(`\x1b[38;5;34m${operationalModeLabel('execute')}\x1b[39m`);
  });

  it('cycles and wraps selection with arrow and hj-style keys', () => {
    const component = createRuntimeModePickerComponent({
      current: 'specify',
      theme,
      onDone: () => {},
    });

    component.handleInput?.('\x1b[D');
    expect(component.render(120).join('\n')).toContain(
      `\x1b[48;5;33m\x1b[30m ${operationalModeLabel('execute')} `,
    );

    component.handleInput?.('l');
    expect(component.render(120).join('\n')).toContain(
      `\x1b[48;5;34m\x1b[30m ${operationalModeLabel('specify')} `,
    );

    component.handleInput?.('j');
    expect(component.render(120).join('\n')).toContain(
      `\x1b[48;5;33m\x1b[30m ${operationalModeLabel('execute')} `,
    );

    component.handleInput?.('k');
    expect(component.render(120).join('\n')).toContain(
      `\x1b[48;5;34m\x1b[30m ${operationalModeLabel('specify')} `,
    );
  });

  it('returns selected mode value on enter', () => {
    const selected: OperationalModeId[] = [];
    const component = createRuntimeModePickerComponent({
      current: 'specify',
      theme,
      onDone: (value: OperationalModeId | undefined) => {
        if (value) selected.push(value);
      },
    });

    component.handleInput?.('\x1b[C');
    component.handleInput?.('\r');
    expect(selected).toEqual(['execute']);
  });

  it('cancels on escape or q without a value', () => {
    for (const key of ['\x1b', 'q']) {
      const selected: Array<OperationalModeId | undefined> = [];
      const component = createRuntimeModePickerComponent({
        current: 'specify',
        theme,
        onDone: (value: OperationalModeId | undefined) => selected.push(value),
      });

      component.handleInput?.(key);
      expect(selected).toEqual([undefined]);
    }
  });

  it('uses human-facing mode labels in the picker header and segments', () => {
    const component = createRuntimeModePickerComponent({
      current: 'specify',
      theme,
      onDone: () => {},
    });

    const text = component.render(200).join('\n');
    expect(text).toContain('Choose Brunch mode');
    expect(text).toContain(operationalModeLabel('specify'));
    expect(text).toContain(operationalModeLabel('execute'));
  });
});
