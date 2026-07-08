import { getSelectListTheme } from '@earendil-works/pi-coding-agent';
import { TUI } from '@earendil-works/pi-tui';
import type { EditorTheme } from '@earendil-works/pi-tui';
import { describe, expect, it, vi } from 'vitest';

import { createTestLabTheme } from '../../__tests__/support/tui-theme.js';
import { VirtualTerminal } from '../../__tests__/support/virtual-terminal.js';
import { ExchangeAnswerEditorComponent } from '../exchange-answer-editor.js';

const labTheme = createTestLabTheme();
const editorTheme: EditorTheme = {
  borderColor: (str: string) => labTheme.fg('border', str),
  selectList: getSelectListTheme(),
};

describe('ExchangeAnswerEditorComponent harness', () => {
  it('routes typing, newline, submit, and cancel through the real TUI focus path', async () => {
    const terminal = new VirtualTerminal(80, 24);
    const tui = new TUI(terminal);
    const onDone = vi.fn();
    const component = new ExchangeAnswerEditorComponent(tui, editorTheme, {
      body: 'What should Brunch remember?',
      theme: labTheme,
      onDone,
    });

    tui.addChild(component);
    tui.setFocus(component);
    terminal.clearScreen();
    tui.start();

    try {
      await terminal.waitForRender();
      expect(terminal.getViewport().join('\n')).toContain('What should Brunch remember?');

      terminal.sendInput('first line');
      await terminal.waitForRender();
      expect(component.getText()).toBe('first line');
      expect(terminal.getViewport().join('\n')).toContain('first line');

      terminal.sendInput('\n');
      terminal.sendInput('second line');
      await terminal.waitForRender();
      expect(component.getText()).toBe('first line\nsecond line');

      terminal.sendInput('\r');
      expect(onDone).toHaveBeenCalledWith('first line\nsecond line');
    } finally {
      terminal.stop();
      tui.stop();
    }
  });

  it('resolves undefined on escape', async () => {
    const terminal = new VirtualTerminal(80, 24);
    const tui = new TUI(terminal);
    const onDone = vi.fn();
    const component = new ExchangeAnswerEditorComponent(tui, editorTheme, {
      body: 'Cancel?',
      theme: labTheme,
      onDone,
    });

    tui.addChild(component);
    tui.setFocus(component);
    terminal.clearScreen();
    tui.start();

    try {
      await terminal.waitForRender();
      terminal.sendInput('\x1b');
      expect(onDone).toHaveBeenCalledWith(undefined);
    } finally {
      terminal.stop();
      tui.stop();
    }
  });
});
