# Gaps reference node kinds (retire the grounding-typology vocabulary)

Frontier: gaps-node-kind-reference
Status:   active
Mode:     single
Created:  2026-06-10

## Orientation

- **Seam:** the `elicitation_gaps` obligation register (`src/graph/schema/elicitation-gaps.ts` type, `src/db/schema.ts` table, `src/graph/command-executor.ts` seeding/create, `src/graph/queries.ts` read derivation) and its single consumer `src/projections/session/capability-readiness.ts`. Just built by `elicitation-gaps-remodel` (2026-06-10); D75-L reshapes it.
- **Frontier:** `gaps-node-kind-reference` (PLAN §Frontier Definitions) — heads the readiness chain `elicitation-gaps-remodel` → **this** → `capability-readiness`.
- **Volatile state:** none in HANDOFF; the prior refactor plan is retired and deleted (its catalog-enshrining direction was wrong, absorbed here under D75-L).
- **Open risk (the proving unknown):** does referring to a node kind + a judgment satisfier preserve the discrimination the eight typology names carried, given `thesis` fuses protagonist+pain_pull and `context` fuses domain+context_of_use? The slice must prove two same-kind gaps resolve independently.

Posture: proving (inherited from gaps-node-kind-reference).

Cross-cutting obligations carried:
- **Anti-shadowing** (D65-L/D75-L): the table holds obligation/disposition/meta only — never domain content. `refersTo` is a kind tag, `question`/`rationale` are meta prose, not captured answers.
- **Taxonomy ownership** (D73-L): `NodeKind` stays owned by the drizzle-free leaf `src/graph/schema/kinds.ts`; the gaps schema and capability-readiness *import* the union, never redefine it.
- **Command/clock boundary** (D4-L/D16-L): gap mutations stay on `CommandExecutor` + the shared `{specId, lsn}` / `change_log` seam — unchanged.

## Target Behavior

Grounding gaps name their obligation by referring to a graph node kind (`refersTo: NodeKind` + a free-form `question`) end-to-end — schema, seeding, read derivation, and the capability-readiness gate — with the typology `name` vocabulary (`GROUNDING_GAP_TYPOLOGIES`, the gap-`name` enum, `RelevantGapName`) removed.

## Full-card cold-start reads

```
- memory/SPEC.md   — decisions: D75-L (primary), D65-L, D56-L, D54-L, D73-L, D57-L, D64-L; assumptions A24-L, A27-L; invariant I30-L
- memory/PLAN.md    — frontier: gaps-node-kind-reference
- docs/design/ELICITATION_QUESTIONS.md — per-kind question priming examples to seed grounding question text
- docs/design/GRAPH_MODEL.md — §Per-plane node kinds (source-question rubric; grounding-band kinds)
- src/graph/schema/elicitation-gaps.ts, src/graph/schema/kinds.ts, src/graph/schema/nodes.ts — current gap type + NodeKind union
- src/db/schema.ts (elicitationGaps table), src/graph/command-executor.ts (SEEDED_ELICITATION_GAPS, CreateElicitationGapInput, seedElicitationGaps, validateCreateElicitationGap), src/graph/queries.ts (rowToElicitationGap)
- src/projections/session/capability-readiness.ts — the only gate consumer
```

## Boundary Crossings

```
→ createSpec (CommandExecutor.seedElicitationGaps)
→ db elicitation_gaps table (refers_to + question columns; regenerated migration)
→ queries.rowToElicitationGap (read derivation: coverage/answered preserved)
→ projections/session/capability-readiness (capability → NodeKind[] gate)
```

## Risks and Assumptions

```
- RISK: same-kind gaps (two `thesis`, two `context`) collapse to one signal under the gate
    → MITIGATION: the gate aggregates coverage over ALL gaps of a required kind (floor = ≥1 grounded node of that kind), and discrimination lives in question + manual/coverage satisfier — not a per-name lookup. Prove with the discrimination probe.
- RISK: `presence` predicate's `nodeKind` field now overlaps `refersTo`
    → MITIGATION: keep the predicate union as-is (D75-L: substrate unchanged); `refersTo` is the obligation referent, the predicate is the satisfaction check. Do not merge them in this slice.
- ASSUMPTION: the gate's per-kind coverage aggregation rule is an in-model implementation detail, not a new durable decision (D75-L already fixes the floor + discrimination locus).
    → IMPACT IF FALSE: a genuine gate-semantics decision would promote back to ln-spec.
    → VALIDATE: the capability-readiness map test + discrimination probe; if the aggregation rule needs a recorded choice, stop and route to ln-spec.
    → memory/SPEC.md §Assumptions A27-L
- ASSUMPTION: pre-release free-rewrite — regenerate the migration and seed; no `name`-column or typology residue to preserve.
    → IMPACT IF FALSE: would need a data migration; SPEC/PLAN do not require it.
    → VALIDATE: AGENTS §development phase posture.
```

## Posture check (proving)

- **Proof of life:** a gap references a node kind end-to-end (seed → store → read → gate) — a new shape lit across the whole seam.
- **Invariants:** locks the D75-L one-ontology seam (gaps reference `NodeKind`; no parallel vocabulary).
- **Uncertainty:** retires the presence-aliasing / same-kind-discrimination unknown the retired refactor plan only deferred (finding #1). The discrimination probe is the tracer that breaks if the model is wrong.

Scores on all three — build it.

## Acceptance Criteria

```
✓ elicitation-gaps schema test — ElicitationGap carries `refersTo: NodeKind` + `question`; no `name` typology field; no GROUNDING_GAP_TYPOLOGIES export
✓ command-executor seed-set test — createSpec seeds grounding gaps keyed by node kind: floor `context`/`thesis`/`goal`/`constraint` plus `term`/`assumption`; no eight literal typology names
✓ command-executor create/validate test — createElicitationGap requires `refersTo` (a valid NodeKind) + non-empty `question`; rejects an invalid kind
✓ queries read test — rowToElicitationGap maps `refers_to`/`question`; live presence-derived coverage/answered still flips from graph truth with sibling-spec isolation
✓ capability-readiness map test — CAPABILITY_RELEVANT_GAPS is `Record<CapabilityId, readonly NodeKind[]>`; grounding floor = context+thesis+goal+constraint; a required kind with zero referring gaps in the register fails loud (config bug ≠ uncovered)
✓ discrimination probe (proving) — two `thesis`-referring gaps with different questions resolve independently (one covered, one open) rather than aliasing to a single presence count
✓ no residue — `rg "GROUNDING_GAP_TYPOLOGIES|RelevantGapName|gap\.name"` over src returns nothing; migration regenerated with `refers_to`/`question`, no `name` column
```

## Verification Approach

```
- Inner: vitest unit — schema/type, seed-set, create/validate, queries read derivation, capability-readiness map + loud-fail (npm run verify gate)
- Middle: the discrimination probe — two same-kind gaps resolved independently via question + satisfier (retires the proving unknown)
- Outer: per-spec seeded read-back over a freshly created spec (existing observed-shapes / read-back probe extended)
```

## Cross-cutting obligations

```
- Anti-shadowing: table stores obligation/disposition/meta only, never domain content (D65-L/D75-L)
- NodeKind union owned by the drizzle-free leaf graph/schema/kinds.ts; import, never redefine (D73-L)
- Mutations stay on CommandExecutor + shared {specId, lsn} / change_log clock (D4-L/D16-L)
- Reconcile topology READMEs that name the catalog/seeding: src/graph/README.md, src/db/README.md, src/projections/README.md
```

## Expected touched paths (tentative)

```
src/graph/schema/
├── elicitation-gaps.ts        ~   (name → refersTo: NodeKind + question)
drizzle/
├── 0004_<generated>.sql        +   (regenerated migration: refers_to + question)
└── meta/                       ~   (snapshot)
src/db/
├── schema.ts                   ~   (elicitation_gaps: refers_to + question columns)
└── README.md                   ~
src/graph/
├── command-executor.ts         ~   (SEEDED_ELICITATION_GAPS → seed by kind; CreateElicitationGapInput; seedElicitationGaps; validate)
├── command-executor.test.ts    ~
├── queries.ts                  ~   (rowToElicitationGap)
├── queries.test.ts             ~
├── observed-shapes-coverage.test.ts ?
└── README.md                   ~
src/projections/
├── session/capability-readiness.ts       ~   (RelevantGapName → NodeKind; capability → NodeKind[]; loud-fail; discrimination)
├── session/capability-readiness.test.ts  ~
└── README.md                   ~
```
