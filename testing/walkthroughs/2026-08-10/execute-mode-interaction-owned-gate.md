# Execute mode interaction — successful owned-gate closure

Final witness date: 2026-08-13

Frontier: FE-1348

Source commit: `0302c41c1`

Host path: `/tmp/brunch-fe1348-execute-final.Fb6Spv`

## Closure

**Built.** The final real-TUI witness proved that both production Execute menu entrances consume the same state-aware deterministic availability result, and that their visible Prepare / Compile / Execute choices agree with canonical session, plan, run, Petri, report, JSONL, and SQLite authority. The earlier 2026-08-10 thin-seed gate remains provenance below; this successful witness supersedes only its open disposition.

## Final disposable target and setup

The fresh disposable workspace used seed `rust-todo-cli/base`, producing spec `1` with 44 nodes and 69 edges. The activated session was `019ffb3b-e7c9-7da8-aa37-8808aa1f54cb`; its canonical JSONL was:

```text
/tmp/brunch-fe1348-execute-final.Fb6Spv/.brunch/sessions/2026-08-13T13-07-15-017Z_019ffb3b-e7c9-7da8-aa37-8808aa1f54cb.jsonl
```

During setup, the user switched the real TUI to Execute and selected **Compile a plan**. The provider produced the confirmation ask and the user selected **Compile now**. Compilation wrote `.brunch/cook/specs/1/plan.json` plus provenance: 1 epic, 4 slices, 2 synthesis rounds, graph LSN 3, `execute_launch: ready`, and status `not_started`.

The user then selected **Create the run, then pause**. Run `run-msrnsjo7` was created and paused at `reports_initialized`; no slice started. Its artifacts comprised run metadata, Petrinaut snapshot/net/events, an isolated `empty_dir` workspace, and reports.

The frozen witness boundary began after this setup. No provider or assistant turn occurred after that boundary.

## Frozen-boundary readbacks

Public readbacks agreed:

- `workspace.state` matched spec `1` and the named session.
- `execute.runs` returned exactly one run, `run-msrnsjo7`, at `reports_initialized`, with worktree/reports/Petri present and promotion absent.
- `session.runtimeState` reported operational mode `execute`, role `executor`, and graph LSN 3.
- `execute.run` showed only `worktree_create`, `populate`, `source_policy`, `source_copy`, and `report_init`; it showed no `slice_start`.
- Final read-only SQLite authority reported latest LSN 3, 44 nodes, and 69 edges.

In the real TUI, `/brunch:mode` and `/brunch:consult` each displayed the same **Prepare execution**, **Compile a plan**, and **Execute the plan** choices. The user escaped both menus without selection and then exited normally.

The JSONL contained exactly one `brunch.process_move`: `compile_plan`, written during setup. It contained zero post-boundary process moves and zero post-boundary assistant messages. Post-boundary mode switches were only Specify and then Execute.

## Frozen authority and cleanup

Final authority hashes matched their witness-boundary hashes:

| Artifact | Retained hash |
| --- | --- |
| events | `488f...` |
| marking | `e3fe...` |
| net | `e8f...` |
| sdcpn | `7350...` |
| frozen plan | `11cef...` |
| reports | `9159...` |
| run.json | `dfadda...` |
| source-policy | `d07f...` |

Plan and provenance hashes also matched before/after. Only abbreviated hashes were retained, so no full digest is inferred here.

A later clean `pgrep -fl 'brunch-fe1348-execute-final.Fb6Spv'` produced no output; port 52757 had no listener; no writer lock remained; and the TUI exited normally. This deliberately excludes the earlier self-matching `pgrep` observation.

Screenshots:

- `/Users/lunelson/Library/Application Support/CleanShot/media/media_BVj8Bl0S7N/CleanShot 2026-08-13 at 15.15.02@2x.png`
- `/Users/lunelson/Library/Application Support/CleanShot/media/media_Ry05ae4lPC/CleanShot 2026-08-13 at 17.13.13@2x.png`
- `/Users/lunelson/Library/Application Support/CleanShot/media/media_aaZnvPUc4p/CleanShot 2026-08-13 at 17.32.48@2x.png`
- `/Users/lunelson/Library/Application Support/CleanShot/media/media_GhDvLgMtH1/CleanShot 2026-08-13 at 17.38.58@2x.png`
- `/Users/lunelson/Library/Application Support/CleanShot/media/media_c6Oh1JqPDy/CleanShot 2026-08-13 at 17.40.06@2x.png`

## Prior-gate provenance — 2026-08-10

The original witness ran at source commit `47f02b802` against a fresh `workspace-alpha-grounding/scope-handoff-ready` seed (spec 1, 5 nodes, 5 edges). It switched through the real `/brunch:mode` path into Execute and honestly displayed only **Prepare execution**. Public `session.runtimeState` agreed on Execute/executor/LSN 3, while `execute.runs` and `execute.runTraceIndex` were empty and no independent plan read was available.

That evidence remained `partial`, rather than manufacturing plan/run state: it proved only the thin-seed Prepare case and exposed that production callers were not consuming the existing state-aware resolver. FE-1348 subsequently built that bounded deterministic wiring. The final 2026-08-13 witness above supplied a supported compiled-plan/run target and closed the production mode-switch plus explicit-consult gate without selecting a post-boundary move or executing a slice.
