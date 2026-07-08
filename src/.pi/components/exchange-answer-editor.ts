import { Editor, Key, matchesKey } from '@earendil-works/pi-tui';
import type { Component, EditorTheme, TUI } from '@earendil-works/pi-tui';

import { findLastIndex, isEditorBorderLine, padContentToMinimum, stripEditorBorder } from './editor-lines.js';
import {
  projectRoundedBox,
  roundedBoxInnerWidth,
  stackSections,
  type RoundedBoxPadding,
} from './rounded-box.js';
import { safeLines, type LabTheme } from './tui-lab/index.js';

export interface ExchangeAnswerEditorOptions {
  readonly prompt: string;
  readonly theme: LabTheme;
  readonly onDone: (result?: string) => void;
}

const BOX_PADDING: RoundedBoxPadding = { x: 2, top: 1, bottom: 1 };
const MIN_EDITOR_LINES = 2;
const HELP_LINE = 'enter submits · shift+enter/ctrl+j newline · esc cancels';
const EMPTY_WARNING = 'Enter an answer, or Esc to cancel.';

export class ExchangeAnswerEditorComponent implements Component {
  readonly #editor: Editor;
  #warning: string | undefined;
  #focused = false;

  get focused(): boolean {
    return this.#focused;
  }

  set focused(value: boolean) {
    this.#focused = value;
    this.#editor.focused = value;
  }

  constructor(
    tui: TUI,
    editorTheme: EditorTheme,
    private readonly options: ExchangeAnswerEditorOptions,
  ) {
    this.#editor = new Editor(tui, editorTheme, { paddingX: 0 });
    this.#editor.onSubmit = (text) => {
      // Trimmed on submit so TUI answers match the RPC path, which trims in
      // acceptedResponseFromParams before projecting.
      const answer = text.trim();
      if (answer.length === 0) {
        this.#warning = EMPTY_WARNING;
        return;
      }
      this.options.onDone(answer);
    };
  }

  render(width: number): string[] {
    const safeWidth = Math.max(16, width);
    const contentWidth = Math.max(1, roundedBoxInnerWidth(safeWidth, BOX_PADDING));
    const editorLines = this.#editor.render(contentWidth);
    const bottomIndex = findLastIndex(editorLines, isEditorBorderLine);
    const { contentLines, trailingLines } = stripEditorBorder(editorLines, bottomIndex);
    const editorContent = padContentToMinimum(contentLines, MIN_EDITOR_LINES, contentWidth);
    const warning = this.#warning ? [this.options.theme.fg('warning', this.#warning)] : [];
    const stacked = stackSections([
      [this.options.theme.fg('accent', this.options.prompt)],
      [...editorContent],
      warning,
      [this.options.theme.fg('dim', HELP_LINE)],
      trailingLines,
    ]);
    const box = projectRoundedBox(
      safeLines(stacked.lines, contentWidth),
      { padding: BOX_PADDING },
      safeWidth,
      (text) => this.options.theme.fg('accent', text),
    );
    box.push('');
    return box;
  }

  handleInput(data: string): void {
    if (matchesKey(data, Key.escape) || matchesKey(data, Key.ctrl('c'))) {
      this.options.onDone(undefined);
      return;
    }
    // ceiling: ctrl+g external editor is deferred; reuse pi's ExtensionEditorComponent spawn flow if this surface needs it.
    if (matchesKey(data, Key.ctrl('g'))) return;
    this.#warning = undefined;
    this.#editor.handleInput(data);
  }

  invalidate(): void {
    this.#editor.invalidate();
  }

  getText(): string {
    return this.#editor.getText();
  }

  setText(text: string): void {
    this.#editor.setText(text);
  }
}
