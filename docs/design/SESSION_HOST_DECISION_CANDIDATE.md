# Session host decision candidate — historical note

Status: superseded by [Web UI Architecture](WEB_UI_ARCHITECTURE.md)
Reconciled: 2026-08-05

This note proposed an optional local host for live foreground session topology:
attachment lifecycle, event fan-out, driver routing, and live exchange
answering. It also required graph truth, transcript semantics, and executor run
authority to remain in their existing stores.

The proposal and its adoption sequence are no longer active authority. The
shared-session-host tracer and cutover are sequenced in `memory/PLAN.md`; their
current concrete boundaries live in:

- [`src/app/TOPOLOGY.md`](../../src/app/TOPOLOGY.md)
- [`src/session/TOPOLOGY.md`](../../src/session/TOPOLOGY.md)
- [`src/rpc/TOPOLOGY.md`](../../src/rpc/TOPOLOGY.md)
- [`src/web/TOPOLOGY.md`](../../src/web/TOPOLOGY.md)

The durable non-ownership rule remains useful historical rationale: a session
host may own live attachment topology, but must not become a second authority
for graph, transcript, or executor state. Any future change is governed by the
current PLAN frontier and topology files, not by this candidate.
