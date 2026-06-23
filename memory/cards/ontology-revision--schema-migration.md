# Ontology revision — schema vocabulary migration

Frontier: ontology-revision (FE-1052)
Status:   active
Mode:     slices
Created:  2026-06-23

## Orientation

- **Seam:** the locked graph vocabulary in `src/graph/schema/{kinds,edges,nodes}.ts` (the drizzle-free taxonomy leaf, D73-L) + the per-category/per-kind metadata in `src/graph/policy/` and `NODE_KIND_METADATA`, validated by `CommandExecutor`. This is the canonical-shape seam FE-1052 owns; consumers (renderers, prompt resources, fixtures) ripple from it.
- **Frontier:** `ontology-revision` (FE-1052) — implements SPEC D87-L (kinds/edges), D88-L (`detail.form`), D89-L (`spec.kind`); design in `docs/design/ONTOLOGY_REVIEW_PROTOCOL.md` §6. Absorbs `graph--edge-impact-remodel` (this file's card 1) and GRAPH_MODEL.md retirement (card 5).
- **Volatile state:** the new vocabulary must be **frozen early** — the web build's compile-time `NODE_KIND_METADATA`/`NodePlane` exhaustiveness (I43-L/I44-L) breaks loudly on drift, and `renderer-golden-coverage` (FE-870, active in a parallel worktree) reconciled GRAPH_MODEL's taxonomy copy; its goldens re-lock against this vocabulary.
- **Main open risk:** the rename ripple is mechanical but wide (35 src + 27 fixture files); a missed literal compiles only because some callers use string literals rather than the enum. Mitigate by driving the enum change first and letting type errors enumerate the callers, plus a grep sweep for residual string literals.

Posture: proving (inherited from ontology-revision). Each slice lands a real proof — the new vocabulary survives contact with all callers + the CommandExecutor structural suite — not a study step.

Cross-cutting obligations (all cards):
- Keep the drizzle-free taxonomy leaf intact (D73-L): enums stay in `graph/schema/kinds.ts`; `db/schema.ts` imports them.
- Pre-release posture (POSTURE.md prototype + high-stakes): **regenerate** fixtures/seeds to the new vocabulary; do not add compatibility shims for old-vocabulary data.
- Role-named edge endpoints normalize through `EDGE_CATEGORY_METADATA` (D53-L); do not reintroduce `{category, source, target}` authored dialects.
- Do **not** build the deferred items (`actor`, `scenario`, `conflict`, `participation`, `coverage`, `bench` plane, project graph + `role`).

---

## Card 1 — Edge vocabulary + impact remodel  [full · done]

### Target Behavior

The graph edge category set is the D87-L vocabulary (`witness`, `rationale`, `exclusion`, `cross_reference` + new `refinement`; 8→9) with impact declared as `affected` + `impactKind` + `stanceRequired`, and `npm run verify` passes across all callers and regenerated fixtures.

### Full-card cold-start reads

```
- memory/SPEC.md   — D87-L (edge renames + refinement, stance preserved), D51-L (closed edge set + ReconciliationNeed substrate), D53-L (role-named endpoints), D63-L (basis)
- memory/PLAN.md    — frontier: ontology-revision
- memory/cards/graph--edge-impact-remodel.md — the affected/impactKind/stanceRequired remodel (absorbed here) + the refinement impact DECIDE
- docs/design/ONTOLOGY_REVIEW_PROTOCOL.md — §6.3 edge deltas, §6.7 witness/stance
- src/graph/schema/edges.ts, src/graph/schema/kinds.ts (EDGE_CATEGORIES), src/graph/policy/category-policy.ts — current edge metadata + stance check
```

### Boundary Crossings

```
→ src/graph/schema/kinds.ts (EDGE_CATEGORIES enum)
→ src/graph/schema/edges.ts (EdgeCategory doc + stance type) + src/graph/policy/category-policy.ts (EDGE_CATEGORY_METADATA, edgeImpact, assertStanceLocality)
→ all callers using edge-category string literals (≈35 src files) + role-named edge drafts + CommandExecutor edge validation
→ fixtures/seeds (≈27 json) regenerated to new vocabulary
→ exit: npm run verify green
```

### Risks and Assumptions

```
- RISK: a caller uses a bare string literal ('proof') not the enum, so the rename compiles silently wrong.
    → MITIGATION: after the enum change, grep-sweep src + .fixtures for the 4 old edge names; fail the sweep if any remain outside historical SPEC/PLAN/archive prose.
- ASSUMPTION: refinement's affected/impactKind can be decided now (card flags it DECIDE).
    → IMPACT IF FALSE: a wrong impact value mis-propagates reconciliation traversal (future M4/M5), not current behavior (traversal not built).
    → VALIDATE: decide against the documented propagation rule; default lean affected:target / impactKind:advisory unless cascade earns its keep; pin by the per-category guard.
- ASSUMPTION: pre-release posture permits regenerating fixtures rather than migrating them.
    → IMPACT IF FALSE: would need a data migration; SPEC/PLAN/POSTURE currently say regenerate.
    → VALIDATE: confirmed by AGENTS.md development-phase posture + D-level migration rule.
```

### Posture check (proving)

Landing card 1 is a tracer bullet on the **invariants** axis: it stabilizes the renamed edge seam and proves the new 9-category set passes the full `CommandExecutor` edge-validation + stance + supersession-acyclicity suite. It breaks loudly if any caller or fixture still speaks the old vocabulary. Build it.

### Acceptance Criteria

```
✓ enum            — EDGE_CATEGORIES = [dependency, witness, rationale, realization, refinement, exclusion, composition, cross_reference, supersession]; stance valid only on witness/rationale.
✓ metadata        — EDGE_CATEGORY_METADATA carries affected + impactKind + stanceRequired (impactOn*Change removed); criteriaHelpSignal (true only for witness) + projectionEffect retained; refinement row decided explicitly + guarded.
✓ accessor        — edgeImpact() reads affected/impactKind directly; assertStanceLocality reads stanceRequired (no hardcoded witness/rationale check).
✓ callers         — every src caller of the 4 old edge names updated; grep sweep finds no residual old edge literal outside historical prose.
✓ fixtures        — all .fixtures json regenerated to new edge vocabulary.
✓ invariant-doc   — "endpoint order carries no impact meaning; direction is affected, transitivity is impactKind" stated at the metadata head.
✓ green           — npm run verify passes.
```

### Verification Approach

```
- Inner: type-aware lint + CommandExecutor edge-validation/stance/supersession tests re-pointed to new vocabulary; per-category affected/impactKind/stanceRequired mapping guard.
- Middle: existing graph round-trip/property tests over regenerated fixtures.
```

### Expected touched paths (tentative)

```
src/graph/schema/
├── kinds.ts                       ~  (EDGE_CATEGORIES rename + refinement)
├── edges.ts                       ~  (EdgeCategory doc, stance type)
src/graph/policy/
├── category-policy.ts             ~  (affected/impactKind/stanceRequired; refinement row)
├── __tests__/                     +? (per-category mapping guard)
src/graph/projection/direction.ts  ~  (edgeImpact thin accessor)
src/graph/command-executor/        ~  (edge validation, role-named-edge-draft stance)
src/graph/**                       ~  (remaining edge-literal callers)
src/.pi/**, src/projections/**, src/renderers/**  ~  (edge-literal callers)
.fixtures/**/*.json                ~  (regenerate to new edge vocabulary)
```

---

## Card 2 — Node vocabulary (renames + adds)  [light · done]

> **Card-2 follow-up (2026-06-23): `intentKindCategory` axis stripped, not extended.** The build initially added a 4th category value `'elicitation'` (a readiness-*band* name) to fit `story`/`unknown` into the `basic|structural|reasoning` model — a conflation of two distinct axes (D56-L category vs D64-L band). Investigation found the entire category axis had **no code/test/prompt reader** (only a definition + one re-export; I36-L's "covered" citation was to a non-existent test). Per the user's call and "no property without a clear reader," the axis was **removed entirely** rather than fixed: deleted `IntentKindCategory` + `intentKindCategory()` from `nodes.ts` and the re-export from `graph/index.ts`; D56-L rewritten (no category axis), both I36-L rows corrected, the Lexicon entry retired, D61-L/Claim rephrased to name the truth-bearing kinds directly. The readiness band (D64-L) remains the only live grouping over kinds.

### Objective

The node kind set is the D87-L vocabulary: `validation_method→vv_method`, `obligation→vv_obligation`; adds `entity` (design), `sketch` (design), `story` (intent/elicitation band), `unknown` (intent); `thesis` kept with sharpened definition; `criterion` confirmed at label `AC`. `NODE_KIND_METADATA` (labels + bands + category) and the kind-category derivation reflect the new set; callers + fixtures updated; `npm run verify` green.

### Light-card cold-start reads

```
- memory/SPEC.md   — D87-L (node renames/adds, thesis sharpening), D54-L/D56-L (node shape + kinds + category), D62-L (NODE_KIND_METADATA codes), D64-L (readiness bands), D65-L/D75-L (unknown vs elicitation_gaps distinction)
- memory/PLAN.md    — frontier: ontology-revision
- docs/design/ONTOLOGY_REVIEW_PROTOCOL.md — §6.2 node deltas, §6.6 epistemic triad
- src/graph/schema/{kinds.ts,nodes.ts} — INTENT/ORACLE/DESIGN_KINDS + NODE_KIND_METADATA
```

### Acceptance Criteria

```
✓ INTENT_KINDS adds story + unknown; ORACLE_KINDS renames to vv_method/vv_obligation; DESIGN_KINDS adds entity + sketch.
✓ NODE_KIND_METADATA: vv_method=VV, vv_obligation=O, entity=ENT, sketch=SKT, story=ST, unknown=UNK; readiness bands assigned (story/unknown→elicitation; entity/sketch→design plane). [Intent-category assignment removed — the axis was stripped, see follow-up note above.]
✓ thesis definition/prompting sharpened (testable/refutable/refinable) without renaming the kind; claim stays the umbrella (D61-L).
✓ all callers of validation_method/obligation updated; fixtures regenerated; npm run verify green.
```

### Verification Approach

```
- Inner: CommandExecutor per-plane kind validation; NODE_KIND_METADATA label/band guard (I39-L); web NodePlane exhaustiveness (I43-L/I44-L) stays green. (Kind-category derivation tests removed with the axis.)
- Middle: graph round-trip over regenerated fixtures.
```

### Assumption dependency

`Depends on: D87-L` — node shape is decided; `unknown` is a node kind distinct from `elicitation_gaps` (D65-L confirmed in grill).

### Expected touched paths (tentative)

```
src/graph/schema/{kinds.ts,nodes.ts}  ~
src/graph/command-executor/**          ~
src/web/components/node-card.tsx       ~  (plane/label exhaustiveness)
.fixtures/**/*.json                    ~
```

---

## Card 3 — `detail.form` union on claim kinds  [light · done]

### Objective

`detail` extends to claim kinds `requirement`/`criterion`/`invariant` as a `form`-discriminated union (`plain|gherkin|formal|given`), validated by `CommandExecutor` and advertised at the agent/dev-RPC mutation boundary; `kind` drives behavior, `form` is inert payload; axiom/given rides `context`+`form:"given"`.

### Light-card cold-start reads

```
- memory/SPEC.md   — D88-L (detail.form mechanism), D54-L (per-kind detail contract), I37-L (detail validation invariant)
- memory/PLAN.md    — frontier: ontology-revision
- docs/design/ONTOLOGY_REVIEW_PROTOCOL.md — §6.4 detail.form, §6.6 given routing
- src/graph/schema/nodes.ts — NodeDetail union + per-kind detail schemas; CommandExecutor detail validation
```

### Acceptance Criteria

```
✓ NodeDetail gains the form-discriminated union on requirement/criterion/invariant (+ context form:"given"); decision/term detail unchanged.
✓ CommandExecutor validates form payloads per kind; kind drives band/edge-legality/source-question (never form). I37-L updated.
✓ agent mutate_graph + dev-RPC mutation boundary schemas advertise the form companions (no opaque Unknown).
✓ npm run verify green.
```

### Verification Approach

```
- Inner: CommandExecutor detail-required/prohibited/form-shape tests; boundary schema companion tests.
- Middle (optional, route to ln-oracles): discriminated-union validation shape if it needs middle-loop design.
```

### Assumption dependency

`Depends on: D88-L` — mechanism decided; rides the existing closed-detail pattern.

### Decided (form payload shapes; §6.4 left them as `…`)

- `plain`: `{ form }` only — the default; absent `detail` is equivalent.
- `gherkin`: `{ form, given?: string[], when?: string[], then: string[] }` — `then` required non-empty (the AC outcome).
- `formal`: `{ form, language: string, statement: string }` — LEAN/Dafny round-trip target + text.
- `given`: `{ form, statement: string }` — axiom statement on a `context` node.
- Legality table (`NODE_DETAIL_FORMS` in `nodes.ts`): claim kinds → `plain|gherkin|formal`; `context` → `given` only. One source of truth feeds both the CommandExecutor validator and the two boundary schemas.

### Expected touched paths (tentative)

```
src/graph/schema/nodes.ts              ~  (form union types + CLAIM_FORM_JSON_SCHEMAS + NODE_DETAIL_FORMS table)
src/graph/index.ts                     ~  (re-export form surface)
src/graph/command-executor/command-validation.ts  ~  (validateClaimFormDetail + per-form validators)
src/.pi/extensions/graph/tool-schemas.ts          ~  (mutate_graph boundary form companions)
src/rpc/methods/dev-graph.ts                       ~  (dev-RPC mutation schema form companions)
src/graph/__tests__/{command-executor,mutate-graph-edge-schema}.test.ts  ~  (form behavior + boundary)
```

---

## Card 4 — `spec.kind` field + story/unknown wiring  [light · next]

### Objective

The `specs` row gains `kind = product|feature|function` (D89-L); `story` wires as the intra-spec grouping node (reusing composition/witness) and `unknown` as an intent claim; project-graph + `role` stay deferred; `readiness_band` stays computed.

### Light-card cold-start reads

```
- memory/SPEC.md   — D89-L (spec.kind ownership relation), D61-L (spec identity), D45-L (readiness computed not stored), D11-L (workspace→spec→session)
- memory/PLAN.md    — frontier: ontology-revision
- docs/design/ONTOLOGY_REVIEW_PROTOCOL.md — §6.5 spec scope model
- src/db/schema.ts (specs table), src/graph/** (createSpec/getSpec)
```

### Acceptance Criteria

```
✓ specs row carries kind (product|feature|function); createSpec/getSpec persist/read it; default chosen for existing scratch specs via migration/regeneration.
✓ story node reuses composition (story→requirement) + witness; no new edge for it.
✓ unknown node usable as an intent claim; distinct from elicitation_gaps (no gaps-agenda conflation).
✓ project-graph + role:main|alt NOT built (deferred); readiness_band remains a computed rollup.
✓ npm run verify green.
```

### Verification Approach

```
- Inner: createSpec/getSpec persistence tests for kind; story/unknown CommandExecutor legality tests.
- Middle: graph round-trip over a spec carrying kind + story/unknown nodes.
```

### Assumption dependency

`Depends on: D89-L` — spec scope decided; project-graph deliberately deferred.

### Expected touched paths (tentative)

```
src/db/schema.ts                       ~  (specs.kind column)
src/graph/**                           ~  (createSpec/getSpec, story/unknown wiring)
.fixtures/**/*.json                    ~
```

---

## Card 5 — Retire `docs/design/GRAPH_MODEL.md`  [light · last]

### Objective

`docs/design/GRAPH_MODEL.md` is retired: its taxonomy tables live in code/READMEs, its invariants in SPEC, its prompting guidance in a real home, the ~15 SPEC citations re-pointed, and the doc deleted.

### Light-card cold-start reads

```
- memory/SPEC.md   — D87-L/D88-L/D89-L + every D-row citing GRAPH_MODEL.md
- memory/PLAN.md    — frontier: ontology-revision (accessory: graph-model-doc-retirement)
- docs/design/GRAPH_MODEL.md — the doc being retired (current-state contract)
- src/graph/README.md, src/graph/schema/* — the canonical homes content moves to
```

### Acceptance Criteria

```
✓ taxonomy/edge/node tables live in code (NODE_KIND_METADATA / EDGE_CATEGORY_METADATA) or graph READMEs, not the doc.
✓ durable invariants/prompting guidance rehomed (SPEC / READMEs / prompt resources).
✓ the ~15 SPEC citations of GRAPH_MODEL.md re-pointed to their new homes.
✓ docs/design/GRAPH_MODEL.md deleted; no dangling links across SPEC/PLAN/READMEs.
✓ npm run verify green.
```

### Verification Approach

```
- Inner: link-integrity grep (no surviving GRAPH_MODEL.md references except historical archive); check:skills.
- Middle: none (doc move).
```

### Assumption dependency

`None` — pure canonical-doc move; depends only on cards 1–4 having landed the code that becomes canonical.

### Expected touched paths (tentative)

```
docs/design/GRAPH_MODEL.md             -  (deleted)
memory/SPEC.md                         ~  (re-point ~15 citations)
src/graph/README.md                    ~  (absorb taxonomy/invariants)
src/graph/schema/*                     ~? (doc comments)
```
