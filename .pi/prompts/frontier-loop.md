---
description: Iteratively scope and build a plan frontier, reviewing each delegated unit until the frontier is exhausted
argument-hint: "[plan-frontier-id-or-description]"
---

Act as a coordinator/scoper/reviewer for the implementation of plan frontier: ${1:-next}

Work in a review-bounded loop:

1. consume an existing active scope artifact, or apply `/skill:ln-scope` only when no suitable artifact exists;
2. delegate one reviewable execution unit to a builder;
3. independently verify the builder's claims and either request revision or accept the unit;
4. update the frontier's epistemic state, then loop.

One execution unit means:

- `Mode: single` — one card;
- `Mode: sweep` — exactly one row, then return for coordinator review;
- `Mode: slices` — card-by-card only while `ln-build`'s sliced-execution stop conditions permit continuation.

Repeat until the frontier is closed, blocked, or needs human/product judgment. Do not let one delegation consume an entire sweep ledger.

## How to start:

1. **Orient on the frontier.** Read `memory/PLAN.md` and the relevant frontier definition. Read `memory/SPEC.md`, `HANDOFF.md` if present, and any topology/canonical docs needed to understand this frontier's seam, inherited certainty posture, cross-cutting obligations, and open risks.
2. **Inspect existing execution artifacts.** Check `memory/cards/` for active scope files for this frontier. An active relevant file wins over creating another. A `Mode: sweep` ledger is already a complete scope artifact; do not invoke `ln-scope` merely to start its next row. If multiple active files exist, apply `ln-build` / `ln-scope` selection rules and ask when ambiguous.
3. **Scope only when needed.** Invoke `ln-scope` against the frontier, not an implementation guess, only when no suitable active scope artifact exists or review invalidated the existing artifact. Let `ln-scope` choose `single`, `slices`, or `sweep`. Wait for an epistemic/probe-like card's result before scoping dependent work.
4. **Baseline shared-worktree state.** Immediately before delegation, inspect `git status --short`. Record every pre-existing modified/untracked path as protected state, identify the selected unit's tentative write manifest, and include both in the builder prompt. Never assume a dirty file belongs to the builder merely because it relates to the frontier.
5. **Delegate one execution unit.** Delegate the concrete scope-file path to the `builder` subagent using the prompt below, with `cwd` set to the repository root. The subagent has no conversation context, so include the full prompt, protected-state baseline, and allowed manifest. A sweep delegation stops after exactly one row.
6. **Review claims, not summaries.** Treat the builder report as claims, not completion. Ensure no builder process remains active before reviewing or delegating another writer. Inspect status, commits, diffs, acceptance evidence, verification, reconciliation, and residual risk.
7. **Update epistemic state.** Decide whether the result closes the scoped unit, changes what the frontier means, invalidates downstream cards, or exposes a new unknown. Then either accept and continue, request a focused revision, route back through `ln-scope` / `ln-spec` / `ln-plan`, ask the user, or stop with a blocked report.

## How to prompt the `builder` subagent:

Replace `<relative-scope-card-file-path>` with the concrete scope-card-file for the current loop

```md
/skill:ln-build Please build out <relative-scope-card-file-path>

Treat this file as the execution contract. Build one reviewable execution unit:

- `Mode: single` — the next ready card;
- `Mode: sweep` — exactly the next ready row, then stop and report;
- `Mode: slices` — continue card-by-card only while `ln-build`'s sliced-execution stop conditions do not fire.

Make one commit per completed card/row. Do not start another sweep row after committing the selected row. If a card/row is already satisfied and no code or canonical-state change is needed, do not create an empty commit.

Run the verification required by `ln-build`. Preserve `ln-build`'s mandatory leaf-by-leaf acceptance report and canonical reconciliation. Never manufacture green by skipping, deleting, narrowing, or disabling oracles. Prioritize leaving a verified, committed unit and structured report over exploring later work.

Shared-worktree contract supplied by the coordinator:

- Protected pre-existing state: <paste exact `git status --short` baseline, or `none`>.
- Tentative allowed write manifest: <paste the selected card/row's expected paths plus required canonical reconciliation paths>.

Treat protected paths outside the allowed manifest as foreign work. Stage literal paths only; never bulk-stage, clean, reset, stash, or overwrite protected state. If the implementation needs a path outside the manifest, stop when it crosses a new seam; otherwise note the bounded divergence in the report.

On success, report structured claims:

1. Cards/rows completed
2. Commit hashes and commit messages
3. Files touched per commit
4. Acceptance leaf table with evidence
5. Verification commands and outcomes
6. Skipped-test-count delta versus the parent commit
7. Canonical reconciliation performed: SPEC/PLAN/topology/scope-file changes, or explicit no-op
8. Divergences from the scope card, if any
9. Residual risks or manual verification debt
10. Remaining cards/rows, or why the scope file was deleted/exhausted

Stop and report instead of continuing if `ln-build` stop conditions fire, cold-start reads or invariants are stale, the required seam diverges materially from the scope card, verification fails for a reason you cannot fix inside the current card/row, or unexpected foreign work appears.
```

Replace both shared-worktree placeholders before delegating. Do not send the template with unresolved placeholders.

## If delegation times out or returns without a report

Treat silence as an interrupted delegation, not a failed implementation and not permission to launch a second writer.

1. Confirm the builder process is no longer active. If uncertain, stop and ask rather than racing it.
2. Inspect `git status --short` against the recorded baseline. Never reset or discard the interrupted builder's diff.
3. Review the uncommitted diff against the selected card/row exactly as you would review claimed work.
4. If the unit is complete, run the missing verification, perform any missing status/canonical reconciliation, stage literal owned paths, and commit it as the coordinator.
5. If incomplete, delegate a fresh builder to **finish the existing diff**. Include the baseline, current diff paths, completed evidence, and exact missing leaves; forbid restarting or reverting the work.
6. Do not advance the scope pointer until the unit is verified and committed. Report that recovery occurred.

## How to review builder work

Do not accept the work from the subagent's summary alone. Treat the summary as reviewable claims.

1. Read the builder's structured report and identify the claimed commits, files, acceptance leaves, verification evidence, divergences, and residual risks.
2. Confirm the delegated writer is no longer active, then inspect `git status --short` against the captured baseline and inspect the relevant commit diffs/stats. Use literal paths and commit hashes; do not bulk-stage or clean anything.
3. Compare the claimed acceptance evidence to the actual diff and to the scope file's acceptance criteria. If the scope file was deleted, inspect the consumed version from git history when needed.
4. Check canonical reconciliation claims against `memory/SPEC.md`, `memory/PLAN.md`, any touched `src/**/TOPOLOGY.md`, and the consumed scope file lifecycle.
5. Decide one of:
   - **accepted, continue loop** — claims match the diff and more frontier work remains;
   - **accepted, frontier closed** — claims match the diff and the frontier's done condition now holds;
   - **revision requested** — delegate a focused follow-up prompt naming exact findings;
   - **rescope** — the result changed the next best slice or invalidated downstream cards;
   - **route to `ln-spec` / `ln-plan`** — durable truth, frontier boundaries, or sequencing changed;
   - **human decision needed** — the stop condition is real and policy/product judgment is required.

When reporting to the user, include the frontier decision, commits reviewed, verification evidence, any divergences/residual risk, and the recommended next action.
