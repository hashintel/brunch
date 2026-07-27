<!-- PLAN.md — what's next for the `resilient-pipeline` demo-fixture PRODUCT.
     Created by ln-plan · companion to fixtures/resilient-pipeline/SPEC.md.

     SCOPE NOTE — this is NOT brunch's canonical plan (memory/PLAN.md is untouched). This
     standalone plan re-derives the branch-and-join + seeded-halt shape of the hand-authored cook
     plan (fixtures/resilient-pipeline/plan.yaml) from the reversed SPEC. The cook `plan.yaml` is
     the slice-level projection of this plan.

     NOTE — transform-b is intentionally unsatisfiable (the seeded halt). It is a fixture device,
     not a defect to fix. See SPEC D1-K. -->

# Plan — resilient-pipeline

## Context

Round-trip target: a small CSV `parse → transform → serialize` pipeline whose value is *failure
isolation under a Petri net*. One branch (`transform-b`) carries an intentionally contradictory
spec, halts after exhausting its retry budget, and deposits a halt token; the independent branch
(`parse → transform-a`) completes; the join (`serialize`) becomes provably unreachable — waiting,
not failed. The spec was reversed out of the existing hand-authored `plan.yaml`; this plan
recovers the frontier shape that produces it. One epic, one frontier item (`data-pipeline`); the
demo is best run with a low retry budget so the halt is reached fast. The headline is the blocked
frontier drawn live — keep `transform-b`'s contradiction intact; "fixing" it removes the demo.

## Sequencing

### Active

1. `data-pipeline` — not-started — `parse → {transform-a, transform-b✗} → serialize`; contains the seeded halt and the unreachable join.

### Next

- (none — single-epic product.)

### Parallel / Low-conflict

- (none across frontiers.) *Within* `data-pipeline`, `transform-a` and `transform-b` run concurrently on `parse`; `transform-b` halts while `transform-a` completes.

### Horizon

- `simulation-oracle-preview` — the unreachable-join / halt-frontier this produces is what `petri-simulation-oracle` (Phase 4) would flag and `resume-from-marking` would restart once the contradiction is lifted. Loose; not product work for this fixture.

## Frontier Definitions

### data-pipeline

- **Name:** Parse → transform → serialize pipeline (with seeded halt)
- **Linear:** unassigned (demo-fixture product; not tracked in FE)
- **Kind:** structural
- **Status:** not-started
- **Objective:** Build `parse` (root) → `transform-a` and `transform-b` (parallel on `parse`) → `serialize` (join on both). `transform-b` is deliberately contradictory and is expected to halt; `serialize` is consequently unreachable.
- **Why now / unlocks:** The whole product is this one shape — it demonstrates halt isolation and reachability, the Phase-4 resilience story. There is no follow-on epic.
- **Slices (kept on this frontier, not fragmented):** `parse` (root, satisfiable) · `transform-a` `depends_on [parse]` (satisfiable) · `transform-b` `depends_on [parse]` (**seeded contradiction — expected to halt; do not fix**) · `serialize` `depends_on [transform-a, transform-b]` (**join — provably unreachable here**).
- **Acceptance:** `parse` + `transform-a` reach `done` (I2-K); `transform-b` lands on `:halted` after exhausting its budget (I1-K); `serialize` never fires and never fails — it waits (I3-K). Observable in Petrinaut as the blocked frontier.
- **Verification:** inner — ordinary TDD red→green for `parse`/`transform-a`/`serialize`; `transform-b`'s oracle is unsatisfiable by construction. outer — bounded-retry parallel cook run is the real demonstration (owned by ln-oracles).
- **Traceability:** → SPEC R1–R4; D1-K (seeded contradiction), D2-K (failure isolation), D3-K (unreachable ≠ failed), D4-K (file-disjoint, one oracle/slice), D5-K (tune via retries); I1-K, I2-K, I3-K, I4-K. Open assumptions A1-K (low budget halts reliably), A2-K (halt = token-never-arrives) resolve during the cook run.

## Recently Completed

- (none yet — fresh round-trip plan.)

Older history: n/a (standalone product; no archive).

## Dependencies

```text
data-pipeline frontier:
    parse ──┬──> transform-a ───────────┐
            └──> transform-b  ✗HALT      ├──> serialize   (JOIN: needs both)
              (transform-a ∥ transform-b)│
                                         └─ transform-b never completes
                                            → serialize UNREACHABLE (waiting, not failed)
```
