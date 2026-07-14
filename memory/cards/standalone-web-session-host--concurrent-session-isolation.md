# Concurrent standalone-web session isolation

Frontier: standalone-web-session-host
Status:   active
Mode:     single
Created:  2026-07-14

## Orientation

- The containing seam is the target-keyed `LiveSessionHost` behind production `runBrunchWeb` and hosted-session RPC.
- FE-1200 is the Linear/branch frontier; its accepted one-target tracer is complete, and this is slice 2 before the presentation-family sweep.
- Posture: proving (inherited from `standalone-web-session-host`); landing this slice must retire A42-L rather than merely add unit coverage for the host map.
- Main risk: sealed Pi runtimes, exchange registries, event streams, or extension/runtime services may retain module-global state that the one-target tracer could not expose.
- Cross-cutting obligations: durable `(specId, sessionId)` remains the only session identity; one-driver/many-observer authority is target-local; Pi JSONL and SQLite graph truth remain canonical; verification must exercise production wiring rather than inject the sessions under test.

## Target Behavior

Two explicitly targeted standalone-web sessions remain isolated under adversarially interleaved session and shared-graph activity.

## Cold-start reads

- `memory/SPEC.md` — req 31; A42-L; D127-L; I64-L
- `memory/PLAN.md` — frontier `standalone-web-session-host`, concurrency slice
- `docs/design/WEB_UI_ARCHITECTURE.md` — §§2.2, 2.5–2.7, 6
- `src/app/TOPOLOGY.md` — standalone combined-host composition
- `src/session/TOPOLOGY.md` — targeted live-session hosting and coordinator ownership
- `src/rpc/TOPOLOGY.md` — hosted-session RPC and semantic event contract
- `src/projections/TOPOLOGY.md` — projection ownership and canonical-store direction
- `src/app/brunch-web.ts` — production runtime/host wiring
- `src/session/live-session-host.ts` — target-cell and driver contract
- `src/dev/__tests__/standalone-web-session-host.real-entry.test.ts` — one-target production-entry precedent
- `src/dev/__tests__/web-driver-streaming-support.ts` — deterministic faux provider and RPC observer utilities

## Boundary Crossings

```pseudo
production runBrunchWeb(cwd, coordinator, faux agent-services seam)
  -> combined HTTP/WebSocket Brunch host
  -> target-required hosted-session RPC
  -> LiveSessionHost target cells
  -> two sealed Pi AgentSession runtimes + target-local ask/event state
  -> separate Pi SessionManager JSONL files
  -> shared CommandExecutor / SQLite graph authority
  -> target-addressed semantic events + fresh session.presentation reads
```

## Risks and Assumptions

- RISK: the shared faux provider response queue may serialize or misattribute scripted responses and thereby fake a product isolation failure.
  → MITIGATION: use deterministic barriers and target-distinct payloads at the existing `agentServices` substitution seam; do not inject `LiveSessionRuntime` instances around production wiring.
- RISK: a same-process global in Pi or a Brunch extension may leak ask/runtime/event state only under overlapping turns.
  → MITIGATION: keep both turns in flight simultaneously, open distinct asks before either answer settles, and assert both positive ownership and cross-target negative space.
- RISK: event sequence assertions can pass while canonical files are crossed.
  → MITIGATION: refetch both `session.presentation` results and read both JSONL files after settlement; assert target-distinct messages, ask ids/answers, bindings, and absence rivals.
- RISK: shared graph pressure may accidentally become a second test-only command path.
  → MITIGATION: drive graph tool calls through the two real hosted Pi sessions; read shared graph truth through its product projection/command-owned reader.
- ASSUMPTION: several sealed Pi `AgentSession`s can coexist without cross-target mutable-state leakage.
  → IMPACT IF FALSE: the combined-host topology and the queued presentation sweep are not trustworthy; FE-1200 must reshape the runtime boundary before continuing.
  → VALIDATE: this real-host two-session differential.
  → `memory/SPEC.md` A42-L

## Posture check

- **Proof of life:** one production standalone host drives two simultaneously live durable targets.
- **Invariants:** stabilizes I64-L across target-local events, asks, drivers, JSONL files, and reconnect/refetch.
- **Uncertainty:** retires A42-L by failing if runtime or extension state crosses session targets.
- No spike is warranted: the vertical real-entry oracle is cheaper and more decisive than a module-global inventory study alone.

## Acceptance Criteria

```pseudo
concurrent standalone-web isolation
  production entry
    ✓ standalone-web-session-host.concurrency.test.ts — one `runBrunchWeb` host opens two different durable targets through `/rpc`; a repeated open of either target attaches rather than creating a second writable runtime

  interleaved live state
    ✓ standalone-web-session-host.concurrency.test.ts — both target-distinct turns remain in flight together and expose distinct open asks before either answer settles
    ✓ standalone-web-session-host.concurrency.test.ts — each driver can answer only its target's ask; a rival target/driver combination cannot consume or alter the other ask
    ✓ standalone-web-session-host.concurrency.test.ts — every observed semantic frame carries the correct durable target and each target's sequence is independently contiguous
    ✓ standalone-web-session-host.concurrency.test.ts — one target can fail or settle without preventing the other target from completing and accepting later work

  canonical convergence
    ✓ standalone-web-session-host.concurrency.test.ts — after settlement and observer reconnect, each fresh `session.presentation` contains only its own target-distinct messages and ask answer
    ✓ standalone-web-session-host.concurrency.test.ts — the two session JSONL files remain distinct, correctly bound, and free of the other target's semantic markers

  shared authority
    ✓ standalone-web-session-host.concurrency.test.ts — graph mutations initiated by both hosted sessions produce valid success or structured optimistic-concurrency outcomes, and graph readback remains structurally valid with monotonic spec-local change-log authority

  one-target regressions
    ✓ `npm test -- src/session/__tests__/live-session-host.test.ts src/rpc/__tests__/standalone-web-session-host.contract.test.ts src/dev/__tests__/standalone-web-session-host.real-entry.test.ts src/dev/__tests__/standalone-web-session-host.tui-differential.test.ts` — target integrity, RPC negative space, one-target real entry, and web/TUI semantic parity remain green
```

## Invariants preserved

- A session target has at most one writable hosted runtime — guarded by `src/session/__tests__/live-session-host.test.ts` plus the concurrency real-entry oracle.
- Driver ownership is per target, never process-global — guarded by `live-session-host.test.ts` and cross-target rival assertions in the concurrency oracle.
- Browser-facing live events remain semantic overlays, not replay or transcript truth — guarded by fresh projection/JSONL convergence after reconnect.
- `agent_settled`, not `agent_end`, remains the convergence boundary — guarded by `src/projections/session/__tests__/live-session-events.test.ts` and the concurrency settlement assertions.
- Shared graph mutation still routes through CommandExecutor/SQLite authority — guarded by graph readback and spec-local LSN/change-log assertions.
- Stop the line if proving isolation requires a second canonical session/event store, targetless fallback, or duplicate writable Pi runtime.

## Verification Approach

- Inner: focused unit/contract tests — preserve target-cell, driver-conflict, and hosted-RPC negative-space behavior.
- Middle: deterministic real-entry differential — one production `runBrunchWeb` host, two coordinator-created JSONL sessions, adversarially interleaved faux-provider turns/asks, shared graph pressure, reconnect, and canonical readback.
- Outer: none for this slice; it retires process-isolation risk without changing the accepted one-session user interaction. Browser presentation breadth and qualitative rendering remain owned by FE-1200's subsequent presentation-family sweep.

## Cross-cutting obligations

- Use the existing provider-backend substitution seam only; the product must supply coordinator, runtime factory, host, RPC, extensions, ask brokers, event projection, and persistence wiring.
- Keep event sequence, ask registry, driver identity, active-turn state, and disposal target-local.
- Preserve shared graph command atomicity/optimistic concurrency without serializing all session activity behind a new global session lock.
- Treat separate JSONL files and fresh product projections as the convergence oracle; browser caches and event accumulation are disposable.
- If A42-L is falsified, update SPEC/PLAN/topology before attempting the presentation sweep.

## Expected touched paths (tentative)

```pseudo
src/
├── dev/__tests__/
│   ├── standalone-web-session-host.concurrency.test.ts  +
│   └── web-driver-streaming-support.ts                  ?
├── session/
│   ├── live-session-host.ts                             ?
│   └── __tests__/live-session-host.test.ts              ~
├── app/
│   └── brunch-web.ts                                    ?
├── .pi/extensions/                                     ?  # only the concrete leaked instance-state owner, if exposed
├── projections/session/                                ?  # only if target-local convergence projection is wrong
└── rpc/                                                ?  # only if target routing/event fan-out is wrong
memory/
├── SPEC.md                                              ~  # A42-L retirement after proof
├── PLAN.md                                              ~  # slice status / next execution pointer
└── cards/standalone-web-session-host--concurrent-session-isolation.md  -  # delete when consumed
src/{app,session,rpc,projections,web}/TOPOLOGY.md         ?  # reconcile only homes whose current state changes
```
