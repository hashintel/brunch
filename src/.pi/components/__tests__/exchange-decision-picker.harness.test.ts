import { TuiMainScreen } from '@earendil-works/pi-tui';
import { describe, expect, it } from 'vitest';

import { createTestLabTheme } from '../../__tests__/support/tui-theme.js';
import { VirtualTerminal } from '../../__tests__/support/virtual-terminal.js';
import { ExchangeDecisionPickerComponent } from '../exchange-decision-picker.js';

const theme = createTestLabTheme();

describe('ExchangeDecisionPickerComponent harness', () => {
  it('moves with arrows and j/k, then commits stable ids through real TuiMainScreen input routing', async () => {
    const terminal = new VirtualTerminal(80, 24);
    const tui = new TuiMainScreen(terminal);
    const selected: Array<{ readonly id: string } | undefined> = [];
    const picker = new ExchangeDecisionPickerComponent({
      prompt: 'Choose an option',
      choices: [
        { id: 'first', label: 'First' },
        { id: 'second', label: 'Second' },
        { id: 'third', label: 'Third' },
      ],
      theme,
      onDone: (result) => selected.push(result),
    });

    tui.addChild(picker);
    tui.setFocus(picker);
    terminal.clearScreen();
    tui.start();

    try {
      await terminal.waitForRender();
      expect(terminal.getViewport().join('\n')).toContain('› 1. First');

      terminal.sendInput('\x1b[B');
      await terminal.waitForRender();
      expect(terminal.getViewport().join('\n')).toContain('› 2. Second');

      terminal.sendInput('j');
      await terminal.waitForRender();
      expect(terminal.getViewport().join('\n')).toContain('› 3. Third');

      terminal.sendInput('k');
      await terminal.waitForRender();
      expect(terminal.getViewport().join('\n')).toContain('› 2. Second');

      terminal.sendInput('\r');
      expect(selected).toEqual([{ id: 'second' }]);
    } finally {
      terminal.stop();
      tui.stop();
    }
  });

  it('cancels on Esc or q through real TuiMainScreen input routing', async () => {
    const terminal = new VirtualTerminal(80, 24);
    const tui = new TuiMainScreen(terminal);
    const selected: Array<{ readonly id: string } | undefined> = [];
    const picker = new ExchangeDecisionPickerComponent({
      prompt: 'Choose an option',
      choices: [{ id: 'first', label: 'First' }],
      theme,
      onDone: (result) => selected.push(result),
    });

    tui.addChild(picker);
    tui.setFocus(picker);
    terminal.clearScreen();
    tui.start();

    try {
      await terminal.waitForRender();
      terminal.sendInput('\x1b');
      terminal.sendInput('q');
      expect(selected).toEqual([undefined, undefined]);
    } finally {
      terminal.stop();
      tui.stop();
    }
  });
});
