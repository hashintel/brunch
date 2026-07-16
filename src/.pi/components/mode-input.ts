import { Key, matchesKey, type Component } from '@earendil-works/pi-tui';

import { projectRoundedBox } from './rounded-box.js';
import type { LabTheme } from './tui-lab/index.js';

export class ModeInputComponent implements Component {
  #value = '';

  constructor(
    private readonly options: {
      readonly prompt: string;
      readonly theme: LabTheme;
      readonly borderColor: (text: string) => string;
      readonly allowEmpty?: boolean;
      readonly onDone: (value?: string) => void;
    },
  ) {}

  render(width: number): string[] {
    return projectRoundedBox(
      [
        this.options.prompt,
        '',
        `› ${this.#value}`,
        '',
        this.options.theme.fg('dim', 'enter submits · esc goes back'),
      ],
      { padding: { x: 2, top: 1, bottom: 1 } },
      Math.max(16, width),
      this.options.borderColor,
    );
  }

  handleInput(data: string): void {
    if (matchesKey(data, Key.escape) || matchesKey(data, Key.ctrl('c'))) return this.options.onDone();
    if (matchesKey(data, Key.enter)) {
      const value = this.#value.trim();
      if (value || this.options.allowEmpty) this.options.onDone(value);
      return;
    }
    if (matchesKey(data, Key.backspace)) {
      this.#value = this.#value.slice(0, -1);
      return;
    }
    this.#value += Array.from(data)
      .filter((char) => char >= ' ' && char !== '\u007f')
      .join('');
  }

  invalidate(): void {}
}
