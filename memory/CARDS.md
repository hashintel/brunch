<!-- CARDS.md — prepared scope-card queue for ONE frontier item (ln-scope sanctioned derivative).
     Frontier: cook-greenfield-single-tree (single-dir greenfield execution + verified promotion-back).
     Stacks on FE-826 (cook-mode-from-spec). Delete or overwrite when the queue is exhausted/superseded. -->

# Cards — cook-greenfield-single-tree

## Orientation

- **Seam:** cook per-slice worktree + epic-merge + run lifecycle — `src/orchestrator/src/net-compiler.ts` (per-slice dir loop ~566-575, fire-time `seedSliceSandboxFromDeps` ~629/707/773, `verify-epic` ~837 which merges via `mergeSlicesIntoEpicSandbox().epicSandboxDir`), `epic-sandbox-merge.ts` (`resolveSliceWorktreeDir`, `seedSliceSandboxFromDeps`, `mergeSlicesIntoEpicSandbox`), `worktree.ts` (`createSandbox`), `cook-cli.ts` (`runCook`).
- **Frontier:** new — `cook-greenfield-single-tree`, stacked on FE-826. Refines `cook-codebase-mode` + builds on FE-826's `plan.mode`. Closes the open `cook output promotion` follow-on (PLAN.md:45) for greenfield.
- **The model change:** today greenfield runs each slice in an isolated `<sandbox>/<sliceId>/` and merges into `__epic__/<epicId>/`; the per-slice dep-seeding (`seedSliceSandboxFromDeps` over `depends_on`) is an execution-time **oracle on plan-dependency correctness**. Single-dir greenfield trades that oracle (and parallelism) for one directly-usable tree. Brownfield is **unchanged** (keeps per-slice worktrees + `__epic__` merge — its isolation protects the source repo, I123-K).
- **Main open risk:** accretion is only correct if serial firing visits slices in dependency order (a dependent slice's actions must fire after its deps' files land in the shared dir). The petri topology gates a slice on prerequisite tokens, so serial firing *should* respect topological order — but this is the load-bearing assumption and must be pinned by a behavioral test (2-slice dep plan).

---

## Card 1 — Greenfield executes in a single shared tree (FULL)

**Status:** done — net-compiler keys on `sandboxMode === 'codebase'`: greenfield skips per-slice worktrees (`resolveSliceCwd` returns the shared sandbox) and `verify-epic` runs in place (no `__epic__` merge, no merge event); brownfield path unchanged. `assertPolicyForMode` refuses greenfield + `--policy=parallel` (wired in runCook). Tests: greenfield verify-in-place + 2-slice accretion (slice-b sees slice-a via shared dir) + parallel gate; the per-slice-isolation adapter tests split into greenfield-shared + brownfield-distinct (real git). Verify gate green (1744 tests). Durable decision/invariant + PLAN frontier deferred to ln-sync.

### Target Behavior

A greenfield cook run executes every slice in the single run-sandbox directory and verifies each epic against that directory in place, with no per-slice worktrees and no `__epic__` merge.

### Boundary Crossings

```
→ runCook resolves plan.mode = greenfield  (cook-cli.ts)
→ policy gate: greenfield single-dir requires serial; parallel refused/forced-serial  (cook-cli.ts / parseCookArgs)
→ createSandbox(cwd) → single empty run sandbox  (worktree.ts, unchanged)
→ wireHandlers per-slice prep: greenfield → no per-slice mkdir; slice cwd = sandboxDir  (net-compiler.ts ~566-575)
→ fire-time dep seeding: greenfield → seedSliceSandboxFromDeps is a no-op (deps already on disk)  (net-compiler.ts ~629/707/773)
→ slice actions run with cwd = sandboxDir (accretion)  (pi-actions via ctx.sandboxDir)
→ verify-epic: greenfield → run against sandboxDir directly, skip mergeSlicesIntoEpicSandbox  (net-compiler.ts ~837)
→ brownfield path: all of the above unchanged (per-slice worktrees + __epic__ merge)
```

### Risks and Assumptions

```
- RISK: serial firing might not visit slices in dependency order → a dependent slice fires before its dep's files exist in the shared dir → MITIGATION: behavioral test — a 2-slice dep plan (slice-b depends_on slice-a) under greenfield+serial asserts slice-b's action sees slice-a's output file. (Petri prerequisite tokens already gate dependents on dep completion, so this should hold.)
- RISK: parallel policy + single dir = file races → MITIGATION: gate — greenfield single-dir refuses --policy=parallel (or coerces to serial with a warning). Decide refuse-vs-coerce during build.
- RISK: collapsing resolveSliceWorktreeDir to sandboxDir for greenfield could leak into brownfield paths → MITIGATION: mode-thread the decision; brownfield contract tests must stay green unchanged.
- ASSUMPTION: losing the per-slice dependency-correctness oracle is acceptable for greenfield (gain: directly-usable single tree) → VALIDATE: explicit decision, recorded in SPEC. [→ memory/SPEC.md §Decisions]
- ASSUMPTION: __epic__ merge is redundant for single-dir greenfield (the dir IS the union) → VALIDATE: verify-epic-in-place tests pass; no __epic__ dir created in greenfield runs.
```

### Acceptance Criteria

```
✓ greenfield-single-dir — a greenfield run creates NO <sandbox>/<sliceId>/ dirs and NO <sandbox>/__epic__/ dir; all slice output lands directly in <sandbox>/worktree/
✓ greenfield-accretion-deps — 2-slice dep plan (b depends_on a), greenfield+serial: slice-b's action observes slice-a's file in the shared dir
✓ greenfield-verify-in-place — verify-epic runs against sandboxDir (not a merged __epic__ dir); a completed greenfield run reports completed
✓ greenfield-parallel-gate — greenfield + --policy=parallel is refused (or coerced to serial with a surfaced warning) — decided + tested
✓ brownfield-unchanged — engine contract suite + brownfield-smoke stay green; brownfield still uses per-slice worktrees + __epic__ merge
```

### Verification Approach

```
- Inner: engine-contract / net-compiler adapter tests — greenfield single-dir topology + per-slice prep + verify-epic dir; brownfield path regression
- Middle: brownfield-smoke-style integration — greenfield run end-to-end produces one tree, no slice/__epic__ subdirs; dep accretion observed
- Outer: optional manual `brunch cook` on a small greenfield spec plan, inspect the single tree
```

### Promotion note

Full: reverses the per-slice-isolation decision for greenfield (a non-trivial design reversal), changes the greenfield execution model, and retires `__epic__` merge for greenfield. New decision (single-dir greenfield) + reconcile against D162-K/D164-K-adjacent worktree decisions via ln-sync. Brownfield invariants (I123-K) untouched.

---

## Card 2 — Verified promotion-back for greenfield (FULL)

**Status:** done — new `promote-run.ts` (`promoteGreenfieldRun`): empty target → git init + commit on `main`; existing repo → commit on `cook/<runId>` branch (user's branch intact); non-empty target refused unless `--force`; deterministic committer identity. Wired into `runCook` gated on `--out` (opt-in) + greenfield + `result.status === 'completed'` (halt/brownfield promote nothing, print artifact path). `--out`/`--force` added to `parseCookArgs` + CLI help. Verify gate green (1748 tests). Durable decision/invariant + PLAN frontier deferred to ln-sync.

> **Model pivot (2026-06-09, "both, policy-selected"):** single-tree is no longer greenfield-wide. greenfield+**serial** → single tree (Cards 1+2); greenfield+**parallel** → per-slice isolation (race-safe) + whole-plan-merge promotion (Cards 3+4 below). Brownfield unchanged.

---

## Card 3 — Slice layout is policy-selected, not greenfield-wide (FULL)

**Status:** done — `OrchestratorInput.sliceLayout: 'shared' | 'per-slice'` (default `per-slice`); net-compiler gates single-tree branches on `sliceLayout === 'shared'` (per-slice prep: codebase→worktree, else→mkdir; resolveSliceCwd shared→sandboxDir else→seedSliceSandboxFromDeps; verify-epic shared→in place else→`__epic__` merge). runCook sets `sliceLayout = fixture && serial ? 'shared' : 'per-slice'`; `assertPolicyForMode` parallel refusal **retired** (greenfield parallel allowed). Card-1 greenfield tests pass `sliceLayout:'shared'`; new greenfield+parallel test asserts per-slice dirs + `__epic__` merge. Verify gate green (1747 tests; one unrelated app.test.ts flake passed on re-run).

### Target Behavior

The orchestrator runs greenfield slices in one shared tree only under serial policy; under parallel policy greenfield slices get isolated per-slice dirs with an `__epic__` merge, and brownfield is unchanged.

### Boundary Crossings

```
→ runCook computes sliceLayout = (greenfield && serial) ? 'shared' : 'per-slice'  (cook-cli.ts)
→ assertPolicyForMode parallel refusal REMOVED (greenfield parallel now allowed)  (cook-cli.ts)
→ OrchestratorInput.sliceLayout: 'shared' | 'per-slice' (default 'per-slice')  (types.ts)
→ wireHandlers per-slice prep: codebase → seedSliceFromParentWorktree; else per-slice → mkdir; shared → nothing  (net-compiler.ts)
→ resolveSliceCwd: shared → sandboxDir; per-slice → seedSliceSandboxFromDeps  (net-compiler.ts)
→ verify-epic: shared → in place; per-slice → mergeSlicesIntoEpicSandbox  (net-compiler.ts)
```

### Risks and Assumptions

```
- RISK: Card-1 greenfield tests assume single-tree by default → MITIGATION: those tests pass sliceLayout:'shared' explicitly (they test the shared path); a new greenfield+parallel test asserts per-slice dirs + __epic__ merge.
- RISK: decoupling layout (shared vs per-slice) from seeding (worktree vs plain dir) → MITIGATION: prep loop keys worktree-vs-mkdir on sandboxMode==='codebase'; everything else keys single-tree on sliceLayout==='shared'. Brownfield = per-slice + worktree always.
- DECISION (reverses Card 1's "greenfield ⇒ single-tree/serial-only"): single-tree now requires greenfield && serial; greenfield parallel restores per-slice isolation. assertPolicyForMode parallel refusal is retired.
- ASSUMPTION: greenfield+parallel per-slice isolation is just the pre-FE-827 plain-dir model (mkdir + seedSliceSandboxFromDeps + __epic__ merge) → VALIDATE: contract tests for that path.
```

### Acceptance Criteria

```
✓ layout-shared — greenfield+serial (sliceLayout 'shared'): no per-slice dirs, no __epic__, verify-epic in place (Card-1 tests, updated to pass sliceLayout)
✓ layout-per-slice-greenfield — greenfield+parallel: per-slice dirs created, deps seeded per slice, verify-epic merges __epic__/<epicId>/
✓ parallel-allowed — runCook no longer refuses greenfield + --policy=parallel; assertPolicyForMode retired/repurposed
✓ brownfield-unchanged — codebase path still worktrees + __epic__; contract suite + brownfield-smoke green
```

### Verification Approach

```
- Inner: net-compiler adapter/contract tests for the three layouts; runCook sliceLayout selection (pure helper if extracted)
- Middle: engine-contract greenfield+parallel run produces per-slice dirs + __epic__; greenfield+serial single tree
```

### Promotion note

Full: reverses the Card-1 decision (single-tree scope narrowed to serial), reintroduces greenfield parallel. Reconcile the final model in SPEC via ln-sync (the single-tree decision becomes layout-policy-selected).

---

## Card 4 — Whole-plan-merge promotion for greenfield parallel (FULL)

**Status:** done — `mergeCompletedSlicesIntoTree` (extracted shared `mergeSliceDirsInto` core, reused by the epic merge) unions all completed slice dirs into one tree (declaration-order-wins, collisions reported). `promotionSourceDir` (pure, tested): shared → sandbox unchanged; per-slice → whole-plan merge under `<runDir>/__promote__`. runCook promotion uses it, prints conflicts, then `promoteGreenfieldRun`. Collision policy = order-wins + report (LLM reconciliation logged as Horizon `parallel-merge-conflict-reconciliation`). Verify gate green (1750 tests).

### Target Behavior

A completed greenfield parallel run promotes a single whole-plan merge of all completed slice trees into the target as a reviewable git commit.

### Boundary Crossings

```
→ runCook, run completed + greenfield + --out  (cook-cli.ts)
→ serial (shared) → promote sandboxDir directly (Card 2, unchanged)
→ parallel (per-slice) → merge ALL completed slices into one whole-plan dir (declaration-order-wins, collisions reported)  (epic-sandbox-merge.ts: whole-plan merge)
→ promoteGreenfieldRun(mergeDir, ...) → commit-on-branch  (promote-run.ts, reused)
→ print promoted path + branch/commit + any collisions
```

### Risks and Assumptions

```
- RISK: cross-slice path collisions silently last-writer-win → MITIGATION: reuse the merge's declaration-order-wins + conflicts list; print conflicts on promote. Final whole-plan verify is a documented follow-on (per-epic verify-epic already ran).
- RISK: which slices to merge → MITIGATION: only ctx-completed slices, plan declaration order (mirror sliceIdsForEpicVerifyMerge across the whole plan).
- ASSUMPTION: mergeSlicesIntoEpicSandbox generalizes to whole-plan (it is filesystem copy, git-agnostic) → VALIDATE: whole-plan-merge unit test.
- DECISION: greenfield promotion source = sandboxDir (serial) | whole-plan merge (parallel); brownfield promotion stays a separate follow-on.
```

### Acceptance Criteria

```
✓ whole-plan-merge — a function merges all completed slice dirs into one tree (order-wins, conflicts reported); unit-tested on tmpdirs
✓ promote-parallel-greenfield — completed greenfield parallel run + --out lands the merged tree as a commit (files = union of slice outputs)
✓ promote-serial-unchanged — greenfield serial + --out still copy-commits sandboxDir (Card 2 regression)
✓ collisions-surfaced — a path produced by two slices is reported on promote
```

### Verification Approach

```
- Inner: whole-plan-merge unit test (tmpdir slice dirs); promote-run reused tests
- Middle: engine-contract greenfield+parallel end-to-end then promote into a tmpdir target
- Outer: optional manual brunch cook greenfield --policy=parallel --out=<dir>
```

### Promotion note

Full: adds a whole-plan merge seam + a second greenfield promotion source. Reconcile via ln-sync. Whole-plan re-verify deferred (follow-on).

### Target Behavior

After a completed greenfield cook run, `brunch cook` promotes the run-sandbox tree into the target directory as a reviewable result, and promotes nothing when the run did not complete.

### Boundary Crossings

```
→ runCook completes: result.status === 'completed'  (cook-cli.ts)
→ promotion gate: greenfield + completed → promote; halted/deadlocked → skip (artifact stays inspectable)  (cook-cli.ts)
→ target resolution: cwd (or --out); non-empty target refused unless --force  (cook-cli.ts / parseCookArgs)
→ promote <runId>/worktree/ → target as a reviewable landing (git init + commit on a cook/<runId> branch into a fresh repo, OR guarded copy)  (new promotion module)
→ report/print what was promoted (path + branch/commit)  (cook-cli.ts banner)
```

### Risks and Assumptions

```
- RISK: silent overwrite of user files → MITIGATION: refuse non-empty target unless --force; land as a commit/branch (diff), not a raw dump.
- RISK: promoting a partial/halted run → MITIGATION: gate strictly on result.status === 'completed'; all-or-nothing.
- DECISION (locked): landing is commit-on-branch — git init + commit when the target is empty/new; commit on a `cook/<runId>` branch the user reviews+merges when the target is an existing repo. (Guarded copy is not the chosen mechanism.) Target may or may not be a git repo → MITIGATION: git init the empty/non-repo target before committing.
- ASSUMPTION: greenfield promotion is a filesystem/commit step (no git-merge chain), simpler than the brownfield slice→epic→run branch promotion → VALIDATE: promotion tests on a tmpdir target.
- ASSUMPTION: brownfield promotion stays out of scope here (its git-merge-chain promotion is a separate follow-on) → VALIDATE: card touches greenfield only; brownfield runCook output path unchanged.
```

### Acceptance Criteria

```
✓ promote-on-complete — a completed greenfield run lands the generated tree in the target (commit-on-branch or guarded copy); files match the run sandbox
✓ no-promote-on-halt — a halted/deadlocked run promotes nothing; the run sandbox remains inspectable
✓ non-empty-target-guard — promotion into a non-empty target is refused without --force
✓ reviewable-landing — promotion produces a reviewable artifact (a commit/branch or an explicit confirmed copy), not a silent overwrite
✓ promotion-reported — runCook prints the promoted path + branch/commit
```

### Verification Approach

```
- Inner: promotion-module unit tests (tmpdir target) — completed→promoted, halted→untouched, non-empty-guard, reviewable landing
- Middle: integration — greenfield run end-to-end then promote into a tmpdir target; assert tree + completion gating
- Outer: manual `brunch cook` greenfield → inspect promoted project + cook branch
```

### Promotion note

Full: adds a new promotion seam (closes PLAN.md:45 cook output promotion for greenfield); new decision + likely a new invariant ("promotion is gated on completed status; never silent"). Reconcile via ln-sync. Brownfield promotion remains a separate follow-on.
