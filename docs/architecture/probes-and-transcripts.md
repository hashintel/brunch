# Probes and transcript artifacts

Brunch's current verification substrate is **probe runs with transcript evidence**.
A probe is an executable or scripted check that drives a Brunch seam, writes or
points at the canonical transcript artifact, and emits a compact report a human
can review. The transcript is the durable evidence; the report explains what was
proven and where to inspect it.

This replaces the older over-planned "brief library / fixture strategy" shape.
Curated briefs may become useful again, but only as inputs to probes that produce
normal probe-run artifacts under `.fixtures/runs/<probe-id>/<run-id>/`.

## Current contract

A committed probe run lives at:

```
.fixtures/runs/<probe-id>/<run-id>/
├── session.jsonl      # source transcript / canonical run evidence
├── transcript.md      # Brunch-semantic human rendering
└── report.json        # probe metadata, oracle summary, artifact paths
```

Probe reports should include, at minimum:

- `schemaVersion`
- `probeId`
- `runId`
- enough mission / evaluation-focus text to explain the run
- the turn or operation budget when relevant
- blockers / friction / failure notes when relevant
- paths to colocated artifacts

## What belongs here now

- Transport and projection probes that prove Brunch public RPC / web / TUI seams.
- Transcript-shape probes that prove durable Pi JSONL contains enough semantic
  evidence to reconstruct Brunch exchanges.
- Human-readable transcript renderings paired with machine-checkable reports.

## What does not belong here now

- Milestone trophy scripts whose acceptance moment has passed.
- Golden captures for retired transcript shapes.
- Tests that only assert a fixed set of example briefs exists.
- A parallel "brief library" subsystem with its own lifecycle.

## Future pathway for brief-based probes

If Brunch later needs agent-as-user brief-based golden fixtures, the path is:

1. define the probe and its current behavioral question;
2. optionally use a curated brief as probe input;
3. drive Brunch through the public product surface;
4. persist the resulting transcript and report under `.fixtures/runs/...`;
5. make assertions against current Brunch semantics, not historical milestone
   shapes.

Briefs are inputs, not the canonical artifact. The transcript-backed probe run is
canonical.
