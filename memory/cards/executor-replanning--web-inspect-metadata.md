# Executor Replanning Web Inspect Metadata

Frontier: executor-replanning
Linear:   FE-1114
Status:   superseded
Mode:     single
Created:  2026-07-07

## Orientation

- Seam: web run observer presentation.
- Builds on: `executor-replanning--inspect-metadata.md`.
- Posture: proving.
- Superseded by: `memory/cards/executor-run-observer--readable-run-evidence.md`, which absorbs this narrow metadata display into the broader readable run evidence + graph traceability scope to avoid overlapping `/runs` UI work.

## Target Behavior

The web run list/detail surfaces show replanning lineage and abandoned-run metadata when present.

## Acceptance Criteria

- Run list cards show supersession and abandonment metadata compactly.
- Run detail shows `supersedes`, `abandoned at`, and `abandon reason` rows when present.
- Existing run display stays unchanged when metadata is absent.

## Verification Approach

- Web route tests for list/detail metadata rendering.
- Gate: `npm run verify`.

## Non-goals

- No new action buttons.
- No mutation or RPC tool invocation from the web UI.
