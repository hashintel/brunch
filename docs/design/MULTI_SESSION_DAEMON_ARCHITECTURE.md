# Multi-session daemon architecture — historical note

Status: superseded by [Web UI Architecture](WEB_UI_ARCHITECTURE.md)
Source review: Brunch runtime topology and `@earendil-works/pi-orchestrator`,
2026-07-13
Reconciled: 2026-08-05

This design-reference liftout evaluated what a local session supervisor could
teach Brunch. Its durable observation was narrow: a stable host can separate
live session lifetime from TUI, browser, or CLI client lifetime while preserving
existing product authorities.

The proposed daemon shape, adoption sequence, and build heuristics are not
current architecture or open instructions. Current shared-host work is
sequenced by `memory/PLAN.md` and materialized by:

- [`src/app/TOPOLOGY.md`](../../src/app/TOPOLOGY.md)
- [`src/session/TOPOLOGY.md`](../../src/session/TOPOLOGY.md)
- [`src/rpc/TOPOLOGY.md`](../../src/rpc/TOPOLOGY.md)
- [`src/web/TOPOLOGY.md`](../../src/web/TOPOLOGY.md)

## Historical lessons retained

- A live-session host and its client presentation can have separate lifetimes.
- Host metadata must not duplicate graph, transcript, exchange, or executor
  truth.
- One semantic RPC boundary should serve observers and drivers rather than
  spawning a second browser API.
- Restart must recover durable identity without counterfeiting live process
  continuity.
- Interactive session hosting is distinct from executor orchestration and
  sealed run-to-completion subagents.

These lessons are context for the current Web UI and shared-session-host
topology, not permission to adopt `pi-orchestrator`, introduce a daemon, or
revive a separate orchestrator product role.
