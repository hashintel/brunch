# `.fixtures/`

Current seed data plus probe artifacts and transcript evidence for the Brunch POC.
The active convention is **probe first, transcript-backed**: each committed run
must have a probe id, a run id, executable/reportable oracle output, and the
transcript artifact needed for human review. Brief-based golden fixtures may
return later, but they should be generated through this probe/transcript path
rather than a separate brief-library subsystem.

See [`docs/architecture/probes-and-transcripts.md`](../docs/architecture/probes-and-transcripts.md)
for the current architecture.

## Layout

```
.fixtures/
├── seeds/
│   └── <seed-set>/
│       ├── README.md
│       ├── <seed>.json          # Reusable explicit-basis starting truth
│       └── _*.ts                # Reproducible data-prep scripts, not product code
└── runs/
    └── <probe-id>/
        └── <run-id>/
            ├── session.jsonl        # Source transcript / canonical run evidence
            ├── transcript.md        # Human-readable semantic rendering
            ├── report.json          # Probe report and artifact paths
            └── graph-overview.json  # Optional graph readback when graph truth is the proof target
```

## Current runs

- `runs/public-rpc-parity/2026-05-29-public-rpc-parity/` — FE-744 public Brunch
  JSON-RPC structured-exchange parity proof.
- `runs/fixture-curation/fixture-curation-2026-06-05T104440Z/` —
  dev-seed-fixtures tracer proving a Bilal-derived explicit base seed can be expanded
  through the real `propose-graph`/`commit_graph` product path with implicit graph readback.
- `runs/project-graph-review-cycle/2026-06-06-project-graph-review-cycle/` —
  FE-809 tracer proving a Bilal-derived explicit base seed can drive real
  `project-graph` proposal generation through `present_review_set`, public RPC
  review approval, and explicit-basis graph readback.
