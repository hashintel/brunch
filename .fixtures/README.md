# `.fixtures/`

Current probe artifacts and transcript evidence for the Brunch POC.

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
└── runs/
    └── <probe-id>/
        └── <run-id>/
            ├── session.jsonl        # Source transcript / canonical run evidence
            ├── transcript.md        # Human-readable semantic rendering
            └── report.json          # Probe report and artifact paths
```

## Current runs

- `runs/public-rpc-parity/2026-05-29-public-rpc-parity/` — FE-744 public Brunch
  JSON-RPC structured-exchange parity proof.
