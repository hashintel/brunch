import type { KeybindingsManager } from '@earendil-works/pi-coding-agent';
import {
  KeybindingsManager as PiTuiKeybindingsManager,
  TUI,
  TUI_KEYBINDINGS,
  visibleWidth,
  type AutocompleteProvider,
  type KeybindingDefinitions,
} from '@earendil-works/pi-tui';
import type { EditorTheme } from '@earendil-works/pi-tui';
import { describe, expect, it } from 'vitest';

import { createTestLabTheme } from '../../__tests__/support/tui-theme.js';
import { VirtualTerminal } from '../../__tests__/support/virtual-terminal.js';
import { BrunchEditorComponent } from '../brunch-editor.js';

const labTheme = createTestLabTheme();
const editorTheme: EditorTheme = {
  borderColor: (str: string) => labTheme.fg('accent', str),
  selectList: {
    selectedPrefix: (text) => text,
    selectedText: (text) => text,
    description: (text) => text,
    scrollInfo: (text) => text,
    noMatch: (text) => text,
  },
};
// CustomEditor's own handleInput needs a real KeybindingsManager (it calls
// `.matches(...)` for app-level actions: escape-to-cancel, ctrl+d-to-exit)
// — unlike render-only components, this one can't stub keybindings as
// undefined. pi-coding-agent's own KeybindingsManager subclass is type-only
// from the public entry, and its full app-action table isn't exported
// either, so this constructs the real pi-tui base class with TUI_KEYBINDINGS
// plus the two app-level actions BrunchEditorComponent actually depends on
// (mirrors src/dev/component-preview.ts's createComponentPreviewKeybindings)
// and casts — CustomEditor.handleInput only calls base-class methods.
const keybindingDefinitions: KeybindingDefinitions = {
  ...TUI_KEYBINDINGS,
  'app.interrupt': { defaultKeys: ['escape', 'ctrl+c'], description: 'Cancel' },
  'app.exit': { defaultKeys: 'ctrl+d', description: 'Exit' },
} as unknown as KeybindingDefinitions;
const keybindings = new PiTuiKeybindingsManager(keybindingDefinitions) as unknown as KeybindingsManager;

describe('BrunchEditorComponent harness', () => {
  it('renders a labeled box around real typed input through real TUI input routing', async () => {
    const terminal = new VirtualTerminal(60, 24);
    const tui = new TUI(terminal);

    const editor = new BrunchEditorComponent(tui, editorTheme, keybindings, () => ({
      topRight: '[ Specify ]',
      bottomRight: '"Alpha Spec"',
      belowLines: ['http://localhost:3141/session', 'claude-sonnet-5 | 35.6%'],
    }));

    tui.addChild(editor);
    tui.setFocus(editor);
    editor.focused = true;
    terminal.clearScreen();
    tui.start();

    try {
      await terminal.waitForRender();

      let viewport = terminal.getViewport().join('\n');
      expect(viewport).toContain('[ Specify ]');
      expect(viewport).toContain('"Alpha Spec"');
      expect(viewport).toContain('http://localhost:3141/session');
      expect(viewport).toContain('claude-sonnet-5 | 35.6%');

      const lines = terminal.getViewport();
      expect(lines[0]?.trimEnd().endsWith('╮')).toBe(true);
      expect(lines[0]?.includes('╭')).toBe(true);

      terminal.sendInput('hello world');
      await terminal.waitForRender();
      viewport = terminal.getViewport().join('\n');
      expect(viewport).toContain('hello world');
      // Content lines are boxed on both sides.
      const contentLine = terminal.getViewport().find((line) => line.includes('hello world'));
      expect(contentLine?.trimStart().startsWith('│')).toBe(true);
    } finally {
      terminal.stop();
      tui.stop();
    }
  });

  it('keeps autocomplete rows inside the box at multiple widths', async () => {
    const autocompleteProvider: AutocompleteProvider = {
      triggerCharacters: ['@'],
      getSuggestions: async () => ({
        prefix: '@',
        items: [
          { value: '@alpha', label: '@alpha', description: 'first suggestion' },
          { value: '@beta', label: '@beta', description: 'second suggestion' },
        ],
      }),
      applyCompletion: (lines, cursorLine, cursorCol, item) => ({
        lines: [lines[cursorLine]!.slice(0, cursorCol - 1) + item.value],
        cursorLine,
        cursorCol: item.value.length,
      }),
    };

    for (const width of [48, 72]) {
      const terminal = new VirtualTerminal(width, 24);
      const tui = new TUI(terminal);
      const editor = new BrunchEditorComponent(tui, editorTheme, keybindings, () => ({
        topRight: '[ Specify ]',
        bottomRight: 'Alpha Spec',
      }));
      editor.setAutocompleteProvider(autocompleteProvider);
      tui.addChild(editor);
      tui.setFocus(editor);
      editor.focused = true;
      terminal.clearScreen();
      tui.start();

      try {
        await terminal.waitForRender();
        terminal.sendInput('@');
        await waitForViewport(terminal, (viewport) => viewport.some((line) => line.includes('@alpha')));

        const viewport = terminal.getViewport();
        expect(viewport.every((line) => visibleWidth(line) <= width)).toBe(true);
        const suggestionLine = viewport.find((line) => line.includes('@alpha'));
        expect(suggestionLine?.trimStart().startsWith('│')).toBe(true);
        expect(suggestionLine?.trimEnd().endsWith('│')).toBe(true);
      } finally {
        terminal.stop();
        tui.stop();
      }
    }
  });

  it('routes basic typing and programmatic setText through the real Editor', async () => {
    const terminal = new VirtualTerminal(60, 24);
    const tui = new TUI(terminal);

    const editor = new BrunchEditorComponent(tui, editorTheme, keybindings, () => ({}));
    tui.addChild(editor);
    tui.setFocus(editor);
    editor.focused = true;
    terminal.clearScreen();
    tui.start();

    try {
      await terminal.waitForRender();
      terminal.sendInput('abc');
      await terminal.waitForRender();
      expect(editor.getText()).toBe('abc');

      editor.setText('');
      await terminal.waitForRender();
      expect(editor.getText()).toBe('');
    } finally {
      terminal.stop();
      tui.stop();
    }
  });

  it('fires the inherited CustomEditor onEscape hook on the real escape byte', async () => {
    const terminal = new VirtualTerminal(60, 24);
    const tui = new TUI(terminal);

    const editor = new BrunchEditorComponent(tui, editorTheme, keybindings, () => ({}));
    let escaped = false;
    editor.onEscape = () => {
      escaped = true;
    };
    tui.addChild(editor);
    tui.setFocus(editor);
    editor.focused = true;
    terminal.clearScreen();
    tui.start();

    try {
      await terminal.waitForRender();
      terminal.sendInput('\x1b');
      expect(escaped).toBe(true);
    } finally {
      terminal.stop();
      tui.stop();
    }
  });

  it('fires the inherited CustomEditor onCtrlD hook only when the editor is empty', async () => {
    const terminal = new VirtualTerminal(60, 24);
    const tui = new TUI(terminal);

    const editor = new BrunchEditorComponent(tui, editorTheme, keybindings, () => ({}));
    let ctrlDCount = 0;
    editor.onCtrlD = () => {
      ctrlDCount++;
    };
    tui.addChild(editor);
    tui.setFocus(editor);
    editor.focused = true;
    terminal.clearScreen();
    tui.start();

    try {
      await terminal.waitForRender();
      terminal.sendInput('abc');
      await terminal.waitForRender();
      terminal.sendInput('\x04');
      expect(ctrlDCount).toBe(0); // not empty — falls through to delete-char-forward

      editor.setText('');
      await terminal.waitForRender();
      terminal.sendInput('\x04');
      expect(ctrlDCount).toBe(1);
    } finally {
      terminal.stop();
      tui.stop();
    }
  });
});

async function waitForViewport(
  terminal: VirtualTerminal,
  predicate: (viewport: readonly string[]) => boolean,
): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await terminal.waitForRender();
    if (predicate(terminal.getViewport())) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 5));
  }
  expect(predicate(terminal.getViewport())).toBe(true);
}
