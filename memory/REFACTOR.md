# Refactor: LiveSessionHost lifecycle totality (ln-induct PR #335 → F1–F4)

Temporary execution aid (ln-refactor). Delete when complete or superseded. Source: ln-induct on PR #335, lens **B — live-session runtime lifecycle: acquire without total release**. Folds in unaddressed Copilot findings #15/#16/#17/#18 plus one unsampled ownership-axis draw (F4).

## Problem Statement

The `LiveSessionHost` and its only client (the web session route) each acquire a live resource — a runtime cell, a driver claim, an open target — on one path but do not release it on every exit path. Four concrete leaks, all latent (no loud failure; handles/cells/claims accumulate silently):

- **F1 — disposal is not total over in-flight opens.** `dispose()` awaits only already-registered `cells`; it ignores the `opening` map and has no disposed guard. An `open()` in flight resolves *after* dispose starts, runs `cells.set(...)`, and installs an orphaned runtime + live subscription that nothing will ever tear down.
- **F2 — loader opens a target it may not close.** The route loader calls `session.open`, then returns `{ error }` on an `openAsks` parse failure without `session.close`. Every failed load leaks a live cell in the standalone host.
- **F3 — route never closes the target it opened.** The `useEffect` cleanup only unsubscribes from events; navigating away / unmounting never issues `session.close`. Runtimes accumulate for the process lifetime.
- **F4 — driver claim is never relinquished (unsampled) — WITHDRAWN on build inspection.** `cell.driverId` is set in `driveTurn`/`answerExchange` and never reset, so a second driver gets `driver_conflict` for the cell's life. On inspection this is the *intended* one-driver-per-target invariant (D132-L; PLAN §149 "one writable runtime and driver owner per target"), not a leak: `close()` tears down the whole cell, so a reopened target already starts with `driverId: null`, and resetting `driverId` during teardown is vacuous (the cell is deleted anyway). The meaningful change — a driver *handoff* that lets a second driver take over without a close — is explicitly reserved for `shared-session-host-cutover` (PLAN §186 "one driver lease/handoff policy"). No in-scope fix exists; commit 3 dropped (see Commits).

Current lifecycle (states a target/claim can be in, and the exits that fail to release):

```pseudo
graph host-lifecycle-current
  opening --resolve--> open            # F1: if dispose ran during opening, still installs
  open --close--> torn_down            # releases whole cell (driverId goes with it)
  open --dispose(idle)--> torn_down
  open --dispose(active turn)--> ActiveLiveSessionError   # correct, fail-loud
  opening --dispose--> (ignored)       # F1: pending open leaks past dispose
  driveTurn/answerExchange --> driverId set, sticky until close   # intended (D132-L), NOT F4 leak

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
  torn_down: cells.delete + detach + await runtime.dispose   # (driverId dies with the cell)
  driver policy: sticky single driver per target (D132-L); handoff owned by cutover — no change here

graph route-lifecycle-desired
  loader: open --any failure--> best-effort session.close --> {error}   # F2
  ready --unmount--> unsubscribe + best-effort session.close            # F3
```

## Commits

Ordered by safety: one preparatory extraction, then host-internal behavior (self-contained, unit-tested), then client behavior. Each leaves the suite green.

1. [done] **Extract a single cell-teardown helper.** `close()` and `dispose()` duplicate the delete → detach → await-runtime-dispose sequence. Extract one internal teardown routine both call. Pure refactor; no behavior change; existing host tests stay green. Makes commits 2 and 3 land in one place.

2. [done] **Make host disposal total over in-flight opens (F1).** Add a disposed guard so a late-resolving `open()` disposes its runtime instead of registering it, and make `dispose()` await the `opening` map to settle before tearing down. New host tests witness the open-during-dispose race (no orphaned runtime, late runtime disposed). Updates `src/session/TOPOLOGY.md` disposal contract in the same commit.

3. [dropped] **Release the driver claim on teardown (F4).** Dropped on build inspection: release-on-teardown is a no-op because teardown deletes the whole cell, and the meaningful driver-handoff is intended-behavior + `shared-session-host-cutover`-owned (PLAN §186). No buildable red oracle exists that is not either vacuous or a cutover pre-emption. See withdrawn F4 in Problem Statement.

4. [done] **Close the target on every loader failure exit (F2).** When the loader has opened a target and then fails protocol load, issue a best-effort `session.close` before returning the error. New route test: `openAsks` parse failure triggers `session.close` and still renders the error surface.

5. **Close the target on route unmount / navigate-away (F3).** The route effect cleanup issues a best-effort `session.close` alongside unsubscribing. New route test asserts unmount calls `session.close`. Same-commit `src/web/TOPOLOGY.md` update so the route's open/close contract reflects release-on-exit.

## Decisions

- **Modules modified:** `src/session/live-session-host.ts` (teardown helper, disposed guard, opening-settle); `src/web/routes/session.tsx` (loader close-on-error, effect close-on-unmount).
- **Interface changes:** none to the `LiveSessionHost` public signature. Internal-only lifecycle state (disposed flag, teardown routine). The route consumes the existing `session.close` RPC — no new method.
- **Architectural finding (commit 3 dropped):** the sticky single-driver-per-target claim is the intended D132-L invariant, not a leak; driver handoff is reserved for `shared-session-host-cutover` (PLAN §186). No `memory/SPEC.md` change — this only reaffirms an existing invariant.
- **Schema / API contracts:** unchanged. No wire-shape change (that was lens A, already resolved).
- **Topology files touched:** `src/session/TOPOLOGY.md` (commit 2 — disposal totality) and `src/web/TOPOLOGY.md` (commit 5 — route release-on-exit). Each update ships in the commit that changes the behavior it documents.

## Testing Decisions

- **Good test here = observable release, not internal state.** Assert: no orphaned runtime after open-during-dispose (runtime `dispose` called, no post-dispose event dispatch); `session.close` is issued on loader failure and on unmount.
- **Modules tested:** `live-session-host.test.ts` (F1 — extend the existing fan-out/concurrency battery with the open-during-dispose race case); `session-route.test.tsx` (F2, F3 — extend; the existing unmount test at ~L789 already remounts, so add a `session.close` call assertion there and a new close-on-error case).
- **Prior art:** `live-session-host.test.ts` already coalesces concurrent opens and proves driver-conflict/answer outcomes — the race and release tests slot into the same `vi.fn` runtime harness. `session-route.test.tsx` already drives a fake RPC client with `f.calls`/`f.emit`, so asserting a `session.close` call is one predicate.

## Out of Scope

- The dual-path RPC contract-drift lens (A) and the refusal-uniformity finding (F5) — F5 is routed separately to `ln-scope` next.
- The full driver lease/handoff policy and any TUI-side host attachment — owned by `shared-session-host-tracer` / `shared-session-host-cutover`.
- Any wire-shape, schema, or discovery change; questionnaire answering (D133-L); the `Number(run.specId)` weak hit (F6, verify-then-fix, not a leak).
