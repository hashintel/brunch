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

export interface PendingActivity {
  id: string;
  label: string;
  detail?: string;
}

export interface RunState {
  command: string;
  phase: BrigadePhase;
  lines: string[];
  pending: PendingActivity[];
  /** When the run started, for the single global header timer. */
  runStart: number;
}

export class RunStore {
  private state: RunState;
  private readonly clock: ElapsedClock;
  private readonly listeners = new Set<() => void>();

  constructor(
    command: string,
    private readonly now: () => number = () => Date.now(),
  ) {
    this.clock = createElapsedClock(now);
    this.state = { command, phase: 'prep', lines: [], pending: [], runStart: now() };
  }

  push(event: CookEvent): void {
    if (event.kind === 'activity-start') {
      this.commit({ pending: [...this.state.pending, { id: event.id, label: event.label }] });
      return;
    }
    if (event.kind === 'activity-progress') {
      this.commit({
        pending: this.state.pending.map((a) => (a.id === event.id ? { ...a, detail: event.detail } : a)),
      });
      return;
    }
    if (event.kind === 'activity-end') {
      this.commit({ pending: this.state.pending.filter((a) => a.id !== event.id) });
      return;
    }

    const added = formatCookEvent(event, this.clock);
    const phase = nextPhase(this.state.phase, event);
    if (added.length === 0 && phase === this.state.phase) return;
    // Append-only — the Ink backend streams these through <Static>, which
    // assumes items only grow; the lines live in terminal scrollback.
    this.commit({ phase, lines: [...this.state.lines, ...added] });
  }

  private commit(patch: Partial<RunState>): void {
    this.state = { ...this.state, ...patch };
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
