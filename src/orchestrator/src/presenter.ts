// Public entry point for the CLI presentation seam.
//
// The orchestrator emits `CookEvent`s to a `CookBus`; a presenter chosen
// by environment renders them. `reports.jsonl` stays the durable medium
// (D156-K) — CookEvents are ephemeral presentation only. External callers
// import from here; only this root reaches into `presenter/`.

import { CookBus } from './presenter/bus.js';
import type { Presenter } from './presenter/events.js';
import { PlainPresenter } from './presenter/plain.js';
import { type PresenterCommand, type PresenterKind, selectPresenter } from './presenter/select.js';
import { SilentPresenter } from './presenter/silent.js';

export { CookBus } from './presenter/bus.js';
export type { CookEvent, Presenter } from './presenter/events.js';
export { PlainPresenter } from './presenter/plain.js';
export { SilentPresenter } from './presenter/silent.js';
export {
  type PresenterCommand,
  type PresenterKind,
  type SelectPresenterEnv,
  selectPresenter,
} from './presenter/select.js';

export function makePresenter(kind: PresenterKind): Presenter {
  // `ink` is the slice-2 full-screen TUI; until it lands it falls back to
  // the plain renderer, so interactive runs keep today's behavior.
  if (kind === 'silent') return new SilentPresenter();
  return new PlainPresenter();
}

/** Build a bus with the environment-selected presenter subscribed. */
export function createCookBus(
  command: PresenterCommand,
  env: { isTTY?: boolean; ci?: boolean; reporterFlag?: PresenterKind } = {},
): CookBus {
  const kind = selectPresenter({
    command,
    isTTY: env.isTTY ?? Boolean(process.stderr.isTTY),
    ci: env.ci ?? Boolean(process.env.CI),
    ...(env.reporterFlag ? { reporterFlag: env.reporterFlag } : {}),
  });
  const bus = new CookBus();
  bus.subscribe(makePresenter(kind));
  return bus;
}
