// Synchronous fan-out from the orchestrator to its presenters.
//
// One producer, many presenters. A presenter that throws must never
// abort the run or starve its siblings — failures are downgraded to a
// process warning. Exactly one event type, one consumer shape: a bespoke
// class is clearer here than a generic EventEmitter.

import type { CookEvent, Presenter } from './events.js';

export class CookBus {
  private readonly presenters: Presenter[] = [];

  subscribe(presenter: Presenter): void {
    this.presenters.push(presenter);
  }

  emit(event: CookEvent): void {
    for (const presenter of this.presenters) {
      try {
        presenter.onEvent(event);
      } catch (err) {
        process.emitWarning(`presenter failed on "${event.kind}": ${String(err)}`);
      }
    }
  }

  async dispose(): Promise<void> {
    for (const presenter of this.presenters) {
      try {
        await presenter.dispose();
      } catch {
        // A presenter that fails to tear down must not mask the run's outcome.
      }
    }
  }
}
