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

**Status:** next (downstream of Card 1 — promotes the single tree; scope independent of Card 1's internals)

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
