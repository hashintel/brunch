# Route Expensive Comparison Oracles Conservatively

Frontier: n/a
Status:   active
Mode:     single
Created:  2026-07-24

Posture: proving (category concern; no containing PLAN frontier).

## Orientation

- The containing seam is the repository verification harness: package test lanes feed the single required GitHub Actions `Full gate` status.
- This is dev-tooling rework, not a slice of an active product frontier; completed comparison frontiers remain the owners of the oracle behavior being scheduled.
- There is no volatile `HANDOFF.md` state. Existing uncommitted scope files are independent; none declares the workflow/package/script paths below as primary writes.
- The main risk is a false-negative path classification that skips an oracle affected through a transitive dependency; omission must therefore be fail-open and narrower than ordinary change-impact selection.

## Build state

- Local implementation and deterministic contracts are complete.
- Outer evidence remains owned by this card: re-enter when a pull request whose complete base-to-head diff is wholly inside the closed non-runtime allowlist runs the `Full gate`; capture that the comparison step is skipped and the stable job succeeds. The current runtime-changing PR can prove only the full-lane control.

## Target Behavior

The CI test gate omits expensive comparison oracles only when event and changed-path evidence prove they cannot affect the candidate result.

## Full-card cold-start reads

- `memory/SPEC.md` — D1-K and Verification Design, especially Verification Commands and Verification Policy
- `memory/PLAN.md` — Comparison lane context and completed `brownfield-comparison-cases` / prospect regression work
- `AGENTS.md` — verification commands, slow-test eligibility, and CI authority
- `src/dev/TOPOLOGY.md` — Brownfield Comparison Oracles and Prospect Research Regression Case
- `docs/praxis/comparison-runs.md` — unchanged controller-oracle discipline and retained comparison evidence
- `.github/workflows/test.yml` and `package.json` — current single-job sequencing and test-lane commands
- GitHub Actions PR #377 runs `30086902794`, `30087817994`, and `30088392996` — observed catch, rerun cost, and comparison-oracle timings

## Boundary Crossings

```text
GitHub pull-request or merge-group event
→ complete base/head changed-path evidence
→ fail-open test-lane selector
→ always-required static, build, default-test, and non-comparison slow-test gates
→ conditionally-required expensive comparison-oracle lane
→ stable Full gate check result
```

## Risks and Assumptions

- RISK: a shared runtime, harness, dependency, lockfile, workflow, or test configuration change is mistaken for documentation-only work → MITIGATION: omission uses a closed non-runtime allowlist; every unknown, missing, renamed-across-boundary, or non-allowlisted path selects the comparison lane.
- RISK: `pull_request` and `merge_group` expose different refs or incomplete history → MITIGATION: keep full checkout history, test event/ref resolution as a pure function, and select comparison on any diff acquisition failure.
- RISK: splitting the command inventory silently drops or double-runs tests → MITIGATION: add an executable inventory contract and keep `test:full` as the local composition that runs every lane exactly once.
- RISK: changing workflow step conditions weakens the required branch-protection status → MITIGATION: retain one stable required `Full gate` job; skipped comparison work is an internal lane decision, never a skipped required job.
- RISK: the 160.6-second prospect oracle remains in the four-worker default lane and bypasses conditional routing → MITIGATION: reclassify it as an expensive comparison oracle in the same cutover.
- ASSUMPTION: a closed allowlist can identify changes that cannot alter shipped runtime, build output, test infrastructure, or comparison-controller behavior.
  → IMPACT IF FALSE: an affected comparison regression could merge without its owning oracle running on the pull-request head.
  → VALIDATE: table-driven path-classification rivals, unconditional merge-group selection, and a full-suite inventory contract.
  → D1-K adopts the fail-open closed-allowlist policy.

## Posture check

- Lights up: one deterministic path from GitHub event and complete diff evidence to an auditable comparison-lane decision inside the existing required check.
- Stabilizes: CI remains fail-open, merge-group entries remain fully gated, and local `test:full` continues to mean every test.
- Retires: whether an unrelated non-runtime pull-request update can avoid the comparison-oracle cost without weakening the authoritative pre-merge gate.

## Acceptance Criteria

✓ `scripts/ci-test-lanes.test.mjs` — every `merge_group` input selects the expensive comparison lane regardless of paths.

✓ `scripts/ci-test-lanes.test.mjs` — a pull-request diff containing only closed allowlisted non-runtime paths omits the comparison lane.

✓ `scripts/ci-test-lanes.test.mjs` — runtime, comparison, test, fixture, package, lockfile, workflow, build-configuration, unknown, incomplete-diff, and allowlist-boundary rename rivals all select the comparison lane.

✓ `scripts/comparison-test-inventory.test.mjs` — every current full-stack comparison oracle belongs to the comparison lane exactly once, including the prospect workspace oracle, while non-comparison slow tests remain in the mandatory PR lane.

✓ `scripts/test-workflow.contract.test.mjs` — `.github/workflows/test.yml` obtains complete diff evidence, fails open to comparison, always runs static/build/default/non-comparison-slow gates, conditions only the expensive comparison lane for pull requests, and selects it unconditionally for merge groups.

✓ `npm run test:comparison` — the extracted comparison-oracle lane runs all retained known-good and contrastive oracle coverage successfully.

✓ `npm run test:full` — default, non-comparison slow, and comparison lanes compose to run the complete suite successfully with no excluded or duplicate test file.

✓ GitHub Actions workflow run — a controlled non-runtime-only pull request keeps the stable `Full gate` check green without executing the comparison command, while a comparison-path control executes it.

## Invariants preserved

- No comparison oracle or contrastive rival is deleted or weakened — guarded by `scripts/comparison-test-inventory.test.mjs` and `npm run test:full`.
- The slow slice-integration test that caught PR #377’s foreign-worktree mismatch remains in the mandatory PR gate — guarded by the inventory contract and `npm run test:slow:core`.
- Merge-queue candidates run every test with no path-based omission — guarded by lane-selector and workflow contract tests.
- Diff uncertainty increases verification rather than reducing it — guarded by malformed/missing/rename rival cases in `scripts/ci-test-lanes.test.mjs`.
- `test:full` retains its canonical meaning for local verification and CI controls — guarded by the package-script inventory contract.
- One stable `Full gate` status remains the branch-protection surface — guarded by `scripts/test-workflow.contract.test.mjs`.

## Verification Approach

- Inner: table-driven pure selector and explicit test-inventory contract tests prove conservative routing and exact lane membership.
- Middle: workflow contract tests prove event/ref wiring, fail-open behavior, mandatory lane execution, and stable check topology without spending oracle runtime.
- Outer: two controlled GitHub Actions runs—one allowlisted non-runtime diff and one comparison-path control—prove actual skip/run behavior; this card owns that evidence and it must be captured before completion.

## Cross-cutting obligations

- Materialize D1-K consistently; do not leave `AGENTS.md` or `CONTRIBUTING.md` claiming every pull-request event runs `test:full`.
- Comparison-controller identity, known-good fixtures, and contrastive rivals remain unchanged; this slice changes scheduling only.
- Merge-group verification remains the unconditional authoritative full gate.
- Path classification is fail-open and inspectable; do not adopt a heuristic dependency graph or positive “relevant paths” list in this slice.
- Keep the comparison-lane extraction separate from fail-fast, sharding, caching, or scenario reduction so its safety and measured impact remain attributable.

## Expected touched paths (tentative)

```text
.github/workflows/test.yml                                      ~
package.json                                                   ~
scripts/
├── ci-test-lanes.mjs                                          +
├── ci-test-lanes.test.mjs                                     +
├── comparison-test-inventory.test.mjs                         +
└── test-workflow.contract.test.mjs                             +
src/dev/execution-comparison/__tests__/
├── prospect-research-workspace-oracle.test.ts                  -
└── prospect-research-workspace-oracle.slow.test.ts             +
AGENTS.md                                                       ~
CONTRIBUTING.md                                                 ~
```
