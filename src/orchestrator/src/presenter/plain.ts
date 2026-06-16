// Line-oriented presenter: CookEvent → stderr lines.
//
// This is the default backend (CI / non-TTY / piped) and the behavior-
// preserving reference: it must reproduce the pre-refactor output of
// `plan` / `cook` / `serve` byte-for-byte. The line sink is injectable so
// tests can capture output (and so the golden differential stays pure);
// it defaults to `console.error` (stderr — stdout is reserved).

import type { CookEvent, Presenter } from './events.js';

const RULE = '  ──────────────────────────────────────';

export type PlainPresenterOptions = {
  log?: (line: string) => void;
  /** Clock for the elapsed-since-cook-start prefix; injectable for deterministic goldens (I136-K). */
  now?: () => number;
};

export class PlainPresenter implements Presenter {
  private readonly log: (line: string) => void;
  private readonly now: () => number;
  private runStart: number | undefined;

  constructor(options: PlainPresenterOptions = {}) {
    this.log = options.log ?? ((line) => console.error(line));
    this.now = options.now ?? (() => Date.now());
  }

  /** Elapsed since cook start, formatted exactly like the pre-refactor `elapsed()`. */
  private elapsed(): string {
    if (this.runStart === undefined) this.runStart = this.now();
    const seconds = ((this.now() - this.runStart) / 1000).toFixed(1);
    return `${seconds}s`.padStart(7);
  }

  onEvent(event: CookEvent): void {
    switch (event.kind) {
      case 'plan-start':
        this.log('');
        this.log('  brunch plan');
        this.log(RULE);
        this.log(`  spec       ${event.specId}`);
        this.log(`  out        ${event.outDir}`);
        this.log('');
        return;
      case 'plan-written':
        this.log(`  ✓  plan      ${event.path}`);
        this.log(`     ${event.epics} epics, ${event.slices} slices`);
        this.log('');
        return;
      case 'plan-warnings':
        if (event.messages.length === 0) return;
        this.log(`  ${event.messages.length} warnings:`);
        for (const message of event.messages) this.log(`  !  ${message}`);
        this.log('');
        return;
      case 'cook-start':
        this.runStart = event.runStart;
        return;
      case 'action':
        this.log(`  ${this.elapsed()}  ${event.icon}  ${event.message}`);
        return;
      case 'verbose': {
        const trimmed = event.text.trim();
        if (!trimmed) return;
        this.log('');
        for (const line of trimmed.split('\n')) this.log(`             │ ${line}`);
        this.log('');
        return;
      }
      case 'line':
        this.log(event.text);
        return;
    }
  }

  dispose(): void {}
}
