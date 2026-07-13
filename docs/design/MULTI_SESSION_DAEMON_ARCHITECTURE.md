# Multi-session daemon architecture — design note

Status: captured design reference, not scheduled. Source review: Brunch runtime topology + local inspection of `@earendil-works/pi-orchestrator`, 2026-07-13.

## Purpose

Assess whether Brunch should eventually grow a long-lived daemon or session-host layer for:

1. centralizing server/client communication across multiple live agent sessions
2. decoupling browser/TUI attachments from the lifetime of one foreground process
3. supporting a future inventory of concurrently attachable interactive sessions

This note is not a proposal to replace Brunch's current executor architecture. It is a design-reference liftout: what the `pi-orchestrator` experiment teaches, where that shape would help Brunch, and where it would collide with settled product architecture.

## Current Brunch shape

Brunch already has several "session-like" things, but they are not hosted by one durable session supervisor.

### 1. One live foreground Pi session, owned by the TUI process

- [`src/app/brunch-tui.ts`](../../src/app/brunch-tui.ts) starts the product update publisher, session-event relay, live exchange broker, and web sidecar, then creates the live Pi `AgentSession` and attaches it to those process-local relays.
- [`src/rpc/session-event-relay.ts`](../../src/rpc/session-event-relay.ts) holds exactly one attached live session at a time. Re-attachment replaces the current source.
- [`src/rpc/web-host.ts`](../../src/rpc/web-host.ts) and [`src/rpc/websocket.ts`](../../src/rpc/websocket.ts) expose the observer and driver WebSocket surfaces, but only while that TUI-owned process is alive.

Consequence: the browser sidecar is an attachment to the TUI-hosted process, not an independently durable session host.

### 2. Durable workspace/spec/session identity, but not a durable live-session host

- [`src/session/workspace-session-coordinator.ts`](../../src/session/workspace-session-coordinator.ts) owns spec/session selection, creation, binding, and default-session persistence.
- Session identity is durable through Pi JSONL sessions plus `.brunch/workspace.json`, but the live process that drives an active session is not separately supervised.

Consequence: Brunch can reopen a session transcript, but it does not currently provide a daemon that keeps live session processes available across TUI/browser detachments.

### 3. Background subagents are sealed in-process child sessions, not supervised child processes

- [`src/.pi/extensions/subagents/session.ts`](../../src/.pi/extensions/subagents/session.ts) intentionally creates sealed SDK child sessions in process, with in-memory auth/settings/session managers and explicit world injection.
- [`src/app/agent-runner-port.ts`](../../src/app/agent-runner-port.ts) routes executor worker runs through the sealed `worker` subagent, not through an external orchestrator process.

Consequence: Brunch already has concurrency, but it is bounded, run-to-completion, and deliberately non-daemonized.

### 4. Execute-mode orchestration is durable, but not live-session orchestration

- [`src/executor/orchestrate.ts`](../../src/executor/orchestrate.ts) and [`src/executor/TOPOLOGY.md`](../../src/executor/TOPOLOGY.md) define the durable executor run loop, Petri runtime, and injected execution ports.
- This is orchestration of cook runs and bounded side effects, not hosting a fleet of interactive Pi sessions.

Consequence: Brunch already has an orchestration core. What it does not have is a durable **interactive session host**.

## What the `pi-orchestrator` experiment actually is

`@earendil-works/pi-orchestrator` is best understood as a **local session supervisor daemon**:

1. it runs as a long-lived background process
2. spawns one or more headless `pi --mode rpc` child sessions
3. persists a small instance registry and machine identity
4. exposes a Unix-socket control plane for spawn/list/status/stop/rpc/rpc-stream
5. upgrades one connection into a bidirectional stream carrying RPC responses, session events, and extension-UI requests
6. optionally mirrors local presence into Radius

The useful pattern is not "a new agent architecture." The useful pattern is **one stable control plane over many attachable live sessions**.

## Patterns worth stealing

### P1 — Separate the live-session host from the client surface

The strongest idea in `pi-orchestrator` is that the host owning live sessions does not have to be the same process as the user-facing client. A CLI or browser can attach to a stable local daemon instead of owning the child session's lifetime.

For Brunch, that would mean the current TUI-owned sidecar shape:

```text
TUI process
  owns live AgentSession
  owns web sidecar
  owns event relay
```

could become:

```text
session host / daemon
  owns live AgentSession(s)
  owns event fan-out + driver paths

TUI / browser / CLI clients
  attach as observers or drivers
```

This would directly address the current process-local coupling in [`src/app/brunch-tui.ts`](../../src/app/brunch-tui.ts) and [`src/rpc/session-event-relay.ts`](../../src/rpc/session-event-relay.ts).

### P2 — Give live sessions an explicit inventory and control plane

Brunch today has durable **session files** and **workspace defaults**, but not a durable **live session inventory**. The orchestrator experiment keeps a clear instance registry with ids, statuses, cwd, and session metadata.

That matters if Brunch ever needs:

- more than one simultaneously live foreground session
- browser/TUI attach-detach without losing the host
- a "which live sessions exist right now?" answer
- explicit open/attach/stop semantics for interactive hosts

### P3 — Use one streaming transport for responses, events, and UI questions

`pi-orchestrator`'s `rpc-stream` leg unifies request/response, session events, and extension UI round-trips on one durable channel.

Brunch already has most of the pieces:

- product notifications via `brunch.updated`
- live Pi stream relay via `brunch.sessionEvent`
- live answer broker via `session.answerExchange`
- live turn driver via `session.driveTurn`

But those are currently scoped to a single TUI-started host and split across `/rpc` observer and `/rpc/driver` surfaces; see [`src/rpc/TOPOLOGY.md`](../../src/rpc/TOPOLOGY.md).

The orchestrator experiment is evidence that a single attachable stream is a coherent abstraction, not just a convenience hack.

### P4 — Persist lightweight host metadata, not product truth

The orchestrator persists machine/instance metadata, but the child session remains the owner of actual transcript truth.

That fits Brunch's authority model. If Brunch ever adds a daemon, it should persist only host-layer facts such as:

- live session id / status / cwd / attached spec
- client attachment state
- last-seen timestamps
- maybe selected route or mode

It should not become a second source of truth for:

- graph state
- transcript semantics
- exchange state
- executor run state

Those authorities already exist and should stay where they are: graph DB, Pi JSONL session files, and executor artifacts.

### P5 — Crash recovery should degrade honestly

One good discipline in `pi-orchestrator` is that restart recovery does **not** pretend live child processes survived. It marks previous live-looking instances stopped and clears remote presence.

If Brunch daemonizes interactive sessions later, it should prefer the same rule: after host restart, recover **durable identity** but do not counterfeit **live continuity**.

## Patterns not to steal

### N1 — Do not replace Brunch's executor core with a daemon scheduler

Brunch already has its orchestration core in [`src/executor/`](../../src/executor/) and the executor/tool-port architecture named in [`src/executor/TOPOLOGY.md`](../../src/executor/TOPOLOGY.md). That is the durable execution authority.

The `pi-orchestrator` shape is relevant only to the **interactive/live-session transport layer**, not to the cook-run authority model.

### N2 — Do not reintroduce a separate orchestrator-vs-executor product split

Brunch's plan and SPEC history are explicit that CODE/executor owns the orchestration tool surface rather than splitting product architecture into an orchestrator process plus a separate coding mode; see the current `memory/PLAN.md` context and the product/runtime notes in [`src/app/TOPOLOGY.md`](../../src/app/TOPOLOGY.md).

So if Brunch grows a daemon, it should be understood as a **session host / transport host**, not as a revived product-level "orchestrator mode."

### N3 — Do not let a daemon invalidate the sealed subagent design by default

Brunch's subagents are intentionally in-process, sealed, and explicitly world-injected; see [`src/.pi/extensions/subagents/session.ts`](../../src/.pi/extensions/subagents/session.ts).

That design buys three things the daemon must not casually undo:

1. no ambient `~/.pi` discovery
2. explicit world injection instead of accidental inheritance
3. no second long-lived child-process ecology unless needed

A future daemon may host live foreground sessions. It should not automatically convert all background subagents into daemon-managed subprocesses.

### N4 — Do not create a new canonical browser API outside the existing RPC discipline

Brunch already has a strong public JSON-RPC boundary and explicit driver/observer separation in [`src/rpc/TOPOLOGY.md`](../../src/rpc/TOPOLOGY.md). A daemon should serve that boundary, not bypass it with ad hoc socket protocols or a second semantic API.

## Where Brunch's current shape is already hitting this seam

The following current ceilings are early signs that a session-host layer could become valuable.

### C1 — One live session relay only

[`src/rpc/session-event-relay.ts`](../../src/rpc/session-event-relay.ts) attaches exactly one live session source at a time. That is sufficient for today's TUI-sidecar shape, but it is not a multi-session host abstraction.

### C2 — Web sidecar lifetime equals TUI lifetime

[`src/app/brunch-tui.ts`](../../src/app/brunch-tui.ts) starts the sidecar in the same process that owns the live Pi session. If the TUI exits, the sidecar exits, and the driver path disappears with it.

### C3 — Driver methods are process-local, not session-host-native

[`src/rpc/methods/session-driver.ts`](../../src/rpc/methods/session-driver.ts) is explicitly "Drive one plain assistant turn through the live in-process AgentSession." That wording is accurate today and also names the limit.

### C4 — Some executor observer paths already name split-process ceilings

[`src/executor/TOPOLOGY.md`](../../src/executor/TOPOLOGY.md) already records that same-process wake-ups are the first ceiling for Petrinaut live observation and that split-process execution would require file watching or a durable broker.

That is adjacent evidence that Brunch's event and observation infrastructure is still largely process-local.

## Recommended future shape

If Brunch needs this capability, the right move is **not** "adopt `pi-orchestrator` wholesale." The right move is:

### Recommendation — an optional local session-host layer

Add a **local session host** as an optional runtime layer that owns live foreground sessions and centralizes attachments, while preserving existing product authorities.

```text
authoritative stores
  SQLite graph DB
  Pi JSONL session files
  executor run artifacts

optional session host / daemon
  live foreground session inventory
  attach/detach lifecycle
  event fan-out
  driver methods
  live exchange answering
  browser/TUI/CLI attachment

clients
  TUI
  browser sidecar
  CLI probes
  future headless helpers
```

The daemon would own **live interactive session topology**, not graph truth, not transcript semantics, and not executor authority.

### First responsibilities for such a host

1. Own multiple live foreground sessions, each with a stable host-side id.
2. Offer `list / open / attach / close` semantics for those live sessions.
3. Stream three things on one attachable channel: RPC responses, `AgentSessionEvent`s, and live ask/answer prompts.
4. Keep the current Brunch JSON-RPC surface as the semantic API exposed to clients.
5. Allow one driver / many observers per hosted live session.

### Things it should explicitly not own

1. SQLite graph mutation authority.
2. Pi transcript parsing semantics.
3. Executor lifecycle or Petri scheduling authority.
4. Generic persistence of product state.
5. Ambient subagent discovery or a second policy system.

## Adoption sequence

### Step 1 — extract a host abstraction before daemonizing

Before any new process boundary, extract the current TUI-owned live session host into an internal abstraction:

- current live session inventory = one session
- attach observer stream
- drive turn
- answer exchange
- publish updates

This is the lowest-risk move because it can keep the current one-process runtime while making the future daemon boundary explicit.

### Step 2 — support more than one attached live session in-process

Generalize the relay/driver path away from "the current session" into "a hosted session by host id." That means replacing today's single-source relay shape in [`src/rpc/session-event-relay.ts`](../../src/rpc/session-event-relay.ts) with a session-indexed host.

### Step 3 — make the web sidecar a client of that host abstraction

At that point, the browser surface can depend on the host abstraction rather than on a raw process-local `AgentSession` reference. This is the seam where TUI/browser lifetime can begin to decouple.

### Step 4 — only then consider a real local daemon

Once the host abstraction is stable and the value is proven, move that host behind a local transport such as a Unix socket or loopback RPC server. The daemon process should be optional until Brunch has strong evidence that multi-session attachability is needed often enough to earn the complexity.

### Step 5 — treat external presence as a separate question

`pi-orchestrator`'s Radius integration is useful prior art for remote presence, but Brunch should not import that concern early. First earn the local session-host layer. Remote presence, discovery, or cross-machine attachment is a separate architectural bet.

## Decision heuristics

Brunch should probably **not** build this yet if all of the following remain true:

- one foreground session per TUI launch is enough
- browser sidecar is primarily an observer, not a long-lived independent client
- live ask/answer and drive-turn remain rare and TUI-owned
- subagents remain run-to-completion sealed children

Brunch should probably **start** this if several of the following become true:

- users need multiple concurrently live interactive sessions
- browser and TUI need to attach/detach independently
- a live session should survive the original TUI client
- session inventory/listing becomes a product need
- headless or external clients need the same live driver path as the TUI
- one-driver/many-observer needs to work across process boundaries, not just within one TUI process

## Bottom line

The `pi-orchestrator` experiment is strong prior art for Brunch, but only in a narrow and important lane: **live interactive session hosting**.

It does **not** suggest that Brunch should move product authority into a daemon, revive a separate orchestrator product role, or replace the sealed subagent and executor-core architecture.

What it does suggest is that Brunch is likely to want, at some future point, an explicit **session host** with these properties:

- stable local control plane
- explicit live-session inventory
- attachable streaming transport
- driver/observer separation
- honest restart degradation
- strict non-ownership of graph/transcript/executor truth

That is the piece of the experiment worth stealing.
