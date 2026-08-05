# Structured-exchange request collapse — historical note

Status: superseded by the D116-L `ask` cutover
Original decision: 2026-06-23
Reconciled: 2026-08-05

This note records the retired transition from four model-selected `request_*`
tools to one server-routed terminal. The chosen intermediate shape preserved
durable `present_*` transcript anchors while deriving terminal UI behavior from
the pending present, making request-tool mis-pairing unrepresentable.

That intermediate `request_response` surface is no longer active. After D116-L:

- `ask` is the only interactive structured-exchange terminal;
- `present_*` tools remain durable offer carriers where their exchange requires
  one;
- legacy `request_*` names survive only as persisted result-detail
  discriminants where compatibility requires them; and
- current exchange selection, continuation, recovery, and settlement behavior
  comes from the live exchange topology and schemas.

## Current authority

- [`src/exchanges/TOPOLOGY.md`](../../src/exchanges/TOPOLOGY.md) owns the
  framework-neutral exchange core.
- [`src/exchanges/schemas/TOPOLOGY.md`](../../src/exchanges/schemas/TOPOLOGY.md)
  owns shared exchange schema boundaries.
- [`src/.pi/extensions/exchanges/TOPOLOGY.md`](../../src/.pi/extensions/exchanges/TOPOLOGY.md)
  owns the Pi adapter and registered tool surface.
- [`src/session/TOPOLOGY.md`](../../src/session/TOPOLOGY.md) owns transcript
  recovery and settlement carriers.
- [Structured Exchange Answering Paths](STRUCTURED_EXCHANGE_ANSWERING_PATHS.md)
  describes the current cross-surface answer path.
- [Review Sets](REVIEW_SETS.md) records the retained batch-review mechanism.

`memory/SPEC.md` D116-L records the cutover decision; the topology files above
name the current materialized surface.

## Historical rationale retained

The load-bearing insight was to derive terminal behavior from server-owned
pending exchange state rather than asking the model to restate a legal pair.
That principle survived the later `ask` cutover even though the
`request_response` API did not.

The removed design alternatives, migration bridge, tracer plan, and “next”
sections are historical implementation detail and must not be read as open
work.
