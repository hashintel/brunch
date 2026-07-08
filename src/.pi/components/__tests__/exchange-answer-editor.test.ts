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

function createComponent(onDone = vi.fn(), body = 'What problem are we solving?') {
  const terminal = new VirtualTerminal(80, 24);
  const tui = new TUI(terminal);
  return {
    terminal,
    tui,
    onDone,
    component: new ExchangeAnswerEditorComponent(tui, editorTheme, {
      body,
      theme: labTheme,
      onDone,
    }),
  };
}

describe('ExchangeAnswerEditorComponent', () => {
  it('renders the body, stripped editor content, help, padding, and no editor rule rows inside a rounded box', () => {
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

  it('renders a multi-line markdown body as real lines inside the box borders', () => {
    const { component } = createComponent(
      vi.fn(),
      'This is a **free-text** question. No options.\n\nWhat is your name?',
    );

    const lines = stripLines(component.render(72));

    // Every rendered element must be a single physical line: an embedded newline
    // breaks the rounded-box borders and the TUI's differential height accounting
    // (the walkthrough-observed free-text corruption).
    expect(lines.some((line) => line.includes('\n'))).toBe(false);
    const nameLine = lines.find((line) => line.includes('What is your name?'));
    expect(nameLine).toBeDefined();
    expect(nameLine).toContain('│');
    // Markdown is rendered, not passed through raw.
    expect(lines.join('\n')).not.toContain('**free-text**');
  });

  it('keeps the editor mounted and renders a warning on empty submit', () => {
    const onDone = vi.fn();
    const { component } = createComponent(onDone);

    component.handleInput('\r');

    expect(onDone).not.toHaveBeenCalled();
    expect(stripLines(component.render(72)).join('\n')).toContain('Enter an answer, or Esc to cancel.');
  });
});
