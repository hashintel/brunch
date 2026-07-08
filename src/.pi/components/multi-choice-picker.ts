import { type Component, Key, matchesKey } from '@earendil-works/pi-tui';

import { describedChoiceLines } from './choice-row.js';
import { renderExchangeMarkdownBodyLines } from './exchange-markdown-body.js';
import {
  projectRoundedBox,
  roundedBoxInnerWidth,
  stackSections,
  type RoundedBoxPadding,
} from './rounded-box.js';
import { projectScrollViewport } from './scroll-viewport.js';
import { safeLines, type LabTheme } from './tui-lab/index.js';

export interface MultiChoicePickerChoice {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
}

export interface MultiChoicePickerResult {
  readonly choices: readonly MultiChoicePickerChoice[];
}

export interface MultiChoicePickerOptions {
  readonly prompt: string;
  readonly body?: string;
  readonly choices: readonly MultiChoicePickerChoice[];
  readonly topLabel?: string;
  readonly bottomLabel?: string;
  /**
   * Choice ids that contradict every other selection (e.g. a "none of these"
   * choice). Selecting one clears the rest; selecting any other choice clears
   * them.
   */
  readonly exclusiveChoiceIds?: readonly string[];
  readonly theme: LabTheme;
  readonly onDone: (result?: MultiChoicePickerResult) => void;
}

const BOX_PADDING: RoundedBoxPadding = { x: 2, top: 1, bottom: 1 };
const MAX_VISIBLE_CHOICE_LINES = 8;

export class MultiChoicePickerComponent implements Component {
  #activeIndex = 0;
  readonly #selected = new Set<string>();
  #warning: string | undefined;

  constructor(private readonly options: MultiChoicePickerOptions) {}

  render(width: number): string[] {
    const safeWidth = Math.max(1, width);
    const contentWidth = Math.max(1, roundedBoxInnerWidth(safeWidth, BOX_PADDING));
    const { theme } = this.options;
    const bodyLines = renderExchangeMarkdownBodyLines(this.options.body, theme, contentWidth);
    const { choiceLines, activeLineIndex } = this.#choiceLines();
    const choiceWindow = projectScrollViewport(choiceLines, MAX_VISIBLE_CHOICE_LINES, activeLineIndex);
    const stacked = stackSections([
      [theme.fg('accent', this.options.prompt)],
      bodyLines,
      [...choiceWindow.lines],
      [
        ...(this.#warning ? [theme.fg('warning', this.#warning)] : []),
        theme.fg('dim', '↑/↓ move · space toggles · enter commits · esc/q cancels'),
      ],
    ]);
    const lines = safeLines(stacked.lines, contentWidth);
    const choiceStart = stacked.offsets[2] ?? 0;
    const thumbRows = new Set(
      choiceWindow.isThumbRow.flatMap((isThumb, index) => (isThumb ? [choiceStart + index] : [])),
    );
    const box = projectRoundedBox(
      lines,
      {
        padding: BOX_PADDING,
        thumbRows,
        ...(this.options.topLabel ? { topLabel: this.options.topLabel } : {}),
        ...(this.options.bottomLabel ? { bottomLabel: this.options.bottomLabel } : {}),
      },
      safeWidth,
      (text) => theme.fg('accent', text),
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
      const choices = this.options.choices.filter((choice) => this.#selected.has(choice.id));
      if (choices.length === 0) {
        this.#warning = 'Select at least one option.';
        return;
      }
      this.options.onDone({ choices });
      return;
    }
    if (matchesKey(data, Key.space)) {
      this.#toggleActive();
      return;
    }
    if (matchesKey(data, Key.down) || matchesKey(data, 'j')) {
      this.#move(1);
      return;
    }
    if (matchesKey(data, Key.up) || matchesKey(data, 'k')) this.#move(-1);
  }

  invalidate(): void {}

  #choiceLines(): { readonly choiceLines: readonly string[]; readonly activeLineIndex: number } {
    const choiceLines: string[] = [];
    let activeLineIndex = 0;
    this.options.choices.forEach((choice, index) => {
      if (index === this.#activeIndex) activeLineIndex = choiceLines.length;
      choiceLines.push(...this.#choiceLine(choice, index));
    });
    return { choiceLines, activeLineIndex };
  }

  #choiceLine(choice: MultiChoicePickerChoice, index: number): readonly string[] {
    const { theme } = this.options;
    const active = index === this.#activeIndex;
    const selected = this.#selected.has(choice.id);
    const marker = active ? theme.fg('accent', '›') : ' ';
    const checkbox = selected ? theme.fg('success', '[x]') : theme.fg('dim', '[ ]');
    const label = selected ? (theme.bold?.(choice.label) ?? choice.label) : choice.label;
    return describedChoiceLines({
      firstLine: `${marker} ${checkbox} ${label}`,
      continuationIndent: 6,
      choice,
      theme,
    });
  }

  #toggleActive(): void {
    const active = this.options.choices[this.#activeIndex];
    if (!active) return;
    this.#warning = undefined;
    if (this.#selected.has(active.id)) {
      this.#selected.delete(active.id);
      return;
    }
    const exclusive = this.options.exclusiveChoiceIds ?? [];
    if (exclusive.includes(active.id)) {
      this.#selected.clear();
    } else {
      for (const id of exclusive) this.#selected.delete(id);
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
