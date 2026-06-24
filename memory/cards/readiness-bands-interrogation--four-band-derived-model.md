# Readiness-band four-band derived model (D94-L)

Frontier: readiness-bands-interrogation
Status:   active
Mode:     slices
Created:  2026-06-24

## Orientation

- **Seam:** the readiness-band axis — `READINESS_BANDS` (drizzle-free leaf `src/graph/schema/kinds.ts`) + derived `bandsForKind(kind)` node membership (`src/graph/schema/nodes.ts`), with two carriers: `gap.band` (elicitation agenda) and node band membership (filter/render/threshold).
- **Frontier:** `readiness-bands-interrogation` — verdict reached (D94-L firm + I50-L planned); this file materializes it.
- **Posture:** earned (inherited from `readiness-bands-interrogation`; proving→earned transition recorded in PLAN). The proving question is answered; this is closure — materialize the model, re-point readers, delete the stored-table redundancy.
- **Open risk:** Card 1 materialized the band-less render bucket; remaining risk is the explicit I50-L guard that proves agenda readers stay on `gap.band` while node readers stay on `bandsForKind`.

### Cross-cutting obligations (inherited)

- **I31-L** — readiness never bars graph truth or work. The model change adds **no** hard gate; `CommandExecutor` still admits any-band kinds. Bands stay derived/advisory.
- **I50-L** — the two carriers must not re-couple: agenda reads `gap.band`; node filter/render/threshold reads plane-derived node bands. Card 2 adds the separation assertion.
- **Web build (I43-L/I44-L)** — `web/` is drizzle-free and depends compile-time on `NODE_KIND_METADATA`/`NodePlane`; freeze the four-band enum early so drift breaks the build loudly.
- **renderer-golden-coverage (FE-870)** — a live band reader via `list_by_band`/graph-slice; its goldens re-lock against the four-band order. Coordinate (card 3).

### Cold-start reads

```
- memory/SPEC.md — D94-L (the model), I50-L (two-carrier guard), D63-L (basis stance),
                   D64-L (superseded three-band), D45-L (readiness estimate),
                   I31-L/I35-L/I39-L (preserved readers)
- memory/PLAN.md — frontier: readiness-bands-interrogation (reader enumeration is the scope input)
- src/graph/README.md — current-state band citations to reconcile (card 3)
```

---

## Card 1 — Four-band enum + derived band membership

**Status:** done — 2026-06-24. Direct fallout re-pointed `queries.ts`, the graph-slice renderer, readiness estimate expectations, prompt/specification previews, and affected goldens so the materialized enum stayed green; Card 2 remains responsible for the explicit I50-L carrier-separation guard and final advertisement/pass-through review.

**Posture:** earned (materialize D94-L; delete the stored per-kind table).

### Target Behavior

Node band membership is derived from `plane` plus a hand-maintained intent bisection plus an explicit band-less set, with `projection` as the fourth band — the per-kind `readinessBands` table is gone.

### Boundary Crossings

```
→ src/graph/schema/kinds.ts   (READINESS_BANDS adds 'projection', ordered grounding→elicitation→projection→commitment)
→ src/graph/schema/nodes.ts   (NodeKindMetadata drops readinessBands; new bandsForKind(kind) derivation)
→ callers of NODE_KIND_METADATA[kind].readinessBands  (direct fallout re-pointed the compile-time readers; card 2 locks the guard)
```

### Derivation rule (D94-L)

```
bandsForKind(kind):
  band-less set { example, sketch, term }      → []        (reference/sidecar; never laddered)
  intent bisection (hand-maintained table):
    grounding  { goal, thesis, context }                   (context also elicitation → dual)
    elicitation{ context, constraint, story, unknown,
                 assumption, invariant, decision }         (constraint also... see note)
  plane default for non-intent kinds:
    design  → projection
    oracle  → projection
    plan    → commitment
```

- **Dual-band:** `context` = {grounding, elicitation}; `constraint` = {grounding, elicitation} (preserve existing constraint dual-band; verdict assigned it elicitation but keep grounding membership per current D64-L `constraint` dual-band and D57-L grounding-relevant constraint — confirm in build, do not silently drop grounding).
- **requirement/criterion** stay intent-plane (REQ/AC plane move is provisional, NOT in scope) but resolve to `commitment` band — so the intent bisection table must special-case them OR the derivation checks them explicitly. Simplest: the intent bisection table is the authority for *all* intent kinds (grounding/elicitation/commitment/band-less), plane-default applies only to design/oracle/plan.

### Risks and Assumptions

```
- RISK: constraint's grounding membership silently dropped → MITIGATION: assert constraint bands == {grounding, elicitation} in the kind-metadata test.
- ASSUMPTION: requirement/criterion keep commitment band while staying intent-plane.
    → IMPACT IF FALSE: none structural — they're commitment band either way (D94-L); plane move is provisional.
    → VALIDATE: kind-metadata test pins REQ/AC → commitment.
```

### Posture check (earned)

- **Materializes:** D94-L's derived-band rule into `nodes.ts`/`kinds.ts`.
- **Deletes:** the 24-row per-kind `readinessBands` declaration (the over-modelling the verdict named).
- **Locks in:** `bandsForKind` as the single source of node band membership.

### Acceptance Criteria

```
✓ kinds.test / queries.test — READINESS_BANDS == ['grounding','elicitation','projection','commitment']
✓ band-derivation test — bandsForKind(module|interface|entity|check|vv_method|vv_obligation|evidence) == ['projection']
✓ band-derivation test — bandsForKind(milestone|frontier|slice) == ['commitment']
✓ band-derivation test — bandsForKind(requirement|criterion) == ['commitment']
✓ band-derivation test — bandsForKind(context) and bandsForKind(constraint) are dual {grounding,elicitation}
✓ band-derivation test — bandsForKind(example|sketch|term) == [] (band-less)
✓ band-derivation test — bandsForKind(goal|thesis) == ['grounding']; (story|unknown|assumption|invariant|decision) == ['elicitation']
```

### Verification Approach

```
- Inner: unit (vitest) — exhaustive bandsForKind over every NodeKind; READINESS_BANDS order.
```

### Expected touched paths

```
src/graph/schema/
├── kinds.ts       ~
├── nodes.ts       ~
└── __tests__/ or co-located *.test.ts  ~
```

---

## Card 2 — Re-point node-band readers + I50-L two-carrier guard

**Posture:** earned (re-point readers to the derived rule; lock the carrier separation).

### Target Behavior

Every node-band reader consumes `bandsForKind` (not a stored table), the render path handles band-less kinds, and the `gap.band` carriers are proven independent of the node-kind table.

### Boundary Crossings

```
→ src/graph/queries.ts                     (matchesFilter band filter; deriveGapCoverage presence predicate)
→ src/renderers/graph/graph-slice.ts       (BAND_ORDER adds projection; bandForRender band-less bucket)
→ src/graph/command-executor/command-validation.ts  (band-value legality — isReadinessBand picks up 'projection' via enum, verify)
→ src/.pi/extensions/graph/tool-schemas.ts (list_by_band advertises 4 bands)
→ src/graph/elicitation-driver.ts + src/projections/session/readiness-estimate.ts  (I50-L: confirm gap.band-only)
```

### Band-less render decision (the open risk)

`bandForRender` currently returns `readinessBands[0]` and throws if absent. Band-less kinds now return `[]`. Decision for build: render band-less nodes under a dedicated trailing bucket (e.g. an "unbanded"/reference group after `commitment` in `BAND_ORDER` display), NOT throw. Keep the throw only for the *requested-band* path when a node genuinely doesn't match an explicitly requested band.

### Risks and Assumptions

```
- RISK: list_by_band with 'projection' returns design+oracle nodes — confirm matchesFilter uses bandsForKind.some(...).
- RISK: I39-L band guard test pins old 3-band metadata → MITIGATION: re-point to 4-band derived in this card.
- ASSUMPTION: isReadinessBand validation derives from READINESS_BANDS enum, so 'projection' is accepted with no extra change. VALIDATE: command-validation test for band='projection'.
```

### Posture check (earned)

- **Closes:** the carrier ambiguity — I50-L asserts agenda reads `gap.band`, node readers read `bandsForKind`.
- **Locks in:** I50-L two-carrier separation as the completion test.

### Acceptance Criteria

```
✓ queries.test — list_by_band ['projection'] returns design+oracle nodes; ['commitment'] returns plan+REQ/AC; dual-band context matches both grounding and elicitation filters
✓ graph-slice.test — BAND_ORDER includes projection; band-less node (example/sketch) renders in the unbanded bucket, no throw
✓ command-validation.test — band='projection' is legal; unknown band rejected
✓ I50-L assertion — sortElicitationGapsForAsking + readinessEstimate read gap.band only (no NODE_KIND_METADATA/bandsForKind import in those modules)
✓ I39-L band guard re-pointed to 4-band derived model, green
```

### Verification Approach

```
- Inner: unit (vitest) — re-pointed queries/graph-slice/command-validation tests + I50-L import-boundary/behavior assertion.
- Middle: none (no LLM/compositional change).
```

### Cross-cutting obligations

```
- I31-L — no reader gates work on band; CommandExecutor admits any-band kinds (unchanged).
- I50-L — establish the two-carrier separation assertion here.
```

### Expected touched paths

```
src/graph/
├── queries.ts                       ~
├── queries.test.ts                  ~
├── elicitation-driver.ts            ? (likely no change; assert-only)
├── command-executor/
│   └── command-validation.ts        ~
└── __tests__/                       ~
src/renderers/graph/
├── graph-slice.ts                   ~
└── __tests__/graph-slice.test.ts    ~
src/projections/session/
└── readiness-estimate.ts            ? (assert-only)
src/.pi/extensions/graph/
└── tool-schemas.ts                  ~
```

---

## Card 3 — Canonical-doc + golden reconciliation

**Posture:** earned (canonicalize current-state docs; re-lock FE-870 goldens).

### Target Behavior

The materialized four-band model is reflected in co-located READMEs/code citations and renderer goldens; no doc still describes the three-band stored-table model.

### Boundary Crossings

```
→ src/graph/README.md            (band current-state section → four-band derived)
→ src/graph/schema/nodes.ts      (D64-L header citation → D94-L derived model)
→ src/projections/session/readiness-estimate.ts (D64-L header citation)
→ renderer goldens touching band order/grouping (FE-870 coordinate)
```

### Acceptance Criteria

```
✓ src/graph/README.md band section describes the derived four-band model + two carriers (no stored-table language)
✓ D64-L→D94-L citation updates in nodes.ts / readiness-estimate.ts headers
✓ renderer goldens regenerated/re-locked against the four-band BAND_ORDER (npm run verify green)
✓ rg 'three.band|3.band|readinessBands:' src returns only intentional/historical references
```

### Verification Approach

```
- Inner: npm run verify (fix → test → build); golden diffs reviewed.
- Outer: none.
```

### Cross-cutting obligations

```
- FE-870 coordination — re-lock band-reader goldens; do not widen into unrelated renderer work.
- Freeze the four-band enum before web build relies on it (compile-time NODE_KIND_METADATA/NodePlane).
```

### Expected touched paths

```
src/graph/
├── README.md                        ~
└── schema/nodes.ts                  ~ (header citation)
src/projections/session/
└── readiness-estimate.ts            ~ (header citation)
src/renderers/graph/__tests__/       ~ (goldens, if band-order-sensitive)
```
