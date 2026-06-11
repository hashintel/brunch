import { type Component } from '@earendil-works/pi-tui';

import {
  AGENT_LENS_IDS,
  AGENT_STRATEGY_IDS,
  type AgentLensSelection,
  type AgentStrategySelection,
} from '../../../session/runtime-state.js';
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
  readonly theme: LabTheme;
  readonly onDone: (selection?: TSelection) => void;
}

export interface RuntimeStrategyPickerOptions {
  readonly current: AgentStrategySelection;
  readonly theme: LabTheme;
  readonly onDone: (strategy?: AgentStrategySelection) => void;
}

export interface RuntimeLensPickerOptions {
  readonly current: AgentLensSelection;
  readonly theme: LabTheme;
  readonly onDone: (lens?: AgentLensSelection) => void;
}

const STRATEGY_CHOICES: readonly AgentStrategySelection[] = ['auto', ...AGENT_STRATEGY_IDS];
const LENS_CHOICES: readonly AgentLensSelection[] = ['auto', ...AGENT_LENS_IDS];

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

export class RuntimeAxisPickerComponent<TSelection extends string> implements Component {
  #activeIndex: number;
  readonly #segments: readonly TrackSegment[];

  constructor(private readonly options: RuntimeAxisPickerOptions<TSelection>) {
    this.#activeIndex = Math.max(0, options.choices.indexOf(options.current));
    this.#segments = options.choices.map((label) => ({
      label,
      color: label === 'auto' ? 'muted' : 'accent',
    }));
  }

  render(width: number): string[] {
    const safeWidth = Math.max(1, width);
    return safeLines(
      [
        this.options.theme.fg('accent', this.options.title),
        this.options.theme.fg('dim', `current: ${this.options.current}`),
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
      this.options.onDone(this.options.choices[this.#activeIndex]);
      return;
    }
    if (data === '\x1b[C' || data === 'l' || data === 'j') {
      this.#activeIndex = nextSegmentIndex(this.#activeIndex, this.options.choices.length);
      return;
    }
    if (data === '\x1b[D' || data === 'h' || data === 'k') {
      this.#activeIndex = previousSegmentIndex(this.#activeIndex, this.options.choices.length);
    }
  }

  invalidate(): void {}
}
