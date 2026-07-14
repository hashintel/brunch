# Session host decision candidate

Status: superseded by [WEB_UI_ARCHITECTURE.md](WEB_UI_ARCHITECTURE.md). Kept as historical design evidence.

## Candidate decision

If Brunch ever outgrows the current TUI-owned live-session shape, it should add an **optional local session-host layer** that owns **live foreground session topology only**:

- live session inventory
- attach / detach lifecycle
- event fan-out
- driver / observer separation
- live ask-answer relay

It should **not** own:

- graph truth
- transcript semantics
- executor run authority
- ambient subagent discovery or policy

## Why this candidate exists

Brunch already has:

- durable workspace/spec/session identity via [`src/session/workspace-session-coordinator.ts`](../../src/session/workspace-session-coordinator.ts)
- a public JSON-RPC observer/driver boundary via [`src/rpc/TOPOLOGY.md`](../../src/rpc/TOPOLOGY.md)
- sealed in-process subagents via [`src/.pi/extensions/subagents/session.ts`](../../src/.pi/extensions/subagents/session.ts)
- a durable executor core via [`src/executor/TOPOLOGY.md`](../../src/executor/TOPOLOGY.md)

What it does **not** yet have is a durable host for multiple attachable live interactive sessions. Today that role is embedded in the TUI process; see [`src/app/brunch-tui.ts`](../../src/app/brunch-tui.ts) and the single-source relay in [`src/rpc/session-event-relay.ts`](../../src/rpc/session-event-relay.ts).

The `pi-orchestrator` experiment is relevant because it demonstrates a coherent shape for this missing layer: a stable local host controlling multiple live sessions over one attachable streaming control plane.

## Non-goals

- Replacing the executor core with a daemon scheduler
- Reviving a separate product-level orchestrator mode
- Converting background subagents into daemon-managed child processes by default
- Introducing a second semantic API outside Brunch JSON-RPC

## Adoption trigger

This candidate should stay dormant unless multiple signs appear together:

1. one live foreground session is no longer enough
2. browser and TUI need independent attach/detach lifetimes
3. a live session should survive the original TUI process
4. session inventory/listing becomes a real product need
5. one-driver / many-observer must work across process boundaries, not just inside one host process

## Preferred sequence

1. Extract an internal session-host abstraction while keeping one process.
2. Generalize from one attached live session to a host-side session inventory.
3. Make the web sidecar a client of that host abstraction.
4. Only then consider moving the host behind a local daemon transport.

## Proposed wording for future SPEC adoption

Brunch may introduce an optional local session-host layer when live interactive session hosting becomes a distinct product concern. That layer owns live foreground session topology — attachment, event fan-out, and driver routing — but it does not become an authority over graph truth, transcript semantics, or executor run state. Existing authorities remain where they already live: SQLite graph DB, Pi JSONL transcripts, and executor artifacts.
