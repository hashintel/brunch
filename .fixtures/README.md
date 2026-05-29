# `.fixtures/`

Curated test inputs, captured golden runs, and probe-oracle review bundles for the Brunch POC.

This directory is the on-disk home of the fixture strategy described in
[docs/architecture/fixture-strategy.md](../docs/architecture/fixture-strategy.md).

## Layout

```
.fixtures/
├── briefs/                          # Curated product briefs (JSON)
│   ├── brief-001-identity-reference.json
│   ├── brief-002-state-lifecycle.json
│   ├── brief-003-derived-views.json
│   └── ...
├── <brief-id>/
│   └── <run-id>/
│       ├── <run-id>.jsonl           # Captured transcript
│       ├── <run-id>.meta.json       # Brief id, driver mode, session, projection summary
│       ├── <run-id>.graph.json      # Deferred until the graph plane exists
│       └── <run-id>.coherence.json  # Deferred until coherence is first-class
└── runs/
    └── <probe-id>/
        └── <run-id>/
            ├── session.jsonl        # Probe source transcript
            ├── transcript.md        # Human-readable semantic rendering
            └── report.json          # Probe report and artifact paths
```

## Status

The first M1 briefs live under `briefs/` as JSON files. Captured brief runs are added under each brief id by the JSON-RPC stdio fixture driver. Probe-oracle review bundles that are not tied to a curated brief live under `runs/<probe-id>/<run-id>/`.

## Conventions

- Briefs are short, human-readable JSON; captured runs and probe bundles are the heavy data.
- Brief ids are kebab-case and stable; runs are timestamped, content-hashed, or deterministic for reviewable scripted captures.
- Replay regression runs check transcript reproduction first. Property and adversarial / generative checks come online as later milestones provide graph and coherence artifacts.
- Probe bundles keep executable reports and human transcript renderings colocated so a reviewer can compare the oracle output against transcript evidence.
