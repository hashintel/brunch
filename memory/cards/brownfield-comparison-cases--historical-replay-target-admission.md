# Admit lane-ready historical replay targets

Frontier: brownfield-comparison-cases
Status:   done
Mode:     single
Created:  2026-07-22

Posture: proving (inherited from `brownfield-comparison-cases`).

## Orientation

- **Containing seam:** D137-L historical replay preparation/admission between frozen case selection and Brunch/Claude execution launch.
- **Frontier:** FE-1241 `brownfield-comparison-cases`; keep this work on `ka/fe-1241-brownfield-comparison-cases`.
- **Volatile state:** the Petrinaut profile/oracle and pinned Brunch graph seed are built; review found `admitHistoricalReplay` test-only, one-commit-only, and absent from the production prepare path.
- **Main risk:** weakening A49-L while reconciling its source-materialization proof with FE-1239's separate exact-handoff commit.

## Target Behavior

Every pinned brownfield execution lane is returned only after D137-L's deep operation admits its complete declared synthetic prefix.

## Cold-start reads

- `memory/SPEC.md` — A49-L retirement clarification; D136-L; D137-L
- `memory/PLAN.md` — frontier `brownfield-comparison-cases`
- `src/dev/TOPOLOGY.md` — Historical Replay Isolation and Brownfield Comparison Oracles
- `src/dev/end-to-end-comparison/solution-isolation.ts` — current admission checks and one-commit mismatch
- `src/dev/end-to-end-comparison/pinned-source-preparation.ts` — current two-commit preparation and dependency install
- `src/dev/execution-comparison/operator-cli.ts` — current Petrinaut-only pinned dispatch
- `src/dev/end-to-end-comparison/{brunch-adapter,claude-adapter}.ts` — current greenfield execution launch adapters

## Boundary Crossings

```text
→ frozen case contract + lane + source/target/controller/forbidden roots
→ compile-time historical-replay profile resolution
→ pinned source root commit
→ exact packet-only handoff child commit
→ case-owned dependency preparation or explicit no-op
→ strict policy-pair and runtime-boundary admission
→ lane finalization
→ BrunchReady { baseSha, specId, launch } | ClaudeReady { baseSha, launch }
```

## Completion evidence

| Leaf | Outcome | Evidence |
| ---- | ------- | -------- |
| One source root plus one packet-only child is admitted | met | `historical-replay-target.test.ts` known-good temporary Git fixture; `solution-isolation.test.ts` two-commit admission |
| `HEAD` and returned `baseSha` equal the handoff child | met | `historical-replay-target.test.ts` exact `HEAD`, parent, count, and packet-delta assertions |
| Wrong parent, packet drift, or third commit rejects before readiness | met | `historical-replay-target.test.ts` production-operation rivals retain admission reasons and remove the partial target |
| Brunch host landing performs no dependency install | met | self-contained Brunch production-operation test supplies a fail-if-called install runner and reaches readiness |
| Petrinaut selects only immutable Yarn install and rejects tracked mutation | met | self-contained synthetic pinned-Git tests assert exact `corepack yarn install --immutable --mode=skip-build`, admit its non-ignored untracked dependency artifact under D136-L, and fail tracked mutation in `dependency_preparation` |
| Strict policy/path/network/ref/symlink isolation prevents readiness | met | production-operation reachable-network, remote/ref, symlink, and forbidden-root rivals plus `solution-isolation.test.ts` weakened-policy, readable-root, tracked-worktree, network, and branded-verifier rivals |
| Pinned production callers cannot bypass the deep operation | met | `operator-cli.ts` dispatches every parsed `pinned_git` contract to `prepareHistoricalReplayTarget`; obsolete half-ready preparation module/export removed |
| Brunch returns positive brownfield Execute-plan-ready `specId` | met | self-contained target test queries the exact handoff requirement, projects brownfield Execute state, and passes `assertExecuteProjectionPlanReady` |
| Claude has no `specId` and carries strict launch policy | met | production dispatch test asserts the lane discriminator, strict policy, empty MCP/settings/plugins/network allowance, and absence of `specId` |
| Ready descriptor reaches execution while Petri remains unchanged | met-with-divergence | The Claude runner directly consumes the ready descriptor and retains output from the packet-child `baseSha`; Brunch readiness carries its adapter-produced launch descriptor; no automatic pinned actor-recipe dispatcher is implemented or claimed; greenfield `execution-adapters.test.ts` remains green |
| Linux CI can exercise the production operation without weakening production defaults | met | every deep-operation test injects a factory whose verifier is branded by `createNetworkDeniedCommandRunner`; the portability oracle executes the complete ready path with a process-independent sandbox fake, raw substitution rejects, and the default unsupported-host oracle remains fail-closed |
| Setup rejection is structured and leaves no launchable partial target | met | `HistoricalReplayTargetPreparationError` carries `status`, `phase`, and admission reasons; failure tests prove owned-target removal and pre-existing-target preservation |

Portability red: `npm test -- src/dev/execution-comparison/__tests__/historical-replay-target.test.ts -t "injected branded verifier factory"` — 1 failed because the production operation ignored the injected factory (`expected 0 to be 1`).

Portability green: the same command — 1 passed, 12 skipped by the name filter. The paired unsupported-host oracle also passed: `npm test -- src/dev/end-to-end-comparison/__tests__/solution-isolation.test.ts -t "fails closed when the host cannot provide"` — 1 passed, 3 skipped by the name filter.

Focused green: `npm test -- src/dev/execution-comparison/__tests__/historical-replay-target.test.ts src/dev/execution-comparison/__tests__/operator-cli.test.ts src/dev/end-to-end-comparison/__tests__/solution-isolation.test.ts src/dev/end-to-end-comparison/__tests__/execution-adapters.test.ts src/dev/end-to-end-comparison/__tests__/case-profile.test.ts src/dev/execution-comparison/__tests__/case-contract.test.ts src/dev/execution-comparison/__tests__/brunch-lane.test.ts` — 7 files, 43 tests passed.

Checkpoint green: `npm run verify:full` — default 328 files/2,571 tests passed with 1 file/2 tests skipped; slow 9 files/68 tests passed; build passed. `npm run check` and `git diff --check` passed. Skipped-test delta versus `20709cdd`: 0 changed `.skip`/`.todo` markers.

## Risks and Assumptions

- **RISK:** changing `commitCount === 1` to `2` could admit arbitrary synthetic history.
  - **MITIGATION:** validate the exact root/child relationship, source identity, packet-only child delta, `HEAD === baseSha`, and absence of any third commit.
- **RISK:** generalizing pinned dispatch could run Petrinaut's install for Brunch host landing.
  - **MITIGATION:** an exhaustive code-owned map gives every pinned case id exactly one `none` or `petrinaut-yarn-immutable-v1` recipe with no default; the public contract never supplies commands.
- **RISK:** tests could pass only because the developer has a sibling HASH checkout.
  - **MITIGATION:** the admission tracer must use self-contained temporary Git fixtures at the deep-module boundary; optional real-repository evidence cannot be the only oracle.
- **ASSUMPTION:** the exact-handoff child can remain independently attributable while the two commits are admitted as one closed synthetic prefix.
  - **IMPACT IF FALSE:** D137-L's selected shape fails and preparation must collapse to one commit or adopt a different execution-base model.
  - **VALIDATE:** one known-good two-commit fixture plus packet-drift, wrong-parent, and third-commit rivals through the production operation.
  - **SPEC:** settled by D137-L; this slice is the falsifier.

## Posture check

This tracer scores on all three proving axes:

- **Proof of life:** a prepared pinned target reaches a real lane launch descriptor only through production admission.
- **Invariant:** A49-L isolation is enforced over the final execution base rather than a pre-handoff intermediate.
- **Uncertainty:** contrastive Git-topology rivals can falsify D137-L before provider work.

No spike is cheaper: the production slice itself is a temporary-repository experiment with no provider, browser, or external service.

## Acceptance Criteria

```text
historical replay target
├── declared prefix
│   ├── ✓ historical-replay-target.test.ts — one source root plus one packet-only child is admitted
│   ├── ✓ historical-replay-target.test.ts — HEAD and returned baseSha equal the handoff child
│   └── ✓ historical-replay-target.test.ts — wrong parent, packet drift, or any third commit fails before lane readiness
├── closed preparation
│   ├── ✓ historical-replay-target.test.ts — Brunch host landing performs no dependency install
│   └── ✓ historical-replay-target.test.ts — Petrinaut selects exactly corepack yarn install --immutable --mode=skip-build and rejects tracked mutation
├── strict isolation
│   ├── ✓ historical-replay-target.test.ts — weakened policy, readable forbidden root, reachable network probe, remote/ref, or escaping symlink prevents a ready result
│   └── ✓ production-call-site guard — no pinned production caller can bypass the deep operation for a half-ready workspace
├── lane finalization
│   ├── ✓ historical-replay-target.test.ts — Brunch returns a positive specId whose exact spec graph is brownfield and Execute-plan ready
│   ├── ✓ historical-replay-target.test.ts — Claude returns no specId and carries the strict launch policy
│   └── △ execution adapters — Claude directly consumes its ready descriptor and Brunch carries adapter-produced launch metadata; no automatic actor-recipe dispatcher is claimed; Petri greenfield remains unchanged
└── failure hygiene
    └── ✓ historical-replay-target.test.ts — rejection retains structured phase/reason evidence and leaves no launchable partial target
```

## Invariants preserved

- Exact approved `spec.md` and `public-contract.json` bytes cross unchanged — guarded by: existing handoff/public-packet tests plus `historical-replay-target.test.ts`.
- No historical source refs, remotes, solution services, controller roots, or case-private oracle material become target-reachable — guarded by: `solution-isolation.test.ts` and the new production-path rivals.
- Brunch and Claude retain their asymmetric strict policies; neither is reduced to a lowest-common-denominator sandbox — guarded by: `solution-isolation.test.ts` and launch-descriptor assertions.
- Brunch stops at `promotion_prepared` and never lands provider output into a source repository — guarded by: existing execution-adapter and no-landing suites.
- `ExecutionAttempt` remains unchanged — guarded by: existing end-to-end matrix/attempt tests.
- Minimal Petri remains the sole greenfield case and its preparation path remains byte-identical — guarded by: existing case-profile and execution-adapter tests.
- Stop the line: a red on exact handoff bytes, controller isolation, strict policy shape, or no-landing is a respec signal, not a fixture update.

## Verification Approach

- **Inner:** self-contained temporary-Git state-machine rivals through the public deep operation; focused case-policy, operator, adapter, and launch-descriptor tests.
- **Middle:** existing full solution-isolation adversarial suite plus pinned Brunch graph/preflight integration; no provider invocation.
- **Outer:** none for this infrastructure slice. FE-1241 owns the later fresh Petrinaut provider matrix and separately named host-integration evidence after this admission gate closes.
- **Checkpoint:** `npm run verify:full`, `npm run check`, `git diff --check`, and skipped-test delta versus `20709cdd`.

## Cross-cutting obligations

- D137-L exposes one deep operation, not a public phase machine or serializable security token.
- Dependency commands remain code-owned and case-closed; no manifest command/plugin escape hatch.
- Admission validates exactly one strict Claude/Brunch policy pair even though the returned descriptor is lane-specific.
- Setup rejection remains distinct from candidate assertion failure and happens before provider work.
- Failed/invalid evidence remains inspectable while incomplete targets cannot be launched.

## Explicitly Out

- Real Petrinaut provider runs, full HASH `/processes/draft`, and optional real optimizer evidence.
- Closing the separate review finding that the synthetic Petrinaut browser fixture does not prove the real pinned HASH route.
- General replay plugins, resumable persisted phase engines, arbitrary dependency recipes, or a third brownfield case.
- Refactoring the oracle registry or unrelated cleanup/retry infrastructure.

## Expected touched paths (tentative)

```text
memory/
├── SPEC.md                                                          ~
├── PLAN.md                                                          ~
└── cards/brownfield-comparison-cases--historical-replay-target-admission.md
src/dev/
├── TOPOLOGY.md                                                      ~
├── end-to-end-comparison.ts                                        ~
├── end-to-end-comparison/
│   ├── solution-isolation.ts                                       ~
│   ├── pinned-source-preparation.ts                                -|~
│   ├── brunch-adapter.ts                                           ~
│   ├── claude-adapter.ts                                           ~
│   └── __tests__/
│       ├── solution-isolation.test.ts                              ~
│       └── execution-adapters.test.ts                              ~
└── execution-comparison/
    ├── historical-replay-target.ts                                 +
    ├── historical-replay-target/                                   ?
    ├── case-contract.ts                                            ~
    ├── operator-cli.ts                                             ~
    ├── brunch-lane.ts                                              ~
    └── __tests__/
        ├── historical-replay-target.test.ts                         +
        └── operator-cli.test.ts                                     ~
```
