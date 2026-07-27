<!-- PLAN.md — what's next for the `layered-todo` demo-fixture PRODUCT.
     Created by ln-plan · companion to fixtures/layered-todo/SPEC.md.

     SCOPE NOTE — this is NOT brunch's canonical plan (memory/PLAN.md is untouched). This
     standalone plan re-derives the dependency shape of the hand-authored cook plan
     (fixtures/layered-todo/plan.yaml) from the reversed SPEC, so the same product can be driven
     SPEC → PLAN → cook and reproduce a similar diamond-join + cross-epic-gate build. The cook
     `plan.yaml` is the slice-level projection of this plan. -->

# Plan — layered-todo

## Context

Round-trip target: an in-memory Todo service + CLI whose value is its *dependency shape* — a
real fan-out → join (`types → {store, validation} → service`) inside the `core` epic, plus a
cross-epic gate (`cli` waits on all of `core`). The spec was reversed out of the existing
hand-authored `plan.yaml`; this plan recovers the frontier shape that produces it. Two frontier
items mirror the two epics: `core-domain` (the diamond) and `cli-surface` (the gated command
epic). The next bottleneck is the join — `service` cannot start until both `store` and
`validation` land — and the gate: no command can start until `core-domain` clears. Preserving
exactly those edges (no more, no fewer) is the whole point; that's what the parallel cook run
draws live.

## Sequencing

### Active

1. `core-domain` — not-started — `types → {store, validation} → service`; contains the fan-out and the join.

### Next

1. `cli-surface` — gated behind `core-domain` (cross-epic gate); `add`/`list`/`done` + e2e integration.

### Parallel / Low-conflict

- (none across frontiers — `cli-surface` is gated on `core-domain` by design.) *Within* `core-domain`, `store` and `validation` run concurrently; *within* `cli-surface`, the 3 commands run concurrently.

### Horizon

- `graph-compilation-preview` — this hand-authored DAG is the shape `petri-graph-compilation` (Phase 3) would derive from a spec rather than have hand-authored. Loose; not product work for this fixture.

## Frontier Definitions

### core-domain

- **Name:** Core Todo domain (the diamond)
- **Linear:** unassigned (demo-fixture product; not tracked in FE)
- **Kind:** structural
- **Status:** not-started
- **Objective:** Build `types` (root) → `store` and `validation` (parallel on `types`) → `service` (the join, depends on both). Establishes the domain and the headline fan-out→join shape.
- **Why now / unlocks:** Everything depends on the domain, and the join (`service`) is the demo's centrepiece — unreachable until both upstream tokens land. The whole `cli` epic is gated behind this frontier clearing.
- **Slices (the diamond — kept on this frontier, not fragmented into separate plan entries):** `types` (root) · `store` `depends_on [types]` · `validation` `depends_on [types]` (these two parallel) · `service` `depends_on [store, validation]` (**join**).
- **Acceptance:** per-slice unit tests green; `service` demonstrably waits for both `store` and `validation` (I1-K); `store` and `validation` run concurrently once `types` lands (I3-K).
- **Verification:** inner — per-slice TDD red→green; outer — parallel cook run showing the join held until both tokens arrive (owned by ln-oracles).
- **Traceability:** → SPEC R1–R4; D1-K (genuine build-order edges), D2-K (service = join), D4-K (file-disjoint, one oracle/slice); I1-K, I3-K, I4-K. A1-K (id generator), A2-K (title bounds) resolve inside `types` / `validation`.

### cli-surface

- **Name:** Command surface (gated on core)
- **Linear:** unassigned
- **Kind:** bounded feature
- **Status:** not-started
- **Objective:** Add `add` / `list` / `done` command functions over `TodoService`, then prove `add → list → done` end-to-end. Parallel among themselves; the whole epic is gated on `core-domain`.
- **Why now / unlocks:** Demonstrates the cross-epic gate — no command can begin until `core-domain` clears — and closes the round-trip with the e2e integration oracle.
- **Slices:** `cmd-add` · `cmd-list` · `cmd-done` (all `depends_on [service]`, parallel among themselves). Epic gate slice: `todo-e2e` integration.
- **Acceptance:** 3 command unit tests green; `tests/todo-e2e.integration.test.ts` green in the merged `__epic__/cli/` tree; commands demonstrably held until `core` clears (I2-K).
- **Verification:** inner — per-command TDD red→green; middle — e2e integration on merged tree; outer — cook run showing the cross-epic gate (ln-oracles).
- **Traceability:** → SPEC R5–R8; D3-K (cross-epic gate), D4-K; I2-K, I5-K.

## Recently Completed

- (none yet — fresh round-trip plan.)

Older history: n/a (standalone product; no archive).

## Dependencies

```text
core-domain frontier:
    types ──┬──> store ──────────┐
            └──> validation ─────┴──> service        (JOIN: needs both)
            (store ∥ validation, concurrent on types)

                       │  cross-epic gate: cli waits on all of core
                       ▼
cli-surface frontier:
    service ──┬──> cmd-add  ┐
              ├──> cmd-list  ├──> todo-e2e            (epic `cli` gate)
              └──> cmd-done ┘
              (3 commands concurrent once core clears)
```
