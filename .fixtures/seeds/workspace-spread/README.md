# `.fixtures/seeds/workspace-spread/`

Hand-authored multi-spec workspace seeds.

Purpose:

- give workspace-level projections a deterministic two-spec inventory in one seeded database
- provide distinct readiness grades so specs-overview and future sessions-overview renderers can exercise grade contrast without live curation
- keep the graph fixtures explicit-basis and small enough to pair with deterministic session creation in tests or probes

Contents:

- `alpha-grounding.json` — early-grade spec with grounding-oriented graph truth
- `beta-commitments.json` — later-grade spec with commitment-heavy graph truth

These are graph seeds, not session transcripts. Future session-overview harnesses can deterministically bind one or more sessions onto these two specs and vary turn counts without changing the graph seed contract.
