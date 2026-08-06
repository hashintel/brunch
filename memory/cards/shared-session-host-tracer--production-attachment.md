# Session runtime contract production tracer

Frontier: shared-session-host-tracer
Status:   active — inner contracts and production composition wiring built; PTY compound witness remains
Mode:     single
Created:  2026-08-05

## Orientation

- Containing seam: D141-L keeps normal TUI and standalone web as two legitimate runtime compositions while converging sealed runtime construction, target-addressed Brunch semantic RPC/projections, JSONL truth, and cross-process single-writer authority.
- Frontier: FE-1321 / `shared-session-host-tracer`; its first production-attachment attempt falsified A47-L's independent-host premise and the resulting `ln-design` selected contract convergence instead.
- Volatile state: SPEC/PLAN/topology reconciliation for D141-L is present in the current working copy and belongs to this frontier; the prior blocked result is preserved below as rejected-shape evidence.
- Main open risk: A51-L — companion React may not provide enough product value without surviving TUI exit, and Brunch currently lacks cross-process exclusion before TUI and standalone web construct the same JSONL runtime.

Posture: proving (inherited from `shared-session-host-tracer`).

## Target Behavior

A session active in normal TUI mode is available to companion React through the canonical target-addressed Brunch session contract.

## Full-card cold-start reads

- `memory/SPEC.md` — A51-L; D39-L, D84-L, D132-L, D133-L, D141-L; I64-L, I65-L; Verification Design “Session runtime contract convergence oracle”
- `memory/PLAN.md` — frontier `shared-session-host-tracer` and arc `shared-session-host-convergence`
- `docs/design/WEB_UI_ARCHITECTURE.md` — 2026-08-05 supersession plus historical FE-1200 evidence
- `src/app/TOPOLOGY.md` — two legitimate runtime compositions and production entry ownership
- `src/session/TOPOLOGY.md` — standalone `LiveSessionHost`, live ask registry, and target authority
- `src/rpc/TOPOLOGY.md` — current raw TUI sidecar versus canonical target-addressed semantic contract
- `src/web/TOPOLOGY.md` — React target filtering, JSONL hydration, semantic overlay, and settlement refetch
- `docs/praxis/manual-testing.md` — colleague walkthrough ownership and findings discipline
- Pi `docs/sdk.md`, `docs/tui.md`, and `docs/rpc.md` — preserve real `InteractiveMode`; do not substitute degraded RPC/custom-UI behavior

## Rejected shape evidence

The prior candidate colocated `InteractiveMode` with an independently-lived host. Pi 0.83.0's public `InteractiveMode.stop()` leaves `AgentSessionRuntime` alive, but `run()` remains blocked in `getUserInput()` and retains its callback. A fresh mode can reuse the exact runtime, yet repeated detach/re-attachment accumulates orphaned mode/run loops. This card must not reintroduce that shape, patch Pi internals, fork Pi, or build a remote terminal client.

## Boundary Crossings

```text
production normal-TUI entry
→ acquire per-target writer authority before Pi runtime construction
→ one sealed AgentSessionRuntime + real InteractiveMode + one JSONL SessionManager
→ adapt the exact live session / ask registry into target-addressed Brunch session semantics
→ companion React session route
  → session.presentation hydration from JSONL
  → brunch.liveSessionEvent semantic overlay
  → session drive / open-ask / answer operations against the TUI-owned runtime
→ agent_settled
→ fresh JSONL-derived session.presentation convergence
→ rival standalone-web open rejected before second runtime construction
→ normal TUI shutdown disposes runtime and releases writer authority
→ standalone web reopens the same target from JSONL
```

## Risks and Assumptions

- RISK: “shared contract” becomes a second wrapper around the existing raw relay instead of one semantic projection path → MITIGATION: companion React must receive `brunch.liveSessionEvent` and target-required `session.*` results; raw `AgentSessionEvent`, `brunch.sessionEvent`, and `/rpc/driver` are not accepted proof.
- RISK: target exclusion exists only inside one `LiveSessionHost`, allowing TUI and standalone processes to write the same JSONL → MITIGATION: acquire writer authority before either composition creates `SessionManager`/`AgentSessionRuntime`; the subprocess rival asserts zero second runtime creation and zero transcript effect.
- RISK: a stale lock workaround can either strand a session or permit duplicate writers → MITIGATION: the writer guard must fail closed on uncertain ownership, release on normal disposal and construction failure, and carry an explicit crash/stale-owner policy with a contrastive oracle. Do not add a force-steal path.
- RISK: companion browser control races direct `InteractiveMode` input → MITIGATION: treat TUI and its companion browser as one operator authority; serialize live turns through existing runtime busy behavior and prove a concurrent rival returns `busy` with zero extra transcript effect. Do not introduce a general lease/handoff protocol in this tracer.
- ASSUMPTION: A51-L — companion React need not outlive the TUI process for the current product.
  → IMPACT IF FALSE: D141-L is insufficient and the architecture must revisit detachable Pi presentation or remote-terminal ownership before cutover.
  → VALIDATE: production compound witness plus the FE-1321 colleague walkthrough.

## Posture check

- **Lights up:** the shipped normal-TUI process through the canonical semantic session contract into the existing React session route.
- **Stabilizes:** I64-L cross-process writer authority and I65-L semantic convergence across the two legitimate runtime compositions.
- **Retires:** A51-L if the automated compound witness and colleague walkthrough show that companion React remains useful without independent process lifetime.
- This is the cheapest vertical proof: it reuses the real TUI, existing React route, JSONL projection, and `LiveSessionHost` contract rather than adding a daemon, remote terminal, or detachable Pi lifecycle.

## Build progress (2026-08-05)

- Built fail-closed per-target filesystem writer authority and attached it before both TUI and standalone runtime construction, with normal/construction-failure release.
- Built the exact-session TUI semantic adapter and exposed the canonical hosted-session RPC/event contract from the normal TUI sidecar without deleting the old relay/driver.
- Added a slow composition-level lifecycle tracer, but it uses the injected `launchInteractive` boundary rather than a PTY-backed real `InteractiveMode`; it therefore does **not** satisfy the PTY/custom-UI/durable-convergence leaves below. Keep this card active.

## Acceptance Criteria

```text
✓ src/session writer-guard tests — normal acquisition precedes runtime creation; same-target rival acquisition fails closed; distinct targets remain independent; construction failure and normal disposal release authority; the declared stale/crash case cannot create a second writer.

✓ src/rpc companion-session contract tests — the TUI-owned adapter exposes target-required session presentation/drive/openAsks/answer semantics and emits only validated brunch.liveSessionEvent frames; raw Pi events, targetless calls, and a second browser dialect are rejected.

✓ src/app/__tests__/session-runtime-contract-tracer.slow.test.ts · real TUI companion — a PTY-backed production normal-TUI entry renders Brunch/Pi chrome and editor, submits one ordinary turn, answers one extension-owned structured ask, and performs one /brunch:consult custom-UI choice while companion React observes/continues the exact target.

✓ src/app/__tests__/session-runtime-contract-tracer.slow.test.ts · durable convergence — after agent_settled, normalized React-visible semantic records equal a fresh session.presentation projection from the sole JSONL and include the exact brunch.elicitation_style effect.

✓ src/app/__tests__/session-runtime-contract-tracer.slow.test.ts · authority rivals — while TUI owns the target, a standalone-web subprocess is refused before a second runtime factory call or transcript write; a concurrent companion turn receives busy with zero duplicate effect.

✓ src/app/__tests__/session-runtime-contract-tracer.slow.test.ts · lifecycle transfer — normal TUI shutdown disposes its runtime and releases writer authority; standalone web then opens the same target, hydrates the settled JSONL, and can complete a subsequent deterministic turn.

✓ existing standalone-web and TUI suites — `standalone-web-session-host.real-entry.test.ts`, `standalone-web-session-host.concurrency.test.ts`, `session-route.test.tsx`, and `brunch-tui.test.ts` remain green without weakening standalone target isolation or real TUI behavior.

✓ npm run verify:full — required because this slice adds a slow PTY/subprocess witness and changes both production runtime-entry seams.
```

## Invariants preserved

- D39-L sealed Brunch Pi profile and real `InteractiveMode` remain the normal TUI implementation — guarded by: existing `src/app/__tests__/brunch-tui.test.ts` plus the PTY compound witness. **Stop the line** if the implementation replaces the TUI with a line client or Pi RPC dialog surface.
- I64-L permits one writable runtime per JSONL across processes and durable target identity never degrades to connection/process identity — guarded by: writer-guard contracts and subprocess rivals. **Stop the line** on any force-steal or create-runtime-before-acquire path.
- I65-L/D133-L keep JSONL as durable truth and browser traffic semantic — guarded by: existing projection/route suites plus the live-to-settled differential. **Stop the line** if React needs raw Pi events, ANSI, or a mirror store.
- D132-L standalone multi-session concurrency remains intact — guarded by: `standalone-web-session-host.concurrency.test.ts`; the cross-process guard is per target, not a workspace-global mutex.
- D84-L's current raw relay remains removable rather than becoming a compatibility dependency — guarded by: the new companion proof targets only `brunch.liveSessionEvent` and target-addressed `session.*`; actual deletion remains the wait-gated cutover.

## Verification Approach

- Inner: contract and negative-space tests for target writer authority, release/error behavior, semantic adapter shape, target addressing, and raw-event rejection.
- Middle: one PTY + subprocess + mounted-React compound witness over production TUI and standalone-web entries with deterministic faux-provider turns and fresh JSONL comparison.
- Outer: FE-1321 owns a colleague walkthrough after the middle witness is green; re-entry trigger is the landed tracer. It judges whether one normal TUI workflow plus companion browser observation/control remains useful without companion survival after TUI exit, and records findings under `docs/praxis/manual-testing.md`.

## Cross-cutting obligations

- Use one sealed runtime factory and one semantic presentation model across both launch compositions; do not make the scope pass by duplicating decoders or runtime setup.
- Acquire per-target writer authority before constructing any writable Pi session and release only after disposal; distinct session targets must remain concurrently usable.
- Keep companion and standalone React on one target-addressed Brunch RPC/event vocabulary; no `/rpc/driver`, raw Pi event, or route-local identity in the new path.
- Keep live events ephemeral and converge at `agent_settled` through fresh JSONL projection.
- Do not delete the old raw relay/driver inventory in this tracer; `shared-session-host-cutover` owns the closed deletion sweep after A51-L retires.
- Do not add session picker, daemon management, remote auth, remote terminal transport, generic lease handoff, crash-surviving turns, or cross-machine hosting.

## Expected touched paths (tentative)

```text
package.json                                                     ?  (only if a direct lock dependency is required)
package-lock.json                                                ?  (paired only with package.json)
src/session/
├── session-writer-guard.ts                                      +
├── __tests__/session-writer-guard.test.ts                       +
├── tui-live-session-adapter.ts                                  +
└── __tests__/tui-live-session-adapter.test.ts                   +
src/app/
├── brunch-tui.ts                                                ~
├── brunch-web.ts                                                ~
└── __tests__/
    ├── session-runtime-contract-tracer.slow.test.ts              +
    └── session-runtime-contract-tracer-support.ts                ?
src/rpc/
├── handlers.ts                                                  ?
├── web-host.ts                                                  ~
├── live-session-contract.ts                                     ?
└── __tests__/standalone-web-session-host.contract.test.ts       ~
src/web/__tests__/session-route.test.tsx                         ?
memory/cards/shared-session-host-tracer--production-attachment.md ~
memory/PLAN.md                                                   ?  (completion status only)
memory/SPEC.md                                                   ?  (retire A51-L only if outer evidence closes it)
src/app/TOPOLOGY.md                                              ?
src/session/TOPOLOGY.md                                          ?
src/rpc/TOPOLOGY.md                                              ?
src/web/TOPOLOGY.md                                              ?
```
