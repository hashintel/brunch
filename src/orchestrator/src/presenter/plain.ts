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
};

export class PlainPresenter implements Presenter {
  private readonly log: (line: string) => void;

  constructor(options: PlainPresenterOptions = {}) {
    this.log = options.log ?? ((line) => console.error(line));
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
    }
  }

  dispose(): void {}
}
