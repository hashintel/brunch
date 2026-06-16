// Observable run state for the Ink backend.
//
// Folds the CookEvent stream into { phase, lines } using the SAME formatter
// as the plain backend (so log bodies can't drift) and the pure brigade
// tracker. Exposes the subscribe/getSnapshot pair `useSyncExternalStore`
// needs; the snapshot identity is stable between no-op events.

import { createElapsedClock, type ElapsedClock } from './clock.js';
import type { CookEvent } from './events.js';
import { formatCookEvent } from './format.js';
import { type BrigadePhase, nextPhase } from './phase.js';

const MAX_LINES = 500;

export interface RunState {
  command: string;
  phase: BrigadePhase;
  lines: string[];
}

export class RunStore {
  private state: RunState;
  private readonly clock: ElapsedClock;
  private readonly listeners = new Set<() => void>();

  constructor(command: string, now?: () => number) {
    this.clock = createElapsedClock(now);
    this.state = { command, phase: 'prep', lines: [] };
  }

  push(event: CookEvent): void {
    const added = formatCookEvent(event, this.clock);
    const phase = nextPhase(this.state.phase, event);
    if (added.length === 0 && phase === this.state.phase) return;
    this.state = {
      ...this.state,
      phase,
      lines: [...this.state.lines, ...added].slice(-MAX_LINES),
    };
    for (const listener of this.listeners) listener();
  }

  getSnapshot = (): RunState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
}
