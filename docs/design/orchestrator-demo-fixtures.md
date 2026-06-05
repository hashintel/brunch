# Orchestrator demo / stress-test fixtures

**Status:** backlog · build later. Authored 2026-06-05 from the orchestrator stress-test discussion.

**Purpose:** three greenfield `brunch cook` fixtures, each isolating **one thing a Petri net does that a linear agent loop structurally cannot** — and each also previewing a horizon item, so the set doubles as a roadmap demo. The existing `fixtures/txt/` is too flat (one dependency edge, 5 leaves) to show any of this.

These are **greenfield / fixture mode** on purpose (plan at `<dir>/plan.yaml`, empty per-slice worktrees, generate-from-scratch). Greenfield isolates the net's behaviour and dodges the brownfield merge/promotion caveats (see "open seams" below).

---

## Shared design principles (the split strategy)

1. **One testable behaviour per slice**, each owning exactly one `verification` target (`tests/<slice>.test.ts`) so the mechanical lane (`write-tests → write-code → run-tests`) has a real red→green oracle.
2. **Epic = integration seam.** Epic `verification` is a cross-slice integration test that runs in the merged `__epic__/<epicId>/` tree — it proves the slices actually compose.
3. **`depends_on` only for genuine build-order** (shared type, prerequisite API). Keep leaves independent — fan-out is the headline; every spurious edge serialises the demo.
4. **One module per slice — keep slices file-disjoint.** The current epic merge is declaration-order, last-wins file-copy (`epic-sandbox-merge.ts`), so two parallel slices writing the *same* file silently clobber. Design around it. (A deliberate shared-file fixture would *expose* this and motivate `cook-artifact-lifecycle` — see seams.)
5. **Size each slice to one sonnet TDD pass** — small, sharp definitions; `pi` one-shots them.
6. **Let the file not exist yet.** Each slice's target file should genuinely be absent so `evaluate-done` returns "needs work" and the TDD lanes fire. (Post-FE-813 the evaluator is read-only and gates `done` on *executing* the verification targets, so this is naturally honest now — but absent files keep the demo unambiguous.)

### Demo knobs

```
brunch cook <dir> --policy=serial                          # baseline
brunch cook <dir> --policy=parallel --agentPoolSize=3 \     # the contrast
  --petrinaut-stream                                        # live net in Petrinaut
```
The serial-vs-parallel wall-clock delta *is* the demo. `--petrinaut-stream` shows pool draining, joins, and halts live.

### Plan schema (reference)

```yaml
epics:
  - id: <epicId>
    summary: "..."
    depends_on: [<epicId>...]
    verification: [{ kind: integration-test, target: "tests/<x>.integration.test.ts" }]
slices:
  - id: <sliceId>
    epic_id: <epicId>
    definition: "one sharp behaviour"
    depends_on: [<sliceId>...]
    verification: [{ kind: unit-test, target: "tests/<sliceId>.test.ts" }]
```

---

## Fixture 1 · `parallel-utils` — the wall-clock proof

**Thesis:** N independent slices, pool-bounded → 3 fire at once; a linear loop does them one-by-one. The number is the demo.

**Project:** a zero-dependency TypeScript utility library, bun-tested. Each util is its own file + its own test → pure fan-out, no inter-slice deps, no merge conflicts.

```
scaffold ─┬─ chunk        (8 independent leaves, each tests/<x>.test.ts)
          ├─ unique
          ├─ groupBy       epic `utils` depends_on [scaffold]
          ├─ debounce      epic verify: tests/barrel.integration.test.ts
          ├─ retry           (imports all → exercises __epic__ merge)
          ├─ clamp
          ├─ slugify
          └─ deepEqual
```

- **Slices:** `scaffold` (package.json/tsconfig/index barrel), then 8 leaves all `depends_on: [scaffold]`, none depending on each other.
- **Run:** `--agentPoolSize=3` → wall-clock ≈ ⌈8/3⌉ × slice vs 8 × slice serial. In Petrinaut you watch `pool:code-agent` drain to zero and refill.
- **Maps to:** `petri-parallel-execution` (FE-743, landed). Run twice (serial then parallel) — the delta is the headline.

---

## Fixture 2 · `layered-todo` — the diamond (flagship)

**Thesis:** a real fan-out → **join** plus a cross-epic gate — the dependency shape a flat plan literally cannot represent.

**Project:** an in-memory Todo service with a CLI.

```
epic core:                          epic cli (depends_on [core]):
   types                               ┌─ add
    ├──> store ────┐                   ├─ list      (3 parallel leaves)
    └──> validation ─> service         └─ done
         (parallel)    (JOIN)
                                     epic verify: tests/todo-e2e.integration.test.ts
```

- **core slices:** `types` (root) → `store` `depends_on [types]`, `validation` `depends_on [types]` (these two run concurrently) → `service` `depends_on [store, validation]` (**the join** — cannot start until both arrive).
- **cli slices:** `add`, `list`, `done`, each effectively gated behind `core` via the epic dependency; parallel among themselves.
- **Files:** `types.ts`, `store.ts`, `validation.ts`, `service.ts`, `commands/*.ts` — disjoint; `service.ts` imports store+validation but is its own file, so the merge stays clean.
- **Maps to:** the net-compiler dependency wiring (landed); previews `petri-graph-compilation` (Phase 3) — this hand-authored DAG is the shape graph-compilation would later derive, and what FE-800 emits from a spec.

This is the most "Petri-only" visual: the join is unreachable until both upstream tokens land, and `cli` can't begin until `core`'s gate clears.

---

## Fixture 3 · `resilient-pipeline` — failure isolation + the Phase-4 story

**Thesis:** one slice is given a contradictory / over-constrained spec so it exhausts its retry budget and deposits a **halt token**. The independent subtree keeps completing; the join becomes provably **unreachable**. A linear agent just stalls ambiguously here.

**Project:** a small data-processing pipeline CLI (CSV/JSON transform).

```
parse ─┬─ transform-a ───┐
       └─ transform-b ✗──┴─> serialize    (✗ halts → serialize UNREACHABLE)
              (contradictory verification:
               two mutually-exclusive criteria)
```

- **Slices:** `parse` (root) → `transform-a` `depends_on [parse]`, `transform-b` `depends_on [parse]` → `serialize` `depends_on [transform-a, transform-b]`.
- **The seeded failure:** `transform-b`'s slice definition + verification encode a genuine contradiction (e.g. two criteria that cannot both pass), so its TDD loop exhausts `--max-retries` / `maxSemanticReworks` and deposits a halt token on `:halted`.
- **What the net shows:** `parse` + `transform-a` complete, `transform-b` halts, `serialize` waits forever — the live net displays exactly the blocked frontier. That's the demo of deadlock / reachability and the motivation for **resume-from-marking**.
- **Tune with:** `--max-retries`, `maxSemanticReworks`.
- **Maps to:** halt-token semantics (landed) → `petri-simulation-oracle` (Phase 4, horizon). Note Phase-4 core can be built on FE-800 plans without Phase 3; this fixture produces exactly the unreachable-join / halt-frontier such an oracle would flag and resume from.

---

## Build order

1. **`parallel-utils`** — quickest to author; proves the pipe end-to-end; yields the serial-vs-parallel wall-clock number.
2. **`layered-todo`** — the flagship visual (diamond join + cross-epic gate); the one that *sells* Petri vs linear.
3. **`resilient-pipeline`** — the resilience / horizon story for the Phase-4 narrative.

---

## Open seams that touch these fixtures

- **`assess-semantic` is a stub** (auto-satisfies). Frame every demo as "**mechanical** TDD execution visualised as a live Petri net" — the mechanical lane, parallelism, dependency joins, and pool capping are all real and are the whole point. A true semantic gate waits on FE-700 / Phase 3.
- **Evaluator integrity — resolved (FE-813).** `evaluate-done` is now read-only and gates `done` on *executing* the verification targets (not an LLM verdict), so greenfield fixtures route honestly through the TDD lanes.
- **Epic merge is last-wins file-copy.** Keep slices file-disjoint (principle 4). A deliberate shared-registry 4th fixture would expose this and motivate `cook-artifact-lifecycle` (commit slices → real `git merge` with conflict surfacing → promote to `cook/<runId>`).
- **No promotion path yet.** Runs leave work in inspectable worktrees but nothing is committed/merged back — the `cook-codebase-mode` promotion follow-on. Not needed for these greenfield demos.

## Quick map: fixture → landed capability → horizon item

| Fixture | Proves (landed) | Previews (horizon) |
| --- | --- | --- |
| `parallel-utils` | parallel firing + pool capping (FE-743) | scale / larger pools |
| `layered-todo` | dependency DAG + join + cross-epic gate | `petri-graph-compilation` (Phase 3) |
| `resilient-pipeline` | halt-token semantics | `petri-simulation-oracle` (Phase 4) |
