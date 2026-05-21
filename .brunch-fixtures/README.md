# `.brunch-fixtures/`

Curated test inputs and captured golden runs for the Brunch POC.

This directory is the on-disk home of the fixture strategy described in
[docs/architecture/fixture-strategy.md](../docs/architecture/fixture-strategy.md).

## Layout

```
.brunch-fixtures/
├── briefs/                          # Curated product briefs (JSON)
│   ├── brief-001-identity-reference.json
│   ├── brief-002-state-lifecycle.json
│   ├── brief-003-derived-views.json
│   └── ...
└── <brief-id>/
    └── <run-id>/
        ├── <run-id>.jsonl           # Captured transcript
        ├── <run-id>.meta.json       # Brief id, driver mode, session, projection summary
        ├── <run-id>.graph.json      # Deferred until the graph plane exists
        └── <run-id>.coherence.json  # Deferred until coherence is first-class
```

## Status

The first M1 briefs live under `briefs/` as JSON files. Captured runs are added
under each brief id by the JSON-RPC stdio fixture driver.

## Conventions

- Briefs are short, human-readable JSON; the captured runs are the heavy data.
- Brief ids are kebab-case and stable; runs are timestamped, content-hashed, or
  deterministic for reviewable scripted captures.
- Replay regression runs check transcript reproduction first. Property and
  adversarial / generative checks come online as later milestones provide graph
  and coherence artifacts.
