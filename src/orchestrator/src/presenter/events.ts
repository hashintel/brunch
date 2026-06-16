// The presentation event stream for `plan` / `cook` / `serve`.
//
// This is the single boundary the orchestrator emits to; presenters
// (plain / ink / silent) consume it. It is *ephemeral* — `reports.jsonl`
// remains the durable communication medium (D156-K); a CookEvent never
// carries durable truth, only what the user should see happen.
//
// The union grows arm-by-arm as surfaces are migrated off direct
// `console.error`. Slice 1 covers the existing post-hoc output; live
// `activity-start`/`activity-end` waits are slice 2.

export type CookEvent =
  // --- plan surface ---
  | { kind: 'plan-start'; specId: number; outDir: string }
  | { kind: 'plan-written'; path: string; epics: number; slices: number }
  | { kind: 'plan-warnings'; messages: string[] }
  // --- cook surface ---
  // Seeds the presenter's elapsed clock; renders nothing itself.
  | { kind: 'cook-start'; runStart: number }
  // A per-action progress line; the presenter prepends elapsed-since-cook-start.
  | { kind: 'action'; icon: string; message: string }
  // Raw agent output, shown only when the emit site is in verbose mode.
  | { kind: 'verbose'; text: string }
  // A pre-formatted line rendered verbatim (banner / summary / promotion blocks).
  | { kind: 'line'; text: string }
  // --- live waits (slice 2b) ---
  // Opens a pending activity: a long wait the user should see in progress.
  | { kind: 'activity-start'; id: string; label: string }
  // Updates the in-flight detail of an open activity (e.g. a pi token heartbeat).
  | { kind: 'activity-progress'; id: string; detail: string }
  // Closes the activity; the wait is over.
  | { kind: 'activity-end'; id: string }
  // The run finished (emitted after promotion); `ok` = completed vs halted.
  | { kind: 'cook-done'; ok: boolean }
  // --- slice grid ---
  // Seeds the epic→slice progress grid up front (all slices start queued).
  | { kind: 'run-shape'; epics: { id: string }[]; slices: { id: string; epicId: string }[] }
  // A slice changed state. `step` is the current sub-action while running.
  | { kind: 'slice'; id: string; epicId: string; status: 'running' | 'passed' | 'failed'; step?: string };

export interface Presenter {
  onEvent(event: CookEvent): void;
  dispose(): void | Promise<void>;
}
