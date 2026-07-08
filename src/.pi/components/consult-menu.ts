import { type Component, Key, matchesKey } from '@earendil-works/pi-tui';

import { accumulateChoiceLines, describedChoiceLines } from './choice-row.js';
import {
  projectRoundedBox,
  roundedBoxInnerWidth,
  stackSections,
  type RoundedBoxPadding,
} from './rounded-box.js';
import { projectScrollViewport } from './scroll-viewport.js';
import { safeLines, type LabTheme } from './tui-lab/index.js';

export interface ConsultMenuChoice {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
}

export interface ConsultMenuResult {
  readonly id: string;
}

export interface ConsultMenuOptions {
  readonly title: string;
  readonly choices: readonly ConsultMenuChoice[];
  readonly theme: LabTheme;
  readonly onDone: (result?: ConsultMenuResult) => void;
}

const MAX_VISIBLE_CHOICES = 8;
const BOX_PADDING: RoundedBoxPadding = { x: 2, top: 1, bottom: 1 };
const SURFACE_IDENTITY_BORDER_ROLE = 'borderAccent';

export class ConsultMenuComponent implements Component {
  #activeIndex = 0;

  constructor(private readonly options: ConsultMenuOptions) {}

  render(width: number): string[] {
    const safeWidth = Math.max(16, width);
    const contentWidth = Math.max(1, roundedBoxInnerWidth(safeWidth, BOX_PADDING));
    const { choiceLines, activeLineIndex } = this.#choiceLines();
    const choiceWindow = projectScrollViewport(choiceLines, MAX_VISIBLE_CHOICES, activeLineIndex);
    const stacked = stackSections([
      [this.options.theme.fg('accent', this.options.title)],
      [...choiceWindow.lines],
      [this.options.theme.fg('dim', '↑/↓ or j/k move · enter commits · esc/q dismisses')],
    ]);
    const content = safeLines(stacked.lines, contentWidth);
    const choiceStart = stacked.offsets[1] ?? 0;
    const thumbRows = new Set(
      choiceWindow.isThumbRow.flatMap((isThumb, index) => (isThumb ? [choiceStart + index] : [])),
    );

    const box = projectRoundedBox(
      content,
      { padding: BOX_PADDING, thumbRows, topLabel: '[ Consult ]' },
      safeWidth,
      (text) => this.options.theme.fg(SURFACE_IDENTITY_BORDER_ROLE, text),
    );
    box.push('');
    return box;
  }

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

  #choiceLines(): { readonly choiceLines: readonly string[]; readonly activeLineIndex: number } {
    return accumulateChoiceLines({
      choices: this.options.choices,
      activeIndex: this.#activeIndex,
      renderChoice: (choice, index) => this.#choiceLine(choice, index),
    });
  }

  #choiceLine(choice: ConsultMenuChoice, index: number): readonly string[] {
    const active = index === this.#activeIndex;
    const marker = active ? this.options.theme.fg('accent', '›') : ' ';
    const ordinal = `${index + 1}.`;
    const label = active ? (this.options.theme.bold?.(choice.label) ?? choice.label) : choice.label;
    return describedChoiceLines({
      firstLine: `${marker} ${ordinal} ${label}`,
      continuationIndent: 2 + ordinal.length + 1,
      choice,
      theme: this.options.theme,
    });
  }

  #move(delta: number): void {
    const length = this.options.choices.length;
    if (length === 0) return;
    this.#activeIndex = (this.#activeIndex + delta + length) % length;
  }
}

export function createConsultMenuComponent(options: ConsultMenuOptions): ConsultMenuComponent {
  return new ConsultMenuComponent(options);
}
