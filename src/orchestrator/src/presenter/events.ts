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
  | { kind: 'plan-warnings'; messages: string[] };

export interface Presenter {
  onEvent(event: CookEvent): void;
  dispose(): void | Promise<void>;
}
