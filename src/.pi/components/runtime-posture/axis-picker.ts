import { type Component } from '@earendil-works/pi-tui';

import {
  OPERATIONAL_MODE_IDS,
  operationalModeLabel,
  type OperationalModeId,
} from '../../../session/schema/kinds.js';
import {
  nextSegmentIndex,
  previousSegmentIndex,
  renderSegmentTrack,
  safeLines,
  type LabTheme,
  type TrackSegment,
} from '../tui-lab/index.js';

interface RuntimeAxisPickerOptions<TSelection extends string> {
  readonly title: string;
  readonly current: TSelection;
  readonly choices: readonly TSelection[];
  readonly labelFor?: (selection: TSelection) => string;
  readonly theme: LabTheme;
  readonly onDone: (selection?: TSelection) => void;
}

export interface RuntimeModePickerOptions {
  readonly current: OperationalModeId;
  readonly theme: LabTheme;
  readonly onDone: (mode?: OperationalModeId) => void;
}

/**
 * Lateral padding in columns, matching Pi's standard `Text` component default
 * (`paddingX = 1`) used for transcript content and the brunch chrome.
 */
const PICKER_PADDING_X = 1;

export function createRuntimeModePickerComponent(
  options: RuntimeModePickerOptions,
): RuntimeAxisPickerComponent<OperationalModeId> {
  return new RuntimeAxisPickerComponent({
    title: 'Choose Brunch mode',
    choices: OPERATIONAL_MODE_IDS,
    labelFor: operationalModeLabel,
    ...options,
  });
}

export class RuntimeAxisPickerComponent<TSelection extends string> implements Component {
  #activeIndex: number;
  readonly #segments: readonly TrackSegment[];

  constructor(private readonly options: RuntimeAxisPickerOptions<TSelection>) {
    this.#activeIndex = this.#initialIndex();
    this.#segments = options.choices.map((label) => ({
      label: this.#labelFor(label),
      color: label === this.options.current ? 'success' : 'accent',
    }));
  }

  render(width: number): string[] {
    const safeWidth = Math.max(1, width);
    const contentWidth = Math.max(1, safeWidth - PICKER_PADDING_X * 2);
    const leftMargin = ' '.repeat(PICKER_PADDING_X);
    const lines = safeLines(
      [
        this.options.theme.fg('accent', this.options.title),
        this.#currentLine(),
        renderSegmentTrack(this.options.theme, this.#segments, this.#activeIndex, contentWidth),
        this.options.theme.fg('dim', '←/→ or h/l/j/k cycle · enter commits · esc/q cancels'),
      ],
      contentWidth,
    ).map((line) => leftMargin + line);
    // Bottom padding: keep the picker visually separated from the footer.
    lines.push('');
    return lines;
  }

  handleInput(data: string): void {
    if (data === '\x1b' || data === 'q') {
      this.options.onDone();
      return;
    }
    if (data === '\r' || data === '\n') {
      const selection = this.options.choices[this.#activeIndex];
      this.options.onDone(selection);
      return;
    }
    if (data === '\x1b[C' || data === 'l' || data === 'j') {
      this.#cycle(nextSegmentIndex);
      return;
    }
    if (data === '\x1b[D' || data === 'h' || data === 'k') {
      this.#cycle(previousSegmentIndex);
    }
  }

  invalidate(): void {}

  #initialIndex(): number {
    const currentIndex = this.options.choices.indexOf(this.options.current);
    return currentIndex >= 0 ? currentIndex : 0;
  }

  #cycle(step: (activeIndex: number, length: number) => number): void {
    this.#activeIndex = step(this.#activeIndex, this.options.choices.length);
  }

  #currentLine(): string {
    const { theme, current } = this.options;
    return theme.fg('dim', 'current: ') + theme.fg('success', this.#labelFor(current));
  }

  #labelFor(choice: TSelection): string {
    return this.options.labelFor?.(choice) ?? choice;
  }
}
