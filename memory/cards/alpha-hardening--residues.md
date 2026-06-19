# Alpha-hardening loose-ends (seed flag + runtime leaf + deferred prompt-shape)

Frontier: alpha-hardening
Status:   active
Mode:     chain
Created:  2026-06-19

## Orientation

- **Containing seam:** `alpha-hardening` — a parallel / low-conflict collection frontier for three genuinely-small residues left by completed frontiers (`dev-seed-fixtures`/FE-848, the unbuilt `runtime-vocab-leaf`, and the FE-893 deferred-by-design prompt-shape). Branch `ln/fe-xxx-alpha-hardening` already exists and is clean; work is unstarted.
- **Frontier framing (from `memory/PLAN.md` §Frontier Definitions → alpha-hardening):** one low-conflict branch, **one commit per residue**. Linear intentionally unassigned ("the three residues are small enough to share a tracker unit, not each their own"). Each residue is scoped at build time against its source frontier's original acceptance.
- **Volatile state:** none. No `HANDOFF.md`. Each residue's seam is present and legible: residue 1's seed CLI lives at `src/graph/seed-fixtures.ts` with an all-seeds schema-currency test already in `src/graph/__tests__/seed-fixtures.test.ts`; residue 2's model leaf is `src/graph/schema/kinds.ts` and the vocab to move currently lives in `src/session/runtime-state.ts` (lines ~1–64); residue 3's `.pi/agents/<agent>/SYSTEM.md` convention is **already adopted** (`elicitor/`, `reviewer/`, `pi-coder/`), so only the `SKILL.md`+`references/` skill shape, the `[sub]` sub-agent convention, and the `_generated/` typed-vocab layer remain open.
- **Main open risk:** residue 3 carries an embedded ship-or-defer decision under `sourcing: strip-or-build` ("do not over-build the generated layer before a concrete stale-member need"). No concrete stale-member need exists today (the agent sees op_mode/kinds via `compose.ts` inline rendering, not a generated reference file; no skill has asked for sub-references; no sub-agent is built). The lean resolution is **explicit deferral with documented decisions** — card 3 states this and leaves room for ln-build's practical prelude to adopt a piece if it finds a concrete need.
- **Cross-cutting obligations inherited from the frontier:** preserve **D39-L** sealed-Pi profile (code-owned manifest, no ambient discovery) for any prompt-shape change; preserve **D52-L** directed topology and **D73-L** domain-owns-vocab direction for the runtime leaf; honor the **topology-readmes-and-boundaries** standing obligation (new `src/session/schema/` dir → README + boundary test) inside card 2; honor **probes-and-transcripts-evolution** implicitly (the all-seeds flag supports reproducible probe-input workbenches). One branch, one commit per card; do not let the collection grow into unrelated cleanup.

**Posture: proving (inherited from `alpha-hardening`).** Each card is small and low-blast-radius. Tracer-bullet value per card: card 1 lights up the reproducible multi-seed workbench path (proof of life) + makes seed purposes legible (invariant); card 2 locates and locks the runtime-vocab seam via an import-boundary test (invariant); card 3 retires three open "deferred-by-design" prompt-shape questions by closing them with explicit decisions (uncertainty). None depends on a high-impact unvalidated `memory/SPEC.md` §Assumptions.

## Chain discipline notes

- **Hard anti-speculation gate:** no card depends on implementation findings from an earlier card. Cards 1, 2, 3 touch disjoint primary write paths (seed CLI + `.fixtures/seeds/`; `src/session/schema/` + `src/session/runtime-state.ts`; `src/.pi/skills/` + `src/.pi/agents/` READMEs). Valid chain.
- **Shared-file sequencing:** cards 2 and 3 both edit `src/.pi/extensions/runtime/state.ts` — card 2 changes axis-enum **import paths**; card 3 changes skill **manifest location strings** *only if* it adopts the `SKILL.md`/`references/` folder shape. Different sections, no semantic collision, but to avoid build-time churn, **build card 2 before card 3** so card 3 rebases onto card 2's committed imports. If card 3 resolves to pure deferral (docs-only), it does not touch `state.ts` at all and the overlap evaporates.
- **Order:** card 1 (independent) → card 2 → card 3. Each lands as its own commit on `ln/fe-xxx-alpha-hardening`.
- **Stop the chain** if any card trips the promotion checklist, reveals a frontier split, or surfaces a real unknown (most likely card 3 if a concrete `_generated/` need appears that wants a real build, not a deferral) — route back through `ln-spec` / `ln-plan` rather than guessing ahead.

---

## Card 1 — dev-seed all-seeds opt-in flag + captured-seed disposition catalog

Status: done

### Objective

Add an explicit opt-in `--all-seeds` path to the dev seed CLI (never the default) and author the captured-seed disposition catalog so every tracked seed set has a named purpose.

### Light-card cold-start reads

```
- memory/SPEC.md   — D16-L, D20-L, D52-L, D61-L, D63-L, D70-L, D71-L, D79-L (seed/loader/workbench topology)
- memory/PLAN.md    — frontier: alpha-hardening (residue 1); source frontier: dev-seed-fixtures (FE-848, archived in docs/archive/PLAN_HISTORY.md §2026-06-19)
- src/graph/seed-fixtures.ts            — existing CLI: `--workspace <dir> --seed <set>/<slug> [--reset]`; parseSeedCliArgs, the --reset semantics, the import.meta.url entrypoint
- src/graph/__tests__/seed-fixtures.test.ts — existing all-seeds schema-currency `describe('all tracked seeds remain structurally legal', …)` block (the tracked-catalog discovery it already does)
- .fixtures/README.md                   — four-role `.fixtures/` layout; seeds vs workbenches vs runs vs scratch
- .fixtures/seeds/*/README.md           — per-set READMEs already present for every set (bilal-port, bilal-port-variants, brunch-self, cook-port, dumpchat, edge-spread, fable, kind-band-spread, rd-loop, workspace-spread, yamlbase)
```

### Target detail / decision space

- **`--all-seeds` flag:** today `npm run seed -- --workspace <dir> --seed <set>/<slug> [--reset]` seeds exactly one fixture. The residue wants an explicit, opt-in way to seed **every tracked seed** into a target workspace (the manual-workbench / probe-input use case the disposition catalog names), with **no ambient all-seeds default** — `npm run seed` with no `--seed`/`--all-seeds` must continue to fail with usage, not silently seed everything. Resolve at build time between (lean) `--all-seeds` seeds every tracked seed into the target workspace (each as its own spec, `--reset` required or explicitly confirmed) vs. a separate check-only command — lean toward the seeding form because that is what "manual workbench / probe input" disposition needs. The existing all-seeds **schema-currency test** in `seed-fixtures.test.ts` stays a test guard (it is not a CLI default); do not gate it behind the flag unless the practical prelude finds it slow/fragile in `npm run verify`.
- **Disposition catalog:** create `.fixtures/seeds/README.md` as the canonical catalog mapping each tracked seed set → one of `test` / `preview` / `manual workbench` / `probe input` / `parked`, with a one-line purpose per set. Sets to cover: `bilal-port`, `bilal-port-variants`, `brunch-self`, `cook-port`, `dumpchat`, `edge-spread`, `fable`, `kind-band-spread`, `rd-loop`, `workspace-spread`, `yamlbase`. Per-set READMEs already exist; the catalog is the roster-level index, not a duplication of per-set content.

### Acceptance Criteria

```
✓ seed CLI rejects a bare `npm run seed` (no --seed, no --all-seeds) with usage — no ambient all-seeds default
✓ `--all-seeds` seeds every tracked seed into the target workspace as distinct specs through seedFixture/CommandExecutor; --reset semantics honored
✓ --all-seeds is opt-in only; the single-seed --seed path is unchanged
✓ parseSeedCliArgs tests cover: --all-seeds requires --workspace; --all-seeds + --seed is rejected as ambiguous; equals-form accepted
✓ .fixtures/seeds/README.md exists and maps every tracked seed set to a disposition (test/preview/manual workbench/probe input/parked) with a one-line purpose
✓ npm run verify green; no behavior change to the existing all-seeds schema-currency test unless explicitly reshaped
```

### Verification Approach

```
- Inner: vitest unit tests on parseSeedCliArgs + an --all-seeds integration test that seeds into a temp workspace and reads back distinct spec ids through the product RPC/projection; README catalog sanity check (every set present, every disposition in the allowed set)
- Middle: none (dev-only CLI)
- Outer: none
```

### Cross-cutting obligations

- Loader stays `src/graph/seed-fixtures.ts`; seeds stay under `.fixtures/seeds/`; the all-seeds path routes through the same `seedFixture`/`CommandExecutor` mutation boundary (no direct DB rows) — preserves D16-L/D61-L/D63-L.
- `npm run dev` continues to never seed implicitly.
- Supports the `probes-and-transcripts-evolution` standing obligation (reproducible probe-input workbenches).

### Assumption dependency

`None` — correctness does not hinge on any live `memory/SPEC.md` §Assumptions.

### Expected touched paths (tentative)

```
src/graph/seed-fixtures.ts                        ~   (--all-seeds flag + parseSeedCliArgs + seeding loop)
src/graph/__tests__/seed-fixtures.test.ts         ~   (--all-seeds coverage; bare-invoke rejection)
.fixtures/seeds/README.md                         +   (captured-seed disposition catalog)
.fixtures/README.md                               ~   (cross-link to the new seeds catalog)
package.json                                      -   (not touched; --all-seeds rides `npm run seed`)
```

### Build note

Done 2026-06-19: `--all-seeds` now seeds every tracked fixture as a distinct spec
using `<set>-<slug>` slugs, remains opt-in/rejects `--seed` ambiguity, and the
roster catalog covers every tracked seed set.

---

## Card 2 — runtime-vocab leaf (`src/session/schema/kinds.ts`)

Status: done

### Objective

Establish `src/session/schema/kinds.ts` as the drizzle-free, pi-free source-of-truth leaf for the session/runtime axis enums, mirroring `src/graph/schema/kinds.ts` (D73-L ownership direction), and redirect consumers to import the closed arrays/types from it.

### Light-card cold-start reads

```
- memory/SPEC.md   — D58-L, D59-L, D73-L, D85-L (runtime axes; domain-owns-vocab; goal axis dropped)
- memory/PLAN.md    — frontier: alpha-hardening (residue 2); source frontier: runtime-vocab-leaf (archived in docs/archive/PLAN_HISTORY.md §2026-06-19)
- src/graph/schema/kinds.ts            — the model leaf: pure `as const` arrays, imports nothing
- src/session/runtime-state.ts         — current home of the vocab to move (lines ~1–64): OperationalModeId, AgentRoleId, AutoAxisSelection ('auto'), AgentStrategyId, AgentStrategySelection, AgentLensId, AgentLensSelection, OPERATIONAL_MODE_IDS, PLANNED_OPERATIONAL_MODE_IDS, PlannedOperationalModeId, OperationalModeChoice, AGENT_STRATEGY_IDS, AGENT_LENS_IDS. Stays: BrunchAgentState, DEFAULT_BRUNCH_AGENT_STATE, parseBrunchAgentState, BRUNCH_AGENT_RUNTIME_STATE_CUSTOM_TYPE, mention types
- src/projections/__tests__/topology-boundaries.test.ts — existing import-boundary test pattern to extend
- src/.pi/extensions/runtime/state.ts, src/projections/session/runtime-policy.ts, src/projections/session/affordances.ts, src/projections/session/runtime-state.ts — consumers to redirect
```

### Target detail

- Create `src/session/schema/kinds.ts` as a pure constants leaf (imports nothing — no drizzle, no pi, no `graph/atoms`, no `session/runtime-state`). It owns the closed enum arrays and derived types for `op_mode`, `strategy`, `lens`, and the `auto` sentinel: `OPERATIONAL_MODE_IDS`, `AGENT_STRATEGY_IDS`, `AGENT_LENS_IDS`, `PLANNED_OPERATIONAL_MODE_IDS`, and the `OperationalModeId` / `AgentRoleId` / `AgentStrategyId` / `AgentStrategySelection` / `AgentLensId` / `AgentLensSelection` / `AutoAxisSelection` / `PlannedOperationalModeId` / `OperationalModeChoice` types. `goal` is **not** present (dropped by D85-L). Must **not** recreate `READINESS_GRADES` (retired by capability-readiness).
- `src/session/runtime-state.ts` re-exports the vocab from the leaf for its own internal use and keeps the state shapes + parsers; downstream consumers that only need vocab import from `src/session/schema/kinds.ts` (or continue via `runtime-state.ts` re-export — pick the import form the practical prelude finds cleanest, but the **leaf** is the source of truth).
- Add an import-boundary/architecture test (extend `topology-boundaries.test.ts` or a co-located `session/schema/__tests__/` test) asserting: the leaf imports nothing; `src/session/runtime-state.ts` sources the axis enums from the leaf; the display-only `PLANNED_OPERATIONAL_MODE_IDS`/`OperationalModeChoice` resolve to the leaf.
- Author/extend the `src/session/schema/` README (or a section in `src/session/README.md`) naming the leaf as the session-side mirror of `graph/schema/kinds.ts` per D73-L.

### Acceptance Criteria

```
✓ src/session/schema/kinds.ts exists, imports nothing, owns op_mode/strategy/lens/auto closed arrays + derived types (no goal, no READINESS_GRADES)
✓ src/session/runtime-state.ts sources the axis enums from the leaf (no duplicate `as const` array literals for these axes)
✓ consumers (.pi/extensions/runtime/state.ts, runtime-policy.ts, affordances.ts, projections/session/runtime-state.ts) resolve axis vocab to the leaf (directly or via re-export)
✓ import-boundary test asserts: leaf imports nothing; runtime-state.ts axis enums come from the leaf
✓ session/schema README (or session/README section) documents the leaf as the D73-L session-side mirror
✓ npm run verify green; compose goldens + manifest-legality tests unchanged (D39-L sealing preserved; no behavior change)
```

### Verification Approach

```
- Inner: import-boundary/architecture test (leaf imports nothing; consumers source axis enums from the leaf); existing runtime-state/affordances/runtime-policy tests unchanged-green (pure move)
- Middle: none
- Outer: none
```

### Cross-cutting obligations

- Preserve **D52-L** directed dependencies: the leaf is a pure constants module; `db/` is not involved (contrast `graph/schema/kinds.ts` which `db/` consumes — here no db consumer exists, do not invent one).
- Preserve **D73-L** ownership direction (domain owns vocab, not persistence).
- Honor **topology-readmes-and-boundaries**: new `src/session/schema/` dir gets a README/boundary note.
- Preserve **D39-L** sealing: this is a TypeScript import refactor; no ambient discovery, no manifest behavior change.

### Assumption dependency

`None` — mechanical move inside a settled seam; no live assumption rides on it.

### Expected touched paths (tentative)

```
src/session/schema/
├── kinds.ts                                       +   (pure constants leaf; op_mode/strategy/lens/auto)
└── README.md                                      +?  (or a section in src/session/README.md)
src/session/runtime-state.ts                       ~   (move vocab to leaf; re-export; keep state shapes/parsers)
src/.pi/extensions/runtime/state.ts                ~   (import axis vocab from leaf — see chain note: do before card 3)
src/projections/session/runtime-policy.ts          ~   (import axis vocab from leaf)
src/projections/session/affordances.ts             ~   (import axis vocab from leaf)
src/projections/session/runtime-state.ts           ?   (re-export path, if it re-exports vocab today)
src/projections/__tests__/topology-boundaries.test.ts  ~   (extend with leaf import-boundary assertion)
```

### Build note

Done 2026-06-19: `src/session/schema/kinds.ts` is now the import-free runtime-axis vocab leaf; `runtime-state.ts` consumes/re-exports it, projections and the prompt manifest import vocab types from the leaf, and topology tests lock the import boundary plus no-goal/no-READINESS_GRADES constraints. Added `src/session/schema/README.md` and refreshed `src/session/README.md`/D73-L for the session-side mirror.

---

## Card 3 — FE-893 deferred prompt-shape (ship-or-defer decision)

Status: next (after card 2)

### Objective

Close the three FE-893 deferred-by-design prompt-shape questions — the `SKILL.md`+`references/` skill shape, the `[sub]` sub-agent definition convention, and the `_generated/` typed-vocab reference layer — by either adopting or explicitly deferring each, with the decision documented in the canonical READMEs.

### Light-card cold-start reads

```
- memory/SPEC.md   — D25-L, D39-L, D40-L, D52-L, D58-L, D59-L, D85-L (sealed profile; prompt-resource manifest; agents/skills topology)
- memory/PLAN.md    — frontier: alpha-hardening (residue 3); source frontier: prompt-skill-consolidation (FE-893, archived in docs/archive/PLAN_HISTORY.md §2026-06-19, "Deferred-by-design residue")
- src/.pi/skills/README.md     — current skill layout (flat .md: methods/*.md, strategies/*.md, lenses/*.md); prompt-resource body lock ledger
- src/.pi/agents/README.md     — `.pi/agents/<agent>/SYSTEM.md` convention already adopted (elicitor/reviewer/pi-coder); notes "references can later sit beside the body"
- src/.pi/extensions/runtime/state.ts — code-owned manifest (STRATEGY_RESOURCES, LENS_RESOURCES, method manifest) — the sealed surface any shape change must route through
- src/.pi/extensions/system-prompts/compose.ts — where the agent currently sees op_mode/kinds inline (no generated reference file today)
```

### Target detail / decision space

Three open questions, each resolved (adopt or explicitly defer) at build time, documented in the canonical README:

1. **`SKILL.md` + `references/` skill shape.** Today skills are flat `.md` (e.g. `methods/capture.md`). The presented shape would make each skill a folder (`methods/capture/SKILL.md` + `methods/capture/references/*.md`). **Lean: defer** — no skill has a concrete sub-reference need today (capture.md is the FE-861 conduct home and is the most likely first consumer, but FE-861 is still in progress and has not asked for references). Deferral = document the intended shape + the trigger (a skill needing sub-references) in `src/.pi/skills/README.md`; do not reshape files. If the practical prelude finds a concrete need, adopt for that one skill only.
2. **`[sub]` sub-agent definition convention.** No sub-agent is built today (subagent acquisition is a named near-future successor, not present). **Lean: defer** — document the intended `[sub]` notation in `src/.pi/agents/README.md` as a placeholder convention triggered when the first sub-agent lands; do not add empty stubs.
3. **`_generated/` typed-vocab reference layer.** The agent currently sees op_mode/strategy/lens/kind vocab via `compose.ts` inline rendering; no generated reference file exists. Under `sourcing: strip-or-build` ("do not over-build the generated layer before a concrete stale-member need"), **lean: defer** — document in `src/.pi/skills/README.md` (and/or `src/.pi/agents/README.md`) the intended destination (`_generated/` typed-vocab refs), the lock disposition (regenerated + drift-checked, distinct from the authored-body lock), and the trigger (a concrete stale-member need — e.g. vocab drift between compose.ts inline and a reference the agent relies on), and record that no such need exists today. Do not create the `_generated/` directory or a generator.
4. **Close the already-adopted piece:** record in `src/.pi/agents/README.md` that the `.pi/agents/<agent>/SYSTEM.md` convention is **closed/adopted** (it is — three agents use it), so the open residue is only the three items above.

If all three lean deferrals hold, card 3 is a docs+decision commit (READMEs only, no `state.ts` change → the card 2/3 `state.ts` overlap evaporates). If any one adopts, scope the adoption to that single surface and update `state.ts` manifest locations accordingly.

### Acceptance Criteria

```
✓ src/.pi/skills/README.md records the SKILL.md+references/ shape decision (adopted-for-X | deferred-until-trigger) with the trigger named
✓ src/.pi/agents/README.md records the [sub] sub-agent convention decision (deferred-until-first-subagent) with the trigger named, and marks the SYSTEM.md convention closed/adopted
✓ the _generated/ typed-vocab reference layer is either built (with lock disposition + trigger) or explicitly deferred in the canonical README with the trigger named; no empty _generated/ dir or stub generator is created on deferral
✓ if any piece is adopted, D39-L sealing is preserved (code-owned manifest, no ambient discovery) and manifest-legality + compose goldens stay green
✓ npm run verify green
```

### Verification Approach

```
- Inner: README content check (each of the three questions has an adopt-or-defer decision recorded with a named trigger); if any adoption lands, manifest-legality + compose golden tests green
- Middle: none
- Outer: none
```

### Cross-cutting obligations

- Preserve **D39-L** sealing: any adoption routes through the code-owned manifest in `src/.pi/extensions/runtime/state.ts`; no filesystem discovery of skills/agents/_generated.
- Preserve **D52-L** topology: `.pi/skills/` and `.pi/agents/` stay markdown-only; `_generated/` (if ever built) is a generated artifact, not an authored seam.
- Do not over-build under `sourcing: strip-or-build` — deferral is the expected resolution; adoption requires a concrete need named in the build.

### Assumption dependency

`None` — these are presentation/convention decisions, not load-bearing on any live `memory/SPEC.md` §Assumptions. (D39-L sealing is a decision, not an assumption, and is preserved either way.)

### Expected touched paths (tentative)

```
src/.pi/skills/README.md                          ~   (SKILL.md/references decision + _generated/ decision)
src/.pi/agents/README.md                          ~   ([sub] decision + mark SYSTEM.md convention closed)
src/.pi/extensions/runtime/state.ts               ?   (ONLY if a piece is adopted — manifest location strings; otherwise untouched)
src/.pi/skills/<family>/<skill>/                  ?   (ONLY if SKILL.md/references adopted for a concrete skill)
```

---

## Routing

Build this chain on `ln/fe-xxx-alpha-hardening`, one `ln-build` invocation per card in order (1 → 2 → 3), one commit each. Suggested next step: `ln-build memory/cards/alpha-hardening--residues.md` starting with card 1.
