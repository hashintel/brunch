# executor-host-promotion — host preflight slice

## Orientation

- Containing seam: `executor-host-promotion` (FE-1118), after FE-1112 built run-local promotion and recovery.
- Frontier item: `executor-host-promotion` on `ka/fe-1118-executor-host-promotion`, stacked on `ka/fe-1112-executor-promotion`.
- Main risk: host branch mutation is the externally visible, hard-to-reverse seam; first slice must inspect only.

## Scope Weight

Full scope card. This establishes the host-promotion boundary while deliberately keeping mutation out of scope.

## Target Behavior

Host promotion preflight validates a run-local promotion and reports the host diff that would be applied without changing the host branch.

## Boundary Crossings

```text
future host-promotion Pi tool or core helper
→ run metadata / promotion.json
→ run worktree git commit/diff inspection
→ host preflight report
```

## Risks and Assumptions

- RISK: preflight accidentally mutates host files, refs, branch, or index. → MITIGATION: tests assert host cwd contents and git status are unchanged.
- RISK: preflight trusts stale promotion metadata. → MITIGATION: validate `promotionCommitSha` / `promotion.json` against the run worktree before producing an applyable diff report.
- ASSUMPTION: a diff/report-only slice is enough to make the host apply seam reviewable before mutation. → VALIDATE: focused tests prove the report contains the promoted SHA and changed files while host state is unchanged.

## Acceptance Criteria

✓ Core preflight returns `missing_run`, `run_not_promoted`, or `promotion_not_found` without side effects for invalid inputs.

✓ Core preflight validates `run.json.promotionCommitSha` and `promotion.json.land.commitSha` agree.

✓ App/core preflight computes the promoted worktree diff against its parent/base and reports changed files / patch summary without mutating the host cwd.

✓ No host branch/ref/index/file mutation occurs in this slice.

## Verification Approach

- Inner: focused Vitest tests for preflight success, stale metadata, and no host mutation.
- Gate: `npm run verify`.

## Recommended Next Route

Build it with `ln-build`.
