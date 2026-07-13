# Reconciliation derivation: read-only derived edge_revalidation tracer

Frontier: reconciliation-derivation
Status:   active
Mode:     single
Created:  2026-07-13

Full scope card — structural (first derived-need read path; proving tracer whose verdict
gates the rest of the frontier).

Posture: proving (inherited from reconciliation-derivation). The open question is product
quality, not computability: are derived staleness needs better product than persisted
ones — noise level, signal usefulness? This tracer IS that measurement. The watermark
schema, clearing UX, and any retirement of persisted `edge_revalidation` rows are
explicitly OUT of scope — beyond the epistemic horizon until this tracer's verdict.

## Target Behavior

A read-only derived `edge_revalidation` query — computed from `updated_at_lsn` comparison over `EDGE_CATEGORY_METADATA` direction/impact policy, with no schema change — surfaces alongside persisted reconciliation needs so signal quality and noise level are observable on real workspaces.

## Full-card cold-start reads

```
- memory/SPEC.md   — D8-L (needs substrate + spec-local LSN), D51-L (closed edge
                     categories + per-category policy), I16-L (reviewer writes target
                     only the need substrate — a derived VIEW must not break this),
                     A8-L (one substrate absorbs all impasse kinds — the table stays)
- memory/PLAN.md   — frontier: reconciliation-derivation (full definition incl. the
                     three scope-bounding corrections and the first-tracer candidate)
- src/graph/policy/category-policy.ts — EDGE_CATEGORY_METADATA (affected + impactKind)
- src/graph/projection/direction.ts — existing upstream/downstream derivation + the
                     never-built "log downstream impacts on edit" docstring intent
- src/projections/graph/reconciliation-needs.ts — intentional topology stub; this card
                     decides whether the tracer materializes it or leaves it (its comment
                     is the payload — read before touching)
- src/graph/TOPOLOGY.md — graph read-path layout rules
```

## Boundary Crossings

```
→ derived query over nodes/edges updated_at_lsn + EDGE_CATEGORY_METADATA (src/graph/)
→ read-path surface: alongside getOpenReconciliationNeeds (queries.ts consumers)
→ projection/render surface where persisted needs already appear (agents/contexts or
  projections read path — match wherever getOpenReconciliationNeeds output lands today)
```

## Risks and Assumptions

```
- RISK: noise — a busy workspace may derive many stale edges, drowning persisted needs
  → MITIGATION: that is the MEASUREMENT, not a failure; the tracer must make noise
  observable (counts by category/impactKind), not suppress it. Do not add heuristic
  filtering beyond the declared impactKind policy (`none` derives nothing) — filtering
  choices belong to the post-verdict frontier.
- RISK: conflating derived and persisted needs at the read surface confuses consumers
  and could violate I16-L's write-boundary reasoning → MITIGATION: derived results are
  a DISTINCT read (separate function/shape or an explicit `derived: true` marker),
  never written to reconciliation_need, never given need ids that imply row identity.
- ASSUMPTION: "upstream updated later than downstream last acknowledged" is directly
  computable from existing updated_at_lsn fields + direction metadata (PLAN premise,
  validated by 2026-07-02 inventory).
    → IMPACT IF FALSE: the whole frontier reshapes (write-side trigger instead).
    → VALIDATE: the tracer's first red-green test IS the validation.
- ASSUMPTION: without a watermark, "downstream last acknowledged" approximates to the
  downstream node/edge's own updated_at_lsn (per-edge acknowledged-LSN is the
  post-verdict schema work).
    → IMPACT IF FALSE (too coarse → false negatives): record in the verdict; do NOT
      pull the watermark forward into this card.
```

## Posture check (proving)

Proof of life: the first automatic staleness signal a user gets without the agent
authoring one. Uncertainty: retires "is the derivation computable as a read?" and
produces the noise-level evidence the frontier's next card needs. Invariants: locates
the derived-vs-persisted read seam without touching the write substrate. Scores on all
three axes.

## Acceptance Criteria

```
✓ derivation correctness — new co-located unit suite: for each edge category with
  impactKind advisory/cascade, an upstream node updated past the downstream endpoint
  yields a derived edge_revalidation entry (edge id, category, direction, LSN delta);
  impactKind `none` categories derive nothing; up-to-date edges derive nothing
✓ read-only guarantee — test asserts the derivation performs no writes: reconciliation_
  need row count and edges/nodes byte-state unchanged after query (I16-L-adjacent)
✓ distinct surface — the derived read is separately identifiable from persisted needs
  (shape or marker) wherever both appear; existing getOpenReconciliationNeeds consumers
  unchanged — named suite: existing src/graph queries tests stay green
✓ observability for the verdict — the tracer exposes per-category/impactKind counts so
  a real-workspace run can report noise level (test: counts computed correctly on a
  fixture graph with known stale/fresh mix)
✓ topology-stub disposition — src/projections/graph/reconciliation-needs.ts either
  materializes as this projection's home (if the tracer surfaces through projections/)
  or its stub comment is updated to record why the tracer lives elsewhere; silent
  bypass is not an option (repo topology-stub rule)
✓ verdict recorded — the card/PLAN reconciliation includes the noise-level reading from
  the fixture (and, if cheaply available, a real .fixtures workspace) plus an explicit
  recommendation: proceed to watermark schema / reshape / stop
```

## Invariants preserved

```
- I16-L: reviewer/derived paths never write outside the need substrate — this card
  writes NOTHING (read-only tracer) — guarded by: the read-only test above; STOP-THE-
  LINE if any implementation path wants to persist derived needs
- A8-L: the reconciliation_need table remains the substrate for possible_relation /
  possible_duplicate / semantic_conflict — guarded by: no schema migration in this card
  (absence check: no new drizzle migration)
- D51-L: closed edge-category set + per-category policy stays the single policy source —
  guarded by: derivation reads EDGE_CATEGORY_METADATA, no parallel policy map (review
  check on the diff)
```

## Verification Approach

```
- Inner: derivation unit tests over fixture graphs (stale/fresh/none-impact mixes) +
  read-only assertion + npm run fix
- Middle: full npm run verify (gate is green on this branch as of 2026-07-13); existing
  graph/queries/projection suites stay green
- Outer: the noise-level verdict itself — a run over a seeded/fixture workspace reported
  in the reconciliation notes; owned by THIS card (it is the acceptance leaf above),
  not deferred. The richer advisory-pending seed variant remains FE-1187/fixture-prep
  convergence work, not this card's to build.
```

## Cross-cutting obligations

```
- Do not build the watermark schema, clearing flow, or any retirement of persisted
  edge_revalidation rows (post-verdict frontier work)
- direction.ts docstring: its never-built "log downstream impacts on edit" intent must
  be updated to reflect what now exists (derived read) — stale intent is drift
- Reconciliation at close: PLAN frontier status + verdict + recommendation; SPEC only
  if the verdict changes a durable premise (A8-L untouched by design)
```

## Expected touched paths (tentative)

```
src/graph/
├── projection/
│   ├── direction.ts                    ~  (docstring intent update; possibly helpers)
│   └── derived-revalidation.ts (+test) +? (derivation home if graph-side)
├── queries.ts                          ~? (surface alongside persisted needs, if here)
└── TOPOLOGY.md                         ~? (read-path note if a new module lands)
src/projections/graph/
└── reconciliation-needs.ts             ~  (materialize stub OR update its comment)
src/agents/contexts/…                   ?  (only if the persisted-needs render surface
                                            lives here and the tracer must appear beside it)
memory/PLAN.md                          ~  (frontier status + verdict)
memory/SPEC.md                          ~? (only on premise change)
```
