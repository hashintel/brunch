import { type Component } from '@earendil-works/pi-tui';

import {
  projectRoundedBox,
  roundedBoxInnerWidth,
  stackSections,
  type RoundedBoxPadding,
} from './rounded-box.js';
import { safeLines, type LabTheme } from './tui-lab/index.js';

export interface MultiChoicePickerChoice {
  readonly id: string;
  readonly label: string;
}

export interface MultiChoicePickerResult {
  readonly choices: readonly MultiChoicePickerChoice[];
}

export interface MultiChoicePickerOptions {
  readonly prompt: string;
  readonly choices: readonly MultiChoicePickerChoice[];
  readonly theme: LabTheme;
  readonly onDone: (result?: MultiChoicePickerResult) => void;
}

const BOX_PADDING: RoundedBoxPadding = { x: 2, top: 1, bottom: 1 };

export class MultiChoicePickerComponent implements Component {
  #activeIndex = 0;
  readonly #selected = new Set<string>();
  #warning: string | undefined;

  constructor(private readonly options: MultiChoicePickerOptions) {}

  render(width: number): string[] {
    const safeWidth = Math.max(1, width);
    const contentWidth = Math.max(1, roundedBoxInnerWidth(safeWidth, BOX_PADDING));
    const { theme } = this.options;
    const stacked = stackSections([
      [theme.fg('accent', this.options.prompt)],
      this.options.choices.map((choice, index) => this.#choiceLine(choice, index)),
      [
        ...(this.#warning ? [theme.fg('warning', this.#warning)] : []),
        theme.fg('dim', '↑/↓ move · space toggles · enter commits · esc/q cancels'),
      ],
    ]);
    const lines = safeLines(stacked.lines, contentWidth);
    const box = projectRoundedBox(lines, { padding: BOX_PADDING }, safeWidth, (text) =>
      theme.fg('accent', text),
    );
    box.push('');
    return box;
  }

  handleInput(data: string): void {
    if (data === '\x1b' || data === 'q') {
      this.options.onDone();
      return;
    }
    if (data === '\r' || data === '\n') {
      const choices = this.options.choices.filter((choice) => this.#selected.has(choice.id));
      if (choices.length === 0) {
        this.#warning = 'Select at least one option.';
        return;
      }
      this.options.onDone({ choices });
      return;
    }
    if (data === ' ') {
      this.#toggleActive();
      return;
    }
    if (data === '\x1b[B' || data === 'j') {
      this.#move(1);
      return;
    }
    if (data === '\x1b[A' || data === 'k') this.#move(-1);
  }

  invalidate(): void {}

  #choiceLine(choice: MultiChoicePickerChoice, index: number): string {
    const { theme } = this.options;
    const active = index === this.#activeIndex;
    const selected = this.#selected.has(choice.id);
    const marker = active ? theme.fg('accent', '›') : ' ';
    const checkbox = selected ? theme.fg('success', '[x]') : theme.fg('dim', '[ ]');
    const label = selected ? (theme.bold?.(choice.label) ?? choice.label) : choice.label;
    return `${marker} ${checkbox} ${label}`;
  }

  #toggleActive(): void {
    const active = this.options.choices[this.#activeIndex];
    if (!active) return;
    this.#warning = undefined;
    if (this.#selected.has(active.id)) {
      this.#selected.delete(active.id);
      return;
    }
    this.#selected.add(active.id);
  }

  #move(delta: number): void {
    this.#warning = undefined;
    const length = this.options.choices.length;
    if (length === 0) return;
    this.#activeIndex = (this.#activeIndex + delta + length) % length;
  }
}

export function createMultiChoicePickerComponent(
  options: MultiChoicePickerOptions,
): MultiChoicePickerComponent {
  return new MultiChoicePickerComponent(options);
}
