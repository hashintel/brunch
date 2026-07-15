# Web UI and live-session host architecture

Status: accepted design synthesis; input to `memory/SPEC.md` and `memory/PLAN.md`, not a second product contract or plan. FE-1200 materialized the standalone host, `LiveSessionHost`, durable session-presentation projection, and live/durable reconciliation for ordinary text plus one `ask` (D127-L/D128-L; A43-L validated), then proved concurrent target isolation in one production host (A42-L validated). The presentation-family sweep (I65-L) is the only remaining FE-1200 slice. Current state authority is `memory/SPEC.md` plus the co-located `src/**/TOPOLOGY.md` homes; this doc keeps the design rationale for the remaining work.

This document supersedes the architectural recommendations in:

- [`docs/archive/architecture/pi-wrapper-comparative.md`](../archive/architecture/pi-wrapper-comparative.md) — howcode comparison
- [`docs/archive/architecture/pi-web-comparative.md`](../archive/architecture/pi-web-comparative.md) — jmfederico/pi-web comparison
- [`SESSION_HOST_DECISION_CANDIDATE.md`](SESSION_HOST_DECISION_CANDIDATE.md)
- [`MULTI_SESSION_DAEMON_ARCHITECTURE.md`](MULTI_SESSION_DAEMON_ARCHITECTURE.md)

The comparative documents remain useful historical evidence. This document owns the current synthesis now that a standalone, interactive web UI is again a priority feature.

## 1. Purpose

Brunch needs a standalone browser experience that presents the same Specify- and Execute-mode sessions as the TUI:

- open several sessions at once;
- hydrate each session from its on-disk Pi JSONL transcript;
- stream ordinary assistant text, reasoning, tool activity, and Brunch-specific results;
- drive new turns and answer structured `ask` exchanges;
- preserve the same Brunch-augmented transcript structure produced through the TUI;
- keep graph, transcript, and executor authority in their existing canonical stores.

This is not a second chat product. It is a new presentation and driver head over the same Brunch session model.

## 2. Decisions reached

### 2.1 Standalone web is a primary presentation mode

The target is not a read-only attachment to a running TUI. A user can launch Brunch in web mode without constructing `InteractiveMode` or opening a terminal UI. The web client can drive hosted sessions directly.

The current TUI sidecar remains useful implementation evidence, but its TUI-owned singleton lifetime is no longer the target architecture.

### 2.2 One cwd-scoped host owns many live sessions

One Brunch host process serves exactly the workspace rooted at the launch cwd. It may host several simultaneously live sessions across that workspace's specs.

The host does not become a machine-wide project control plane. Cross-project discovery, remote machines, organization tenancy, and auth introduced only for remote access remain out of scope.

### 2.3 Hosted sessions use Pi's in-process typed SDK

Each live session is an in-process, sealed Pi `AgentSession` created through Brunch's existing runtime/service factory seams. The host does not spawn one `pi --mode rpc` child per session.

Pi's RPC mode remains relevant prior art and a possible process-isolation mechanism, but it is not the substrate for this Node/TypeScript custom UI. Using it now would add a Pi-RPC-to-Brunch-RPC translation layer while weakening direct access to Brunch's typed runtime, extensions, coordinator, and command authority.

### 2.4 HTTP/WebSocket and live sessions share one process initially

The first architecture is one foreground Brunch process that:

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

This differs deliberately from jmfederico/pi-web's three-process deployment. Brunch borrows its long-lived session-host concept, not every process boundary.

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

## 3. Target topology

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

The architecture supports several independently streaming sessions. FE-1200 first proved one inventory member, then validated two production-wired targets under overlapping asks, graph writes, failure/recovery, reconnect, and separate JSONL readback.

## 4. Existing pieces

The repository already contains most single-session mechanics.

| Existing piece | Current value | Required evolution |
| --- | --- | --- |
| `src/app/brunch-tui.ts` and Brunch runtime factory | Creates a sealed Brunch Pi runtime with coordinator/tool/extension wiring | Extract hostable runtime creation from TUI ownership; instantiate once per target session |
| `src/session/workspace-session-coordinator.ts` | Durable workspace/spec/session selection and binding | Supply explicit targets to the host; do not become live-runtime inventory |
| `src/rpc/web-host.ts` | Serves React assets and `/rpc`/`/rpc/driver` WebSockets | Become the standalone combined host; use one multi-session handler surface rather than a singleton sidecar handle |
| `src/rpc/session-event-relay.ts` | Proven live Pi event relay with reconnect/fan-out tests | Replace single attached source with session-indexed streams and target-bearing frames |
| `session.driveTurn` | Proven browser/headless prompt path into one live session | Require explicit target and route through `LiveSessionHost` |
| `session.openAsks` / `session.answerExchange` | Proven headless discovery and answering for every current `ask` mode, within declared Other/comment ceilings | Require explicit target and route to that runtime's registry/broker |
| `brunch.updated` | Product-shaped invalidation hints | Keep; invalidate named durable projections rather than patching raw event truth |
| `src/web/rpc-client.ts` | One generic WebSocket JSON-RPC client | Keep transport-only; multiplex session-addressed events |
| TanStack Router + Query web runtime | Route/data ownership and product cache | Add session routes, hydration query, live overlay, and driver mutations |
| `src/.pi/extensions/exchanges/` and `src/exchanges/` | Canonical structured-exchange details, formatters, TUI renderers, and answer mechanics | Extract/extend shared semantic presentation projections; add React adapters |
| Pi JSONL session files | Canonical transcript and Brunch continuity entries | Remain truth; add a named web-facing session presentation projection, not a mirror store |
| Web-driver streaming oracle battery | Proves event/transcript differential, ordering, fan-out, reconnect, turn driving, and exchange convergence through the real host | Rebase from singleton TUI sidecar to explicit hosted-session target |

## 5. Missing pieces

### 5.1 `LiveSessionHost`

A deep internal module must hide:

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

The client must:

- hydrate from the durable projection;
- apply live deltas only to the addressed session view;
- avoid duplicating a message when the durable transcript catches up;
- refetch at settlement and after reconnect;
- treat `agent_settled`, not `agent_end`, as the whole-run idle boundary;
- discard/rebuild ephemeral partial state when continuity is uncertain.

Canonical truth is refetched rather than reconstructed indefinitely from raw events.

### 5.4 Web renderer family

The first tracer needs ordinary text plus one representative structured `ask`. Later coverage must enumerate all current Brunch-specific visible families, including offer results such as candidates, digest, and review set, as well as any product-visible runtime/tool results outside exchanges.

This later work is a sweep: closure means every required inventory row has a shared semantic projection, React renderer, and oracle, or an explicit `n/a` disposition.

### 5.5 Standalone host entry and shutdown

Shipped for the tracer (FE-1200): `--mode web` now starts the standalone combined host (`src/app/brunch-web.ts`). The entry:

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
| A product-shaped session presentation union can cover TUI/web meaning without exposing raw Pi as the browser contract | Otherwise the client either leaks Pi or duplicates interpretation | `ln-design` alternatives plus transcript fixtures spanning ordinary text, tools, offers, asks, and malformed details |
| Durable hydration plus live overlay can converge without a canonical event store | Required by the no-mirror-store discipline | Differential oracle: after settlement/reconnect, rendered semantic records equal a fresh JSONL-derived projection |
| One browser driver by construction is sufficient for the first proof | Avoids premature lease machinery | Real host test rejects a second driver attachment or otherwise proves unambiguous ownership |

## 7. First branch: minimal end-to-end proof

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

## 8. Work after the tracer

These are candidate closure packages, not yet PLAN frontier definitions.

1. **Multi-session concurrency closure** — open and drive two sessions concurrently; prove isolated events, asks, transcript writes, and shared graph-command behavior.
2. **Web renderer coverage sweep** — close the enumerated presentation-family inventory.
3. **Driver ownership and reconnect** — explicit attachment ownership, stale-driver rejection, and handoff semantics; introduce a write lease only when actual contention exists.
4. **Session inventory and lifecycle UI** — open/create/close/reopen tabs across specs without confusing durable session existence with live-host status.
5. **Launch and recovery polish** — URL opening, host status, failed-session recovery, graceful shutdown, and honest restart behavior.
6. **Optional process split** — only if independent web/API restart or host crash isolation becomes a demonstrated requirement.

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

The tracer (FE-1200) has landed, so the once-pending reconciliation is now mostly discharged:

1. ✓ `ln-spec` updated the Product Contract and decisions: web is a primary presentation mode (req 4/31/32, D127-L/D128-L, A42-L/A43-L, I64-L/I65-L). No read-only-sidecar/future-only wording remains in `memory/SPEC.md`.
2. ✓ `ln-plan` sequenced the work; the first tracer is complete. As of 2026-07-14 the former three-frontier `standalone-web` arc is collapsed into the single frontier `standalone-web-session-host` (FE-1200) on one branch, with concurrency and presentation-coverage as in-branch slices rather than separate frontiers.
3. ◐ The FE-1200 concurrency slice's middle-loop oracle is complete; renderer parity and browser feel remain owned by the presentation-coverage slice, not this doc.
4. ✓ `ln-design`-level interface choices for `LiveSessionHost` and the session-presentation projection are materialized in `src/session/live-session-host.ts` and `src/projections/session/`.
5. ✓ Current state is reconciled into `src/app/TOPOLOGY.md`, `src/rpc/TOPOLOGY.md`, `src/session/TOPOLOGY.md`, and `src/web/TOPOLOGY.md` (standalone combined host + TUI sidecar both described as shipped surfaces).
6. ○ The superseded comparative notes remain historical evidence (see §References); they are not competing active recommendations.

## 11. References

- [`memory/SPEC.md`](../../memory/SPEC.md) — current product contract and decisions (reconciled: D127-L/D128-L, req 4/31/32)
- [`memory/PLAN.md`](../../memory/PLAN.md) — current sequencing (FE-1200 tracer + concurrency complete; presentation sweep next on the same branch)
- [`src/rpc/TOPOLOGY.md`](../../src/rpc/TOPOLOGY.md) — TUI sidecar + standalone combined-host RPC surface and streaming evidence
- [`src/web/TOPOLOGY.md`](../../src/web/TOPOLOGY.md) — React client for both the TUI sidecar and standalone `--mode web` host
- [`src/.pi/extensions/exchanges/TOPOLOGY.md`](../../src/.pi/extensions/exchanges/TOPOLOGY.md) — current structured-exchange and headless-answer behavior
- [`STRUCTURED_EXCHANGE_ANSWERING_PATHS.md`](STRUCTURED_EXCHANGE_ANSWERING_PATHS.md) — mechanism history; current coverage authority is the exchanges topology
- Pi SDK documentation (`@earendil-works/pi-coding-agent` 0.80.6, `docs/sdk.md`)
- Pi RPC documentation (`@earendil-works/pi-coding-agent` 0.80.6, `docs/rpc.md`)
