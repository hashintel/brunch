# Elicitation-backlog substrate (Seam 3a — "what to ask next" driver)

Frontier: n/a (cross-cut Seam 3a; D65-L) | tracker/branch = the active cross-cut push
Status:   active
Mode:     single
Created:  2026-06-07

## Orientation

- **Containing seam:** the KNOW/orient layer's missing substrate. `CROSS_CUT_PLAN.md`
  Seam 3a's open ● *"what to ask next" driver* row points at D65-L `elicitation_backlog` —
  a **flat table** (prospective process-agenda), the prospective sibling of the retrospective
  `reconciliation_need` register (D8-L). Today the elicitor has no per-turn agenda store.
- **Relevant frontier item:** none in `memory/PLAN.md`; D65-L is a cross-cut slice advancing
  the POC's elicitation usefulness. Card lives under `crosscut-know--`. No new Linear/branch unless asked.
- **Volatile state:** the sibling `reconciliation_need` is currently **type-only** — see
  [src/graph/schema/reconciliation-need.ts](file:///Users/lunelson/Code/hashintel/brunch-next/src/graph/schema/reconciliation-need.ts)
  ("Phase 1 lock-and-materialize: type definitions only; Drizzle table + CommandExecutor write
  paths land with subsequent M4 slices"). So this slice **materializes the prospective register
  first**, justified by its direct POC value (it drives "what to ask next"); mirror the
  `reconciliation_need` shape so the retrospective register can later materialize symmetrically.
  `createSpec` ([command-executor.ts#L449](file:///Users/lunelson/Code/hashintel/brunch-next/src/graph/command-executor.ts#L449))
  is the seed point — it already runs a transaction allocating a spec-local LSN + `change_log` row.
- **Topology note (post-35eff395):** the `snapshot` architecture noun is retired. The `read | project
  | render` split now governs: **domain read/query logic stays in the owning domain**
  ([src/graph/queries.ts](file:///Users/lunelson/Code/hashintel/brunch-next/src/graph/queries.ts), formerly
  `snapshot.ts`); `src/projections/` is reserved for **reusable multi-consumer/multi-source DTOs**.
  So the backlog read-back lives in `graph/` (single-owner domain read), **not** `src/projections/`
  — add a projection only if a later consumer (RPC/web) actually reuses the shape.
- **Main open risk:** D65-L lists three open scope-design items. This card resolves two and
  defers one (below). The load-bearing assumption A24-L (a flat table suffices, no graph plane)
  is exactly what landing this tracer tests.

Posture: **proving** (inherited from D65-L / cross-cut Seam 3a — Fill=`proving`).

Slice-design decisions made here (resolving D65-L "open for scope/slice design"):

1. **Mutations route through `CommandExecutor`, sharing the spec-local LSN + `change_log`** —
   mirrors D8-L reconciliation needs and preserves the single mutation boundary (D4-L/D20-L).
   This is the card's recommended resolution of D65-L's open routing fork; building it ratifies it.
2. **Seed at spec creation** (`createSpec`) with a small grounding-band question set.
3. **Goal-axis relationship (complement vs thin `goal`, D59-L) is DEFERRED** — not decided here;
   this slice only stands up the substrate and a read-back, not the goal-layer interaction.

Frontier-level cross-cutting obligations this slice carries:

- **D4-L/D20-L:** all backlog mutations route through the command layer and return structured results.
- **D16-L/A4-L:** each mutation allocates exactly one `{specId, lsn}` through the spec's `graph_clock`.
- **D63-L:** `basis` is provenance-directness — a user-raised need is `explicit`, an
  agent-inferred need is `implicit`; do not overload it as a mutation-path field.
- **D52-L:** `graph/` owns the table + mutation **and the read** (domain query in `queries.ts`);
  `db/` is imported only by `graph/`. A `src/projections/` DTO is added only if a consumer reuses it.
- **D65-L shape lock:** flat table only — FK pointers (`arose_from`, `resolved_by`), filter
  attributes (plane/lens affinity, grade band, `open|closed`); **no** graph node/plane, no
  unknown→unknown edges. Keep it forward-compatible with promotion to a plane, do not pre-build one.

### Target Behavior

A flat `elicitation_backlog` table is materialized through `CommandExecutor`, seeded with
grounding-band questions at spec creation, and read back per spec through the command and domain-read boundary.

### Boundary Crossings

```pseudo
→ elicitation_backlog Drizzle table (db/schema.ts) + generated migration
→ graph/schema/elicitation-backlog.ts domain types (mirror reconciliation-need shape)
→ CommandExecutor: create-entry / close-entry mutations (one spec-local LSN + change_log each)
→ createSpec seed hook (grounding-band questions on new spec)
→ domain read (graph/queries.ts): list open backlog entries for a spec
→ SPEC reconciliation (A24-L progress; D65-L routing/seed forks resolved)
```

### Risks and Assumptions

```
- RISK: materializing the prospective register before the retrospective sibling creates schema asymmetry.
    → MITIGATION: mirror the reconciliation_need type/column shape (id, specId, kind/affinity,
      target/FK pointers, rationale, createdAtLsn, resolvedAtLsn) so the sibling materializes symmetrically.
- RISK: the seed question set hard-codes content that should be data/config.
    → MITIGATION: keep the seed list a single small named constant in graph/ (not scattered);
      it is a starting agenda, not a closed vocabulary — entries are mutable through the command path.
- RISK: backlog mutation drifts into a second mutation engine separate from commitGraph.
    → MITIGATION: reuse the CommandExecutor transaction/clock/change_log helpers; backlog ops are
      new operations on the same boundary, not a parallel writer.
- ASSUMPTION: a flat table (FK pointers + filter attrs) is sufficient to drive elicitor questioning
  without a graph plane or unknown→unknown edges.
    → IMPACT IF FALSE: if genuine unknown→unknown dependency or rich traversal emerges, the table
      promotes to a plane (rows→nodes, FK→edges) — a larger reshape touching the locked graph model.
    → VALIDATE: seed→store→read tracer plus later capture-reflection across fixtures; rich
      dependency that the FK pointers cannot express is the falsifier.
    → [→ memory/SPEC.md §Assumptions A24-L]
- ASSUMPTION: routing backlog mutations through CommandExecutor (sharing the spec-local LSN) is the
  right home, not a separate store.
    → IMPACT IF FALSE: backlog gets its own clock/audit; rework of the mutation surface.
    → VALIDATE: the tracer's change_log + LSN assertions; mirrors the settled D8-L need register.
```

### Posture check

Proving tracer scoring on two axes:

- **Proof of life:** stands up an entirely new substrate end-to-end — seed at spec creation →
  command-layer store → read-back — that no current store provides.
- **Uncertainty:** retires the load-bearing half of A24-L (flat table suffices). The tracer breaks
  if the flat shape cannot carry seeded grounding-band agenda items with their FK pointers.

It deliberately does **not** build the per-turn "what to ask next" prompt injection or
capture-reflection spawning/closing — those depend on what the seeded substrate reveals and are
held back by the anti-speculation gate (see follow-on).

### Acceptance Criteria

```pseudo tree
elicitation_backlog substrate
├── table + types
│   ├── ✓ elicitation_backlog table exists with a generated migration and mirrors the reconciliation_need shape
│   └── ✓ domain types enumerate status (open|closed), basis (explicit|implicit), grade band, and FK pointers
├── command-layer mutation
│   ├── ✓ creating an entry allocates one spec-local LSN and one change_log row
│   ├── ✓ closing an entry sets resolved_by / closed_at_lsn and writes one change_log row
│   └── ✓ a malformed entry returns structural_illegal and writes no rows
├── seed at spec creation
│   ├── ✓ createSpec seeds the grounding-band question set for the new spec
│   └── ✓ seeded entries are open, explicit, and scoped to that spec only (sibling specs unaffected)
└── read-back
    └── ✓ listing open backlog entries for a spec returns the seeded set with stable fields
```

### Verification Approach

```
- Inner: CommandExecutor unit tests — create/close mutation, LSN/change_log, structural_illegal, spec scoping.
- Inner: migration/schema test — table present; seed-on-createSpec count and field assertions.
- Middle: domain-read test (graph/queries) — seeded entries read back per spec; sibling-spec isolation.
```

### Cross-cutting obligations

```
- Reuse the CommandExecutor boundary; no direct db/ writes outside graph/; no second clock/audit.
- Flat table only — no graph node/plane, no unknown→unknown edges (D65-L).
- basis stays provenance-directness (D63-L); seeded grounding questions are explicit.
- Mirror reconciliation_need shape for forward-symmetric materialization.
```

### Expected touched paths (tentative)

```pseudo tree
src/db/
├── schema.ts                                  ~   (elicitation_backlog table + enum arrays)
└── row-schemas.ts                             ?
drizzle/
└── 0003_*.sql                                 +   (generated migration)
src/graph/
├── schema/elicitation-backlog.ts             +   (domain types; mirror reconciliation-need.ts)
├── command-executor.ts                       ~   (create/close entry + seed hook in createSpec)
├── command-executor.test.ts                  ~
├── command-executor/
│   └── elicitation-backlog-types.ts          +?
├── queries.ts                                ~   (domain read: list backlog entries per spec)
├── queries.test.ts                           ~
└── index.ts                                  ~
src/projections/                              ?   (only if a consumer reuses the read shape — not by default)
memory/SPEC.md                                ~   (A24-L progress; D65-L routing/seed forks resolved)
docs/design/GRAPH_MODEL.md                    ?   (if the need-register section gains a prospective sibling note)
```

### Foreseeable follow-on (NOT scoped — anti-speculation gate)

The per-turn **"what to ask next" driver** — compose-time injection of open backlog entries
into the elicitor turn (D58-L), plus **capture-reflection** that spawns new entries and closes
resolved ones on each exchange/message — is intentionally **not pre-scoped**. Its exact read
shape and capture-reflection wiring would shift based on what the seeded substrate reveals
(entry volume, field usefulness, goal-axis relationship). Scope it after this tracer lands.

### Traceability

- **SPEC:** D65-L (the register), A24-L (flat-table assumption — the falsifier), D8-L
  (retrospective sibling template), D4-L/D20-L/D16-L (command boundary + LSN), D63-L (basis),
  D64-L (grade bands), D52-L (topology). On build, reconcile A24-L progress and resolve the
  D65-L routing/seed open items; defer the goal-axis fork.
- **Cross-cut:** advances `CROSS_CUT_PLAN.md` Seam 3a *"what to ask next" driver* ● (substrate
  half; behavioral driver remains a follow-on).
