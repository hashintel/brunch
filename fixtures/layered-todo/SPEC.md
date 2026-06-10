<!-- SPEC.md — live architecture register for the `layered-todo` demo-fixture PRODUCT.
     Created by ln-spec · Read by all skills · Refreshed by ln-sync.

     SCOPE NOTE — this is NOT brunch's canonical spec (that lives at memory/SPEC.md, untouched).
     This file specs the standalone greenfield product that the `brunch cook` fixture at
     fixtures/layered-todo/plan.yaml builds: an in-memory Todo service with a CLI. It exists to
     round-trip that hand-authored plan back into a reviewable spec, so the same product can be
     driven SPEC → ln-plan → cook and reproduce a similar dependency-shaped build.

     Companion artifacts:
       - fixtures/layered-todo/plan.yaml ........... the hand-authored cook plan (the thing reversed)
       - fixtures/layered-todo/PLAN.md ............. the frontier-level plan recovered from this spec
       - docs/design/orchestrator-demo-fixtures.md . the fixture-set design + demo knobs -->

# layered-todo — an in-memory Todo service with a CLI

## Product Contract

### Concept

`layered-todo` is a small in-memory Todo domain (`types → store/validation → service`) with a
thin command surface (`add`, `list`, `done`) over the service. The functions are ordinary; the
product's reason for being is its **dependency shape**:

- a real **fan-out → join**: `types` is the root, `store` and `validation` both fan out from it
  and build concurrently, and `service` is the **join** — it cannot begin until *both* `store`
  and `validation` exist; and
- a **cross-epic gate**: the `cli` epic depends on the whole `core` epic, so no command may
  begin until core clears.

This is the dependency shape a flat, linear plan literally cannot represent — and the one a
Petri-net orchestrator draws live. **Success** is structural: a spec that, when planned
(`ln-plan`) and cooked (`brunch cook --policy=parallel`), re-derives this diamond + gate so
that in Petrinaut the join (`service`) is visibly unreachable until both upstream tokens land,
and `cli` is held until the `core` gate clears. The functions passing is necessary; reproducing
the *join and the gate* is the point.

### Constraints & Non-goals

- **In-memory only.** No persistence, no database, no file I/O.
- **Zero runtime dependencies**, **ESM** (`"type": "module"`), **`bun test`** runner — the shared
  fixture substrate.
- **Dependency edges encode genuine build-order only.** `store`/`validation` depend on `types`;
  `service` depends on both; each command depends on `service`. No spurious edges (they would
  serialise the demo); no missing edges (the join/gate is the whole point).
- **File-disjoint slices.** One module per slice. `service.ts` may import `store.ts` and
  `validation.ts`, but each is its own file, so the last-wins epic merge stays clean.
- **CLI is a function-level command surface** over the service (`add`/`list`/`done` functions),
  not a full arg-parsing binary.
- **Fixed surface.** Exactly the modules below — not a general task manager.

### Capability Requirements

#### Core domain (`core` epic)

1. `src/types.ts` — `Todo` (`id: string`, `title: string`, `done: boolean`) and an `id()`
   generator. The root of the domain; everything else descends from it.
2. `src/store.ts` — an in-memory `TodoStore` with `add` / `get` / `list` / `update` / `remove`
   over `Todo`. Depends on `types`.
3. `src/validation.ts` — `validateTitle(title)` (non-empty, ≤ 200 chars) and `validateTodo(t)`,
   throwing on invalid input. Depends on `types`. Independent of `store`.
4. `src/service.ts` — a `TodoService` composing store + validation: `addTodo` validates then
   stores; `listTodos` / `completeTodo` delegate to the store. **The join** — depends on both
   `store` and `validation`.

#### Command surface (`cli` epic, gated on `core`)

5. `src/commands/add.ts` — `add(service, title)` creating a todo via the service, returning its id.
6. `src/commands/list.ts` — `list(service)` returning formatted lines per todo (`[ ]`/`[x]` + title).
7. `src/commands/done.ts` — `done(service, id)` marking a todo complete; throws if the id is unknown.

#### Composition

8. End-to-end: `add → list → done` flows through the assembled service + commands, proving the
   `cli` epic composes over `core` (`tests/todo-e2e.integration.test.ts`, run in the merged tree).

## Live Architecture Register

### Open Assumptions

| # | Assumption | Confidence | Status | Depends on | Validation approach |
| --- | --- | --- | --- | --- | --- |
| A1-K | A simple string `id()` generator (monotonic or random) is sufficient for the in-memory store; no collision-resistance / ordering guarantee is required. | medium | open | R1 / I5-K | `types` unit test asserting `id()` returns distinct strings across calls. |
| A2-K | `validateTitle`'s bounds (non-empty, ≤ 200 chars) are the intended contract, with no trimming/normalisation expected. | medium | open | R3 / I5-K | `validation` unit test at the empty / 200 / 201 boundaries. |

### Active Decisions

- **D1-K — Dependency edges encode genuine build-order only**, producing the diamond: `types` root; `store` and `validation` both `depends_on [types]`; `service` `depends_on [store, validation]`; each command `depends_on [service]`. This shape is what justifies a Petri net over a flat plan. Supersedes: —.
- **D2-K — `service` is the JOIN node** — it depends on *both* `store` and `validation` and cannot begin until both modules exist. This is the join the demo visualises as unreachable-until-both-tokens-land. Depends on: D1-K. Supersedes: —.
- **D3-K — The `cli` epic depends on the whole `core` epic — a cross-epic gate.** No command slice may begin until the entire `core` epic clears; distinct from intra-epic slice dependencies. Depends on: D1-K. Supersedes: —.
- **D4-K — File-disjoint slices, one module + one unit-test oracle per slice; epic owns one integration oracle.** `service.ts` imports store + validation but each is its own file, so the last-wins epic merge stays clean and red→green stays honest. Supersedes: —.
- **D5-K — `bun test` / ESM / zero-dependency substrate**, shared with the rest of the fixture set. Supersedes: —.

### Critical Invariants

| # | Invariant | Protected by | Proves |
| --- | --- | --- | --- |
| I1-K | `service` is unreachable until **both** `store` and `validation` are done (join semantics). | planned: dependency wiring + parallel cook run observing `service` held until both tokens arrive; `tests/service.test.ts` | D2-K, R4 |
| I2-K | No command slice begins until the `core` epic gate clears (cross-epic gate). | planned: epic dependency wiring + cook run; `tests/todo-e2e.integration.test.ts` | D3-K, R5–R7 |
| I3-K | `store` and `validation` are mutually independent and run concurrently once `types` lands. | planned: plan-shape check / parallel cook run | D1-K, R2, R3 |
| I4-K | Slices are file-disjoint; each slice has exactly one unit-test oracle; the epic owns one integration oracle. | `tests/<slice>.test.ts` per slice + `tests/todo-e2e.integration.test.ts` | D4-K |
| I5-K | The domain composes: `addTodo` validates-then-stores, commands delegate to the service, and `add → list → done` passes end-to-end in the merged tree. | `tests/todo-e2e.integration.test.ts` | R4, R8 |

## Future Direction Register

### Maps to graph compilation

- This hand-authored DAG (diamond + cross-epic gate) is the shape `petri-graph-compilation` (Phase 3) would later *derive from a spec* rather than have hand-authored. The fixture previews that horizon item. See `docs/design/orchestrator-demo-fixtures.md`.

### Round-trip as a pattern

- One of the `reverse-plan-fixtures-to-spec` set (`parallel-utils` = pure fan-out; this = fan-out→join + gate; `resilient-pipeline` = halt isolation). Same reversal recipe across all three.

## Lexicon

| Term | Definition |
| --- | --- |
| **join** | A slice that depends on more than one upstream slice (`service` ← `store` + `validation`); unreachable until all upstream tokens land. The product's headline. |
| **cross-epic gate** | An epic-level dependency (`cli` ← `core`) that holds every slice in the downstream epic until the upstream epic fully clears. |
| **fan-out** | Sibling slices that share one upstream and have no edge between them (`store` and `validation` from `types`), so they execute concurrently. |
| **command surface** | The thin `cli` epic — `add`/`list`/`done` functions over `TodoService`, not a standalone binary. |
| **epic / slice / `depends_on` / `verification`** | `brunch cook` plan terms. Epic = integration seam; slice = one behaviour; `depends_on` = genuine build-order only; `verification` = the slice's test oracle. See `docs/design/orchestrator-demo-fixtures.md`. |

## Verification Design

> These commands run **inside the generated product tree** (the cook worktree / merged
> `__epic__/<epic>/` tree), not at the brunch repo root.

### Verification Commands

| Step | Check | Command |
| --- | --- | --- |
| 1 | Type checking | `bunx tsc --noEmit` |
| 2 | Unit tests (per slice) | `bun test tests/<slice>.test.ts` |
| 3 | Integration (e2e) | `bun test tests/todo-e2e.integration.test.ts` |
| all | Full gate | `bun test && bunx tsc --noEmit` |

### Verification Policy

- **Inner loop (per slice):** TDD red→green against the slice's single unit test; target module
  genuinely absent so `evaluate-done` returns "needs work" and the mechanical lane fires.
- **Epic gate:** `tests/todo-e2e.integration.test.ts` runs in the merged `__epic__/cli/` tree and
  proves the command surface composes over the assembled core domain (I2-K, I5-K).
- **Structural gate (the round-trip's real assertion):** a parallel cook run must show `store`
  and `validation` firing concurrently, `service` held until *both* complete (the join, I1-K),
  and the `cli` commands held until the `core` gate clears (I2-K). Verified at the outer loop
  (see `ln-oracles`).

### Acceptance Criteria

1. `ln-plan` over this SPEC produces a plan with: `types` as root; `store` and `validation` both
   depending only on `types` (parallel); `service` depending on **both** `store` and `validation`
   (the join); a `cli` epic gated on the `core` epic; and `add`/`list`/`done` parallel among
   themselves — i.e. it re-derives the diamond + cross-epic gate, not a serial chain.
2. `brunch cook fixtures/layered-todo --policy=parallel --agentPoolSize=3 --petrinaut-stream`
   shows `store` + `validation` concurrent, `service` unreachable until both tokens land, and the
   `cli` commands held until `core` clears — the join and gate are observable.
3. All per-slice unit tests and `tests/todo-e2e.integration.test.ts` pass green in the merged tree.
4. Slices are file-disjoint (I4-K); `service.ts` is the only module importing both `store` and
   `validation`.
