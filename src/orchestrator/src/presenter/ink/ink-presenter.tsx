// The interactive full-screen backend. Renders the Ink App to STDERR (stdout
// stays reserved), feeding it from a RunStore. Thin glue: state + formatting
// live in RunStore / format / phase, all unit-tested without a terminal.

import { render } from 'ink';

import type { CookEvent, Presenter } from '../events.js';
import { RunStore } from '../run-store.js';
import { App } from './app.js';

export class InkPresenter implements Presenter {
  private readonly store: RunStore;
  private readonly instance: ReturnType<typeof render>;

  constructor(command: string, now?: () => number) {
    this.store = new RunStore(command, now);
    // Render to stderr so stdout stays clean for piping / agent JSONL.
    this.instance = render(<App store={this.store} />, { stdout: process.stderr });
  }

  onEvent(event: CookEvent): void {
    this.store.push(event);
  }

  async dispose(): Promise<void> {
    this.instance.unmount();
    await this.instance.waitUntilExit();
  }
}
