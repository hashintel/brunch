# Scope cards — cook-artifact-lifecycle (FE-883)

Execution queue for `cook-artifact-lifecycle` (FE-883, branch
`ka/fe-883-orchestrator-improvements`, on FE-864).

**Reality check (corrected after basing on FE-864, the current seam):** the
brownfield git-merge composer already exists — `run-artifact.ts` (commit
871ef087): `commitSliceWorktree` + `foldSliceBranches` do a real `git merge-tree`
3-way fold of per-slice branches in dependency order, fail-closed on conflicts,
pure plumbing (I135-K preserved). It was deliberately left **unwired** pending "a
live-run check of the dependency-seed interaction". So FE-883 is *wire the
existing composer*, not *build it*.

This matches the Slice-1 spike decision (2026-06-18): git-merge for brownfield
(common ancestor → real 3-way), file-copy union for greenfield (no common
ancestor), elevate collisions to a first-class outcome.

---

## Slice 1 — wire the run-artifact composer into the live path

Status: **in progress.**

### Sub-steps

```
✓ 1a (done, commit 2357f941) — composer correct under dependency-seeding. The
  deferred "live-run check" failed: a dependent slice extending a dep-seeded file
  false-conflicted because slice branches share no inter-slice ancestry. Fix:
  commit each slice recording its dependency commits as parents, so the fold's
  merge-base is the dependency. Regression test added; unfaithful happy-path test
  corrected. (epic-sandbox-merge.ts file-copy untouched.)

✓ mechanism (commits fadb1b52, 5e1d8d32) — proved + factored the fold so both
  1b and 1c can use it: foldToCommit (fold N slice commits onto a base, fail-closed,
  no ref write) + materializeFoldedWorktree (fold + `git worktree add --detach`,
  rework-safe). Tests pin: 3-way merge of different-hunk edits to one file keeps
  both; the fold materializes on disk in a verify worktree.

✓ 1c DECISION (2026-06-18): verify against the folded tree (option i). One
  composition path → the tree verified == the tree shipped; no verify≠ship gap on
  same-file edits. The worktree-checkout unknown is de-risked by materializeFoldedWorktree.

○ 1b/1c INTEGRATION (remaining — engine wiring):
  - net-compiler.ts verify-epic (~870): for brownfield, replace mergeSlicesIntoEpicSandbox
    (file-copy) with commit-epic-slices (commitSliceWorktree, dep order + dep parents)
    + materializeFoldedWorktree into __epic__/<epicId>/ + relink node_modules
    (linkSharedTopLevelEntries). Greenfield keeps the file-copy union. Fold conflict →
    fail the epic (first-class).
  - cook-cli.ts promotion (~567): brownfield branch calls harvestCookRun instead of
    promotionSourceDir + promoteBrownfieldRun; fold conflicts → fatal run outcome
    (recordCookExitStatus(false)). I135-K preserved (all plumbing).
  - Needs an end-to-end runCook/engine integration test (none exists today for
    multi-slice brownfield promotion) — note this gap.

○ 1d — delete the superseded file-copy composition (mergeSlicesIntoEpicSandbox /
  promoteBrownfieldRun once unused) + the stale epic-sandbox-merge.ts:226 TODO.
  Amends I124-K to fork on plan.mode (brownfield → fold; greenfield → file-copy union).
```

### Acceptance Criteria (slice-level)

```
✓ dep-seed — a dependent slice extending a dep-seeded file folds clean (done, 1a)
○ brownfield-3way — two brownfield slices editing different hunks of the same
  pre-existing file both survive promotion (the file-copy union drops one)
○ brownfield-conflict — a true overlapping-hunk conflict surfaces as a fatal run
  outcome, not a buried event field
○ checkout-untouched — promotion still never touches the user's branch / tree /
  index (I135-K)
○ greenfield-unchanged — serial-greenfield shared-tree + parallel-greenfield
  file-copy paths preserved
```

### Verification Approach

```
- Inner: run-artifact.test.ts (done), promote-run.test.ts, epic-sandbox-merge.test.ts
- Middle: brownfield-smoke.integration.test.ts — seeded repo, overlapping slices
- Outer: dogfood a multi-slice brownfield cook with an intentional file overlap
```

---

## Slice 2 — worktree + branch GC / lifecycle (light) — `next` after Slice 1

A finished run reclaims its worktrees + `brunch/{run,slice}/*` refs instead of the
operator-owned cleanup `worktree.ts` documents. Ref-set depends on Slice 1's final
branch topology, so scope after it lands. Keep-on-failure for inspection; promoted
artifact survives GC.

## Slice 3 — per-slice build-cache write isolation (candidate)

May instead be an FE-879 follow-on (FE-879 owns `SHAREABLE_TOP_LEVEL_ENTRIES`).
Decide ownership before scoping.

## Out of scope (noted)

- Sync `git worktree add` serialization (`epic-sandbox-merge.ts:288`) — perf, not
  correctness; FE-879 laziness already bounds worktree count.
