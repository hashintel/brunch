import { type Component } from '@earendil-works/pi-tui';

import { projectRoundedBox } from './rounded-box.js';
import { projectScrollViewport } from './scroll-viewport.js';
import { safeLines, type LabTheme } from './tui-lab/index.js';

export interface ExchangeDecisionPickerChoice {
  readonly id: string;
  readonly label: string;
}

export interface ExchangeDecisionPickerResult {
  readonly id: string;
}

export interface ExchangeDecisionPickerOptions {
  readonly prompt: string;
  readonly choices: readonly ExchangeDecisionPickerChoice[];
  readonly theme: LabTheme;
  readonly onDone: (result?: ExchangeDecisionPickerResult) => void;
}

const MAX_VISIBLE_CHOICES = 8;
const PADDING_X = 1;

export class ExchangeDecisionPickerComponent implements Component {
  #activeIndex = 0;

  constructor(private readonly options: ExchangeDecisionPickerOptions) {}

  render(width: number): string[] {
    const safeWidth = Math.max(16, width);
    const contentWidth = Math.max(1, safeWidth - 4 - PADDING_X * 2);
    const leftMargin = ' '.repeat(PADDING_X);
    const choiceLines = this.options.choices.map((choice, index) => this.#choiceLine(choice, index));
    const choiceWindow = projectScrollViewport(choiceLines, MAX_VISIBLE_CHOICES, this.#activeIndex);
    const headerLines = [this.options.theme.fg('accent', this.options.prompt), ''];
    const helpLines = ['', this.options.theme.fg('dim', '↑/↓ or j/k move · enter commits · esc/q cancels')];
    const content = safeLines([...headerLines, ...choiceWindow.lines, ...helpLines], contentWidth).map(
      (line) => leftMargin + line,
    );
    const choiceStart = headerLines.length;
    const thumbRows = new Set(
      choiceWindow.isThumbRow.flatMap((isThumb, index) => (isThumb ? [choiceStart + index] : [])),
    );

    const box = projectRoundedBox(
      content,
      { blankPadding: { top: 1, bottom: 1 }, thumbRows },
      safeWidth,
      (text) => this.options.theme.fg('accent', text),
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
      const choice = this.options.choices[this.#activeIndex];
      if (choice) this.options.onDone({ id: choice.id });
      return;
    }
    if (data === '\x1b[B' || data === 'j') {
      this.#move(1);
      return;
    }
    if (data === '\x1b[A' || data === 'k') this.#move(-1);
  }

  invalidate(): void {}

  #choiceLine(choice: ExchangeDecisionPickerChoice, index: number): string {
    const active = index === this.#activeIndex;
    const marker = active ? this.options.theme.fg('accent', '›') : ' ';
    const ordinal = `${index + 1}.`;
    const label = active ? (this.options.theme.bold?.(choice.label) ?? choice.label) : choice.label;
    return `${marker} ${ordinal} ${label}`;
  }

  #move(delta: number): void {
    const length = this.options.choices.length;
    if (length === 0) return;
    this.#activeIndex = (this.#activeIndex + delta + length) % length;
  }
}

export function createExchangeDecisionPickerComponent(
  options: ExchangeDecisionPickerOptions,
): ExchangeDecisionPickerComponent {
  return new ExchangeDecisionPickerComponent(options);
}
