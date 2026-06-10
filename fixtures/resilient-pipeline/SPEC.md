<!-- SPEC.md — live architecture register for the `resilient-pipeline` demo-fixture PRODUCT.
     Created by ln-spec · Read by all skills · Refreshed by ln-sync.

     SCOPE NOTE — this is NOT brunch's canonical spec (memory/SPEC.md is untouched). This file
     specs the standalone greenfield product that the `brunch cook` fixture at
     fixtures/resilient-pipeline/plan.yaml builds: a small parse → transform → serialize data
     pipeline — one of whose slices is INTENTIONALLY contradictory. It exists to round-trip that
     hand-authored plan into a reviewable spec, so the same product can be driven SPEC → ln-plan
     → cook and reproduce the halt-isolation / unreachable-join story.

     READ THIS FIRST — unlike a normal spec, this product contains a deliberately unsatisfiable
     requirement (R3 / transform-b). That is a fixture DEVICE, not a defect. Do not "fix" it; the
     contradiction is the demonstration. See D1-K.

     Companion artifacts:
       - fixtures/resilient-pipeline/plan.yaml ..... the hand-authored cook plan (the thing reversed)
       - fixtures/resilient-pipeline/PLAN.md ....... the frontier-level plan recovered from this spec
       - docs/design/orchestrator-demo-fixtures.md . the fixture-set design + demo knobs -->

# resilient-pipeline — a parse → transform → serialize pipeline with a seeded halt

## Product Contract

### Concept

`resilient-pipeline` is a small CSV data pipeline: `parse` the input, `transform` it down two
independent branches, then `serialize` the result. The pipeline functions are ordinary; the
product's reason for being is **failure isolation under a Petri net**:

- one branch (`transform-b`) is seeded with an **intentionally contradictory** specification, so
  its TDD loop can never go green — it exhausts its rework / retry budget and deposits a **halt
  token** on `:halted`;
- the independent branch (`parse` → `transform-a`) **completes normally** — the halt does not
  propagate to work that doesn't depend on `transform-b`; and
- the join (`serialize`, which needs both branches) becomes **provably unreachable** — it never
  fires, because one of its two required upstream tokens never arrives. It is *waiting*, not
  *failed*.

A linear agent loop stalls ambiguously here; a Petri net draws the blocked frontier exactly.
**Success** is that, when planned and cooked with a low retry budget, the net shows `parse` +
`transform-a` reaching `done`, `transform-b` landing on `:halted`, and `serialize` waiting
forever — the live deadlock / reachability picture.

### Constraints & Non-goals

- **`transform-b` is intentionally unsatisfiable — do NOT fix it.** Its contradiction is the
  demonstration of halt isolation. "Making it pass" defeats the fixture's purpose (D1-K).
- **Failure must stay isolated.** The seeded halt may not break `parse` or `transform-a`; only
  the downstream cone that depends on `transform-b` (i.e. `serialize`) may be blocked.
- **In-memory, zero runtime dependencies, ESM, `bun test`** — the shared fixture substrate.
- **File-disjoint slices**, one module per slice; dependency edges encode genuine build-order
  only.
- **Keep the retry budget low** for the demo (`--max-retries=2` / a small `maxSemanticReworks`)
  so the halt is reached fast and deterministically.
- **Fixed surface.** Exactly the four modules below — not a general ETL framework.

### Capability Requirements

#### Pipeline (`pipeline` epic)

1. `src/parse.ts` — `parse(input: string): Record<string, string>[]` parsing simple CSV (header
   row + comma-separated rows) into row objects. The root. **Satisfiable.**
2. `src/transform-a.ts` — `selectColumns(rows, cols: string[])` returning each row narrowed to
   the given columns. Depends on `parse`. Independent of `transform-b`. **Satisfiable.**
3. `src/transform-b.ts` — `normalize(value: string): string` required to satisfy **both** of two
   mutually-exclusive criteria for every input: **(A)** return the value completely unchanged
   **and (B)** return it upper-cased. These cannot both hold. **Intentionally unsatisfiable —
   the seeded halt (a fixture device, see D1-K). Depends on `parse`.**
4. `src/serialize.ts` — `serialize(rows): string` rendering rows back to CSV, combining the
   outputs of `transform-a` and `transform-b`. **The join** — depends on both. Reachable in
   principle, but **provably unreachable in this fixture** because `transform-b` never completes.

### Live Architecture Register

### Open Assumptions

| # | Assumption | Confidence | Status | Depends on | Validation approach |
| --- | --- | --- | --- | --- | --- |
| A1-K | A low retry budget (`--max-retries=2` / small `maxSemanticReworks`) reliably drives `transform-b` to `:halted` quickly without flakiness, while still letting the satisfiable slices finish. | medium | open | D1-K / I1-K | Cook run at `--max-retries=2`: confirm `transform-b` halts within budget and `parse`/`transform-a` reach `done`. |
| A2-K | The orchestrator treats a halted upstream as "token never arrives" (serialize stays *waiting* / unreachable), not as a propagated failure that fails serialize outright. | high | open | D3-K / I3-K | Cook run: confirm `serialize` remains pending (no fire, no fail) rather than transitioning to a failed state. |

### Active Decisions

- **D1-K — `transform-b`'s verification encodes a genuine contradiction** (two mutually-exclusive criteria) so its TDD loop exhausts the rework/retry budget and deposits a halt token on `:halted`. This is a deliberate fixture device, not a defect; the contradiction is load-bearing. Supersedes: —.
- **D2-K — Failure is isolated to the halted slice's downstream cone.** `parse` and `transform-a`, being independent of `transform-b`, complete normally. The net keeps making progress everywhere the halt does not reach. Depends on: D1-K. Supersedes: —.
- **D3-K — `serialize` is the join depending on both `transform-a` and `transform-b`; it is provably *unreachable*, not *failed*.** Because `transform-b` never deposits a completion token, `serialize` is never enabled and waits forever. Reachability ≠ failure. Depends on: D1-K, D2-K. Supersedes: —.
- **D4-K — File-disjoint slices, one module + one unit-test oracle per slice; `bun test` / ESM / zero-dep substrate.** Shared with the rest of the fixture set. Supersedes: —.
- **D5-K — Halt speed is tuned via `--max-retries` / `maxSemanticReworks`, kept low for the demo.** Supersedes: —.

### Critical Invariants

| # | Invariant | Protected by | Proves |
| --- | --- | --- | --- |
| I1-K | `transform-b` never reaches `done`; after exhausting its rework budget it deposits a halt token on `:halted`. | planned: bounded-retry cook run; `transform-b`'s contradictory `tests/transform-b.test.ts` (unsatisfiable by construction) | D1-K, R3 |
| I2-K | `parse` and `transform-a` reach `done` regardless of `transform-b`'s halt — failure does not propagate to the independent subtree. | planned: cook run observing both reach `done` while `transform-b` halts | D2-K, R1, R2 |
| I3-K | `serialize` is provably unreachable: it never fires and never fails — it waits, because one of its two required upstream tokens never arrives. | planned: cook run / reachability check showing `serialize` pending indefinitely | D3-K, R4 |
| I4-K | Slices are file-disjoint; each satisfiable slice has exactly one unit-test oracle. | `tests/<slice>.test.ts` per slice | D4-K |

## Future Direction Register

### Maps to the simulation oracle (Phase 4)

- The unreachable-join / halt-frontier this fixture produces is exactly what `petri-simulation-oracle` (Phase 4, horizon) would flag, and what **resume-from-marking** would restart from once `transform-b`'s contradiction is lifted. Phase-4 core can build on these plans without Phase 3. See `docs/design/orchestrator-demo-fixtures.md`.

### Round-trip as a pattern

- The resilience entry in the `reverse-plan-fixtures-to-spec` set (`parallel-utils` = pure fan-out; `layered-todo` = fan-out→join + gate; this = halt isolation + unreachable join). Same reversal recipe across all three.

## Lexicon

| Term | Definition |
| --- | --- |
| **halt token / `:halted`** | The marking a slice deposits when it exhausts its rework/retry budget without going green; the slice stops, the net keeps running elsewhere. |
| **seeded contradiction** | An intentionally unsatisfiable slice spec (`transform-b`'s two mutually-exclusive criteria) used to *cause* a halt on purpose. A fixture device, not a bug. |
| **unreachable join** | A join slice (`serialize`) that can never be enabled because one required upstream token never arrives; *waiting*, not *failed*. |
| **failure isolation** | The property that a halt blocks only its downstream cone, while independent subtrees complete normally (`parse`/`transform-a`). |
| **rework / retry budget** | `maxSemanticReworks` / `--max-retries` — how many failed TDD passes a slice gets before it halts. Kept low for the demo. |

## Verification Design

> These commands run **inside the generated product tree** (the cook worktree / merged
> `__epic__/pipeline/` tree), not at the brunch repo root.

### Verification Commands

| Step | Check | Command |
| --- | --- | --- |
| 1 | Type checking | `bunx tsc --noEmit` |
| 2 | Unit tests (satisfiable slices) | `bun test tests/<slice>.test.ts` |
| outer | The actual demonstration | `brunch cook fixtures/resilient-pipeline --policy=parallel --max-retries=2 --petrinaut-stream` |

### Verification Policy

- **Inversion of the normal inner loop.** For `parse`, `transform-a`, `serialize` the inner loop
  is ordinary TDD red→green. For **`transform-b` the inner-loop oracle is unsatisfiable by
  construction** — it is *meant* never to pass. So the meaningful verification for this product
  is the **outer loop**: the cook run, where the halt frontier is the observable result.
- **Structural gate (the round-trip's real assertion):** a bounded-retry parallel cook run must
  show `parse` + `transform-a` at `done`, `transform-b` at `:halted`, and `serialize` pending
  forever — failure isolated (I2-K), halt deposited (I1-K), join unreachable but not failed
  (I3-K). Owned by the outer loop / `ln-oracles`.

### Acceptance Criteria

1. `ln-plan` over this SPEC produces a plan with: `parse` root; `transform-a` and `transform-b`
   both depending only on `parse` (parallel); `serialize` depending on **both** — i.e. it
   re-derives the branch-and-join, and preserves `transform-b`'s seeded contradiction rather
   than "repairing" it.
2. `brunch cook fixtures/resilient-pipeline --policy=parallel --max-retries=2 --petrinaut-stream`
   shows `parse` + `transform-a` reaching `done`, `transform-b` landing on `:halted` after
   exhausting its budget, and `serialize` waiting forever — the blocked frontier, drawn live.
3. `parse`, `transform-a` unit tests pass green; `serialize`'s would pass if reached but is never
   enabled; `transform-b`'s is unsatisfiable by construction (the device).
4. The halt stays isolated: the independent subtree completes; only `serialize` is blocked (I2-K, I3-K).
