# Session resume and active-tree continuity

Date: 2026-08-10
Frontier: FE-1348 `post-hardening-alpha-validation`
Row: `Session resume and active-tree continuity`
Disposition: `built`

## Boundary and method

This row used a fresh temporary workspace created through `createWorkspaceSessionCoordinator`, a real Pi 0.83.0 `SessionManager`, Brunch's production file-backed envelope/transcript/runtime/style projections, and a fresh coordinator plus manager construction across the quit/relaunch boundary. No provider turn, raw JSONL authoring, tracked fixture, seed, production source, or config was used or changed.

The bounded driver lived only at `.fixtures/scratch/fe1348-session-resume/witness.ts` while running. Its workspace was `/var/folders/2c/ptn6jcrj61lck_yzfz_p3b5m0000gn/T/fe1348-session-resume-Yy3nvJ` and was removed by the driver's `finally` block; the driver directory was then removed.

## Exact operations

1. `createSetupSession({ specTitle: "FE-1348 continuity witness" })` created spec `1` and session `019feb68-1cf2-7383-9d4a-51b1fa321f7a`.
2. `SessionManager.open(...)` opened the coordinator-created canonical JSONL.
3. Pi append APIs wrote active-branch mode `specify`, style `disambiguate`, assistant text `Choose the retained path`, and user text `SELECTED ACTIVE LEAF`.
4. `branch(branchPointId)` moved to branch point `75fe6e3c`; Pi append APIs then wrote an abandoned sibling with transcript text `ABANDONED APPEND-ORDER SIBLING`, mode `execute`, and style `propose` (leaf `50030f34`).
5. `branchWithSummary(selectedLeafId, "Returned to the selected active leaf.")` performed the Pi-valid tree change back through selected answer `41c45fb8`, producing active continuation leaf `c70e1c88`.
6. The first coordinator and manager were dropped. A fresh `createWorkspaceSessionCoordinator({ cwd })` called `openTargetSession({ specId: 1, sessionId: "019feb68-1cf2-7383-9d4a-51b1fa321f7a" })`, and a fresh `SessionManager.open(...)` reopened the returned file.
7. Before and after, `readBrunchSessionEnvelope`, `projectSessionRuntimeState`, `latestElicitationStyle`, and `renderSessionTranscriptFile` projected the canonical file through production readers.

## Before/after target and projection

| Evidence | Before quit | After relaunch |
| --- | --- | --- |
| Spec id | `1` | `1` |
| Session id | `019feb68-1cf2-7383-9d4a-51b1fa321f7a` | `019feb68-1cf2-7383-9d4a-51b1fa321f7a` |
| Active leaf | `c70e1c88` | `c70e1c88` |
| Active-branch ids | `ab88d267`, `bcb428d8`, `edc2a545`, `a18a32be`, `75fe6e3c`, `41c45fb8`, `c70e1c88` | identical |
| Mode / derived role | `specify` / `elicitor` | `specify` / `elicitor` |
| Elicitation style | `disambiguate` | `disambiguate` |
| Transcript | includes `SELECTED ACTIVE LEAF`; excludes abandoned sibling | same |

The target file was the same coordinator-owned JSONL on both sides of relaunch. Its active-branch envelope and rendered transcript were stable.

## Active branch versus append-order rival

The canonical raw file intentionally retained both valid siblings. Explicit all-history inspection found the latest runtime-state and style rows by append order were the abandoned sibling's `execute` and `propose`. In contrast, every product-semantic projection returned the selected active branch's `specify` and `disambiguate`, and the rendered transcript included `SELECTED ACTIVE LEAF` while excluding `ABANDONED APPEND-ORDER SIBLING` before and after relaunch.

This is the required contrast: JSONL history remains append-only, while canonical current-state projection follows Pi's active root-to-leaf branch rather than leaking the abandoned sibling's later semantic carriers.

## Contract-oracle cross-check

```text
npm test -- src/session/__tests__/active-session-branch.test.ts \
  src/session/__tests__/session-transcript.test.ts \
  src/session/__tests__/elicitation-style.test.ts \
  src/projections/session/__tests__/runtime-state.test.ts \
  src/app/__tests__/brunch-tui.test.ts

Test Files  5 passed (5)
Tests      58 passed (58)
```

These existing real-path contracts cover physical Pi reopen/tree acceptance, active-branch transcript filtering, branch-relative style and runtime projection, and TUI chrome composition from the active Pi branch while retaining both siblings.

## Cleanup proof

- Driver emitted `CLEANUP_REMOVED=/var/folders/2c/ptn6jcrj61lck_yzfz_p3b5m0000gn/T/fe1348-session-resume-Yy3nvJ`.
- A post-run existence check returned `workspace_exists_after_cleanup? False`.
- `.fixtures/scratch/fe1348-session-resume/` was removed after execution.
- No tracked fixture/seed or ignored pre-existing workbench/scratch residue was touched.

## Leaf disposition

| Leaf | Outcome | Evidence |
| --- | --- | --- |
| Quit/relaunch preserves selected spec and target | met | Same spec/session/file target before and after fresh coordinator + manager construction. |
| Pi-valid branch/tree change preserves active-leaf transcript | met | `branch` + `branchWithSummary`; leaf `c70e1c88`; selected transcript included and sibling excluded before/after. |
| Mode and style remain active-branch-relative | met | Product projections stayed `specify` / `disambiguate`; all-history rivals were `execute` / `propose`. |
| Canonical JSONL projection has no append-order leakage | met | Identical active-branch id projection before/after plus transcript/runtime/style contrast. |
| Bounded fresh scratch is removed | met | Driver cleanup marker, negative existence check, and driver-directory removal. |

Skipped-test-count delta versus parent: `0`.
