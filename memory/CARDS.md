<!-- CARDS.md — prepared scope-card queue for one live frontier item.
     Created by ln-scope · consumed by ln-build · retired when queue exhausted.
     Frontier: spec-to-cook-plan (FE-800).
     Parent branch: ka/fe-800-spec-to-cook-plan (stacked on ka/fe-764). -->

# Scope cards — FE-800 spec-to-cook-plan

FE-764 queue (slices 1–4) shipped on `ka/fe-764-petri-sync-server`; that
queue is retired. FE-800 now owns this file. Only slice 1 is fully
scoped — slice 2 (LLM planning pass) and beyond depend on what slice 1's
projection shape ends up looking like, so they are not safe to pre-queue
per the ln-scope prepared-queue rule.

---

## Slice 1: deterministic projection — completed spec → cook-valid plan.yaml skeleton

**Status:** done. `src/orchestrator/src/cook-plan-projection.ts` exports
`projectCookPlanFromSpec(snapshot) → Plan` + `CompletedSpecSnapshot`
type; 7 tests (empty snapshot, N-requirement slice generation with
stable `req-<kindOrdinal>` ids, `verifies`-edge linkage, drop of
requirement→requirement `depends_on`, determinism, `loadPlan` YAML
round-trip, brunch_graphs corpus fixture pinning the spike's "≥1
verifying criterion per requirement" oracle). `npm run verify` green
(1584 tests; one unrelated transient flake on retry in
`src/server/app.test.ts`'s landing-only kickoff test, passes in
isolation and is not touched by FE-800).

### Target Behavior

A pure function `projectCookPlanFromSpec(snapshot)` takes a
`CompletedSpecSnapshot` (a structural shape — see Boundary Crossings
below — that the caller assembles from the brunch server's knowledge
tables) and returns a `Plan` (the existing
`src/orchestrator/src/types.ts` type) whose `slices` are one-per
`requirement` knowledge item in stable kind-ordinal order, whose
`verification` arrays are derived from incoming
`criterion --verifies--> requirement` edges, whose `depends_on` arrays
are empty for every slice, and whose `epics` array contains exactly one
default epic that every slice attaches to.

### Boundary Crossings

```
→ src/orchestrator/src/cook-plan-projection.ts (new — pure projector)
→ consumes:
    CompletedSpecSnapshot (new structural type, declared in this module):
      {
        requirements: { id: number; content: string; kindOrdinal: number }[]
        criteria:     { id: number; content: string; kindOrdinal: number }[]
        edges:        { fromItemId: number; toItemId: number;
                        relation: 'verifies' | 'depends_on' | 'derived_from'
                                | 'constrains' | 'refines' }[]
      }
    Plan / Epic / Slice / Verification (existing — src/orchestrator/src/types.ts)
→ exits at:
    src/orchestrator/src/cook-plan-projection.test.ts (new — unit tests
      + Plan-shape round-trip through structural conformance, not via
      filesystem)
```

This slice deliberately does NOT touch:

- `src/orchestrator/src/cook-cli.ts` — no CLI surface yet (slice 2 or 3 wires it).
- `src/server/db.ts` or the knowledge tables — the projector takes a
  pre-assembled snapshot. A later slice owns the server-side snapshot
  builder + the orchestrator↔server transport (CLI invocation, HTTP
  endpoint, or filesystem export — open question).
- Any LLM call. The planning pass + reconciliation stages live in
  later slices.

### Risks and Assumptions

```
- ASSUMPTION: A `requirement` knowledge item is the right unit to project
  one-per-slice in slice 1. The spike's reading of A97 + the SPEC §159
  table treats requirements as the buildable atoms.
  → VALIDATE: project the brunch_graphs completed spec and check every
    projected slice corresponds to one requirement and every requirement
    appears exactly once.

- ASSUMPTION: `criterion --verifies--> requirement` is the only edge that
  contributes to a slice's `verification` array in slice 1. Other relation
  kinds (`depends_on`, `derived_from`, `constrains`, `refines`) read as
  zero per the spike, but the projector must not silently drop them — it
  ignores them by design and the test pins that.
  → VALIDATE: projector test that asserts a `depends_on` edge between two
    requirements does NOT populate `slice.depends_on` (that ordering is
    slice 2's planning-pass job, not graph truth).

- ASSUMPTION: A single default epic (id: 'default', summary: 'All
  requirements') is acceptable for slice 1. Real epic grouping is the
  LLM planning pass's job in slice 2.
  → VALIDATE: round-trip test — feed the projector's output through
    `loadPlan` (against a tmp file or by serialising to YAML in-memory
    and parsing) and confirm the cook engine's existing plan-shape
    invariants hold (every slice.epic_id resolves to an epics[].id).

- ASSUMPTION: Verification targets in slice 1 are NOT synthesized to
  runnable test paths (e.g. `tests/<slug>.test.ts`). That synthesis is
  itself a planning decision (which test framework, which path
  convention) and belongs to a later slice. Slice 1 emits each
  `criterion` as a `Verification` with `kind: 'criterion'` and
  `target: criterion.content` so the linkage is preserved verbatim and
  cook will surface "no runnable target yet" loudly rather than
  pretending to verify.
  → VALIDATE: projector test pins this kind/target shape; cook-side
    behaviour against an unrunnable target is out of scope here.

- RISK: Stable slice ids — slug-from-content is fragile (content edits
  rename slices). Use `req-<kindOrdinal>` as the stable id; record a
  human-readable `definition` (the requirement content verbatim) for
  agent context. Same convention for the default epic.
  → MITIGATION: pin `req-<kindOrdinal>` in the test; never include
    content-derived characters in the id.

- RISK: Cross-mini-library boundary — the orchestrator package must NOT
  import `@/server/*` to avoid coupling. The `CompletedSpecSnapshot`
  type lives in the orchestrator package (so this slice has no inbound
  server dep). A later slice owns the snapshot builder on the server
  side and the wire format between them.
  → MITIGATION: this slice declares the snapshot type locally; the
  server-side builder is a separate slice.

- RISK: The `Plan` schema currently typechecks `Verification.kind` as
  `string`, but cook's runtime treats specific kinds (`unit-test`,
  `integration-test`) specially. Emitting `kind: 'criterion'` is a new
  enum member that cook doesn't recognise as runnable.
  → MITIGATION: explicit non-goal for slice 1 — the projection's output
  is reviewable, not yet runnable end-to-end. The acceptance criterion
  "round-trips through loadPlan" exercises shape, not runtime. End-to-
  end cook execution is the explicit subject of the LATER end-to-end
  wiring slice (frontier acceptance #5), which lives after the LLM
  planning + reconciliation slices fill in `unit-test` /
  `integration-test` targets.
```

### Acceptance Criteria

```
✓ `projectCookPlanFromSpec(snapshot)` exported from
  `cook-plan-projection.ts`; pure (no I/O, no globals, no LLM).

✓ `CompletedSpecSnapshot` type exported from `cook-plan-projection.ts`
  with the shape declared in Boundary Crossings.

✓ test: empty snapshot ({ requirements: [], criteria: [], edges: [] })
  returns a Plan with one default epic and zero slices.

✓ test: snapshot with N requirements and zero criteria produces N
  slices, each with empty `verification` and empty `depends_on`, each
  attached to the default epic; slice ids are `req-<kindOrdinal>` in
  ascending order.

✓ test: a single `criterion --verifies--> requirement` edge produces a
  `Verification` entry on the target slice with `kind: 'criterion'` and
  `target: criterion.content`; verification ordering follows criterion
  `kindOrdinal`.

✓ test: a `depends_on` edge between two requirements does NOT populate
  `slice.depends_on` (slice 1 intentionally drops graph-read execution
  ordering — that's the LLM planning pass's job).

✓ test: projection is deterministic — calling the projector twice on
  the same snapshot returns structurally-equal Plan objects.

✓ test: Plan-shape round-trip — serialise the projected Plan to YAML
  with the `yaml` package, write to a tmp file, call `loadPlan(path)`
  from `src/orchestrator/src/plan-loader.ts`, and assert structural
  equality with the original Plan. Validates schema-level conformance
  (every slice.epic_id resolves; every slice has the required fields)
  without involving cook runtime.

✓ test: brunch_graphs corpus fixture — a small JSON fixture under
  `src/orchestrator/src/__fixtures__/brunch-graphs-snapshot.json`
  carries the relevant requirement/criterion subset from the spike's
  completed spec 2 (extracted by hand or via a one-off script — record
  which in the test); projector against this fixture produces a Plan
  whose slice count equals the requirement count and whose verification
  coverage equals the spike-reported "every requirement has ≥1
  verifying criterion." This is the spike's positive finding pinned
  as a regression oracle.

✓ `npm run verify` green.
```

### Verification Approach

```
- Inner: cook-plan-projection.test.ts unit tests (empty snapshot, slice
  generation, edge handling, depends_on drop, determinism,
  loadPlan round-trip, brunch_graphs corpus fixture).
- Middle: deferred — server-side snapshot builder + orchestrator↔server
  transport is a later slice; this slice's middle-loop is the
  brunch_graphs corpus fixture standing in for the eventual real
  snapshot.
- Outer: deferred to the end-to-end wiring slice (frontier acceptance
  #5) — a real cook run consuming a generated plan against a brownfield
  fixture.
```

### Promotion / open decisions for the next slice

After slice 1 ships, the next ln-scope pass owns these decisions before
slice 2 (LLM planning pass) is scoped:

- Where the snapshot builder lives (server-side endpoint vs. CLI
  subcommand exporting JSON) and whether the orchestrator reads it via
  filesystem or HTTP.
- Whether epic grouping is part of the LLM call or a separate
  deterministic clustering step.
- Whether the LLM planning pass writes back over the projector's Plan
  (mutating epic / depends_on / verification.target fields) or emits a
  delta that the reconciliation stage applies.
- Whether the demo-mode override is "authored plan-yaml file overrides
  LLM output" (file-based escape hatch) or "deterministic depends_on
  inference rule" (no LLM at all).
