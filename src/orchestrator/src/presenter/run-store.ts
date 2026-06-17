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

export type SliceStatus = 'queued' | 'running' | 'passed' | 'failed';

export interface SliceRow {
  id: string;
  epicId: string;
  status: SliceStatus;
  /** Current sub-action while running (tests / code / verify). */
  step?: string;
  /** Live heartbeat for the running slice (latest line / tool). */
  detail?: string;
  /** Why the slice failed (e.g. 'tests failed', 'infra error'). */
  reason?: string;
}

export interface RunState {
  command: string;
  phase: BrigadePhase;
  lines: string[];
  /** Non-slice waits (worktree, promotion). Slice waits live on the grid. */
  pending: PendingActivity[];
  /** Epic ids in plan order, for grouping the grid. */
  epics: string[];
  /** The slice grid — every slice, seeded queued by run-shape. */
  slices: SliceRow[];
  /** When the run started, for the single global header timer. */
  runStart: number;
  /** Set when the run halted — the reason, pinned in a halt summary. */
  haltReason?: string;
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
    this.state = { command, phase: 'prep', lines: [], pending: [], epics: [], slices: [], runStart: now() };
  }

  private isSlice(id: string): boolean {
    return this.state.slices.some((s) => s.id === id);
  }

  private updateSlice(id: string, patch: Partial<SliceRow>): SliceRow[] {
    return this.state.slices.map((s) => (s.id === id ? { ...s, ...patch } : s));
  }

  push(event: CookEvent): void {
    if (event.kind === 'run-shape') {
      this.commit({
        epics: event.epics.map((e) => e.id),
        slices: event.slices.map((s) => ({ id: s.id, epicId: s.epicId, status: 'queued' as const })),
      });
      return;
    }
    if (event.kind === 'slice') {
      const running = event.status === 'running';
      this.commit({
        slices: this.updateSlice(event.id, {
          status: event.status,
          ...(event.step !== undefined ? { step: event.step } : {}),
          // clear the in-flight label + heartbeat once the slice stops running
          ...(running ? {} : { step: undefined, detail: undefined }),
          // set/clear the failure reason from the event (undefined for passed/running)
          reason: event.reason,
        }),
      });
      return;
    }
    // Slice-keyed activity detail lands on the grid row; everything else is a
    // non-slice wait (worktree, promotion) and shows in the pending footer.
    if (event.kind === 'activity-start') {
      if (this.isSlice(event.id)) return;
      this.commit({ pending: [...this.state.pending, { id: event.id, label: event.label }] });
      return;
    }
    if (event.kind === 'activity-progress') {
      if (this.isSlice(event.id)) {
        this.commit({ slices: this.updateSlice(event.id, { detail: event.detail }) });
        return;
      }
      this.commit({
        pending: this.state.pending.map((a) => (a.id === event.id ? { ...a, detail: event.detail } : a)),
      });
      return;
    }
    if (event.kind === 'activity-end') {
      if (this.isSlice(event.id)) {
        this.commit({ slices: this.updateSlice(event.id, { detail: undefined }) });
        return;
      }
      this.commit({ pending: this.state.pending.filter((a) => a.id !== event.id) });
      return;
    }

    if (event.kind === 'cook-done') {
      // Advances the brigade to `serve` on success; pins a halt summary otherwise.
      this.commit({
        phase: nextPhase(this.state.phase, event),
        ...(event.ok ? {} : { haltReason: event.reason ?? 'halted' }),
      });
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
