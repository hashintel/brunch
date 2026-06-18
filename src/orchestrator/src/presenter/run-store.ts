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
  /** Attempt count — incremented each time the slice (re)enters running. */
  attempts?: number;
}

export interface RunState {
  command: string;
  phase: BrigadePhase;
  lines: string[];
  /** Non-slice waits (worktree, promotion). Slice waits live on the grid. */
  pending: PendingActivity[];
  /** Epic ids in plan order, for grouping the grid. */
  epics: string[];
  /** Epics that have emitted a verdict — gates cook→taste until all have. */
  epicsVerdicted: string[];
  /** The slice grid — every slice, seeded queued by run-shape. */
  slices: SliceRow[];
  /** When the run started, for the single global header timer. */
  runStart: number;
  /** Set when the run halted — the reason, pinned in a halt summary. */
  haltReason?: string;
  /** Total attempts allowed per slice (retry budget + 1), for the n/max display. */
  maxAttempts?: number;
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
    this.state = {
      command,
      phase: 'prep',
      lines: [],
      pending: [],
      epics: [],
      epicsVerdicted: [],
      slices: [],
      runStart: now(),
    };
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
        // total attempts = retry budget + 1 (attempt 1 is the first run)
        ...(event.maxRetries !== undefined ? { maxAttempts: event.maxRetries + 1 } : {}),
      });
      return;
    }
    if (event.kind === 'slice') {
      const running = event.status === 'running';
      const prev = this.state.slices.find((s) => s.id === event.id);
      // A fresh run (queued→running) is attempt 1; a retry (failed→running) bumps
      // it; a step change mid-run (running→running) keeps the count.
      const attempts = running
        ? prev?.status === 'running'
          ? prev.attempts
          : (prev?.attempts ?? 0) + 1
        : prev?.attempts;
      this.commit({
        slices: this.updateSlice(event.id, {
          status: event.status,
          ...(event.step !== undefined ? { step: event.step } : {}),
          // clear the in-flight label + heartbeat once the slice stops running
          ...(running ? {} : { step: undefined, detail: undefined }),
          // set/clear the failure reason from the event (undefined for passed/running)
          reason: event.reason,
          attempts,
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

    if (event.kind === 'cook-start') {
      // Seed BOTH timers from one origin: the action-log clock (via the
      // formatter) and the footer's `runStart`. On `brunch serve` the store is
      // built during recipe/plan — before cook-start — so the constructor's
      // `runStart` would otherwise count pre-cook time the action lines don't.
      this.clock.seed(event.runStart);
      const phase = nextPhase(this.state.phase, event);
      if (event.runStart !== this.state.runStart || phase !== this.state.phase) {
        this.commit({ phase, runStart: event.runStart });
      }
      return;
    }

    // Accumulate epic verdicts BEFORE computing the phase so the current event
    // counts toward the cook→taste gate (all known epics must have a verdict).
    const verdictId = event.kind === 'action' ? /^epic\s+(\S+)/.exec(event.message)?.[1] : undefined;
    const epicsVerdicted =
      verdictId !== undefined && !this.state.epicsVerdicted.includes(verdictId)
        ? [...this.state.epicsVerdicted, verdictId]
        : this.state.epicsVerdicted;

    const added = formatCookEvent(event, this.clock);
    const phase = nextPhase(this.state.phase, event, {
      epics: this.state.epics,
      verdictedEpics: new Set(epicsVerdicted),
    });
    if (added.length === 0 && phase === this.state.phase && epicsVerdicted === this.state.epicsVerdicted)
      return;
    // Append-only — the Ink backend streams these through <Static>, which
    // assumes items only grow; the lines live in terminal scrollback.
    this.commit({ phase, lines: [...this.state.lines, ...added], epicsVerdicted });
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
