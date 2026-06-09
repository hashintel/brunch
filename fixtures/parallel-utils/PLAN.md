<!-- PLAN.md — what's next for the `parallel-utils` demo-fixture PRODUCT.
     Created by ln-plan · companion to fixtures/parallel-utils/SPEC.md.

     SCOPE NOTE — this is NOT brunch's canonical plan. brunch's plan lives at
     memory/PLAN.md and is untouched. This standalone plan re-derives the fan-out shape
     of the hand-authored cook plan (fixtures/parallel-utils/plan.yaml) from the reversed
     SPEC, so the same library can be driven SPEC → PLAN → cook and reproduce a similar
     parallel build. The cook `plan.yaml` is the slice-level projection of this plan. -->

# Plan — parallel-utils

## Context

Round-trip target: a zero-dependency TS utility library whose value is its *shape* — one
shared scaffold prerequisite, then N genuinely independent leaves that fan out and execute
concurrently under `brunch cook --policy=parallel`. The spec was reversed out of the existing
hand-authored `plan.yaml`; this plan recovers the frontier shape that produces it. Two
frontier items only: a scaffold prerequisite, then the utility fan-out (8 leaf slices + a
barrel integration gate). The next bottleneck is scaffold — until it lands, no leaf can fire;
once it lands, all 8 leaves are eligible at once. Keeping the leaves independent (no util→util
edge) is the whole point — that's what the parallel run demonstrates.

## Sequencing

### Active

1. `library-scaffold` — not-started — package.json / tsconfig / empty barrel; the sole shared prerequisite.

### Next

1. `utils-fan-out` — follows scaffold; the 8 independent leaves + barrel integration gate. This is the headline fan-out.

### Parallel / Low-conflict

- (none) — by design. Within `utils-fan-out` the 8 leaf slices are mutually independent and run in parallel, but they all wait on `library-scaffold`.

### Horizon

- `more-utils` — additional independent leaves added the same way (one module + one test + one barrel re-export, `depends_on: [scaffold]`). Loose; widens the fan-out without serialising.

## Frontier Definitions

### library-scaffold

- **Name:** Library scaffold (shared prerequisite)
- **Linear:** unassigned (demo-fixture product; not tracked in FE)
- **Kind:** structural
- **Status:** not-started
- **Objective:** Establish `package.json` (`"type": "module"`, `bun test`), `tsconfig.json`, and `src/index.ts` as an initially-empty barrel. This is the only slice every leaf depends on.
- **Why now / unlocks:** Nothing can fan out until the package + barrel exist; this is the single gate before the parallel burst. Keeping it the *only* shared prerequisite is what preserves pure fan-out.
- **Acceptance:** `bunx tsc --noEmit` passes on an empty barrel; scaffold test asserts `dependencies` is empty (I4-K).
- **Verification:** inner — scaffold unit test + typecheck; no integration yet.
- **Traceability:** → SPEC R1; D3-K (bun/ESM/zero-dep); I4-K (zero dependencies).

### utils-fan-out

- **Name:** Independent utility leaves + barrel composition
- **Linear:** unassigned
- **Kind:** bounded feature
- **Status:** not-started
- **Objective:** Add the 8 independent utilities, each its own module + single unit test + one barrel re-export, then prove they compose through the barrel. Each leaf `depends_on: [scaffold]` and nothing else — no util→util edges.
- **Why now / unlocks:** This is the fan-out the whole product exists to demonstrate. Under `--policy=parallel --agentPoolSize=3` the 8 leaves drain and refill `pool:code-agent`; the serial-vs-parallel wall-clock delta is the result.
- **Leaf slices (mutually independent, the fan-out — kept on this frontier, not fragmented into separate plan entries):** `chunk` · `unique` · `group-by` · `debounce` · `retry` · `clamp` · `slugify` · `deep-equal`. Epic gate slice: `barrel-integration`.
- **Acceptance:** all 8 unit tests green; `tests/barrel.integration.test.ts` green in the merged `__epic__/utils/` tree; no utility module imports another (I1-K); each leaf re-exported exactly once (I2-K).
- **Verification:** inner — per-leaf TDD red→green (`bun test tests/<name>.test.ts`); middle — barrel integration test on merged tree; outer — parallel cook run showing concurrent firings (I5-K), owned by ln-oracles.
- **Traceability:** → SPEC R2–R10; D1-K (file-disjoint single export), D2-K (scaffold-only dependency), D4-K (one oracle per slice); I1-K, I2-K, I3-K, I5-K. Open assumptions A1-K (unique equality), A2-K (debounce trailing edge) resolve inside their leaf slices.

## Recently Completed

- (none yet — fresh round-trip plan.)

Older history: n/a (standalone product; no archive).

## Dependencies

```text
library-scaffold ──┬──> chunk ───────┐
                   ├──> unique        │
                   ├──> group-by      │
                   ├──> debounce      │
                   ├──> retry         ├──> barrel-integration   (epic `utils` gate)
                   ├──> clamp         │
                   ├──> slugify       │
                   └──> deep-equal ───┘

  (utils-fan-out frontier)        all 8 leaves parallel-eligible
                                  once scaffold completes — no util→util edges
```
