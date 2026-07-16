# Refactor: LiveSessionHost lifecycle totality (ln-induct PR #335 → F1–F4)

Temporary execution aid (ln-refactor). Delete when complete or superseded. Source: ln-induct on PR #335, lens **B — live-session runtime lifecycle: acquire without total release**. Folds in unaddressed Copilot findings #15/#16/#17/#18 plus one unsampled ownership-axis draw (F4).

## Problem Statement

The `LiveSessionHost` and its only client (the web session route) each acquire a live resource — a runtime cell, a driver claim, an open target — on one path but do not release it on every exit path. Four concrete leaks, all latent (no loud failure; handles/cells/claims accumulate silently):

- **F1 — disposal is not total over in-flight opens.** `dispose()` awaits only already-registered `cells`; it ignores the `opening` map and has no disposed guard. An `open()` in flight resolves *after* dispose starts, runs `cells.set(...)`, and installs an orphaned runtime + live subscription that nothing will ever tear down.
- **F2 — loader opens a target it may not close.** The route loader calls `session.open`, then returns `{ error }` on an `openAsks` parse failure without `session.close`. Every failed load leaks a live cell in the standalone host.
- **F3 — route never closes the target it opened.** The `useEffect` cleanup only unsubscribes from events; navigating away / unmounting never issues `session.close`. Runtimes accumulate for the process lifetime.
- **F4 — driver claim is never relinquished (unsampled).** `cell.driverId` is set in `driveTurn`/`answerExchange` and never reset. A completed turn leaves the claim held, so a second driver (new tab) gets permanent `driver_conflict` until the target is closed. The bot never sampled this; it is the ownership-axis instance of the same lens.

Current lifecycle (states a target/claim can be in, and the exits that fail to release):

```pseudo
graph host-lifecycle-current
  opening --resolve--> open            # F1: if dispose ran during opening, still installs
  open --close--> torn_down            # releases cell; does NOT reset driverId (F4)
  open --dispose(idle)--> torn_down
  open --dispose(active turn)--> ActiveLiveSessionError   # correct, fail-loud
  opening --dispose--> (ignored)       # F1: pending open leaks past dispose
  driveTurn/answerExchange --> driverId set --(never)--> released   # F4

graph route-lifecycle-current
  loader: open --openAsks ok--> ready
  loader: open --openAsks parse-fail--> {error}      # F2: target left open
  ready --unmount--> unsubscribe only                # F3: target left open
```

## Solution

Every acquire has a matching release on every exit. Disposal is total; the route closes what it opens; a driver claim is released when its cell is torn down (and the idle-release policy is named, not silently chosen).

```pseudo
graph host-lifecycle-desired
  disposed?(open) --> dispose late runtime immediately   # F1 guard
  opening --dispose--> await settle, then tear down       # F1 totality
  torn_down: cells.delete + detach + await runtime.dispose + driverId := null  # F4
  driver policy: sticky-until-teardown (named) OR release-on-settle (decision below)

graph route-lifecycle-desired
  loader: open --any failure--> best-effort session.close --> {error}   # F2
  ready --unmount--> unsubscribe + best-effort session.close            # F3
```

## Commits

Ordered by safety: one preparatory extraction, then host-internal behavior (self-contained, unit-tested), then client behavior. Each leaves the suite green.

1. [done] **Extract a single cell-teardown helper.** `close()` and `dispose()` duplicate the delete → detach → await-runtime-dispose sequence. Extract one internal teardown routine both call. Pure refactor; no behavior change; existing host tests stay green. Makes commits 2 and 3 land in one place.

2. [done] **Make host disposal total over in-flight opens (F1).** Add a disposed guard so a late-resolving `open()` disposes its runtime instead of registering it, and make `dispose()` await the `opening` map to settle before tearing down. New host tests witness the open-during-dispose race (no orphaned runtime, late runtime disposed). Updates `src/session/TOPOLOGY.md` disposal contract in the same commit.

3. **Release the driver claim on teardown (F4).** Reset the driver owner when a cell is torn down (close + dispose). Scope is **release-on-teardown only** — a completed turn keeps the claim sticky for the cell's life; the richer completed-turn/idle handoff policy is deliberately *not* invented here. New host test: a second driver can claim the target after it is closed and reopened. Same-commit `src/session/TOPOLOGY.md` update to the driver-owner sentence.

4. **Close the target on every loader failure exit (F2).** When the loader has opened a target and then fails protocol load, issue a best-effort `session.close` before returning the error. New route test: `openAsks` parse failure triggers `session.close` and still renders the error surface.

5. **Close the target on route unmount / navigate-away (F3).** The route effect cleanup issues a best-effort `session.close` alongside unsubscribing. New route test asserts unmount calls `session.close`. Same-commit `src/web/TOPOLOGY.md` update so the route's open/close contract reflects release-on-exit.

## Decisions

- **Modules modified:** `src/session/live-session-host.ts` (teardown helper, disposed guard, opening-settle, driver release); `src/web/routes/session.tsx` (loader close-on-error, effect close-on-unmount).
- **Interface changes:** none to the `LiveSessionHost` public signature. Internal-only lifecycle state (disposed flag, teardown routine). The route consumes the existing `session.close` RPC — no new method.
- **Architectural decision (settled, commit 3):** driver-lease release semantics = **release-on-teardown only**. `driverId` resets when a cell is closed/disposed; the completed-turn/idle handoff policy is *not* invented here — PLAN §186 reserves "one driver lease/handoff policy" for `shared-session-host-cutover`. This commit fixes the permanent-conflict leak without pre-empting the cutover's lease design; no `memory/SPEC.md` §Decisions entry needed (it establishes no durable contract beyond the cutover's reserved seam).
- **Schema / API contracts:** unchanged. No wire-shape change (that was lens A, already resolved).
- **Topology files touched:** `src/session/TOPOLOGY.md` (commits 2, 3 — disposal totality + driver-owner release) and `src/web/TOPOLOGY.md` (commit 5 — route release-on-exit). Each update ships in the commit that changes the behavior it documents.

## Testing Decisions

- **Good test here = observable release, not internal state.** Assert: no orphaned runtime after open-during-dispose (runtime `dispose` called, no post-dispose event dispatch); a second driver succeeds after the first releases; `session.close` is issued on loader failure and on unmount.
- **Modules tested:** `live-session-host.test.ts` (F1, F4 — extend the existing fan-out/concurrency battery with race + release cases); `session-route.test.tsx` (F2, F3 — extend; the existing unmount test at ~L789 already remounts, so add a `session.close` call assertion there and a new close-on-error case).
- **Prior art:** `live-session-host.test.ts` already coalesces concurrent opens and proves driver-conflict/answer outcomes — the race and release tests slot into the same `vi.fn` runtime harness. `session-route.test.tsx` already drives a fake RPC client with `f.calls`/`f.emit`, so asserting a `session.close` call is one predicate.

## Out of Scope

- The dual-path RPC contract-drift lens (A) and the refusal-uniformity finding (F5) — F5 is routed separately to `ln-scope` next.
- The full driver lease/handoff policy and any TUI-side host attachment — owned by `shared-session-host-tracer` / `shared-session-host-cutover`.
- Any wire-shape, schema, or discovery change; questionnaire answering (D133-L); the `Number(run.specId)` weak hit (F6, verify-then-fix, not a leak).
