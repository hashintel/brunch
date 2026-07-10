# Ship-gate runbook artifacts

This directory is reserved for reviewed live proof runs from `docs/architecture/poc-live-ship-runbook.md`. New runs use `brunch --mode tui`, which opens the browser sidecar by default; each committed `report.json` preserves the exact historical CLI invocation used for that run.

A real run is stored as `.fixtures/runs/ship-gate-runbook/<run-id>/` and must include, at minimum:

- `report.json`
- `session.jsonl`
- `transcript.md`
- `graph-summary-before.json`
- `graph-summary-after.json`
- `accepted-gaps-before.json`
- `accepted-gaps-after.json`
- `runtime-state-before.json`
- `runtime-state-after.json`
- `system-prompt-before.md`
- `system-prompt-after.md`
- `posture-diff.md`
- `web-observer-before.md`
- `web-observer-after.md`
- `entry-contents.md`

No live provider run has been captured in this directory yet. Do not treat this README as ship evidence.
