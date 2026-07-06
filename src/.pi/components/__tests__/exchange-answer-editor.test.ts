import { getSelectListTheme } from '@earendil-works/pi-coding-agent';
import { TUI } from '@earendil-works/pi-tui';
import type { EditorTheme } from '@earendil-works/pi-tui';
import { describe, expect, it, vi } from 'vitest';

import { createTestLabTheme } from '../../__tests__/support/tui-theme.js';
import { VirtualTerminal } from '../../__tests__/support/virtual-terminal.js';
import { stripAnsi } from '../editor-lines.js';
import { ExchangeAnswerEditorComponent } from '../exchange-answer-editor.js';

const labTheme = createTestLabTheme();
const editorTheme: EditorTheme = {
  borderColor: (str: string) => labTheme.fg('border', str),
  selectList: getSelectListTheme(),
};

const stripLines = (lines: readonly string[]) => lines.map(stripAnsi);

function createComponent(onDone = vi.fn()) {
  const terminal = new VirtualTerminal(80, 24);
  const tui = new TUI(terminal);
  return {
    terminal,
    tui,
    onDone,
    component: new ExchangeAnswerEditorComponent(tui, editorTheme, {
      prompt: 'What problem are we solving?',
      theme: labTheme,
      onDone,
    }),
  };
}

describe('ExchangeAnswerEditorComponent', () => {
  it('renders the prompt, stripped editor content, help, padding, and no editor rule rows inside a rounded box', () => {
    const { component } = createComponent();
    component.setText('A graph-native spec workspace.');

    const lines = stripLines(component.render(72));
    const body = lines.join('\n');

    expect(lines[0]).toContain('╭');
    expect(body).toContain('What problem are we solving?');
    expect(body).toContain('A graph-native spec workspace.');
    expect(body).toContain('enter submits · shift+enter/ctrl+j newline · esc cancels');
    expect(lines.at(-1)).toBe('');

    const inside = lines.slice(1, -2).map((line) => line.replace(/[│ ]/g, ''));
    expect(inside.some((line) => /^─+$/.test(line))).toBe(false);
  });

  it('keeps the editor mounted and renders a warning on empty submit', () => {
    const onDone = vi.fn();
    const { component } = createComponent(onDone);

    component.handleInput('\r');

    expect(onDone).not.toHaveBeenCalled();
    expect(stripLines(component.render(72)).join('\n')).toContain('Enter an answer, or Esc to cancel.');
  });
});
