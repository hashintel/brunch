<!-- SPEC.md — live architecture register for the `parallel-utils` demo-fixture PRODUCT.
     Created by ln-spec · Read by all skills · Refreshed by ln-sync.

     SCOPE NOTE — this is NOT brunch's canonical spec. brunch's product spec lives at
     memory/SPEC.md. This file specs the standalone greenfield product that the
     `brunch cook` fixture at fixtures/parallel-utils/plan.yaml builds: a zero-dependency
     TypeScript utility library. It exists to round-trip that hand-authored plan back up
     into a reviewable spec, so the same library can be driven forward SPEC → ln-plan →
     cook and reproduce a similar fully-parallel fan-out build.

     Companion artifacts:
       - fixtures/parallel-utils/plan.yaml ......... the hand-authored cook plan (the thing reversed)
       - docs/design/orchestrator-demo-fixtures.md . the fixture-set design + demo knobs -->

# parallel-utils — a zero-dependency TypeScript utility library

## Product Contract

### Concept

`parallel-utils` is a small, bun-tested TypeScript library of independent, pure utility
functions. Each utility lives in its own module and is re-exported through a single barrel
(`src/index.ts`). There is no inter-utility coupling: every function stands alone.

The library exists as the **build target of a parallel-execution round-trip**. Its value is
not novel functionality (these are ordinary `chunk`/`unique`/`debounce`-style helpers) but
its *shape*: a single shared scaffold prerequisite followed by N genuinely independent
leaves. That shape is the product's reason for being — it is what lets a Petri-net
orchestrator fire many slices at once where a linear agent loop must grind them one by one.

**Success** is structural, not just functional: a spec that, when planned (`ln-plan`) and
cooked (`brunch cook --policy=parallel`), re-derives the fixture's pure fan-out — one
`scaffold` prerequisite, then 8 leaves that depend only on `scaffold` and never on each other
— so the orchestrator's pool drains and refills and the serial-vs-parallel wall-clock delta
appears. The functions all passing is necessary; reproducing the *parallelism* is the point.

### Constraints & Non-goals

- **Zero runtime dependencies.** No third-party packages in `dependencies`.
- **ESM only** (`"type": "module"`), TypeScript source.
- **`bun test` is the only test runner.** No jest/vitest/node:test.
- **No inter-utility imports.** A utility module must not import another utility module; the
  only shared touch-point is the barrel re-exporting them.
- **No util→util build dependency.** Every utility depends solely on `scaffold`. Any
  utility-to-utility edge serialises the build and is therefore out of contract.
- **No runtime I/O, no global mutable state.** Functions are pure (or, for `debounce`,
  closure-local) and deterministic under fake timers.
- **Fixed surface.** Exactly the 8 utilities below — not a general lodash replacement.
- **No bundling/publish/release pipeline.** Source + tests only; "build" means it typechecks.

### Capability Requirements

#### Scaffolding

1. Provide `package.json` (`"type": "module"`, `bun test` script), `tsconfig.json`, and
   `src/index.ts` as a barrel that re-exports every utility. The barrel starts empty; each
   utility adds its own re-export. This is the sole prerequisite all leaves share.

#### Utilities (each its own module + own test, mutually independent)

2. `chunk<T>(arr: T[], size: number): T[][]` — split into size-N groups (last group may be
   shorter); `size <= 0` throws. (`src/chunk.ts`)
3. `unique<T>(arr: T[]): T[]` — elements in first-seen order, duplicates removed under
   SameValueZero equality. (`src/unique.ts`)
4. `groupBy<T>(arr: T[], key: (x: T) => string): Record<string, T[]>`. (`src/group-by.ts`)
5. `debounce<F extends (...a: any[]) => void>(fn: F, ms: number): F` — delay invocation until
   `ms` after the last call (trailing edge). (`src/debounce.ts`)
6. `retry<T>(fn: () => Promise<T>, times: number): Promise<T>` — retry a rejecting promise up
   to `times` times before rejecting with the last error. (`src/retry.ts`)
7. `clamp(n: number, min: number, max: number): number` — throws if `min > max`. (`src/clamp.ts`)
8. `slugify(s: string): string` — lowercase, non-alphanumerics → single dash, collapse
   repeats, trim leading/trailing dashes. (`src/slugify.ts`)
9. `deepEqual(a: unknown, b: unknown): boolean` — structural equality for plain objects,
   arrays, and primitives. (`src/deep-equal.ts`)

#### Composition

10. Importing the barrel exposes all 8 utilities; a single integration test exercises the
    merged surface (proves the leaves actually compose in the assembled tree).

## Live Architecture Register

### Open Assumptions

| # | Assumption | Confidence | Status | Depends on | Validation approach |
| --- | --- | --- | --- | --- | --- |
| A1-K | SameValueZero is the intended equality for `unique` (so `NaN` dedupes and `+0`/`-0` collapse), rather than `===` or deep equality. | medium | open | R3 / I3-K | Unit test asserting `unique([NaN, NaN])` → `[NaN]` and `unique([+0, -0])` → one element. |
| A2-K | `debounce` needs only trailing-edge semantics (no leading-edge/immediate option) for the demo product. | medium | open | R5 / I3-K | Unit test with fake timers asserting the call fires once, `ms` after the last invocation. |
| A3-K | The orchestrator's epic merge (declaration-order, last-wins file copy) is safe here *because* leaves are file-disjoint, so no concurrent slice writes the same file. | high | open | D1-K / I1-K | Confirm each leaf writes a distinct `src/<name>.ts`; barrel edits are additive and owned by scaffold + each leaf's own export line. |

### Active Decisions

- **D1-K — One module per utility, file-disjoint, single named export; the barrel re-exports each.** This independence is what enables unbounded fan-out and side-steps the orchestrator's last-wins epic merge (two parallel slices writing the same file would clobber). Depends on: A3-K. Supersedes: —.
- **D2-K — `scaffold` is the only shared prerequisite; every utility `depends_on: [scaffold]` and nothing else.** Preserves pure fan-out. A util→util edge would serialise the demo and is excluded by contract. Depends on: D1-K. Supersedes: —.
- **D3-K — `bun test` runner, ESM, zero dependencies.** Keeps each leaf a single self-contained TDD pass with no install/build coupling between slices. Supersedes: —.
- **D4-K — Each utility owns exactly one unit-test oracle (`tests/<name>.test.ts`); the epic owns one integration oracle (`tests/barrel.integration.test.ts`).** One red→green target per slice keeps the mechanical lane (write-tests → write-code → run-tests) honest. Depends on: D1-K. Supersedes: —.

### Critical Invariants

| # | Invariant | Protected by | Proves |
| --- | --- | --- | --- |
| I1-K | No utility module imports another utility module (leaves are import-disjoint). | planned: import-graph assertion in `tests/barrel.integration.test.ts` (or lint rule) | D1-K, D2-K, R2–R9 |
| I2-K | Every utility is re-exported by the barrel exactly once; the barrel is the single composition point. | `tests/barrel.integration.test.ts` | R1, R10 |
| I3-K | Each utility's behaviour is pinned by exactly one unit test that fails before its module exists (genuine red→green). | `tests/<name>.test.ts` per leaf | D4-K, R2–R9 |
| I4-K | Zero runtime dependencies: `package.json` has an empty/absent `dependencies` field. | planned: scaffold unit test asserting no `dependencies` | constraint (zero-dep) |
| I5-K | Every leaf depends only on `scaffold` in the plan — no util→util edges — so all leaves are eligible to fire concurrently once `scaffold` completes. | planned: plan-shape check / cook run with `--policy=parallel` observing concurrent firings | D2-K, the parallelism capability |

## Future Direction Register

### Growing the library

- Adding a utility is adding one more independent leaf (`src/<name>.ts` + `tests/<name>.test.ts` + one barrel re-export) that `depends_on: [scaffold]`. Nothing serialises; fan-out widens. New utilities become PLAN frontier items when the work is taken up.

### Round-trip as a pattern

- This spec is the worked example of reversing a `brunch cook` `plan.yaml` back into a reviewable SPEC. The same reversal applies to the sibling fixtures (`layered-todo` for fan-out→join, `resilient-pipeline` for halt isolation). See `docs/design/orchestrator-demo-fixtures.md`.

## Lexicon

| Term | Definition |
| --- | --- |
| **barrel** | `src/index.ts`, which re-exports every utility; the library's single public entry and only composition point. |
| **leaf / utility slice** | One independent utility: its module (`src/<name>.ts`), its single unit test (`tests/<name>.test.ts`), and its one barrel re-export. |
| **scaffold** | The shared prerequisite slice: `package.json`, `tsconfig.json`, and the initially-empty barrel. The only thing every leaf depends on. |
| **fan-out** | The structural property that all leaves depend solely on `scaffold` and never on each other, making them concurrently executable. The product's reason for existing. |
| **epic / slice / `depends_on` / `verification`** | `brunch cook` plan terms. Epic = integration seam; slice = one behaviour; `depends_on` = genuine build-order only; `verification` = the slice's test oracle. See `docs/design/orchestrator-demo-fixtures.md`. |

## Verification Design

> These commands run **inside the generated product tree** (the cook worktree / merged
> `__epic__/utils/` tree), not at the brunch repo root. They are the parallel-utils
> product's own gate, distinct from brunch's `npm run verify`.

### Verification Commands

| Step | Check | Command |
| --- | --- | --- |
| 1 | Type checking | `bunx tsc --noEmit` |
| 2 | Unit tests (per leaf) | `bun test tests/<name>.test.ts` |
| 3 | Integration (barrel) | `bun test tests/barrel.integration.test.ts` |
| all | Full gate | `bun test && bunx tsc --noEmit` |

### Verification Policy

- **Inner loop (per leaf):** TDD red→green against the leaf's single unit test. The target
  module must genuinely not exist yet, so the orchestrator's `evaluate-done` returns
  "needs work" and the mechanical lane (`write-tests → write-code → run-tests`) actually
  fires. One test file per leaf — no shared test file across leaves.
- **Epic gate:** the barrel integration test runs in the merged `__epic__/utils/` tree and
  proves the independently-built leaves compose through the barrel (I2-K) and stay
  import-disjoint (I1-K).
- **Structural gate (the round-trip's real assertion):** a parallel cook run must show the
  leaves firing concurrently — `pool:code-agent` draining to zero and refilling — proving
  I5-K. This is the property that makes the reversed spec "achieve a similar result" to the
  hand-authored fixture, and it is verified at the outer loop (see `ln-oracles`).

### Acceptance Criteria

1. `ln-plan` over this SPEC produces a plan with exactly one `scaffold` prerequisite and 8
   leaves, each `depends_on: [scaffold]` and none depending on another leaf — i.e. it
   re-derives the fixture's fan-out shape, not a serial chain.
2. `brunch cook <plan> --policy=parallel --agentPoolSize=3 --petrinaut-stream` executes leaves
   concurrently: `pool:code-agent` drains to 0 and refills; wall-clock ≈ ⌈8/3⌉ × slice versus
   8 × slice under `--policy=serial`. The serial-vs-parallel delta is observable.
3. All 8 unit tests and the barrel integration test pass green in the merged tree.
4. No utility module imports another (I1-K) and `dependencies` is empty (I4-K).
