# Companion React semantic convergence over the production TUI PTY

Frontier: shared-session-host-tracer
Status:   active
Mode:     single
Created:  2026-08-07

## Orientation

- **Containing seam.** `runBrunchTui`'s sidecar composition (`src/app/brunch-tui.ts` lines ~221–296): the TUI acquires the per-target writer, builds `createTuiLiveSessionAdapter` over the `InteractiveMode`-owned session, wraps it as a `HostedSessionRpcBoundary` whose `project` is `projectSessionPresentationFile` over the canonical JSONL, and hands both to `startWebHost`. Canonical `/rpc` receives only `semanticSessionEvents`; the raw `SessionEventRelay` is confined to `legacySessionEvents` → `/rpc/driver`. The companion browser surface is `src/web/routes/session.tsx` plus `src/web/rpc-client.ts`.
- **Relevant frontier item.** `shared-session-host-tracer` (FE-1321). Its Status line names companion React convergence as the first unscoped remaining witness and instructs re-scoping against the child/report shape the landed PTY witness established at `27e0fb49b`.
- **Volatile state.** No `HANDOFF.md`. The landed PTY witness (`src/app/__tests__/session-runtime-contract-tracer.slow.test.ts` + `-child.ts` + `-support.ts`) is the live substrate this card extends; the child's boot choreography includes the Specify how-to-work chooser trap (the chooser swallows keystrokes until dismissed, so the journey waits for its *absence* after Esc).
- **Main open risk.** Pi's `SessionManager` autosaves appended messages but needs an explicit `_rewriteFile` for custom entries (`src/session/flush-session-manager.ts`), and the TUI process — not the test — owns that manager. If the ordinary turn's messages are not on disk when `agent_settled` fires, the companion's post-settle `session.presentation` refetch and a parent-computed fresh projection will disagree. That disagreement would be a real I65-L defect in the TUI composition, not a test-timing artifact.
- **Cross-cutting obligations carried from the frontier.** Canonical `/rpc` stays semantic-only and `/rpc/driver` stays transitional (neither transport contract may change here); `src/dev/tui-driver/**` remains the sole PTY surface; the child report stays minimal and test-owned; no detachable TUI, remote terminal protocol, or second truth store.

Posture: proving (inherited from `shared-session-host-tracer`)

## Card — Companion React converges with canonical JSONL over a real TUI turn

### Target Behavior

A companion React client attached only to the real-TUI sidecar's semantic `/rpc` converges on a TUI-typed ordinary turn with a fresh canonical-JSONL projection.

### Cold-start reads

```
- memory/SPEC.md   — A51-L; D141-L, D132-L, D133-L, D84-L; I64-L, I65-L;
                     §Verification Design "Session runtime contract convergence oracle"
- memory/PLAN.md   — frontier: shared-session-host-tracer; arc shared-session-host-convergence
- src/web/TOPOLOGY.md  — migration state (companion + standalone share session.presentation,
                         target-addressed session.*, subscribeSessionEvents); testing expectations
- src/rpc/TOPOLOGY.md  — /rpc vs /rpc/driver split; the "refetch session.presentation at
                         agent_settled, discard overlay" convergence rule
- src/app/__tests__/session-runtime-contract-tracer.slow.test.ts
- src/app/__tests__/session-runtime-contract-tracer-child.ts
- src/app/__tests__/session-runtime-contract-tracer-support.ts
                       — the landed PTY witness: child argv, discriminated report,
                         chooser-absence wait, production canonical-session reader
- docs/praxis/manual-testing.md §Findings ledger discipline — for the deferred outer beat
```

### Boundary Crossings

```
→ Vitest parent (jsdom environment) starts a PTY through src/dev/tui-driver
→ child process boots the real runBrunchTui with no launchInteractive override
     (provider backend substituted only through agentServices)
→ TUI acquires the per-target writer, builds tuiLiveSessionAdapter + hostedSession,
     starts the web sidecar via startWebHost
→ child writes {status:'ready', cwd, webSidecarUrl} to the parent-owned report path
→ parent opens the production createWebSocketRpcClient against ws://<sidecar>/rpc,
     passing WebSocketImpl from 'ws' (jsdom's WebSocket is not used)
→ parent renders BrunchWebApp at /session/$specId/$sessionId
     root loader → workspace.state; session loader → session.open, session.openAsks,
     session.presentation
→ parent dismisses the Specify chooser and types the ordinary turn into the real Pi editor
→ InteractiveMode-owned session → tuiLiveSessionAdapter → brunch.liveSessionEvent
     → rpc-client.subscribeSessionEvents → live overlay → DOM
→ agent_settled → route clears overlay and refetches session.presentation
→ parent independently derives truth: inspectCanonicalSessionFiles(cwd)
     → projectSessionPresentationFile → compared against the rendered transcript
→ Ctrl-D quit; writer lock released
```

### Risks and Assumptions

```
- RISK: the ordinary turn's messages may not have reached the JSONL file when
  agent_settled fires, because the TUI process owns the SessionManager and the
  parent cannot flush it.
    → MITIGATION: assert convergence only after agent_settled, with a bounded
      retry on the fresh projection. If the file still lags, do NOT sleep the
      test into green — that is a stop-the-line I65-L finding for the TUI
      composition, and the fix belongs in production settle-time flushing
      (compare src/rpc/methods/session.ts, which flushes on the standalone path).
      Route the finding through memory/SPEC.md before landing.

- RISK: jsdom environment plus a PTY driver plus node child processes in one file.
    → MITIGATION: vitest's jsdom environment keeps node APIs available, and the
      per-file `// @vitest-environment jsdom` pragma is already the pattern in
      src/web/__tests__/session-route.test.tsx. Pass WebSocketImpl explicitly so
      transport never depends on jsdom's WebSocket implementation.

- RISK: a second full PTY boot roughly doubles the frontier's slow-lane cost.
    → MITIGATION: one journey feeds every leaf through a single beforeAll, matching
      the landed witness; the file carries the .slow marker so the routine local
      gate stays fast and CI owns the full run.

- ASSUMPTION: the TUI live-session adapter's `close` is status-only, so a browser
  detach (route unmount, socket close) cannot tear down the TUI-owned session.
    → IMPACT IF FALSE: browser navigation would kill the companion feed and would
      also invalidate the later post-shutdown-reopen slice's premise.
    → VALIDATE: cheapest proof is an acceptance leaf — after the React app
      unmounts, the PTY still accepts a turn and the JSONL still grows.

- ASSUMPTION: contract convergence is product-sufficient (A51-L).
    → IMPACT IF FALSE: the frontier's selected D141-L shape is wrong and the
      cutover sequencing changes.
    → VALIDATE: this slice advances but does not retire A51-L; rival refusal,
      post-shutdown reopen, and the colleague walkthrough still owe the rest.
    → [→ memory/SPEC.md §Assumptions A51-L]
```

### Posture check

Proving. The slice scores on all three axes: **proof of life** — first companion React client driven by a real `InteractiveMode` turn across a process boundary; **invariants** — it locks I65-L's "settled browser view equals a fresh JSONL projection" for the TUI composition and pins the semantic-only `/rpc` boundary against a real production browser client rather than a hand-built socket; **uncertainty** — it advances A51-L and, through the flush risk above, will either confirm or falsify that the TUI composition's canonical JSONL is current at settlement.

No reshape needed: the slice already breaks if its load-bearing assumptions are wrong.

### Acceptance Criteria

All leaves live in the new `src/app/__tests__/session-runtime-contract-companion.slow.test.ts`, suite `companion React over the production TUI PTY`, fed by one `beforeAll` journey.

```
✓ companion attach — the browser reaches the TUI-owned target through production RPC only
    workspace.state over the sidecar returns status 'ready' with a spec and session, that
    target equals the single entry from inspectCanonicalSessionFiles(cwd), and session.open
    resolves { status: 'attached' } (not 'opened' — no second runtime was constructed)

✓ semantic-only transport — no raw Pi frame reaches the companion client
    every notification captured through rpcClient.subscribe during the journey has method
    brunch.liveSessionEvent or brunch.updated; none has method brunch.sessionEvent; every
    live-session frame's params.target deep-equals the durable target

✓ TUI-driven turn arrives as semantic deltas — assistant_text_delta carries the reply
    the captured frame sequence contains one or more assistant_text_delta deltas whose
    concatenated text contains TRACER_PROBE_REPLY, followed by an agent_settled delta

✓ observer-only — the companion never drove the turn
    the recorded outbound request methods contain no session.driveTurn and no
    session.answerExchange; the turn's only driver was the PTY keyboard

✓ companion React renders the TUI turn
    within the "Session transcript" list, the rendered text contains TRACER_PROBE_PROMPT
    and TRACER_PROBE_REPLY after settlement

✓ settled convergence — the rendered transcript equals a fresh canonical-JSONL projection
    after agent_settled, the rendered message entries (role + text, in order) equal the
    message entries of a parent-computed
    projectSessionPresentationFile({ target, sessionFile }) over the file from
    inspectCanonicalSessionFiles(cwd), with no live-overlay residue

✓ detach is inert — unmounting the companion does not disturb the TUI-owned session
    after the React tree unmounts and its socket closes, the PTY still renders the real
    editor and the canonical JSONL is unchanged or grows; it does not shrink or reset

✓ journey cleanup — Ctrl-D with a companion attached still releases the writer lock
    sessionWriterLockPath(cwd, target) is absent after the child exits

✓ landed PTY witness stays green — all three leaves of
    src/app/__tests__/session-runtime-contract-tracer.slow.test.ts still pass after the
    shared journey helpers move (run: npm run test:slow:core)
```

### Invariants preserved

```
- The landed PTY witness's boot / ordinary-turn / bounded-cleanup claims keep asserting the
  same facts — guarded by: session-runtime-contract-tracer.slow.test.ts (named leaf above)
- The child stays free of any launcher override — guarded by: the landed
  `expect(journey.childSource).not.toMatch(/launchInteractive\s*:/u)` leaf; the companion
  journey reuses the same child entry rather than forking a variant
- Canonical /rpc stays semantic-only and /rpc/driver keeps its transitional contract —
  guarded by: the semantic-only leaf above plus the existing split-transport regressions in
  src/dev/__tests__/web-driver-streaming.*.test.ts and
  src/rpc/__tests__/standalone-web-session-host.contract.test.ts
- src/dev/tui-driver/** remains the sole PTY surface — guarded by: ambient; the new journey
  module must state this in its header comment and spawn only through startSession
- The child report keeps its two-variant, minimal shape and no alternate session truth is
  introduced — guarded by: the ProductionTracerReport type in
  session-runtime-contract-tracer-support.ts, and by the companion journey deriving its
  target from workspace.state + inspectCanonicalSessionFiles rather than from the report
- The per-target writer guard stays fail-closed and release-on-exit stays armed (I64-L) —
  guarded by: the journey-cleanup leaf above. Stop-the-line: a surviving lock here is a
  respec signal, not a fixture to update.
```

### Verification Approach

```
- Inner: existing unit oracles, unchanged — tui-live-session-adapter.test.ts (adapter
  semantics), session-route.test.tsx (React presentation and ask answering against a fake
  client), rpc-client.test.ts (transport framing). This slice adds no new inner oracle; if
  it needs one, that is a signal the seam moved.
- Middle: cross-process production witness — the new .slow.test.ts spanning real TUI PTY +
  real WebSocket + real React render + parent-computed JSONL projection. Proves the
  companion path end to end and is the card's primary oracle.
- Outer: deferred, owned. The colleague walkthrough judging whether companion React stays
  useful without surviving TUI process exit is the frontier's own outer verification line
  (memory/PLAN.md §shared-session-host-tracer, "outer colleague walkthrough confirming that
  the real TUI and companion browser remain useful without independent-host survival").
  Re-entry trigger: after the rival-refusal and post-shutdown-reopen slices land, before the
  frontier is called complete. This card must not be read as discharging it.
```

### Cross-cutting obligations

```
- Do not modify either transport contract: canonical /rpc stays semantic-only,
  /rpc/driver stays transitional and is retired by shared-session-host-cutover, not here.
- src/dev/tui-driver/** remains the only PTY surface; no new spawn/expect path.
- The child report stays minimal and test-owned: no event mirror, no session truth.
- No detachable TUI, no remote terminal protocol, no second truth store.
- New test support modules must live under src/**/__tests__/** so tsconfig.build.json keeps
  them out of dist.
- The SPEC convergence oracle also owes "one extension-owned structured ask and one TUI-only
  product interaction" on this composition. Both stay OUT of this card and remain owed by the
  structured-ask slice; do not let this card's green read as closing that oracle.
- I64-L's release-under-contention proof remains with the rival/reopen slices.
```

### Expected touched paths (tentative)

```
src/app/__tests__/
├── session-runtime-contract-companion.slow.test.ts  +   (jsdom; the companion witness)
├── session-runtime-contract-pty-journey.ts          +   (shared PTY choreography:
│                                                         startSession argv, wait/require
│                                                         screen, chooser-absence wait,
│                                                         bounded-quit helper)
├── session-runtime-contract-tracer.slow.test.ts     ~   (import the extracted helpers;
│                                                         leaves unchanged)
└── session-runtime-contract-tracer-support.ts       ?   (only if a constant is genuinely
                                                          shared with the child; PTY
                                                          helpers must NOT land here — the
                                                          child imports this module)
src/web/TOPOLOGY.md                                  ~   (migration state: companion React
                                                          convergence proven; remaining
                                                          open proofs narrowed)
src/app/TOPOLOGY.md                                  ?   (only if the witness inventory
                                                          there names the PTY tracer)
memory/SPEC.md                                       ~   (I65-L coverage note; Verification
                                                          Design oracle status; A51-L
                                                          evidence line)
memory/PLAN.md                                       ~   (frontier Status + Dependencies
                                                          "next" pointer)
memory/cards/
└── shared-session-host-tracer--companion-react-convergence.md ~
```

### Overlap test

Checked against the six active scope files. Write manifests are disjoint except:

- `src/app/TOPOLOGY.md` — also `?` in `greenfield-secure-drop-demo--mission-and-witness.md` Card 4 (implemented, witness pending; KA-owned, Horizon-parked). Marked `?` here; prefer landing this slice's topology delta in `src/web/TOPOLOGY.md` and touch `src/app/TOPOLOGY.md` only if its witness inventory would otherwise go stale.
- `memory/PLAN.md` / `memory/SPEC.md` — canonical documents shared by every frontier; `walkthrough-remediation-2--provider-conduct-evidence.md` also declares `memory/PLAN.md ~` but is paused. Not a code collision; ordinary canonical-doc reconciliation discipline applies.

No merge or reshape required.
