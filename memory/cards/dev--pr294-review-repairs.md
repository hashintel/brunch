# PR #294 review repairs: deferred-send ordering + ride-alongs

Frontier: n/a
Status:   active
Mode:     slices
Created:  2026-07-06

## Orientation

- Containing seam: the boot-kick deferred-send wrapper (`scheduleKickSend`, `src/app/brunch-tui.ts`) under the `LiveKickDeps.sendCustomMessage` interface consumed by `originateAndKick` / `deliverSeedEntries` (`src/.pi/extensions/session-orientation/juncture.ts`); sourced from the 5 unresolved review threads on PR #294 (commit `b15163ed`), inducted 2026-07-06.
- Current branch: `ln/fe-1152-refinements` stack tip; tip repairs like the consumed `dev--stack-review-*` cards — no new Linear issue or branch.
- Posture: earned (settled seam built by `3ca4b573`; this closes the ordering ambiguity that deferral introduced and locks the completion-semantics contract).
- Main risk: the naive repair — re-awaiting real delivery inside the `session_start` handler — reintroduces the parked-TUI bug `3ca4b573` fixed. The fix must preserve "handler returns immediately" while restoring "sends execute serially".
- CONSTRAINT (this pass): do not edit `memory/PLAN.md`, `memory/SPEC.md`, or any `TOPOLOGY.md` — another agent's `ln-sync` is in flight. If the serial-send contract deserves a topology mention, note it for the next sync instead.

## Card 1 — serialize the deferred kick sends behind one defer window

Status: done
Weight: full

Build note: implemented in `src/app/brunch-tui.ts` with a per-kick `KickSendSerialChain` created inside `resolveKickContext`; `scheduleKickSend` still resolves immediately but queues each send behind the one defer promise. Verified by focused send-chain unit tests and `npm run verify`. Canonical topology/SPEC mention intentionally deferred per the in-flight constraint above.

### Target Behavior

All sends scheduled through one kick context execute serially in scheduling order after a single defer window, so a seed entry is fully sent before the next seed entry begins and before the kick send begins, while every wrapped call still resolves immediately for its caller.

### Full-card cold-start reads

- `memory/SPEC.md` — D40-L, D101-L/D102-L (session seed facts), D109-L.
- `src/app/brunch-tui.ts` — `scheduleKickSend` + the `resolveKickContext` wiring (~343–560) and its doc comments ('fired' = send scheduled; 50ms `ceiling:`).
- `src/.pi/extensions/session-orientation/juncture.ts` — `originateAndKick`, `deliverSeedEntries`, `sendCustomMessageViaExtensionApi` (J5 adapter: sync-enqueue, ordering already safe — untouched).
- `src/dev/tier-2-harness.ts` — `emitStartupOrientationForHarness` "bind returned ⇒ kick settled" contract (waits defer + idle).

### Boundary Crossings

```pseudo
session_start(startup) handler (J1/J2)
→ resolveKickContext closure (per-juncture)
→ deferred serial send chain (single 50ms defer, then FIFO awaited sends)
→ pi session.sendCustomMessage (seed entries display:false, then kick triggerTurn)
→ opening turn composes with seed already delivered
```

### Risks and Assumptions

- RISK: re-awaiting delivery in the handler parks `InteractiveMode` before `subscribeToAgent()` — the exact bug `3ca4b573` fixed.
  → MITIGATION: chain shape — the closure holds `chain = <single defer>`; each wrapped send does `chain = chain.then(() => send()).catch(→ diagnostic)` and returns immediately. Callers never await delivery; the chain serializes it.
- DECISION (encode in the implementation): chain failure policy is fail-closed — when a chained send fails, report the diagnostic and skip the remaining sends for that kick context (with the skip named in the diagnostic). Rationale: proceeding would fire a kick whose seed silently failed — the same seedless-directed-kick class the orientation append-failure card (`8a7d1cd4`) closed at the append layer.
- ASSUMPTION: invoking `send()` inside `.then(...)` converts sync throws into rejections, structurally absorbing the Copilot sync-throw thread.
  → VALIDATE: unit test with a synchronously-throwing send.
- ASSUMPTION: seed sends (`display: false`, no `triggerTurn`) resolve fast, so serializing before the kick adds no perceptible latency; the kick send is last on its chain so its turn-length resolution blocks nothing.
  → IMPACT IF FALSE: boot kick delayed beyond the defer window; visible as slow opening turn.
  → VALIDATE: existing tier-2 harness timing assertions stay green.
- ASSUMPTION: the chain lives per `resolveKickContext` call (per juncture run), so junctures do not queue behind each other's turns.
  → VALIDATE: inspect wiring — the closure is created per invocation; add a test only if that reading is wrong.

### Posture check

Earned closure: locks in the seam invariant "resolved-at-scheduling sends still execute serially in scheduling order", closes the ordering ambiguity the deferral introduced, and retires the hollow-await hazard for this seam. Juncture code stays dual-compatible: its awaits are real for direct senders (RPC/tests) and harmless for deferred ones.

### Acceptance Criteria

✓ New unit test (brunch-tui send-chain) — with deferred sends for seed then kick, the seed's `send()` promise settles before the kick's `send()` is invoked.
✓ New unit test — three chained sends execute in scheduling order, each invoked only after the previous settles (covers multi-seed-entry ordering, induction finding 1b).
✓ New unit test — a synchronously-throwing `send()` routes to `reportAsyncDiagnostic` and does not escape the timer/chain (absorbs the Copilot sync-throw thread).
✓ New unit test — after a failed send, subsequent sends on the same chain are skipped and the diagnostic names the skip (fail-closed policy).
✓ Existing tier-2 harness tests — `emitStartupOrientationForHarness` defer+idle contract unchanged and green.
✓ `scheduleKickSend`'s doc comment and the 50ms `ceiling:` comment updated to describe the serial-chain contract without weakening the 'fired' = send-scheduled semantics.

### Verification Approach

- Inner: focused Vitest unit tests on the chain wrapper (deferred/controllable send fakes); existing session-orientation + tier-2 harness suites.
- Gate: `npm run fix`; `npm run verify` before commit.

### Cross-cutting obligations

- Do NOT re-await delivery in the `session_start` handler path (regression `3ca4b573`).
- J5 adapter (`sendCustomMessageViaExtensionApi`) untouched — `pi.sendMessage` is synchronous enqueue; its ordering is already safe.
- Preserve 'fired' kick-outcome semantics ("send scheduled") and `BRUNCH_KICK_SEND_DEFER_MS` export for tests.
- Note for next `ln-sync` (do not edit canonical docs this pass): the serial-send contract may deserve a line where the kick surface is documented.

### Expected touched paths (tentative)

```pseudo
src/app/
├── brunch-tui.ts                    ~
└── __tests__/<kick-send-chain>.ts   + | ~  # wherever scheduleKickSend tests live today
src/dev/tier-2-harness.ts ?
```

## Card 2 — align inner review-comment guards with the nonblank predicate

Status: done
Weight: light

Build note: aligned both inner `request_changes` guards with the caller-trimmed nonblank contract and pinned whitespace-only public submit behavior for digest and non-digest reviews. Verified by focused structured-exchange tests and `npm run verify`.

### Objective

`projectAcceptedReviewDetails`'s two `request_changes` branches reject blank comments gracefully instead of letting `zRequestReviewDetails.parse` throw past the `{ ok: false }` protocol.

### Light-card cold-start reads

- `memory/SPEC.md` — request/review terminal contract (D106-L, D110-L).
- `src/session/structured-exchange-loop/accepted-response.ts` — outer guard (~150–156, trims + length-checks) vs inner branches (~271, ~296, undefined-only).
- `src/exchanges/projections/request-response/review.ts` — every terminal now parses through `zRequestReviewDetails` (throws on blank).

### Acceptance Criteria

✓ The two inner `request_changes` guards reject empty-after-trim comments with the existing graceful message (`comment === undefined || comment.length === 0`, or the shared nonblank predicate) — no reachable input can make the parse throw where `{ ok: false }` is the protocol.
✓ A doc line on `projectAcceptedReviewDetails` names its input contract (receives the caller-trimmed comment).
✓ Test through the public submit path: whitespace-only `review.comment` for digest and non-digest `request_changes` yields `{ ok: false }`, no throw (latent today — single caller trims first; the test pins the defense).

### Verification Approach

- Inner: structured-exchange-loop unit tests.
- Gate: `npm run fix`; `npm run verify` before commit.

### Cross-cutting obligations

- Do not widen into a predicate-consolidation refactor; `structuredExchangeResponseRequiresComment` is already shared. This is only the nonblankness half of the two inner branches.

### Assumption dependency

None.

### Expected touched paths (tentative)

```pseudo
src/session/structured-exchange-loop/
├── accepted-response.ts                     ~
└── __tests__/<accepted-response test>.ts    ~
```

### Promotion checklist

- [ ] Does this change a requirement?
- [ ] Does this create, retire, or invalidate an assumption?
- [ ] Does this slice depend on an unvalidated high-impact assumption?
- [ ] Does this make or reverse a non-trivial design decision?
- [ ] Does this establish a new seam-level invariant?
- [ ] Does this change a frontier-level cross-cutting obligation or verification architecture layer?
- [ ] Does it cross more than two major seams?
- [ ] Is this the first touch in an unfamiliar seam from a fresh thread?
- [ ] Can you not name the containing seam or current rationale from the live docs?

## Card 3 — reconcile the PR #294 review threads

Status: next
Weight: light

### Objective

The false-positive `setWorkingVisible` thread is answered and resolved; the remaining threads are answered once their fixes exist.

### Light-card cold-start reads

- `src/.pi/extensions/chrome/index.ts` — the `turn_start` handler comment (~282–288) documenting pi's streaming-gated indicator (the `true` is a no-op outside the missed-`agent_start` case).
- PR #294 unresolved threads (GitHub, `gh api graphql` reviewThreads).

### Acceptance Criteria

✓ The `setWorkingVisible` thread has a reply citing the streaming-gated no-op contract (pi hides the indicator when streaming ends; no matching `false` needed) and is marked resolved.
✓ The Cursor ordering thread and the two Copilot threads (sync-throw, guard drift ×2) have replies pointing at the Card 1 / Card 2 commits — posted after those commits exist locally; note in each reply that they land with the next `gt submit` (submits stay the user's action).

### Verification Approach

- Inner: re-fetch unresolved threads after replies; the false-positive one shows `isResolved: true`.

### Assumption dependency

None.

### Expected touched paths (tentative)

None (GitHub-side actions only).

### Promotion checklist

- [ ] Does this change a requirement?
- [ ] Does this create, retire, or invalidate an assumption?
- [ ] Does this slice depend on an unvalidated high-impact assumption?
- [ ] Does this make or reverse a non-trivial design decision?
- [ ] Does this establish a new seam-level invariant?
- [ ] Does this change a frontier-level cross-cutting obligation or verification architecture layer?
- [ ] Does it cross more than two major seams?
- [ ] Is this the first touch in an unfamiliar seam from a fresh thread?
- [ ] Can you not name the containing seam or current rationale from the live docs?
