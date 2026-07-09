---
description: Iteratively slice and/or sweep through a plan frontier, delegating scope-card builds, verifiying and validating results; continue until frontier is exhausted
argument-hint: "[plan-frontier-id-or-description]"
---

Act as a coordinator/scoper/reviewer for the implementation of plan frontier: ${1:-`next`}

You will work in a loop... 

1. apply /skill:ln-scope to create scope card file(s) for the current plan frontier, then 
2. delegate those card files to a builder agent who will implement them, then 
3. verify and validate the builder's work, and either request revisions or accept as complete, and LOOP

You will repeat this procedure until the frontier is closed, blocked, or needs human/product judgment.

## How to start:

1. **Orient on the frontier.** Read `memory/PLAN.md` and the relevant frontier definition. Read `memory/SPEC.md`, `HANDOFF.md` if present, and any topology/canonical docs needed to understand this frontier's seam, inherited certainty posture, cross-cutting obligations, and open risks.
2. **Inspect existing execution artifacts.** Check `memory/cards/` for active scope files for this frontier. Prefer consuming an already-active relevant scope file before creating another. A `Mode: sweep` ledger is already a scope artifact; do not create a second card just to start a sweep row. If multiple active files exist, apply `ln-build` / `ln-scope` selection rules and ask when ambiguous.
3. **Scope the next buildable unit when needed.** Invoke `ln-scope` against this frontier, not against an implementation guess. Let `ln-scope` decide whether to produce one `Mode: single` card, a short `Mode: slices` sequence, or a `Mode: sweep` ledger. Sometimes a few cards can be scoped at once; sometimes the next card is epistemic/probe-like and you should wait for its build result before scoping further.
4. **Delegate the scoped artifact to a builder.** Once there is a concrete scope file path, delegate that file to the `builder` subagent using the builder prompt below. Set the subagent `cwd` to the current repository root. The subagent has no conversation context, so include the full builder prompt.
5. **Review the builder's claims.** Treat the builder report as claims, not as completion. Inspect status, commits, diffs, acceptance evidence, verification, reconciliation, and residual risk.
6. **Update epistemic state.** Decide whether the result closes the scoped unit, changes what the frontier means, invalidates downstream cards, or exposes a new unknown. Then either accept and continue, request a focused revision, route back through `ln-scope` / `ln-spec` / `ln-plan`, ask the user, or stop with a blocked report.

## How to prompt the `builder` subagent:

Replace `<relative-scope-card-file-path>` with the concrete scope-card-file for the current loop

```md
/skill:ln-build Please build out <relative-scope-card-file-path>

Treat this file as the execution contract. Build the next ready card or sweep row. If the file is `Mode: slices`, continue card-by-card only while `ln-build`'s sliced-execution stop conditions do not fire. Make one commit per completed card/row. If a card/row is already satisfied and no code or canonical-state change is needed, do not create an empty commit.

Run the verification required by `ln-build`. Preserve `ln-build`'s mandatory leaf-by-leaf acceptance report and canonical reconciliation. Never manufacture green by skipping, deleting, narrowing, or disabling oracles.

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

## How to review builder work

Do not accept the work from the subagent's summary alone. Treat the summary as reviewable claims.

1. Read the builder's structured report and identify the claimed commits, files, acceptance leaves, verification evidence, divergences, and residual risks.
2. Inspect `git status --short` and the relevant commit diffs/stats. Use literal paths and commit hashes; do not bulk-stage or clean anything.
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
