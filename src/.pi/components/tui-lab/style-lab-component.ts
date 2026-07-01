import { type Component } from '@earendil-works/pi-tui';

import {
  DEMO_MODEL_SEGMENTS,
  nextSegmentIndex,
  previousSegmentIndex,
  renderSegmentTrack,
} from './segment-track.js';
import { renderStylePalettePreview, safeLines, type LabTheme } from './style-palette.js';

/**
 * Reference component demonstrating `tui-lab`'s shared visual primitives
 * (style palette + segment track) side by side. Not wired into any product
 * extension or slash command — previewable only via
 * `npm run dev:components -- tui-lab`. Kept for style/segment-track
 * experimentation, not as a shipped affordance.
 */
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
