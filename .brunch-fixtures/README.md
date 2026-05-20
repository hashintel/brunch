# `.brunch-fixtures/`

Curated test inputs and captured golden runs for the Brunch POC.

This directory is the on-disk home of the fixture strategy described in
[docs/architecture/fixture-strategy.md](../docs/architecture/fixture-strategy.md).

## Layout

```
.brunch-fixtures/
├── briefs/                          # Curated product briefs (YAML)
│   ├── offline-kanban.yaml
│   ├── role-based-doc-sharing.yaml
│   └── ...
└── <brief-id>/
    └── <run-id>/
        ├── <run-id>.jsonl           # Captured transcript
        ├── <run-id>.graph.json      # Captured graph state
        ├── <run-id>.coherence.json  # Captured coherence verdict + needs
        └── <run-id>.meta.json       # Brief id, persona dials, model, timestamps
```

## Status

Empty by design until the `mode-shell-and-fixture-driver` frontier (M1) lands
the JSON-RPC stdio agent-as-user driver. Briefs may be authored ahead of that
under the `brief-library-curation` parallel frontier — see `memory/PLAN.md`.

## Conventions

- Briefs are short, human-readable YAML; the captured runs are the heavy data.
- Brief ids are kebab-case and stable; runs are timestamped or content-hashed.
- Property invariants from the fixture-strategy doc are checked on every
  capture (replay regression, property regression, adversarial / generative).
