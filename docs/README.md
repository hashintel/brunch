# brunch-next

This is the canonical line for the Brunch POC over `pi-coding-agent`. Prior
implementation, planning memory, and design docs have been archived under
[`archive/`](../../archive/).

## Canonical docs

The three POC architecture docs are the source of authority for everything
downstream:

1. [prd.md](./architecture/prd.md) — product thesis, delivery posture, requirements, milestone ladder M0–M9, success criteria.
2. [pi-seam-extensions.md](./architecture/pi-seam-extensions.md) — the five Brunch-owned subsystems on top of pi (side-tasks, lenses, spec selector, offer-first interaction, mentions + staleness), the graph clock + change log, the reconciliation-need substrate, the oracle plane stub, the Flue evaluation, and framework-alignment / deferred subsystems.
3. [fixture-strategy.md](./architecture/fixture-strategy.md) — brief library, captured-run fixture format, three-layer assertion model (replay / property / adversarial), agent-as-user driver over JSON-RPC stdio, milestone mapping.

## Planning memory

Two canonical files in [`memory/`](../../memory/) are the only sanctioned
planning state:

- [memory/SPEC.md](../../memory/SPEC.md) — product contract, capability requirements, live architecture register (assumptions, decisions, invariants), future direction register, lexicon, verification stance.
- [memory/PLAN.md](../../memory/PLAN.md) — active frontier, near-horizon ordering, dependencies, and the stable-id frontier definitions sequenced against the milestone ladder.

## Fixtures

[`.brunch-fixtures/`](../../.brunch-fixtures/) holds curated briefs and
captured golden runs. See the directory README for layout and conventions.

## Behavioral kernels

[`docs/design/BEHAVIORAL_KERNELS.md`](../design/BEHAVIORAL_KERNELS.md) is
the canonical input to the oracle-plane stub and the kernel-activation gate.
Briefs #1–#3 in the fixture library are worked out in that document.

## Working conventions

See [`AGENTS.md`](../../AGENTS.md) at the project root for the verification
harness (`npm run fix` inner loop / `npm run verify` gate), the `ln-*` skill
flow, branching/PR conventions, and the operational protocols in
[`docs/praxis/`](../praxis/).
