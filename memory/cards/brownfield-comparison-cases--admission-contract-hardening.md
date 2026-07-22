# Harden historical replay admission contracts

Frontier: brownfield-comparison-cases
Status:   done
Mode:     single
Created:  2026-07-22

Posture: proving (inherited from `brownfield-comparison-cases`).

## Objective

Historical replay admission enforces D136-L and D137-L without rejecting declared dependency artifacts or defaulting an undecided pinned case.

## Cold-start reads

- `memory/SPEC.md` — D136-L and D137-L
- `memory/PLAN.md` — frontier `brownfield-comparison-cases`
- `src/dev/TOPOLOGY.md` — Historical Replay Isolation
- `memory/cards/brownfield-comparison-cases--historical-replay-target-admission.md` — completed tracer and preserved invariants
- `src/dev/execution-comparison/historical-replay-target.ts` — dependency selection and deep-operation composition
- `src/dev/end-to-end-comparison/solution-isolation.ts` — final-prefix cleanliness and network probes

## Acceptance Criteria

```text
admission contract hardening
├── ✓ historical-replay-target.test.ts — a dependency recipe may leave untracked artifacts while tracked source remains clean
├── ✓ historical-replay-target.test.ts — tracked dependency mutation still fails during dependency_preparation
├── ✓ historical-replay-target.test.ts — a branded verifier that reaches a required network probe fails during admission with network_probe_reachable
├── ✓ historical-replay-target.test.ts + TypeScript build — every pinned case id has one explicit code-owned dependency recipe and no default branch
├── ✓ solution-isolation.test.ts — packet drift, third commits, remotes, refs, and tracked worktree mutation remain rejected
└── ✓ card/link check — completed Petrinaut evidence points to the live historical-replay tests rather than deleted preparation tests
```

## Completion evidence

| Leaf | Outcome | Evidence |
| ---- | ------- | -------- |
| Non-ignored untracked dependency artifacts remain admissible | met | `historical-replay-target.test.ts` runs the compiled Petrinaut install seam, leaves `.pnp.cjs` untracked, and reaches Claude readiness; final admission now asks Git only for tracked worktree changes |
| Tracked source or packet mutation still fails | met | the Petrinaut tracked-package rival fails in `dependency_preparation`; packet drift fails in `admission`; `solution-isolation.test.ts` now mutates tracked `package.json` and retains `git_worktree_changes_present` |
| Reachable required network probe prevents readiness | met | a deep-operation branded-verifier rival reaches `https://github.com`, fails in `admission` with `network_probe_reachable`, returns no descriptor, and removes the owned target |
| Every pinned case id has one explicit code-owned recipe | met | `PinnedExecutionCaseId` projects the contract owner union; `DEPENDENCY_RECIPE_BY_PINNED_CASE satisfies Record<...>` names Brunch `none` and Petrinaut immutable Yarn with no default; the TypeScript production build passes |
| Existing topology and isolation rivals remain rejected | met | focused historical-replay and solution-isolation suites retain wrong-parent, packet-drift, third-commit, remote/ref, tracked-worktree, path/symlink, policy, brand, and host rejection |
| Petrinaut evidence points to live tests | met | the completed Petrinaut card now cites `historical-replay-target.test.ts` and `solution-isolation.test.ts`; no `pinned-source-preparation.test.ts` reference remains |

Untracked-artifact red: `npm test -- src/dev/execution-comparison/__tests__/historical-replay-target.test.ts -t "admits non-ignored untracked Petrinaut"` — 1 failed in `admission` with `git_worktree_changes_present` for `?? .pnp.cjs`. Green: the same command — 1 passed, 12 skipped by the name filter.

Reachable-network sensitivity red: with the required `https://github.com` probe temporarily removed, `npm test -- src/dev/execution-comparison/__tests__/historical-replay-target.test.ts -t "branded verifier reaches a required network probe"` — 1 failed because preparation incorrectly resolved `ready`. Green after restoring the required probe: the same command — 1 passed, 14 skipped by the name filter.

Exhaustive-map red: a temporary source sentinel failed while the production module still used the Petrinaut type guard/default-none branch. After the exhaustive `satisfies Record<PinnedExecutionCaseId, ...>` map and runtime coverage for both current cases landed, the sentinel was removed as a representation lock; the TypeScript production build is the durable exhaustiveness oracle.

Focused green before representation-only sentinel removal: `npm test -- src/dev/execution-comparison/__tests__/historical-replay-target.test.ts src/dev/execution-comparison/__tests__/operator-cli.test.ts src/dev/end-to-end-comparison/__tests__/solution-isolation.test.ts src/dev/end-to-end-comparison/__tests__/execution-adapters.test.ts src/dev/end-to-end-comparison/__tests__/case-profile.test.ts src/dev/execution-comparison/__tests__/case-contract.test.ts src/dev/execution-comparison/__tests__/brunch-lane.test.ts` — 7 files, 45 tests passed.

Checkpoint green after refactor: `npm run verify:full` — default 328 files/2,572 tests passed with 1 file/2 tests skipped; slow 9 files/68 tests passed; TypeScript and production builds passed. `npm run check` and `git diff --check` passed.

Remaining provider-preflight debt: resolve the declared commit/tree against a real HASH checkout, run the real immutable install and retain its exact result, then prove the focused standalone `/optimization` route reaches setup-valid readiness before interpreting any candidate outcome. The separately named `/processes/draft` host/iframe evidence remains non-gating.

## Verification Approach

- **Inner:** contrastive deep-operation tests for allowed untracked dependency output, forbidden tracked mutation, reachable network, and exhaustive case-recipe selection.
- **Middle:** existing solution-isolation adversarial suite and full D137 historical-replay target suite.
- **Outer:** none for this hardening slice. The first fresh Petrinaut provider preflight owns actual HASH commit/tree resolution, real immutable install, and focused-route setup validity before any result is interpreted.
- **Checkpoint:** `npm run verify:full`, `npm run check`, `git diff --check`, and skipped-test delta versus `20709cdd`.

## Cross-cutting obligations

- Dependency preparation remains one compiled recipe; public contracts and manifests never supply commands.
- Only controller-owned pre-lane preparation may create dependency artifacts; source and packet files remain immutable.
- Production composition still creates the real fail-if-unavailable verifier; test composition may inject only a branded verifier factory.
- Setup rejection remains separate from candidate assertion failure.
- Brunch no-install behavior, strict asymmetric policies, no-landing, and the sole greenfield Petri path remain unchanged.

## Assumption dependency

None — this slice reconciles two already-settled decisions and adds the missing adversarial oracle.

## Explicitly Out

- A real HASH checkout/install/browser run; owned by the next provider preflight.
- General dependency plugins, persisted phase receipts, or a third brownfield case.
- Broader oracle registry or replay-module refactoring.

## Expected touched paths (tentative)

```text
memory/
├── PLAN.md                                                                      ~
└── cards/
    ├── brownfield-comparison-cases--admission-contract-hardening.md
    ├── brownfield-comparison-cases--historical-replay-target-admission.md       ~
    └── brownfield-comparison-cases--petrinaut-optimization-case-oracle.md       ~
src/dev/
├── TOPOLOGY.md                                                                  ~
├── end-to-end-comparison/
│   ├── solution-isolation.ts                                                    ~
│   └── __tests__/solution-isolation.test.ts                                     ~
└── execution-comparison/
    ├── historical-replay-target.ts                                              ~
    └── __tests__/historical-replay-target.test.ts                               ~
```
