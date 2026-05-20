<!-- REFACTOR.md — temporary execution aid for orchestrator cleanup.
     Delete when complete. -->

# Orchestrator review cleanup

Batch of mechanical fixes from ln-review findings 1, 2, 3, 6, 8.

## Problem Statement

The orchestrator seam has a naming lie (`fixtureDir` means worktree), duplicated topo-sort, scattered report construction, dead imports, and two coexisting fake systems in the contract tests.

## Solution

Five tiny commits, each leaving tests green.

## Commits

1. **Rename `fixtureDir` → `worktreeDir` on `OrchestratorInput`** — rename the field on the type, update both engines, cook-cli, and all test references. Pure rename, no behavior change.

2. **Generic topo-sort** — collapse `topoSort` + `topoSortSlices` into one `topoSort<T>(items, getId, getDeps)`. Remove the two specialized copies.

3. **Extract `createReport` helper onto `ReportSink`** — add a factory method that handles id generation + timestamp + append. Update both engines and pi-actions to use it. Removes 3 inline report-construction sites.

4. **Migrate contract test #1 to `createFakes()`** — delete the old module-level `callOrder`/`evalCallCount`/`fakeActions`/`fakeTestRunner`. Rewrite test #1 to use the factory. ~100 lines removed.

5. **Remove unused `ReportLine` import from engine-proc.ts**.

## Decisions

- `OrchestratorInput.worktreeDir` replaces `fixtureDir` as the canonical field name
- `topoSort` becomes a generic utility in its own module or at the top of engine-proc
- `createReport` is a free function, not a method on `ReportSink` interface (keeps the interface minimal)

## Testing Decisions

- All 36 existing tests must pass after each commit — no new tests needed since this is pure refactor
- Contract tests are the primary safety net

## Out of Scope

- Finding #4 (extractJson fragility) — not mechanical, needs design thought
- Finding #5 (module-level verbose state) — acceptable for single-run CLI
- Finding #7 (split verify-epic) — needs ln-design, not cleanup
