import { type Component, Key, matchesKey } from '@earendil-works/pi-tui';

import { renderExchangeMarkdownBodyLines } from './exchange-markdown-body.js';
import {
  projectRoundedBox,
  roundedBoxInnerWidth,
  stackSections,
  type RoundedBoxPadding,
} from './rounded-box.js';
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
  readonly body?: string;
  readonly choices: readonly ExchangeDecisionPickerChoice[];
  readonly topLabel?: string;
  readonly bottomLabel?: string;
  readonly theme: LabTheme;
  readonly onDone: (result?: ExchangeDecisionPickerResult) => void;
}

const MAX_VISIBLE_CHOICES = 8;
const BOX_PADDING: RoundedBoxPadding = { x: 2, top: 1, bottom: 1 };

export class ExchangeDecisionPickerComponent implements Component {
  #activeIndex = 0;

  constructor(private readonly options: ExchangeDecisionPickerOptions) {}

  render(width: number): string[] {
    const safeWidth = Math.max(16, width);
    const contentWidth = Math.max(1, roundedBoxInnerWidth(safeWidth, BOX_PADDING));
    const choiceLines = this.options.choices.map((choice, index) => this.#choiceLine(choice, index));
    const choiceWindow = projectScrollViewport(choiceLines, MAX_VISIBLE_CHOICES, this.#activeIndex);
    const bodyLines = renderExchangeMarkdownBodyLines(this.options.body, this.options.theme, contentWidth);
    const stacked = stackSections([
      [this.options.theme.fg('accent', this.options.prompt)],
      bodyLines,
      [...choiceWindow.lines],
      [this.options.theme.fg('dim', '↑/↓ or j/k move · enter commits · esc/q cancels')],
    ]);
    const content = safeLines(stacked.lines, contentWidth);
    const choiceStart = stacked.offsets[2] ?? 0;
    const thumbRows = new Set(
      choiceWindow.isThumbRow.flatMap((isThumb, index) => (isThumb ? [choiceStart + index] : [])),
    );

    const box = projectRoundedBox(
      content,
      {
        padding: BOX_PADDING,
        thumbRows,
        ...(this.options.topLabel ? { topLabel: this.options.topLabel } : {}),
        ...(this.options.bottomLabel ? { bottomLabel: this.options.bottomLabel } : {}),
      },
      safeWidth,
      (text) => this.options.theme.fg('accent', text),
    );
    box.push('');
    return box;
  }

  // matchesKey, not raw-byte comparison: under the kitty keyboard protocol
  // (negotiated by ProcessTerminal in Ghostty/kitty/...) keys arrive as CSI-u
  // sequences that legacy byte equality misses.
  handleInput(data: string): void {
    if (matchesKey(data, Key.escape) || matchesKey(data, 'q')) {
      this.options.onDone();
      return;
    }
    if (matchesKey(data, Key.enter)) {
      const choice = this.options.choices[this.#activeIndex];
      if (choice) this.options.onDone({ id: choice.id });
      return;
    }
    if (matchesKey(data, Key.down) || matchesKey(data, 'j')) {
      this.#move(1);
      return;
    }
    if (matchesKey(data, Key.up) || matchesKey(data, 'k')) this.#move(-1);
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
