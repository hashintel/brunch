# Web UI and live-session host architecture

Status: historical design synthesis and FE-1200 implementation guide. Its standalone-host design remains materialized, but FE-1321 superseded the later recommendation that TUI and React must converge on one independently-lived host. Current authority is `memory/SPEC.md` D141-L plus `memory/PLAN.md` and the co-located `src/**/TOPOLOGY.md` homes.

This document supersedes the architectural recommendations in:

- [`docs/archive/architecture/pi-wrapper-comparative.md`](../archive/architecture/pi-wrapper-comparative.md) — howcode comparison
- [`docs/archive/architecture/pi-web-comparative.md`](../archive/architecture/pi-web-comparative.md) — jmfederico/pi-web comparison
- [`SESSION_HOST_DECISION_CANDIDATE.md`](SESSION_HOST_DECISION_CANDIDATE.md)
- [`MULTI_SESSION_DAEMON_ARCHITECTURE.md`](MULTI_SESSION_DAEMON_ARCHITECTURE.md)

The comparative documents remain useful historical evidence.

## 2026-08-05 supersession: converge contracts, not process shape

FE-1321 tested this document's remaining independent-host premise against Pi 0.83.0. Public `InteractiveMode.stop()` preserves the runtime, but `run()` remains pending in `getUserInput()` and retains its callback; clean detach/re-attachment would therefore require upstream Pi lifecycle work before demonstrating current product value.

The selected D141-L architecture keeps two legitimate runtime compositions:

```pseudo
normal TUI
  -> owns one sealed Pi runtime + real InteractiveMode
  -> serves companion React through target-addressed Brunch semantic RPC/events

standalone web
  -> owns LiveSessionHost runtimes
  -> serves React through the same semantic RPC/events

both
  -> same sealed runtime factory
  -> same presentation projections and RPC vocabulary
  -> same JSONL truth
  -> per-target cross-process writer exclusion before runtime construction
```

The active work now converges contracts and writer authority, then deletes `SessionEventRelay`, raw `brunch.sessionEvent`, and `/rpc/driver`. It does **not** require companion React or the TUI presentation to survive TUI process exit, and it does not introduce a daemon, remote terminal protocol, raw Pi browser surface, or second truth store. Sections below retain FE-1200's implementation history and the superseded independent-host reasoning; where they conflict with this correction, D141-L and the co-located topology files win.

## 1. Purpose

Brunch needs a standalone browser experience that presents the same Specify- and Execute-mode sessions as the TUI:

- open several sessions at once;
- hydrate each session from its on-disk Pi JSONL transcript;
- stream ordinary assistant text, reasoning, tool activity, and Brunch-specific results;
- drive new turns and answer structured `ask` exchanges;
- preserve the same Brunch-augmented transcript structure produced through the TUI;
- keep graph, transcript, and executor authority in their existing canonical stores.

This is not a second chat product. It is a new presentation and driver head over the same Brunch session model.

## Colleague entry: run it and find the seams

### Current runnable modes

From a published alpha package:

```bash
# TUI + transitional TUI-owned browser sidecar
npx @hashintel/brunch@alpha

# Standalone target-addressed web host (no InteractiveMode)
npx @hashintel/brunch@alpha --mode web
```

From this repository, build the browser bundle before launching the source host:

```bash
npm install
npm run build:web

# Current TUI-owned runtime + sidecar
npm run dev -- --cwd <workspace>

# FE-1200 standalone combined host
npm run dev -- --cwd <workspace> --mode web
```

Both commands print a loopback URL. The standalone root route lists specs and runs, but it does not yet expose a session picker. To exercise the session UI, open `/session/<specId>/<sessionId>`; the selected ids are recorded in `<workspace>/.brunch/workspace.json` under `defaults`. Do **not** run the current TUI and standalone web mode as independent writers over the same session: FE-1200 rejects duplicate hosted opens inside one host, but the cross-process single-authority transition is precisely the work still open.

Provider auth lives in Pi's native auth store. Configure it with `/login` in the TUI (or Pi itself) before expecting standalone web turns to reach a provider; there is no `brunch login` command.

### Current code journey

```pseudo
standalone web request
  src/app/brunch.ts
    -> src/app/brunch-web.ts
      -> src/session/live-session-host.ts
        -> sealed Pi AgentSession + live ask registry
      -> src/rpc/web-host.ts
        -> src/rpc/methods/hosted-session.ts
        -> brunch.liveSessionEvent
      -> src/web/routes/session.tsx
        -> JSONL session.presentation + ephemeral live overlay

transitional TUI + sidecar
  src/app/brunch-tui.ts
    -> separately-created Pi AgentSession + InteractiveMode
    -> src/rpc/session-event-relay.ts          # raw Pi event relay
    -> src/rpc/web-host.ts /rpc/driver         # handle-gated sidecar driver
```

Start with the standalone path when changing session hosting or React presentation. Read the TUI path when changing the transition: it is current product behavior, but its session host/relay shape is the architecture to absorb and delete—not a second pattern to extend.

### Current versus intended topology

```pseudo
current:
  TUI process
    owns Pi runtime A
    owns raw SessionEventRelay
    serves /rpc + /rpc/driver sidecar

  standalone web process
    owns LiveSessionHost
      owns Pi runtime B...
    serves target-addressed /rpc + semantic events

intended:
  one independent cwd-scoped Brunch session host
    owns sealed Pi runtimes + JSONL writers
    owns graph command authority
    owns driver lease/handoff + semantic events
      <- TUI client/adapter
      <- React client
```

FE-1200 proved the lower standalone half: host inventory, explicit targets, concurrent isolation, semantic projection, and browser coverage. It did not prove the Pi TUI attachment. `shared-session-host-tracer` owns that load-bearing proof (A47-L); `shared-session-host-cutover` then closes the enumerated migration and deletes `SessionEventRelay`, `brunch.sessionEvent`, `/rpc/driver`, and TUI-owned parallel host wiring.

### Regression net: what guards this while it's dormant

`--mode web` is a shipped-but-not-yet-daily-driven surface. The point of this section is that a change to *core Brunch* (the Pi runtime/service factories, `WorkspaceSessionCoordinator`, `CommandExecutor`/graph authority, session projections, or the RPC registry) that silently breaks the standalone web path will still fail the suite, because these guards exercise the real production wiring and all run in the **default** `npm run test` (none are `*.slow.test.ts`):

| Guard | Path it protects | What breaks it |
| --- | --- | --- |
| `src/dev/__tests__/standalone-web-session-host.real-entry.test.ts` | Production entry: launches `runBrunchWeb` with a faux provider; open → drive → structured `ask` → settle → reconnect | Any regression in the real `--mode web` startup, host wiring, or RPC surface |
| `src/rpc/__tests__/standalone-web-session-host.contract.test.ts` | Target-addressed hosted-session RPC contract + refusal messages | Method-shape / target-addressing / disposition drift in `hosted-session.ts` |
| `src/dev/__tests__/standalone-web-session-host.tui-differential.test.ts` | Web-driven vs TUI-driven JSONL semantic equivalence | Divergence between the two host paths' transcript output |
| `src/dev/__tests__/standalone-web-session-host.concurrency.test.ts` | Two-session isolation: overlapping asks, separate JSONL, target-local failure/recovery, reconnect | Shared mutable runtime leakage across concurrent sealed Pi sessions |
| `src/session/__tests__/live-session-host.test.ts` | `LiveSessionHost` open/attach/close, driver ownership, ask registry, disposal | Unit-level lifecycle regressions (the seam the concurrent refactor touches) |
| `src/projections/session/__tests__/live-session-events.test.ts` | `brunch.liveSessionEvent` projection + schema | Live-event contract drift |
| `src/web/__tests__/session-route.test.tsx` | React session route: JSONL hydration + live overlay + driver mutations | Client-side truth-model regressions |
| `src/app/__tests__/brunch.test.ts` | `--mode web` argv routing | Entry-point wiring regressions |

The transitional TUI-sidecar path (the architecture the cutover deletes) is separately guarded by `src/dev/__tests__/web-driver-streaming.*.test.ts` (command-intake, exchange-convergence, relay, reconnect, fan-out). Once `shared-session-host-cutover` retires `SessionEventRelay` / `/rpc/driver`, those guards retire with it.

**Caveat for the colleague:** the heavy real-entry and concurrency guards each spin several in-process Pi `AgentSession`s plus web hosts. They pass in isolation and single-worker, but have been observed to time out under high parallel load (e.g. `--maxWorkers=4`, hitting the 8000ms `waitFor` bounds with `Agent is already processing`). Treat a failure in these two files under a loaded run as *possible load flake, not a confirmed regression* — re-run the file in isolation or single-worker to disambiguate before attributing breakage. This is a test-robustness property of the harness, not a known product defect.

## 2. Decisions reached

### 2.1 Standalone web is a primary presentation mode

The target is not a read-only attachment to a running TUI. A user can launch Brunch in web mode without constructing `InteractiveMode` or opening a terminal UI. The web client can drive hosted sessions directly.

The current TUI sidecar remains useful implementation evidence and current alpha behavior, but its TUI-owned singleton lifetime is transitional—not a second architecture Brunch intends to support indefinitely. The target is one independent session host used by both TUI and React presentations; the TUI remains a first-class product surface rather than being removed or reduced to a token client.

### 2.2 One cwd-scoped host owns many live sessions

One Brunch host process serves exactly the workspace rooted at the launch cwd. It may host several simultaneously live sessions across that workspace's specs.

The host does not become a machine-wide project control plane. Cross-project discovery, remote machines, organization tenancy, and auth introduced only for remote access remain out of scope.

### 2.3 Hosted sessions use Pi's in-process typed SDK

Each live session is an in-process, sealed Pi `AgentSession` created through Brunch's existing runtime/service factory seams. The host does not spawn one `pi --mode rpc` child per session.

Pi's RPC mode remains relevant prior art and a possible process-isolation mechanism, but it is not the substrate for this Node/TypeScript custom UI. Using it now would add a Pi-RPC-to-Brunch-RPC translation layer while weakening direct access to Brunch's typed runtime, extensions, coordinator, and command authority.

### 2.4 FE-1200 shares HTTP/WebSocket and live sessions in one process; convergence separates clients from host authority

The materialized FE-1200 architecture is one foreground Brunch process that:

- serves the built React application;
- exposes Brunch JSON-RPC over WebSocket;
- owns the workspace coordinator and graph command authority;
- owns a session-indexed inventory of live `AgentSession`s.

Browser disconnects and reloads do not end sessions. A host-process restart does end in-flight live runs; durable sessions reopen from JSONL.

```ts
// ceiling: one process couples HTTP-host and live-session failure domains;
// split out a restart-surviving session daemon when independent web/API restart
// or crash isolation becomes a demonstrated product requirement.
```

This first step differs deliberately from jmfederico/pi-web's three-process deployment. FE-1200 borrowed its long-lived session-host concept without yet taking the process boundary. The user-set target now takes the next part of that pattern: one independent cwd-scoped host owns runtime authority while TUI and React attach as presentations. Brunch still rejects pi-web's Pi-shaped REST/raw-event contract, machine federation, and remote-auth expansion.

The load-bearing unknown is the TUI adapter. Pi exports `InteractiveMode` over an in-process `AgentSessionRuntime`; it does not export a ready-made remote TUI client. The transition therefore starts with a production-cover tracer, not a paper daemon abstraction. The winning shape may keep `InteractiveMode` colocated with the host process or introduce a Brunch-owned client adapter, but it must preserve the real TUI experience, one writer, and Brunch semantic browser boundary. It must not solve the diagram by constructing a second Pi runtime or retaining a permanent second relay.

### 2.5 One driver per session, many observers

Writer authority is scoped per hosted session:

- exactly one driver may submit turns or answer live asks for a session;
- any number of observers may receive that session's events and durable projections;
- different sessions may be driven concurrently;
- a session file must not be opened as two independently writable hosted runtimes.

The first proof has one browser driver by construction, so it does not need a general write-lease protocol. A lease becomes necessary when TUI, browser, CLI, or reconnecting browser clients can contend for the same hosted session.

Graph mutation authority remains separate from session-driver authority. Concurrent sessions may reach the same `CommandExecutor`; graph validation, optimistic concurrency, and atomic command handling remain the protection for shared graph truth.

### 2.6 Public clients speak Brunch JSON-RPC, never raw Pi RPC

The browser uses named Brunch product methods and notifications. Pi types and events may exist behind host adapters, but the client does not coordinate a raw Pi RPC connection beside Brunch RPC.

The multi-session surface must address sessions explicitly with the durable Brunch target `(specId, sessionId)`. A WebSocket connection, browser tab, route, or host-local object id must not become session identity.

Candidate lifecycle and driver capabilities are:

```text
session.open(target)                 open or attach the hosted runtime
session.close(target)                release/stop a hosted runtime deliberately
session.driveTurn(target, prompt)    drive one session
session.openAsks(target)             read live asks for one session
session.answerExchange(target, ...)  answer one live ask
brunch.sessionEvent(target, seq, event)
                                    identify every ephemeral event by session
```

Exact method names and whether `open` and `close` are public methods remain an `ln-design` question. The invariant is not optional: no driver method or event may rely on one process-global "current session."

### 2.7 JSONL is durable transcript truth; live events are an overlay

A web session view has two inputs:

1. a named, JSONL-derived Brunch session presentation projection for hydration, refresh, and reconnect;
2. session-addressed live events for low-latency incremental rendering.

The live stream is not replay storage and does not become canonical. On reconnect, the client refetches the durable projection and then resumes later events. Sequence numbers are scoped per hosted session.

No chat table, mirror database, or second event spine is introduced.

### 2.8 Presentation semantics are shared; platform renderers are separate

Brunch-specific `toolResult.details` remain the canonical semantic payload for special result families. Each family projects validated details into a transport-neutral presentation model.

```text
validated Brunch toolResult details
  -> shared semantic presentation projection
       -> LLM-context formatter where applicable
       -> TUI renderer
       -> React/web renderer
```

Terminal components and React components are not shared. Meaning, validation, labels, state, and declared elisions are shared.

The host must not send ANSI/TUI output or server-rendered HTML to the browser. The browser must not independently reinterpret raw result-detail shapes with a second set of domain rules.

A completeness oracle should inventory every Brunch-specific presentation family and prove that each required audience has an adapter. Some internal/custom entries intentionally have no human renderer; absence must be declared rather than accidental.

## 3. FE-1200 materialized topology and convergence target

FE-1200 materialized this standalone topology:

```text
brunch --mode web (one cwd)
  │
  └─ Brunch web host process
       ├─ static React assets
       ├─ WebSocket Brunch JSON-RPC
       ├─ WorkspaceSessionCoordinator
       ├─ CommandExecutor / graph authority
       └─ LiveSessionHost
            ├─ (spec A, session 1)
            │    ├─ sealed Pi AgentSession
            │    ├─ JSONL SessionManager
            │    ├─ live ask registry + answer broker
            │    ├─ per-session event sequence
            │    └─ one driver / N observers
            ├─ (spec A, session 2)
            │    └─ ...independent live runtime...
            └─ (spec B, session 3)
                 └─ ...independent live runtime...

browser
  ├─ one root WebSocket transport
  ├─ TanStack Query cache of named durable projections
  ├─ session tab/view A1 (driver or observer)
  ├─ session tab/view A2 (driver or observer)
  └─ React renderers over shared presentation models
```

This architecture supports several independently streaming sessions. FE-1200 first proved one inventory member, then validated two production-wired targets under overlapping asks, graph writes, failure/recovery, reconnect, and separate JSONL readback.

The replacement target moves that authority out of any one presentation lifecycle:

```text
brunch host / session daemon (one cwd)
  ├─ WorkspaceSessionCoordinator
  ├─ CommandExecutor / graph authority
  ├─ Brunch product RPC + semantic subscriptions
  └─ LiveSessionHost
       ├─ target A -> one sealed Pi runtime / JSONL writer / driver lease
       └─ target B -> one sealed Pi runtime / JSONL writer / driver lease

presentations
  ├─ Pi TUI client/adapter -> host target A
  └─ React client         -> host target A or B
```

The host is the writer and lifetime authority; TUI and React are presentations. Whether Pi's `InteractiveMode` can be cleanly colocated with that host or needs a Brunch-owned remote adapter is A47-L, not a settled implementation detail. The tracer must answer it with production cover before the current TUI path is removed.

## 4. Existing pieces

The repository already contains most single-session mechanics.

| Existing piece | FE-1200 current value | Shared-host transition |
| --- | --- | --- |
| `src/app/brunch-tui.ts` and Brunch runtime factory | Creates a separate sealed Pi runtime and `InteractiveMode`; still owns the sidecar relay/driver handles | Prove and adopt a TUI adapter over the one host-owned runtime; remove TUI-owned session-host composition |
| `src/app/brunch-web.ts` | Creates `LiveSessionHost`, sealed target runtimes, semantic event projection, and the combined HTTP/RPC host | Move/compose this authority into the independent cwd-scoped host used by both presentations |
| `src/session/workspace-session-coordinator.ts` | Supplies explicit target opens without changing workspace defaults | Keep as durable workspace/spec/session coordination; do not turn it into runtime inventory |
| `src/session/live-session-host.ts` | Target-addressed in-process runtime inventory, prompt admission, ask answering, driver ownership, and semantic fan-out | Deepen or adapt behind the shared host process; remain the canonical live-session module rather than growing a sibling host |
| `src/rpc/web-host.ts` | Serves React; chooses either standalone hosted-session `/rpc` or TUI-sidecar `/rpc` + `/rpc/driver` | Collapse to one host-facing Brunch RPC surface; delete the sidecar selection and `/rpc/driver` |
| `src/rpc/session-event-relay.ts` | Raw, singleton TUI-sidecar Pi event relay | Delete after every required consumer uses target-addressed semantic events |
| `session.driveTurn` / `session.openAsks` / `session.answerExchange` | Standalone forms require explicit target (and driver where mutating); sidecar forms use process-local handles | Keep only the host-owned target-addressed contract plus explicit lease/handoff semantics |
| `brunch.updated` | Product-shaped invalidation hints | Keep; invalidate named durable projections rather than patching raw event truth |
| `src/web/rpc-client.ts` | Generic WebSocket RPC plus validated/target-filtered `brunch.liveSessionEvent` subscription | Keep transport-only; do not regain raw `brunch.sessionEvent` knowledge |
| TanStack Router + Query web runtime | Session route, hydration query, live overlay, and driver mutations are built | Add session inventory/lifecycle UI only if the cutover's real client workflow requires it; do not make it a hidden prerequisite |
| `src/.pi/extensions/exchanges/` and `src/exchanges/` | Canonical details/answer mechanics feed shared semantic projections plus TUI/React adapters | Preserve one semantic model; the host transition must not merge platform components or duplicate decoders |
| Pi JSONL session files | Canonical transcript and Brunch continuity truth behind `session.presentation` | Remain truth; one host owns each writer and clients refetch after settlement/reconnect |
| Sidecar + standalone oracle batteries | Prove both current paths independently | Rebase required proofs onto one host, then delete sidecar-only harnesses rather than keeping parity tests forever |

## 5. Materialized modules and remaining cutover responsibility

Sections 5.1–5.5 were the FE-1200 build map. They now describe shipped modules; each status line distinguishes current evidence from shared-host transition work.

### 5.1 `LiveSessionHost`

**Materialized:** `src/session/live-session-host.ts` is the standalone runtime inventory. **Transition:** prove the TUI adapter, then make this module or its traced successor the sole host inventory.

The deep internal module hides:

- the map from durable Brunch session target to live runtime;
- idempotent open/attach behavior;
- prevention of duplicate writable opens of one JSONL session;
- per-session event relay, sequence, ask registry, and answer broker;
- prompt serialization within one session;
- cleanup and explicit close behavior;
- failure classification that marks one hosted session failed without intentionally corrupting others;
- disposal during host shutdown.

Its public interface should be small and target-addressed. It must not own graph truth, transcript interpretation, executor runs, client UI state, or cross-project discovery.

### 5.2 Durable session presentation projection

**Materialized:** `src/projections/session/session-presentation.ts` reconstructs the visible active branch for hydration, refresh, and reconnect. The cutover preserves it as the durable presentation truth for both clients where the TUI uses shared semantics; it must not create a daemon-side mirror store.

The browser needs a named projection that can reconstruct the visible active branch of an on-disk session after initial load, refresh, or reconnect.

This is not the removed debug-oriented `session.transcriptDisplay`, raw `SessionManager.getEntries()`, or a generic custom-entry API. Its schema must be a Brunch product presentation vocabulary covering at least:

- user and assistant text;
- streaming-complete assistant messages and errors;
- tool calls/results at the level the product intentionally exposes;
- Brunch-specific structured offers and terminal asks;
- compaction/branch markers only where the product chooses to render them;
- stable entry ids/cursors sufficient for live-overlay reconciliation.

The exact projection API and union shape need `ln-design` before implementation.

### 5.3 Live/durable reconciliation in the web client

**Materialized:** `src/web/routes/session.tsx` hydrates from the durable projection, reduces target-filtered semantic deltas, and discards the overlay/refetches on `agent_settled`. The cutover rebases its transport attachment onto the independent host without changing this truth model.

The client must:

- hydrate from the durable projection;
- apply live deltas only to the addressed session view;
- avoid duplicating a message when the durable transcript catches up;
- refetch at settlement and after reconnect;
- treat `agent_settled`, not `agent_end`, as the whole-run idle boundary;
- discard/rebuild ephemeral partial state when continuity is uncertain.

Canonical truth is refetched rather than reconstructed indefinitely from raw events.

### 5.4 Web renderer family

**Materialized:** FE-1200's I65-L sweep closed the required persisted family inventory. The shared-host cutover treats renderer semantics as protected behavior, not migration work, unless the host move reveals a real missing consumer.

The first tracer needed ordinary text plus one representative structured `ask`. Later FE-1200 coverage enumerated all current Brunch-specific visible families, including offer results such as candidates, digest, and review set, as well as product-visible runtime/tool results outside exchanges.

This later work is a sweep: closure means every required inventory row has a shared semantic projection, React renderer, and oracle, or an explicit `n/a` disposition.

### 5.5 Standalone host entry and shutdown

**Materialized:** `--mode web` starts the standalone combined host (`src/app/brunch-web.ts`). **Transition:** host lifecycle must become independent of either presentation while preserving honest restart degradation.

The current entry:

- initializes workspace/coordinator/graph authority without `InteractiveMode`;
- starts the combined web/session host on loopback;
- reports its URL on CLI stdout;
- stops accepting work during shutdown;
- disposes hosted sessions and flushes required settings/transcript boundaries;
- does not claim that in-flight turns survive host-process death.

Remaining polish (URL auto-open, host status, failed-session recovery ergonomics) is follow-on launch work, not tracer scope.

## 6. Assumptions to validate

| Assumption | Why it matters | Validation |
| --- | --- | --- |
| Several sealed Pi `AgentSession`s can run concurrently in one Node process without shared mutable runtime leakage | This is the basis of the multi-session host | ✓ Validated by `standalone-web-session-host.concurrency.test.ts`: overlapping events/asks, separate JSONL, target-local failure/recovery, and reconnect |
| Brunch extension factories and runtime services are instance-safe | Module-global or singleton extension state could cross-contaminate sessions | ✓ Validated at the exercised production boundary by the same two-session differential; extend only when a newly introduced mutable runtime service escapes that inventory |
| One coordinator and command authority can safely serve graph mutations from concurrent hosted sessions | Session isolation does not isolate shared graph truth | ✓ Validated by concurrent production-session `mutate_graph` results plus shared graph readback and monotonic spec-local LSN |
| A product-shaped session presentation union can cover TUI/web meaning without exposing raw Pi as the browser contract | Otherwise the client either leaks Pi or duplicates interpretation | ✓ Validated by shared projection no-loss/malformed tests for every required persisted ask terminal shape (including questionnaire read-back), React render/answer tests for free text and listed single/multi choices, and distinct candidate/review-set/digest production settlement/reconnect witnesses. Bounded questionnaires remain headlessly answerable through the schema-tagged string/JSON envelope; FE-1200 added no dedicated React questionnaire form. |
| Durable hydration plus live overlay can converge without a canonical event store | Required by the no-mirror-store discipline | Differential oracle: after settlement/reconnect, rendered semantic records equal a fresh JSONL-derived projection |
| One browser driver by construction is sufficient for the first proof | Avoids premature lease machinery | Real host test rejects a second driver attachment or otherwise proves unambiguous ownership |

## 7. Historical FE-1200 first branch: minimal end-to-end proof

### Claim

A standalone Brunch web host can open one existing on-disk Brunch/Pi JSONL session through the multi-session host topology, render and drive several turns in a browser chat, answer one structured `ask`, and leave a transcript semantically equivalent to the TUI path.

### Thin vertical path

```text
brunch --mode web
  -> combined host starts without InteractiveMode
  -> LiveSessionHost opens target (specId, sessionId)
  -> React session route hydrates JSONL-derived presentation
  -> browser submits ordinary prompt
  -> host drives target AgentSession
  -> session-addressed events stream text/tool activity
  -> agent opens one representative ask
  -> React renders shared ask presentation model
  -> browser answers via target-addressed session.answerExchange
  -> same live turn continues to agent_settled
  -> client refetches durable presentation
  -> JSONL contains the same Brunch details/continuity structures as the TUI oracle
```

### In scope

- internal `LiveSessionHost` map keyed by explicit durable target, exercised with one member;
- standalone web host entry without TUI construction;
- opening one existing JSONL session;
- one session chat route and transcript hydration;
- ordinary user/assistant streamed text over several deterministic turns;
- one representative structured `ask` rendered and answered in React;
- settlement/refetch convergence;
- real-entry faux-provider E2E and a manual browser walkthrough.

### Out of scope

- concurrent-session breadth in the UI or test (the host must not hard-code a singleton, but the tracer exercises one member);
- complete special-result renderer inventory;
- write leases or driver handoff;
- separate web/API and session-daemon processes;
- process-crash survival;
- cross-cwd project hosting;
- remote access/auth;
- multi-machine federation;
- terminals, git, file explorer, or raw Pi console parity;
- a chat mirror database or canonical event log.

### Required oracles

1. **Real-entry walking skeleton:** launch the production standalone web host with a faux provider; do not inject the session under test around production wiring.
2. **Transcript differential:** compare the settled web-driven JSONL/projection with the equivalent TUI-driven Brunch session structure, ignoring only explicitly nondeterministic ids/timestamps.
3. **Hydration + live convergence:** the post-settlement fresh projection equals the semantic records shown after streaming.
4. **Structured answer:** the representative `ask` result is provider-legal, durable, and parseable by existing Brunch exchange projections.
5. **Target integrity:** every driver call and live frame identifies the explicit `(specId, sessionId)`; no connection-local current-session inference.
6. **No second truth plane:** the test succeeds after deleting browser cache and rehydrating solely from canonical stores.
7. **Manual feel check:** streaming text, busy/settled state, ask interaction, reload, and error leg are usable in the browser. Visual quality is not proven by DOM assertions alone.

## 8. Transition after FE-1200

FE-1200 completed the original tracer's concurrency and renderer-coverage packages. The remaining work is no longer “more standalone web”; it is replacement of the dual host architecture. `memory/PLAN.md` owns two frontiers under the `shared-session-host-convergence` arc.

### 8.1 Prove the TUI attachment (`shared-session-host-tracer`)

One independently-lived cwd-scoped host owns one writable target runtime. Attach a real TUI presentation and React to that same target; exercise an ordinary turn, structured ask, TUI-only product interaction, detach/reconnect, driver conflict, and fresh JSONL convergence. This retires A47-L and selects the TUI adapter/process shape. The proof must preserve the actual TUI value—editor, chrome, commands, extension UI—not substitute a line-oriented demo client.

### 8.2 Close the inventory and delete the bridge (`shared-session-host-cutover`)

After the tracer, derive a closed sweep ledger from the production TUI composition, RPC registries, web routes, and existing tests. Migrate every required lifecycle/UI/exchange/read/update/shutdown capability to the one host. Then delete the old architecture:

```pseudo
- src/rpc/session-event-relay.ts
- brunch.sessionEvent
- /rpc/driver
- handle-gated sidecar registry variants
- brunch-tui.ts -> raw relay/driver/broker -> startWebHost wiring
- sidecar-only tests/support/docs
```

The cutover is not complete while both paths still pass. Its completion signal is one host authority, two useful presentations, one semantic browser contract, and absence of the deletion inventory from production/test topology.

### 8.3 Deferred beyond convergence

Cross-machine federation, remote auth, generic terminals/git/files, cloud hosting, and survival of an in-flight turn across host-process crash remain outside the POC. Session inventory UI and launch polish enter only when required by the actual shared-host client workflow; they are not excuses to delay relay retirement.

## 9. Prior-art synthesis

### howcode

Keep:

- a typed application boundary around Pi;
- rich React presentation of streamed text, reasoning, tools, and native interactions;
- an on-demand runtime inventory rather than reconstructing every turn from HTTP calls.

Reject:

- Composer/Pi-shaped verbs as Brunch's public product contract;
- a SQLite transcript/list-view mirror that drifts toward second truth;
- tool-by-tool bespoke semantics where Brunch already has a general structured-exchange model;
- a Pi-TUI escape hatch as a substitute for product decisions.

### jmfederico/pi-web

Keep:

- long-lived hosted Pi SDK sessions independent of browser lifetime;
- multiple attachable live sessions;
- one-driver/many-observer fan-out;
- host metadata distinct from transcript truth.

Defer or reject:

- a separate web/API proxy process before restart survivability is required;
- REST-per-session and raw Pi event contracts as the product API;
- machine/project federation and its auth/control-plane expansion;
- imperative browser state patched indefinitely from event streams;
- terminal/git/file-system operations as automatic Brunch product surfaces.

### Pi RPC mode

Keep as evidence that headless prompting, event streaming, session switching, and extension UI relays are supported Pi use cases.

Do not use as the first Brunch host substrate. Pi's own SDK guidance prefers direct `AgentSession` use for a Node/TypeScript custom UI; Brunch also needs its own product RPC, sealed runtime factories, and graph authority.

## 10. Canonical reconciliation status

FE-1200 is complete; the once-pending reconciliation is discharged:

1. ✓ `ln-spec` updated the Product Contract and decisions: standalone web is a primary presentation mode (req 4/31/32, D132-L/D133-L, I64-L/I65-L; FE-1200 retired A43-L/A44-L into those homes). The remaining TUI-sidecar wording is now explicitly transitional: A47-L plus the `shared-session-host-convergence` arc own proof and retirement rather than pretending FE-1200 already replaced it.
2. ✓ `ln-plan` closed and archived the single `standalone-web-session-host` (FE-1200) frontier after its tracer, concurrency, and presentation-coverage slices.
3. ✓ I65-L required-family coverage is complete: projection no-loss/malformed tests cover every required persisted ask terminal shape, including questionnaire read-back; React render/answer tests cover free text and listed single/multi choices; headless bounded-questionnaire answering remains available through the schema-tagged string/JSON envelope, without a dedicated React questionnaire form; distinct candidate/review-set/digest production settlement/reconnect witnesses, concurrency/target isolation, and receipt-bearing review settlement complete the oracle.
4. ✓ `ln-design`-level interface choices for `LiveSessionHost` and the session-presentation projection are materialized in `src/session/live-session-host.ts` and `src/projections/session/`.
5. ✓ Current state is reconciled into `src/app/TOPOLOGY.md`, `src/rpc/TOPOLOGY.md`, `src/session/TOPOLOGY.md`, and `src/web/TOPOLOGY.md` (standalone combined host + TUI sidecar both described as shipped surfaces).
6. ○ The superseded comparative notes remain historical evidence (see §References); they are not competing active recommendations. Their pi-web process-shape recommendation is carried forward here and in A47-L/PLAN, while their stale current-state descriptions remain archived evidence only.
7. ◐ Full architecture replacement is open: `shared-session-host-tracer` must prove the TUI attachment seam, then `shared-session-host-cutover` must retire D84-L and delete the raw sidecar relay/driver path.

## 11. References

- [`memory/SPEC.md`](../../memory/SPEC.md) — current product contract and decisions (reconciled: D132-L/D133-L, req 4/31/32)
- [`memory/PLAN.md`](../../memory/PLAN.md) — current sequencing (FE-1200 is closed; detailed history is archived)
- [`src/rpc/TOPOLOGY.md`](../../src/rpc/TOPOLOGY.md) — TUI sidecar + standalone combined-host RPC surface and streaming evidence
- [`src/web/TOPOLOGY.md`](../../src/web/TOPOLOGY.md) — React client for both the TUI sidecar and standalone `--mode web` host
- [`src/.pi/extensions/exchanges/TOPOLOGY.md`](../../src/.pi/extensions/exchanges/TOPOLOGY.md) — current structured-exchange and headless-answer behavior
- [`STRUCTURED_EXCHANGE_ANSWERING_PATHS.md`](STRUCTURED_EXCHANGE_ANSWERING_PATHS.md) — mechanism history; current coverage authority is the exchanges topology
- Pi SDK documentation (`@earendil-works/pi-coding-agent` 0.80.6, `docs/sdk.md`)
- Pi RPC documentation (`@earendil-works/pi-coding-agent` 0.80.6, `docs/rpc.md`)
