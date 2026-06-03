<!-- CARDS.md — prepared scope-card queue for one live frontier item.
     Created by ln-scope · consumed by ln-build · retired when queue exhausted.
     Frontier: spec-to-cook-plan (FE-800).
     Parent branch: ka/fe-800-spec-to-cook-plan (stacked on ka/fe-764). -->

# Scope cards — FE-800 spec-to-cook-plan

FE-764 queue (slices 1–4) shipped on `ka/fe-764-petri-sync-server`; that
queue is retired. FE-800 now owns this file. Slices 1 (deterministic
projection) and 2 (LLM planning pass) landed; slice 3 (deterministic
reconciliation) is the next card. Slices 4+ (end-to-end wiring, demo
override) are NOT pre-queued — each depends on shape findings from the
prior slice.

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

Slice 1's open decisions resolved by slice 2's scoping:

- **Epic grouping**: part of the same single LLM round-trip (per the
  spike's one-call shape). Not a separate clustering step.
- **Write-back vs delta**: slice 2 emits a typed `PlanningEnrichment`
  delta and does NOT mutate the input Plan. Apply + reconciliation is
  slice 3.

Open decisions still deferred (slice 3 or later):

- Where the snapshot builder lives (server-side endpoint vs. CLI
  subcommand exporting JSON) and the orchestrator↔server transport.
- Whether the demo-mode override is "authored plan-yaml file overrides
  LLM output" (file-based escape hatch) or "deterministic depends_on
  inference rule" (no LLM at all).
- ID-existence + cycle + dangling-dep-onto-constraint reconciliation
  (slice 3's whole subject).

---

## Slice 2: LLM planning pass — execution-order DAG + epic grouping + non-buildable detection

**Status:** done. `src/orchestrator/src/cook-plan-llm-planning.ts`
exports `planExecutionOrdering(plan, runModel) → PlanningResult`,
`planningEnrichmentSchema` (Zod), `PlanningEnrichment` /
`PlanningResult` / `RunModel` types, and `defaultRunModel` (Anthropic
`generateText` + `Output.object`, model knob via
`SPEC_TO_COOK_PLAN_MODEL` env). 7 unit tests + 1 opt-in real-LLM test
skipped unless `PLANNING_REAL_LLM=1 + ANTHROPIC_API_KEY` (covers
success, semantic-passthrough of hallucinated ids, missing-field +
wrong-type parse failures, thrown-runModel failure, empty-plan
short-circuit, prompt content). `npm run verify` green (1592 tests, 1
skipped; one unrelated transient flake on retry in
`src/server/app.test.ts` — different test from slice 1's flake but
same parallel-test pattern, passes in isolation, not FE-800-related).

### Target Behavior

A function `planExecutionOrdering(projectedPlan, runModel)` takes the
slice-1 projected Plan plus an injected `runModel` LLM seam, performs
one structured LLM round-trip, and returns a `PlanningResult` discriminated
union: on success a typed `PlanningEnrichment` carrying per-slice
`dependsOn` arrays, proposed epic grouping with assigned slice ids, and
the set of slice ids the model flagged as non-buildable constraints; on
failure a `{ status: 'failed'; reason: string }` shape so slice 3 can
fall back deterministically. The function does NOT mutate the input
Plan, does NOT validate id existence, does NOT check for cycles, and
does NOT redirect dangling deps — all of that is slice 3's deterministic
reconciliation.

### Boundary Crossings

```
→ src/orchestrator/src/cook-plan-llm-planning.ts (new — pure logic +
   injected LLM seam, mirroring the reconciliation-agent pattern at
   src/server/reconciliation-agent.ts:61)
→ consumes:
    Plan (existing — src/orchestrator/src/types.ts)
    zod/v4 (already in deps via @ai-sdk/anthropic transitive — confirm
       at build; orchestrator already uses zod in pi-actions area or
       can adopt the same version as the server)
    @ai-sdk/anthropic + ai (generateText + Output.object) — already used
       by src/server/reconciliation-agent.ts, src/server/observer.ts
→ exits at:
    src/orchestrator/src/cook-plan-llm-planning.test.ts (new — stubbed
       runModel for inner-loop; opt-in real-LLM test gated on
       PLANNING_REAL_LLM=1)
```

This slice deliberately does NOT touch:

- `src/orchestrator/src/cook-plan-projection.ts` — the projector stays
  pure-pure; this slice composes after it but does not modify it.
- `src/orchestrator/src/cook-cli.ts` — no CLI surface yet; slice 4 or
  later wires the full pipeline (projection → LLM → reconciliation →
  write plan.yaml) behind a flag.
- `src/server/*` — the snapshot builder + transport stays a separate
  slice; this slice's tests use slice 1's projector against the
  in-package brunch_graphs fixture.

### Risks and Assumptions

```
- ASSUMPTION: The reconciliation-agent pattern (injected
  `runModel: (prompt: string) => Promise<unknown>` + `defaultRunModel`
  using `generateText` + `Output.object` + Zod schema) translates
  cleanly to the orchestrator package. The orchestrator already imports
  `@ai-sdk/anthropic` transitively via pi-actions (`pi` subprocess);
  importing it directly in slice 2 follows the same dependency surface.
  → VALIDATE: cook-plan-llm-planning.ts imports the same packages and
    pattern as reconciliation-agent.ts; unit tests run without any
    provider key (stubbed runModel); the real-LLM opt-in test only
    runs when PLANNING_REAL_LLM=1 + ANTHROPIC_API_KEY are set.

- ASSUMPTION: One single `generateText` + `Output.object` round-trip
  is enough to produce depends_on + epic grouping + non-buildable
  flagging together. The 2026-06-03 spike against completed spec 2
  (~900 input / 640 output tokens with claude-sonnet-4) confirmed
  this empirically.
  → VALIDATE: opt-in real-LLM test against the brunch_graphs corpus
    fixture asserts the model returns a well-formed PlanningEnrichment
    (parses through the Zod schema, no exceptions); spike rerun
    expected to land within the same token order.

- ASSUMPTION: Inline prompt string in cook-plan-llm-planning.ts is the
  right shape for slice 2 (orchestrator doesn't have a renderPromptAsset
  loader; pi-actions reads prompt files for subprocesses, not in-process
  LLM calls). Promote to a sibling .md file + a tiny renderer if the
  prompt grows past ~50 lines or needs structured variable substitution.
  → VALIDATE: the prompt fits inline; slice 3 or a later slice can
    promote without touching the contract.

- ASSUMPTION: The Zod schema for the LLM output enforces SHAPE only —
  arrays/strings/objects — and does NOT semantically validate that
  referenced slice ids exist in the input Plan, that the depends_on
  graph is acyclic, that epics partition slices cleanly, or that
  non-buildable slice ids are real. All four checks are slice 3's job.
  → VALIDATE: slice 2 unit tests pin that the parser ACCEPTS a
    well-typed but semantically wrong LLM output (e.g. a depends_on
    referring to a nonexistent slice id); a separate test pins that the
    parser REJECTS structurally malformed output (missing required
    field, wrong type) by returning `{ status: 'failed' }`.

- ASSUMPTION: Structurally-recoverable failure shape mirrors
  reconciliation-agent.ts's pattern. LLM exceptions, parse errors, and
  schema violations all collapse to
  `{ status: 'failed'; reason: string }` so slice 3 can choose
  deterministic fallback (empty depends_on, single default epic) rather
  than crashing the pipeline.
  → VALIDATE: tests for (a) thrown runModel, (b) malformed model
    output, (c) zod parse error each return the failed shape with a
    non-empty reason string.

- RISK: LLM hallucinated slice ids in depends_on or epic assignments.
  Slice 2 deliberately lets these pass the parser (semantic check =
  slice 3). If slice 3 then drops them silently, the user can lose
  ordering signal without warning.
  → MITIGATION: slice 3 will surface drops via explicit warnings;
    slice 2 carries no extra burden. Document the deferral in the
    PlanningEnrichment doc comment.

- RISK: LLM emits cycles in depends_on. Same posture — slice 2 parses,
  slice 3 breaks cycles + warns.
  → MITIGATION: same as above; documented as a deferred concern.

- RISK: The orchestrator package adopting `zod/v4` directly creates a
  second zod consumer (server already uses zod/v4). If the version
  drifts, the schemas diverge.
  → MITIGATION: pin to whatever zod/v4 the server's package.json
    already uses (no new dep declaration; share via root). If the root
    package.json doesn't expose it, declare it once and align with the
    server's import path.

- RISK: Inner-loop tests that import `@ai-sdk/anthropic` may load the
  Anthropic provider (which reads env vars at module init) and break
  in CI where ANTHROPIC_API_KEY is unset.
  → MITIGATION: keep the `defaultRunModel` import in a function body or
    behind a lazy import so unit tests that pass a stubbed runModel
    never touch the provider. The reconciliation-agent pattern already
    works this way — emulate it.
```

### Acceptance Criteria

```
✓ `planExecutionOrdering(plan, runModel)` exported from
  `cook-plan-llm-planning.ts`. Signature:
    (plan: Plan, runModel: (prompt: string) => Promise<unknown>)
      => Promise<PlanningResult>
  where PlanningResult =
    | { status: 'succeeded'; enrichment: PlanningEnrichment }
    | { status: 'failed'; reason: string }

✓ `PlanningEnrichment` exported and typed as:
    {
      sliceDependencies: { sliceId: string; dependsOn: string[] }[];
      epics: { id: string; summary: string; sliceIds: string[] }[];
      nonBuildableSliceIds: string[];
    }
  Zod schema enforces shape; existence/cycle/coverage checks deferred
  to slice 3.

✓ test: stubbed runModel returning a well-formed object produces
  `{ status: 'succeeded', enrichment }` with the expected delta.

✓ test: stubbed runModel returning a well-typed but semantically wrong
  object (depends_on references a slice id NOT present in the input
  Plan) still parses as `succeeded` — slice 2 does not enforce
  semantic correctness.

✓ test: stubbed runModel returning malformed JSON-equivalent (missing
  required field, wrong type) returns `{ status: 'failed', reason }`
  with a non-empty reason string.

✓ test: stubbed runModel throwing an error returns
  `{ status: 'failed', reason }` carrying the error message.

✓ test: empty Plan (zero slices) — slice 2 still calls the LLM (or
  short-circuits to empty enrichment, decided in build) and returns a
  well-formed result. Pick whichever is simpler at build time; pin the
  chosen behaviour with a test.

✓ test: the prompt string includes every slice's id and definition
  (asserted by capturing the prompt the stubbed runModel was called
  with).

✓ `defaultRunModel` exported and uses
  `generateText({ model: anthropic(process.env.SPEC_TO_COOK_PLAN_MODEL
    || 'claude-sonnet-4-20250514'), prompt, output: Output.object({ schema }) })`
  mirroring reconciliation-agent.ts:114.

✓ Opt-in real-LLM integration test gated on
  `process.env.PLANNING_REAL_LLM === '1'` AND `process.env.ANTHROPIC_API_KEY`:
  loads the brunch_graphs corpus fixture (slice 1 added it), projects
  via projectCookPlanFromSpec, runs planExecutionOrdering with
  defaultRunModel, asserts result.status === 'succeeded', and asserts
  at least one slice has a non-empty dependsOn or appears in
  nonBuildableSliceIds (proves the model is actually doing useful
  work). Skipped by default in CI.

✓ `npm run verify` green.
```

### Verification Approach

```
- Inner: cook-plan-llm-planning.test.ts unit tests with stubbed
  runModel. Covers success, semantic-passthrough, parse failure, thrown
  failure, empty plan, prompt content.
- Middle: opt-in real-LLM integration test against the brunch_graphs
  fixture (PLANNING_REAL_LLM=1). Validates the spike's claim survives
  contact with the production prompt + schema shape. Cost: ~1 round-
  trip per local run when enabled.
- Outer: deferred to slice 4 / end-to-end wiring. Once reconciliation
  (slice 3) and CLI wiring (slice 4) land, an end-to-end cook run
  consuming the generated plan provides the real outer-loop signal.
```

---

## Slice 3: deterministic reconciliation — projected Plan + LLM enrichment → cook-runnable Plan

**Status:** done. `src/orchestrator/src/cook-plan-reconciliation.ts`
exports `reconcileCookPlan(projected, enrichment) → { plan, warnings }`
with the full `ReconciliationWarning` discriminated union (synthesized
verification, self-loops, nonexistent ids, cycle-break edges,
non-buildable slices + deps, empty epics, orphan→default).
Acceptance criteria covered by 12 unit tests in
`src/orchestrator/src/cook-plan-reconciliation.test.ts`, including the
2-cycle / 3-cycle determinism pin and a brunch_graphs corpus
end-to-end test that round-trips the reconciled plan through
`loadPlan`. `npm run verify` green. Slice 4 (CLI wiring +
plan.yaml emission + warning surfacing) is next.

### Target Behavior

A pure function `reconcileCookPlan(projected, enrichment) → { plan, warnings }`
takes slice 1's projected Plan plus slice 2's `PlanningEnrichment` and
returns a cook-runnable Plan whose `depends_on` graph is acyclic and
references only existing slice ids, whose epics partition the surviving
slices, whose non-buildable slices are removed (their definition text
preserved in the warnings), and whose every surviving slice has exactly
one `kind: 'unit-test'` verification entry with `target: 'tests/<sliceId>.test.ts'`
plus a `definition` enriched with the slice's verifying-criteria text so
the pi-agent has enough context to author the test file. Anything that
gets dropped, redirected, broken, or synthesized is captured in a
structured `ReconciliationWarning[]` rather than silently swallowed.

### Boundary Crossings

```
→ src/orchestrator/src/cook-plan-reconciliation.ts (new — pure)
→ consumes:
    Plan (existing — src/orchestrator/src/types.ts)
    PlanningEnrichment (slice 2 — src/orchestrator/src/cook-plan-llm-planning.ts)
→ exits at:
    src/orchestrator/src/cook-plan-reconciliation.test.ts (new — unit
       tests over hand-crafted Plan+enrichment pairs covering each
       reconciliation rule + the brunch_graphs corpus end-to-end)
```

This slice deliberately does NOT touch:

- `src/orchestrator/src/cook-plan-projection.ts` — projector stays untouched.
- `src/orchestrator/src/cook-plan-llm-planning.ts` — planning pass
  contract stays untouched; reconciliation consumes its output.
- `src/orchestrator/src/cook-cli.ts` — no CLI surface yet (slice 4).
- `src/orchestrator/src/net-compiler.ts` — cook engine unchanged;
  slice 3's output is already shape-compatible with cook's existing
  `Plan` consumer (`verification[0]?.target` at net-compiler.ts:313).

### Risks and Assumptions

```
- ASSUMPTION: Dropping non-buildable slices entirely (rather than
  retaining them as informational) is the right semantics for cook.
  Cook builds every slice; a slice it can't act on would either run
  forever or surface a confusing failure. Dropping with a warning
  preserves reviewer awareness without polluting the build graph.
  → VALIDATE: test fixture with one non-buildable slice asserts that
    slice is gone from the output Plan AND a warning carries its
    definition text. If the user later wants constraint-style slices
    represented in the cook plan, that's a follow-on (e.g. constraint
    annotations passed to pi-agent prompts), not slice 3 territory.

- ASSUMPTION: Cycle-break rule = Kahn's algorithm with deterministic
  tie-breaking by lexicographic sliceId. When no in-degree-zero node
  remains but slices remain, take the lexicographically-smallest
  remaining sliceId, drop all its incoming dependsOn edges (warning
  each), and continue. This is purely deterministic, breaks every
  cycle, and the warning surfaces what got dropped.
  → VALIDATE: test fixture with a 2-cycle (A→B, B→A) and a 3-cycle
    asserts both cycles break, output topo-sortable, warnings name the
    dropped edges; deterministic across re-runs (call twice, identical
    warnings).

- ASSUMPTION: Verification synthesis = exactly one `{ kind: 'unit-test',
  target: 'tests/<sliceId>.test.ts' }` per surviving slice, regardless
  of how many criterion verifications slice 1 emitted. Cook's
  net-compiler reads only the first verification's target
  (net-compiler.ts:313); collapsing to one entry matches cook's actual
  reader and the existing fixture convention (fixtures/txt/plan.yaml
  has one verification per slice). The criterion text moves into
  `slice.definition` so the pi-agent still sees what to test.
  → VALIDATE: test asserts every output slice has exactly one
    verification, kind `unit-test`, target `tests/<sliceId>.test.ts`.
    Separate test asserts the slice's definition was enriched with
    criterion text when the projection carried `kind: 'criterion'`
    verifications.

- ASSUMPTION: A slice present in the projected Plan but absent from
  every LLM-proposed epic is placed in a default epic (id `default`,
  summary `All requirements`). Mirrors slice 1's default-epic fallback
  so the contract is consistent.
  → VALIDATE: test fixture with an LLM enrichment that omits one
    surviving slice from every epic asserts that slice lands in the
    default epic; default epic is created on-demand only when needed
    (no empty default-epic in the output when LLM covers everything).

- ASSUMPTION: Epic ids that appear in the LLM enrichment but contain
  zero surviving slices are dropped entirely (no orphan epics in the
  output). Cook's plan-loader doesn't require empty epics to be
  preserved.
  → VALIDATE: test fixture where the LLM proposed three epics but only
    two have surviving slices after non-buildable removal asserts the
    output has exactly two epics + a third "dropped empty epic"
    warning.

- ASSUMPTION: `ReconciliationWarning` is a typed discriminated union
  with `code` (machine label), `message` (human prose), and per-kind
  payload (e.g. `{ code: 'cycle-break-dropped-edge', from, to }`). Slice
  4 will surface the warnings to the user when writing plan.yaml.
  → VALIDATE: warning shape tested directly; warnings are stable
    enough that slice 4's serialization layer can rely on them.

- ASSUMPTION: dependsOn edges between two slices where one is
  non-buildable get DROPPED (not redirected through the dep graph).
  Redirection would silently rewire ordering in ways the reviewer
  didn't author. A dropped edge with a clear warning is auditable.
  → VALIDATE: test fixture with slice A depending on non-buildable
    slice B asserts A's dependsOn is empty in output and a warning
    names the drop.

- RISK: Slice id collisions across the synthesized default epic and
  any LLM-proposed epic with id `default`. The LLM was told to use
  kebab-case slugs but might pick `default`.
  → MITIGATION: if the LLM proposed an epic id `default`, preserve it
    (merge with the fallback bucket). The id-as-key behavior collapses
    naturally; warn if a merge happens.

- RISK: Definition enrichment with criterion text could grow the
  definition string past whatever budget the pi-agent prompt template
  imposes downstream. The current pi-agent prompt design hasn't been
  audited for length.
  → MITIGATION: cap the enriched definition at a reasonable size (e.g.
    drop after N criteria with an ellipsis warning) only if a real
    fixture hits the cap. For slice 3, just enrich without truncation;
    add capping in a hardening slice if it bites.
```

### Acceptance Criteria

```
✓ `reconcileCookPlan(projected, enrichment)` exported from
  `cook-plan-reconciliation.ts`; pure; returns
  `{ plan: Plan; warnings: ReconciliationWarning[] }`.

✓ `ReconciliationWarning` exported as a discriminated union including
  at minimum:
    - `{ code: 'dropped-dependency-nonexistent-id', sliceId, missingId }`
    - `{ code: 'dropped-self-loop', sliceId }`
    - `{ code: 'cycle-break-dropped-edge', sliceId, droppedDependsOn }`
    - `{ code: 'dropped-dependency-on-non-buildable', sliceId, nonBuildableId }`
    - `{ code: 'dropped-non-buildable-slice', sliceId, definition }`
    - `{ code: 'dropped-empty-epic', epicId, epicSummary }`
    - `{ code: 'orphan-slice-assigned-to-default-epic', sliceId }`
    - `{ code: 'synthesized-verification-target', sliceId, target }`

✓ test: every output slice has exactly one verification entry, kind
  `unit-test`, target `tests/<sliceId>.test.ts`; a
  `synthesized-verification-target` warning is recorded per slice.

✓ test: a slice whose projected verifications had `kind: 'criterion'`
  entries gets those criterion texts enriched into its `definition`
  (verifiable by substring assertion); the output `verification` array
  contains ONLY the synthesized unit-test entry.

✓ test: a dependsOn edge referencing a sliceId that doesn't exist in
  the projected Plan is dropped from the output with a
  `dropped-dependency-nonexistent-id` warning.

✓ test: a dependsOn edge from slice A to slice A (self-loop) is dropped
  with a `dropped-self-loop` warning.

✓ test: a 2-cycle (A depends on B, B depends on A) is broken
  deterministically by dropping the incoming edges of the
  lexicographically-smallest sliceId; output is acyclic; warnings name
  the dropped edges; identical across re-runs.

✓ test: a 3-cycle (A→B→C→A) is broken by the same rule; output is
  acyclic; deterministic across re-runs.

✓ test: a dependsOn edge onto a non-buildable slice is dropped with a
  `dropped-dependency-on-non-buildable` warning; the non-buildable
  slice itself is removed from the output Plan with a
  `dropped-non-buildable-slice` warning carrying its definition.

✓ test: an LLM-proposed epic with zero surviving slices is dropped
  from the output with a `dropped-empty-epic` warning.

✓ test: a surviving slice not assigned to any LLM-proposed epic lands
  in a default epic (`id: 'default'`, `summary: 'All requirements'`);
  warning recorded. Default epic is NOT created when every slice is
  already covered.

✓ test: brunch_graphs corpus end-to-end — load the slice-1 fixture,
  project, hand-craft a representative PlanningEnrichment (with one
  dep edge, one non-buildable flag, one orphan slice), reconcile,
  assert (a) output plan round-trips through `loadPlan` after YAML
  serialise, (b) every slice has the synthesized verification target,
  (c) the non-buildable slice is gone, (d) warnings are non-empty.

✓ test: determinism — calling `reconcileCookPlan` twice on the same
  inputs returns structurally-equal outputs (plan + warnings).

✓ `npm run verify` green.
```

### Verification Approach

```
- Inner: cook-plan-reconciliation.test.ts unit tests over hand-crafted
  Plan+enrichment pairs, one per reconciliation rule, plus a corpus
  end-to-end test against the brunch_graphs fixture. All pure, no I/O
  beyond the YAML round-trip.
- Middle: deferred to slice 4 — once CLI wiring composes projection +
  planning + reconciliation, an integration test feeds a real cook run.
- Outer: deferred to slice 4 / Bristol-demo end-to-end run.
```

---

## Slice 4: CLI wiring — `brunch plan` composes projection + planning + reconciliation, writes `.brunch/cook/plan.yaml`, surfaces warnings

**Status:** done. `src/orchestrator/src/cook-plan-emitter.ts` exports
the pure composition `emitCookPlanFromSnapshot(snapshot, { runModel? })`;
`src/orchestrator/src/plan-cli.ts` exports `parsePlanArgs` + `runPlan`;
`src/server/cli.ts` dispatches `brunch plan <snapshot.json>
[--out=<dir>] [--verbose]` to it. Emitter falls back to an empty
enrichment when the LLM throws so a usable (orderless) plan still
emits. Warnings print on stderr with a `  !  ` prefix and human-readable
per-code format. 9 unit tests across
`cook-plan-emitter.test.ts` (3) and `plan-cli.test.ts` (6) cover the
success path, LLM-failure fallback, YAML round-trip, arg parsing,
end-to-end YAML emission, and warning surfacing. `npm run verify`
green (known unrelated `src/server/app.test.ts` flake reproduced once
and cleared on retry, as expected per slice 1/2 notes).

### Scope-weight

Light scope card. The containing seam (`brunch` CLI dispatch in
`src/server/cli.ts` + the orchestrator's `cook-cli.ts` pattern) is
settled; the three composition stages already exist as pure modules
(slices 1, 2, 3); the LLM seam is already in place via slice 2's
injectable `runModel` (default = anthropic). The remaining work is
**glue**: one pure composition function + one CLI command that calls
it, writes YAML, and prints warnings. No new seam, no decision
reversal, no invariant change.

### Objective

Provide a `brunch plan <snapshot.json> [--out=<dir>] [--verbose]`
command that loads a `CompletedSpecSnapshot` from a JSON file, runs
projection → LLM planning → reconciliation, writes the resulting plan
to `<dir>/.brunch/cook/plan.yaml` (default `<dir>` = current working
directory), and surfaces every `ReconciliationWarning` on stderr so a
reviewer can audit slice 2's output before the plan drives `brunch
cook`.

### Acceptance Criteria

```
✓ A new pure composition function `emitCookPlanFromSnapshot(snapshot, {
  runModel })` exported from `src/orchestrator/src/cook-plan-emitter.ts`
  returns `{ plan, warnings, planningResult }`. The `runModel` is
  injectable so unit tests can drive the function without an LLM call.

✓ test: `emitCookPlanFromSnapshot` with an injected `runModel` that
  returns a hand-crafted enrichment composes the three stages and
  returns a reconciled plan whose slice ids come from the snapshot's
  requirements, whose every slice has the synthesized unit-test target,
  and whose `warnings` array carries the reconciliation warnings.

✓ test: when the injected `runModel` throws (LLM failure), the function
  surfaces the `{ status: 'failed', reason }` from slice 2 in
  `planningResult` AND still returns a usable plan by reconciling the
  projected slices against an empty enrichment (so the CLI can still
  emit a plan with no inferred ordering rather than failing the whole
  command).

✓ A new `brunch plan <snapshot.json> [--out=<dir>] [--verbose]` command
  reads the JSON, calls `emitCookPlanFromSnapshot` with
  `defaultRunModel`, writes `<dir>/.brunch/cook/plan.yaml` (creating
  the `.brunch/cook/` directory if missing; default `<dir>` = cwd),
  and prints every warning prefixed with `  !  ` on stderr.

✓ test: `parsePlanArgs(args)` parses `<snapshot.json>`, `--out=<dir>`,
  `--verbose`, and throws a usage error when the snapshot path is
  missing.

✓ test: the emitted plan round-trips through `loadPlan` — write to a
  tmp file via `emitCookPlanFromSnapshot` + `stringifyYaml`, reload
  via `loadPlan`, assert structural equality.

✓ `brunch --help` lists the `plan` command.

✓ `npm run verify` green.
```

### Verification Approach

```
- Inner: `cook-plan-emitter.test.ts` unit tests over the composition
  function with an injected `runModel` (stubbed success + stubbed
  failure). `parsePlanArgs` unit tests in a small CLI-test file under
  the orchestrator package.
- Middle: deferred — once the snapshot builder lands (separate slice),
  an integration test feeds a real DB-derived snapshot through the
  pipeline. For now, the brunch_graphs fixture snapshot is exercised
  by the existing slice-3 corpus test.
- Outer: deferred to the Bristol-demo end-to-end (`brunch plan` →
  `brunch cook --petrinaut-stream`) run; this slice opens that door
  but does not run it as part of CI.
```

### Promotion checklist

- [ ] Change a requirement? — no.
- [ ] Create/retire/invalidate an assumption? — no (uses slice-3
  assumptions as-is).
- [ ] Make a non-trivial design decision? — no (composition order +
  CLI surface follow established cook-cli pattern).
- [ ] Establish a new seam-level invariant? — no.
- [ ] Cross more than two major seams? — no (orchestrator + CLI shell).
- [ ] First touch in an unfamiliar seam from a fresh thread? — no.
- [ ] Cannot name the containing seam? — no.

Stays light.

---

## Slice 5: warning-model hardening — single warning stream, synthesis demoted, formatter co-located

**Status:** done. `cook-plan-reconciliation.ts` exports
`reconciliationWarningCategory` (`'transformation' | 'synthesis'`,
exhaustive over the union) and `formatReconciliationWarning` (one
line per code, co-located with the type definition).
`cook-plan-emitter.ts` introduces `EmitterWarning =
ReconciliationWarning | { code: 'planning-failed'; reason: string }`,
exports `emitterWarningCategory` (`'transformation' | 'synthesis' |
'failure'`) and `formatEmitterWarning`, and pushes one
`planning-failed` warning when the LLM throws — `planningResult` is
preserved untouched. `plan-cli.ts` partitions display by category:
failure + transformation always printed, synthesis only with
`--verbose`. Smoke-tested against `brunch_graphs`: clean case now
prints zero warning lines (was 5 synthesis-noise lines pre-slice).
14 new unit tests across reconciliation (16 new — 8 category + 8
formatter cases), emitter (3 new — planning-failed presence/absence,
category dispatch), plan-cli (1 new + 2 reshaped — verbose-toggles
synthesis, planning-failed in `!`-stream). `npm run verify` green
on first try; total orchestrator suite at 274 tests passing.

### Scope-weight

Light scope card. The containing seam (emitter + reconciliation
warning union) is settled. This slice tightens the audit surface
without changing the projection / planning / reconciliation contracts.
Bundles three `ln-review` findings (#2 synthesized-target noise, #3
planning-failure across two return shapes, #5 formatter colocation).

### Objective

Make the warning stream the **single source of audit truth** for a
cook-plan emit: planning failures appear as warnings (not just on a
separate `planningResult.status`), synthesis events are demoted so
reviewers' eyes are drawn to real transformations, and the human
formatter lives next to the warning union it formats.

### Acceptance Criteria

```
✓ `cook-plan-emitter.ts` defines and exports a new top-level
  `EmitterWarning` discriminated union = `ReconciliationWarning |
  { code: 'planning-failed'; reason: string }`. The emitter returns
  `{ plan, warnings: EmitterWarning[], planningResult }`. When the LLM
  throws, the emitter synthesizes one `{ code: 'planning-failed',
  reason }` warning AND still emits a usable orderless plan via the
  existing empty-enrichment fallback. `planningResult` is preserved
  unchanged for callers that want the raw stage status.

✓ `cook-plan-reconciliation.ts` exports two helpers next to the
  `ReconciliationWarning` type:
    - `reconciliationWarningCategory(w): 'transformation' | 'synthesis'`
      — `'synthesis'` for `synthesized-verification-target`,
      `'transformation'` for every other code. Exhaustive switch.
    - `formatReconciliationWarning(w): string` — moved from
      `plan-cli.ts`'s private `formatWarning`. Same per-code format
      strings; tests assert one example per code.

✓ `cook-plan-emitter.ts` exports `emitterWarningCategory(w):
  'transformation' | 'synthesis' | 'failure'` and `formatEmitterWarning
  (w): string` so callers have one place to ask both questions about
  any warning the emitter produces.

✓ `runPlan` in `plan-cli.ts` prints `failure` and `transformation`
  warnings unconditionally (under the existing `  !  ` prefix) and
  `synthesis` warnings only when `--verbose` is set. The "N reconciliation
  warnings" header counts only what gets printed.

✓ test: emitter — when `runModel` throws, `warnings` contains exactly
  one `{ code: 'planning-failed', reason }` entry whose `reason`
  carries the original error message; `planningResult.status` is
  still `'failed'` (back-compat).

✓ test: emitter — when `runModel` succeeds, no `planning-failed`
  warning appears in the output.

✓ test: reconciliation — `reconciliationWarningCategory` returns
  `'synthesis'` only for `synthesized-verification-target` and
  `'transformation'` for every other code (one assertion per code).

✓ test: reconciliation — `formatReconciliationWarning` produces a
  non-empty string mentioning the code and key payload field for
  every code (one assertion per code).

✓ test: plan-cli — `runPlan` without `--verbose` does NOT print
  `synthesized-verification-target` lines; with `--verbose` it does.
  Transformation warnings (cycle break, dropped non-buildable, etc.)
  are printed in both modes.

✓ test: plan-cli — when `runModel` throws, stderr contains a
  `planning-failed` warning line (single audit stream).

✓ `npm run verify` green.
```

### Verification Approach

```
- Inner: extended unit tests across `cook-plan-emitter.test.ts`,
  `cook-plan-reconciliation.test.ts`, `plan-cli.test.ts`. All pure
  modulo the injected `runModel` and the stderr-capture seam already
  used by `runPlan`.
- Middle: none — no new behavior crosses package boundaries beyond
  what slice 4 already exercises.
- Outer: none.
```

### Promotion checklist

- [ ] Change a requirement? — no.
- [ ] Create/retire/invalidate an assumption? — no.
- [ ] Make a non-trivial design decision? — no (the warning model was
  already typed; this slice only adds a category helper and one new
  union member).
- [ ] Establish a new seam-level invariant? — no (the "warnings are
  the audit surface" intent was already in slice 3's card; this slice
  realizes it more cleanly).
- [ ] Cross more than two major seams? — no (reconciliation + emitter
  + CLI display, all in one package).
- [ ] First touch in an unfamiliar seam from a fresh thread? — no.
- [ ] Cannot name the containing seam? — no.

Stays light.
