# brunch

This is the canonical line for the Brunch POC over `pi-coding-agent`. Prior
implementation, planning memory, and design docs have been archived under
[`archive/`](../../archive/).

## Canonical docs

The three POC architecture docs are the source of authority for everything
downstream:

1. [prd.md](./architecture/prd.md) — product thesis, delivery posture, requirements, milestone ladder M0–M9, success criteria.
2. [pi-seam-extensions.md](./architecture/pi-seam-extensions.md) — the five Brunch-owned subsystems on top of pi (side-tasks, lenses, spec selector, offer-first interaction, mentions + staleness), the graph clock + change log, the reconciliation-need substrate, the oracle plane stub, the Flue evaluation, and framework-alignment / deferred subsystems.
3. [probes-and-transcripts.md](./architecture/probes-and-transcripts.md) — current probe-run artifact convention, transcript evidence, report shape, and the future path for any brief-based agent-as-user probes.

POC architecture docs whose plans are now embedded in the product (Pi UI/command containment findings, the trust/resume-exit finding, the faux-provider pattern, and the two external-baseline comparatives) have been archived under [`archive/architecture/`](./archive/architecture/README.md); the live authority for that material is `memory/SPEC.md` plus co-located `src/**/TOPOLOGY.md` files. `pi-system-prompt-architecture.md` stays in `architecture/` until the open D58-L augment-vs-replace question resolves. `poc-live-ship-runbook.md` stays as an active outer-loop runbook.

## Planning memory

Two canonical files in [`memory/`](../../memory/) are the only sanctioned
planning state:

- [memory/SPEC.md](../../memory/SPEC.md) — product contract, capability requirements, live architecture register (assumptions, decisions, invariants), future direction register, lexicon, verification stance.
- [memory/PLAN.md](../../memory/PLAN.md) — active frontier, near-horizon ordering, dependencies, and the stable-id frontier definitions sequenced against the milestone ladder.

## Probe artifacts

[`.fixtures/`](../.fixtures/) holds current probe-run artifacts and transcript evidence. See the directory README for layout and conventions.

## Working conventions

- [`docs/praxis/manual-testing.md`](./praxis/manual-testing.md) — outer-loop manual testing protocol for seeded workbenches, TUI + web sidecar observation, evidence capture, and slice-specific checks.
- [`docs/praxis/seeded-dev-rpc.md`](./praxis/seeded-dev-rpc.md) — set up a seeded local Brunch workspace, inspect it over launcher-backed RPC reads, curate fixture truth through the explicit local mutate seam, and run the product-path fixture curation tracer.

## Behavioral kernels

[`docs/design/BEHAVIORAL_KERNELS.md`](../design/BEHAVIORAL_KERNELS.md) is
the canonical input to the oracle-plane stub and the kernel-activation gate.
Older brief-library examples were retired; future behavioral-kernel evidence should land as probe runs with transcript artifacts.

## Horizon design notes

- [`docs/design/SPEC_INITIATIVE_MODEL.md`](../design/SPEC_INITIATIVE_MODEL.md) — working design proposal for spec as initiative/problem lifecycle, claim as truth-bearing unit, projected current truth, and repo-native branching/merge implications for planning data.
- [`docs/design/ELICITATION_QUESTIONS.md`](../design/ELICITATION_QUESTIONS.md) — priming catalog of elicitation questions organized by graph node kind; the questions are projectable examples that feed the elicitor agent, anchoring gaps on the node-kind ontology rather than a parallel typology vocabulary.

See [`AGENTS.md`](../../AGENTS.md) at the project root for the verification
harness (`npm run fix` inner loop / `npm run verify` gate), the `ln-*` skill
flow, branching/PR conventions, and the operational protocols in
[`docs/praxis/`](../praxis/).
