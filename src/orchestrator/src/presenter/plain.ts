// Line-oriented presenter: CookEvent → stderr lines.
//
// The default backend (CI / non-TTY / piped) and the behavior-preserving
// reference: it reproduces the pre-refactor output of `plan` / `cook` /
// `serve` byte-for-byte. Formatting lives in `format.ts` (shared with the
// Ink backend); this class only owns the clock and the line sink, which
// defaults to `console.error` (stderr — stdout is reserved).

import { createElapsedClock, type ElapsedClock } from './clock.js';
import type { CookEvent, Presenter } from './events.js';
import { formatCookEvent } from './format.js';

export type PlainPresenterOptions = {
  log?: (line: string) => void;
  /** Clock for the elapsed prefix; injectable for deterministic goldens (I136-K). */
  now?: () => number;
};

export class PlainPresenter implements Presenter {
  private readonly log: (line: string) => void;
  private readonly clock: ElapsedClock;

  constructor(options: PlainPresenterOptions = {}) {
    this.log = options.log ?? ((line) => console.error(line));
    this.clock = createElapsedClock(options.now);
  }

  onEvent(event: CookEvent): void {
    for (const line of formatCookEvent(event, this.clock)) this.log(line);
  }

  dispose(): void {}
}
