import { type Component } from '@earendil-works/pi-tui';

import {
  AGENT_LENS_IDS,
  AGENT_STRATEGY_IDS,
  OPERATIONAL_MODE_IDS,
  PLANNED_OPERATIONAL_MODE_IDS,
  type AgentLensSelection,
  type AgentStrategySelection,
  type OperationalModeChoice,
  type OperationalModeId,
} from '../../../session/runtime-state.js';
import {
  nextSegmentIndex,
  previousSegmentIndex,
  renderSegmentTrack,
  safeLines,
  type LabTheme,
  type LabThemeColor,
  type TrackSegment,
} from '../tui-lab/index.js';

interface RuntimeAxisPickerOptions<TSelection extends string> {
  readonly title: string;
  readonly current: TSelection;
  readonly choices: readonly TSelection[];
  /** Choices rendered gray and skipped by arrow-key cycling. */
  readonly disabled?: readonly TSelection[];
  readonly theme: LabTheme;
  readonly onDone: (selection?: TSelection) => void;
}

export interface RuntimeStrategyPickerOptions {
  readonly current: AgentStrategySelection;
  /** Strategies rendered gray and skipped by arrow-key cycling. */
  readonly disabled?: readonly AgentStrategySelection[];
  readonly theme: LabTheme;
  readonly onDone: (strategy?: AgentStrategySelection) => void;
}

export interface RuntimeLensPickerOptions {
  readonly current: AgentLensSelection;
  /** Lenses rendered gray and skipped by arrow-key cycling. */
  readonly disabled?: readonly AgentLensSelection[];
  readonly theme: LabTheme;
  readonly onDone: (lens?: AgentLensSelection) => void;
}

export interface RuntimeModePickerOptions {
  readonly current: OperationalModeId;
  readonly theme: LabTheme;
  readonly onDone: (mode?: OperationalModeChoice) => void;
}

const STRATEGY_CHOICES: readonly AgentStrategySelection[] = ['auto', ...AGENT_STRATEGY_IDS];
const LENS_CHOICES: readonly AgentLensSelection[] = ['auto', ...AGENT_LENS_IDS];
const MODE_CHOICES: readonly OperationalModeChoice[] = [
  ...OPERATIONAL_MODE_IDS,
  ...PLANNED_OPERATIONAL_MODE_IDS,
];

export function createRuntimeStrategyPickerComponent(
  options: RuntimeStrategyPickerOptions,
): RuntimeAxisPickerComponent<AgentStrategySelection> {
  return new RuntimeAxisPickerComponent({
    title: 'Choose Brunch strategy',
    choices: STRATEGY_CHOICES,
    ...options,
  });
}

export function createRuntimeLensPickerComponent(
  options: RuntimeLensPickerOptions,
): RuntimeAxisPickerComponent<AgentLensSelection> {
  return new RuntimeAxisPickerComponent({
    title: 'Choose Brunch lens',
    choices: LENS_CHOICES,
    ...options,
  });
}

export function createRuntimeModePickerComponent(
  options: RuntimeModePickerOptions,
): RuntimeAxisPickerComponent<OperationalModeChoice> {
  return new RuntimeAxisPickerComponent({
    title: 'Choose Brunch mode',
    choices: MODE_CHOICES,
    // Planned modes are visible but unselectable until implemented.
    disabled: PLANNED_OPERATIONAL_MODE_IDS,
    ...options,
  });
}

export class RuntimeAxisPickerComponent<TSelection extends string> implements Component {
  #activeIndex: number;
  readonly #disabled: ReadonlySet<TSelection>;
  readonly #segments: readonly TrackSegment[];

  constructor(private readonly options: RuntimeAxisPickerOptions<TSelection>) {
    this.#disabled = new Set(options.disabled ?? []);
    this.#activeIndex = this.#initialIndex();
    this.#segments = options.choices.map((label) => ({
      label,
      color: this.#segmentColor(label),
    }));
  }

  render(width: number): string[] {
    const safeWidth = Math.max(1, width);
    return safeLines(
      [
        this.options.theme.fg('accent', this.options.title),
        this.#currentLine(),
        renderSegmentTrack(this.options.theme, this.#segments, this.#activeIndex, safeWidth),
        this.options.theme.fg('dim', '←/→ or h/l/j/k cycle · enter commits · esc/q cancels'),
      ],
      safeWidth,
    );
  }

  handleInput(data: string): void {
    if (data === '\x1b' || data === 'q') {
      this.options.onDone();
      return;
    }
    if (data === '\r' || data === '\n') {
      const selection = this.options.choices[this.#activeIndex];
      if (selection !== undefined && this.#disabled.has(selection)) return;
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
    if (currentIndex >= 0 && !this.#disabled.has(this.options.current)) return currentIndex;
    const firstEnabled = this.options.choices.findIndex((choice) => !this.#disabled.has(choice));
    return Math.max(0, firstEnabled);
  }

  #cycle(step: (activeIndex: number, length: number) => number): void {
    const length = this.options.choices.length;
    let index = this.#activeIndex;
    for (let hops = 0; hops < length; hops += 1) {
      index = step(index, length);
      const choice = this.options.choices[index];
      if (choice !== undefined && !this.#disabled.has(choice)) {
        this.#activeIndex = index;
        return;
      }
    }
  }

  #segmentColor(choice: TSelection): LabThemeColor {
    if (this.#disabled.has(choice)) return 'dim';
    if (choice === this.options.current) return 'success';
    return choice === 'auto' ? 'muted' : 'accent';
  }

  #currentLine(): string {
    const { theme, current, choices } = this.options;
    const line = theme.fg('dim', 'current: ') + theme.fg('success', current);
    if (this.#disabled.size === 0) return line;
    const enabled = choices.filter((choice) => !this.#disabled.has(choice));
    return line + theme.fg('dim', `; currently-enabled: ${enabled.join(', ')}`);
  }
}
