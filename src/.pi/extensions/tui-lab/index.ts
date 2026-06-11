import { type ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { type Component } from '@earendil-works/pi-tui';

import {
  DEMO_MODEL_SEGMENTS,
  nextSegmentIndex,
  previousSegmentIndex,
  renderSegmentTrack,
  renderStylePalettePreview,
  safeLines,
  type LabTheme,
} from '../../components/tui-lab/index.js';

export const BRUNCH_TUI_STYLE_LAB_COMMAND = 'brunch:tui-style-lab';

export interface BrunchTuiLabOptions {
  readonly enabled?: boolean;
}

export function registerBrunchTuiLab(pi: ExtensionAPI, options: BrunchTuiLabOptions = {}): void {
  if (!options.enabled) return;

  pi.registerCommand(BRUNCH_TUI_STYLE_LAB_COMMAND, {
    description: 'Preview Brunch dev-only Pi TUI style patterns',
    handler: async (_args, ctx) => {
      await ctx.ui.custom(
        (_tui, theme, _keybindings, done) => {
          const component = new TuiStyleLabComponent(theme, done);
          return component;
        },
        { overlay: true },
      );
    },
  });
}

export class TuiStyleLabComponent implements Component {
  #activeSegment = 1;

  constructor(
    private readonly theme: LabTheme,
    private readonly done: (result?: unknown) => void,
  ) {}

  render(width: number): string[] {
    const safeWidth = Math.max(1, width);
    return [
      ...renderStylePalettePreview(this.theme, safeWidth),
      renderSegmentTrack(this.theme, DEMO_MODEL_SEGMENTS, this.#activeSegment, safeWidth),
      ...safeLines(
        [this.theme.fg('dim', '←/→ cycle local demo state · esc closes · does not mutate Pi models')],
        safeWidth,
      ),
    ];
  }

  handleInput(data: string): void {
    if (data === '\x1b' || data === 'q') {
      this.done();
      return;
    }
    if (data === '\x1b[C' || data === 'l') {
      this.#activeSegment = nextSegmentIndex(this.#activeSegment, DEMO_MODEL_SEGMENTS.length);
    }
    if (data === '\x1b[D' || data === 'h') {
      this.#activeSegment = previousSegmentIndex(this.#activeSegment, DEMO_MODEL_SEGMENTS.length);
    }
  }

  invalidate(): void {}
}

export default registerBrunchTuiLab;
