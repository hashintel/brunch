# executor-promotion — promotion metadata recovery

## Orientation

- Containing seam: `executor-promotion` (FE-1112), after run-local `GitLandPort` landed.
- Review finding: `preparePromotion` performs the run-local git commit before writing `promotion.json` and updating `run.json`.
- Main risk: if `promotion.json` or `run.json` persistence fails after the git commit, retry sees a clean worktree and returns `promotion_no_changes`, leaving the run stuck at `petri_exported` despite a promoted commit existing.

## Scope Weight

Full scope card. This fixes a failure-mode invariant at the first real git mutation seam.

## Target Behavior

`execute_promotion_prepare` can recover or idempotently complete promotion metadata after a prior successful run-local git commit.

## Boundary Crossings

```text
execute_promotion_prepare Pi tool
→ src/executor/promotion.ts
→ GitLandPort result/recovery contract
→ promotion.json / run.json persistence
```

## Risks and Assumptions

- RISK: no-change retry hides a prior successful promotion commit. → MITIGATION: teach the promotion path to distinguish “no changes because already promoted” from “nothing was ever promoted,” using durable promotion metadata or a port-reported current commit.
- RISK: recovery logic re-derives run topology. → MITIGATION: recovery may use only existing run metadata, worktree commit identity, and promotion artifact paths; it must not inspect or rewrite plan/Petri topology.
- ASSUMPTION: recording the promoted commit SHA before or during report persistence is enough to make retry safe. → VALIDATE: focused test simulates commit success followed by persistence failure, then reruns promotion and observes `promotion_prepared` with the same SHA.

## Acceptance Criteria

✓ `src/executor/__tests__/promotion.test.ts` — simulates successful `GitLandPort` commit followed by failed promotion metadata persistence; retry completes `promotion.json` / `run.json` instead of returning `promotion_no_changes`.

✓ `src/app/__tests__/git-land-port.test.ts` — app-layer port exposes enough commit identity on a clean already-promoted worktree, or the core recovery path does not require app-layer changes because commit identity is already durable.

✓ Failure paths that truly have no prior promoted commit still do not advance metadata.

## Verification Approach

- Inner: focused promotion recovery tests.
- Gate: `npm run verify`.

## Recommended Next Route

Build it with `ln-build`.
