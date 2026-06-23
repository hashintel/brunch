# Probes and transcript artifacts

Brunch's current verification substrate is **faux-harness and probe runs with
JSONL evidence**. A probe is an executable or scripted check that drives a Brunch
seam, writes or points at the canonical `session.jsonl` artifact, and emits a
compact report a human can review. The source JSONL is the durable evidence; the
report explains what was proven and where to inspect it. Human-readable
transcript rendering now belongs in workspace-local `.brunch/debug/transcript.md`
for Tier-1/Tier-2 faux-harness loops, not as a default committed probe artifact.

This replaces the older over-planned "brief library / fixture strategy" shape.
Curated briefs may become useful again, but only as inputs to harness/probe runs
that produce normal artifacts under `.fixtures/runs/<probe-id>/<run-id>/` when
promotion is warranted.

## Current contract

A committed probe run lives at:

```
.fixtures/runs/<probe-id>/<run-id>/
├── session.jsonl      # source transcript / canonical run evidence
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
- Machine-checkable reports backed by source JSONL; human-readable transcript
  rendering is a debug-cache affordance for faux-harness workspaces.

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
4. persist the resulting source JSONL and report under `.fixtures/runs/...`;
5. make assertions against current Brunch semantics, not historical milestone
   shapes.

Briefs are inputs, not the canonical artifact. The JSONL-backed harness/probe run
is canonical.
