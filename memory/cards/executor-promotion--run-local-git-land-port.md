# executor-promotion — run-local GitLandPort slice

## Orientation

- Containing seam: `orchestrator-cutover` real-execution substrate; `executor-sandbox` supplies a real git worktree and real verify runner, and `executor-agent-runner` supplies a sealed worker that can make sandbox diffs.
- Frontier item: `executor-promotion` (FE-1112) on `ka/fe-1112-executor-promotion`, stacked on `ka/fe-1111-executor-agent-runner`.
- Handoff state: FE-1111 is complete; `execute_promotion_prepare` is still descriptive and `execute_status.pendingTools` still reports `land`.
- Main open risk: promotion is the first hard-to-reverse git seam, so the first slice must stay run-local and consume existing run artifacts instead of touching host branches.

## Scope Weight

Full scope card. This slice establishes the `GitLandPort` capability boundary and changes the promotion seam from descriptive-only to a real, run-local git mutation.

## Target Behavior

`execute_promotion_prepare` promotes a completed run's verified sandbox worktree diff through an injected `GitLandPort` without mutating host branches.

## Boundary Crossings

```text
execute_promotion_prepare Pi tool
→ src/executor/promotion.ts
→ src/executor/execution-ports.ts GitLandPort contract
→ src/app/git-land-port.ts app-layer git implementation
→ run worktree git state / promotion artifact
```

## Risks and Assumptions

- RISK: host branch/ref mutation sneaks into the first land slice. → MITIGATION: `GitLandPort` first supports run-local promotion only; tests assert no host `.git` branch/ref mutation and no writes outside the run/worktree/promotion paths.
- RISK: promotion re-derives run state and diverges from Petri/report artifacts. → MITIGATION: require `promotion_prepared` inputs to come from existing run metadata, Petri artifact, completed slices, and worktree path; no fresh plan topology derivation.
- RISK: no-op worktrees make promotion look successful without a diff. → MITIGATION: first port result must report an explicit `no_changes` / failure-style status that does not advance metadata, or a real promoted commit/ref artifact with changed files.
- ASSUMPTION: run-local commit/ref is enough to unlock the next reviewable layer before host promotion. → VALIDATE: focused tests prove a diff in the run worktree becomes a run-local promotion artifact, while host branch promotion remains absent.

## Acceptance Criteria

✓ `src/executor/__tests__/promotion.test.ts` — `preparePromotion` invokes an injected `GitLandPort` for a Petri-exported run with a worktree and records a real run-local promotion result.

✓ `src/executor/__tests__/promotion.test.ts` — `GitLandPort` failure or no changes do not advance run metadata and report no side effects.

✓ `src/app/__tests__/git-land-port.test.ts` — app-layer `GitLandPort` performs only run-local git operations inside the worktree/promotion area and returns the promoted commit/ref metadata.

✓ `src/.pi/extensions/__tests__/registry.test.ts` — `execute_promotion_prepare` is wired with injected `GitLandPort`; `execute_status.pendingTools` remains `land` until the run-local layer is accepted as enough to drop it.

✓ `src/executor/promotion.ts` / architecture checks — executor core imports no app, Pi, git, subprocess, or UI modules.

## Verification Approach

- Inner: focused Vitest tests for promotion core, app-layer git port, and Pi registry injection.
- Middle: `npm run fix`.
- Gate: `npm run verify`.

## Promotion Checklist

- [x] Does this change a requirement? It materializes FE-1112's first real promotion layer.
- [x] Does this create, retire, or invalidate an assumption? It validates whether run-local promotion is enough before host promotion.
- [x] Does this make or reverse a non-trivial design decision? It chooses run-local git promotion before host branch mutation.
- [x] Does this establish a new seam-level invariant? First promotion slice must not mutate host branches/refs.
- [x] Does it cross more than two major seams?
- [ ] Is this the first touch in an unfamiliar seam from a fresh thread?
- [ ] Can you not name the containing seam or current rationale from the live docs?

## Recommended Next Route

Build it with `ln-build`.
