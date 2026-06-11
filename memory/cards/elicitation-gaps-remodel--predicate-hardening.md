# Gap-predicate hardening — every accepted arm has semantics or is rejected

Frontier: elicitation-gaps-remodel
Status:   active
Mode:     single
Created:  2026-06-11

> Sequencing: builds on `ln/fe-847-turn-boundary-closure` after
> `capability-readiness--live-gap-legality.md` (disjoint write paths, but the
> Tier-2 legality assertion there is worth having green before reshaping the
> substrate beneath it). User-routed here by the 2026-06-11 ln-induct pass;
> defects originated on PRs #197/#201, fixed at top of stack, no restack.

## Orientation

- Seam: the `GapPredicate` tagged union owned by `src/graph/schema/elicitation-gaps.ts`, dispatched by `validateGapPredicate` (`command-executor.ts`), `deriveGapCoverage` / `rowToElicitationGap` (`queries.ts`), seeding (`command-executor.ts`), and the drizzle 0004 migration.
- Frontier: `elicitation-gaps-remodel` / `gaps-node-kind-reference` (both done) — this card closes dark-variant and dual-encoding holes those frontiers left.
- Current faults (verified at HEAD): `field`/`coverage` predicates are creatable (validator checks kind membership only), derive coverage 0 forever, and cannot be hand-answered (non-`manual` `answered` is rejected) — a permanently-unanswerable obligation, silently. `rowToElicitationGap` trusts `row.predicate` JSON to agree with the `predicate_kind` column and `refers_to`; migration 0004 copied legacy predicate JSON verbatim under remapped `refers_to`, demonstrating the divergence.
- Posture: earned (inherited from `elicitation-gaps-remodel`) — closure moves on a settled model; the one micro-decision (presence granularity) is recorded below, not an empirical unknown.

## Target Behavior

Every `GapPredicate` arm accepted by `CommandExecutor` either has working coverage derivation or is rejected loudly at the boundary, and a stored gap row cannot carry internally-inconsistent predicate facts.

### Full-card cold-start reads

```
- memory/SPEC.md   — D65-L (gap obligation model), D75-L (node-kind reference), D63-L (basis),
                     I30-L (disposition capture); A27-L (predicate expressibility)
- memory/PLAN.md    — frontiers: elicitation-gaps-remodel, gaps-node-kind-reference (Frontier Definitions)
- src/graph/schema/elicitation-gaps.ts — the union and its arms
- src/graph/command-executor.ts        — validateGapPredicate, seeding, disposition rules
- src/graph/queries.ts                 — deriveGapCoverage, derivePresenceCoverage, rowToElicitationGap
- .pi/POSTURE.md                       — migration: free-rewrite (governs the 0004 decision)
```

### Boundary Crossings

```
→ src/graph/command-executor.ts (validation + seeding boundary)
→ src/graph/schema/elicitation-gaps.ts (union ownership; semantics owner lands here or adjacent)
→ src/graph/queries.ts (derivation + row hydration)
→ drizzle/ (regenerated migration + journal, free-rewrite posture)
```

### Risks and Assumptions

```
- RISK: rejecting field/coverage at the boundary breaks a caller that already
  creates them. → MITIGATION: verified at HEAD that seeds and the prompt fallback
  construct only presence; sweep remaining createGap callers before landing.
- RISK: regenerating migration 0004 under free-rewrite invalidates teammates'
  applied local DBs. → MITIGATION: that is the documented posture (.pi/POSTURE.md
  migration: free-rewrite); reseed is the supported recovery. Do NOT add
  forward-migration ceremony.
- ASSUMPTION: capture-reflection / elicitation-driver (future frontier) will want
  situated same-kind gaps; the granularity decision below must not block them.
    → IMPACT IF FALSE: an over-tight uniqueness rule would need loosening — one
      validator branch, cheap.
    → VALIDATE: decision recorded here keeps `manual` open for situated gaps.
    → [→ ln-sync should reconcile the decided contract into SPEC D65-L/D75-L]
```

**Recorded micro-decision (presence granularity, from ln-induct lens "coarse
presence aliasing"):** a `presence` predicate is a *kind-floor* obligation —
derivation counts nodes of the kind, so two open presence gaps for the same
`nodeKind` would alias (one node answers both). Therefore: `validateGapPredicate`
rejects creating a presence gap when an open presence gap for the same
`(specId, nodeKind)` already exists. Situated same-kind obligations use `manual`
(today) or `field`/`coverage` (when their derivation exists). Reconcile this
contract into SPEC via the planned ln-sync pass.

### Posture check (earned)

- **Closes:** the dark-variant ambiguity — whether `field`/`coverage` are supported (they are not, yet) — and the dual-encoding drift between `predicate_kind`, `predicate` JSON, and `refers_to`.
- **Locks in:** the invariant that predicate semantics have exactly one owner: one exhaustive, `never`-checked dispatch that validation and derivation both ride, so adding a union arm without semantics fails to compile.
- **Deletes / retires:** the in-place-rewritten 0004 migration (regenerated clean under free-rewrite), and the validator's silent acceptance of unimplemented arms.

### Acceptance Criteria

```
✓ One exhaustive switch over GapPredicate['kind'] (with a never check) is the single
  owner of per-arm validate + derive semantics; command-executor and queries both
  ride it; adding an arm without semantics is a compile error.
✓ createGap with a field or coverage predicate returns a structured diagnostic
  ("predicate kind not yet supported"), not a persisted row; presence and manual
  are deep-validated (presence: valid nodeKind/band, minimum >= 1; manual: shape).
✓ createGap with a presence predicate duplicating an open presence gap for the same
  (specId, nodeKind) returns a structured diagnostic naming the existing gap.
✓ rowToElicitationGap derives predicate_kind from the parsed JSON (single source) or
  fails loudly on column/JSON mismatch — a hand-corrupted row cannot hydrate into a
  silently-wrong gap; pick the single-source option unless the column is load-bearing
  for SQL filtering.
✓ Migration 0004 + seeds are regenerated coherently (refers_to consistent with
  predicate.nodeKind in every seeded/migrated row); no forward-migration shim exists.
✓ npm run verify green, including a seeded-spec round-trip proving floor gaps still
  derive coverage live from the graph (existing behavior preserved).
```

### Verification Approach

```
- Inner: exhaustiveness is compiler-enforced; unit tests per arm (reject-unimplemented,
  presence dedup, manual disposition path unchanged); row-hydration consistency test
  with a deliberately mismatched fixture row.
- Middle: CommandExecutor create/read round-trip over a fresh DB from the regenerated
  migration + seeds (the migration itself is the fixture).
```

### Cross-cutting obligations

```
- Anti-shadowing (D65-L): the gaps table holds obligation/disposition/meta only;
  domain content stays in the graph.
- All mutations stay on the CommandExecutor spec-local {specId, lsn}/change_log seam.
- Pre-release free-rewrite posture: regenerate, do not preserve the backlog-era or
  inconsistent migrated row shapes.
```

### Expected touched paths (tentative)

```
src/graph/
├── command-executor.ts                 ~
├── command-executor.test.ts            ~
├── queries.ts                          ~
├── queries.test.ts                     ~
└── schema/
    └── elicitation-gaps.ts             ~
drizzle/
├── 0004_gaps_node_kind_reference.sql   ~  (regenerated)
└── meta/_journal.json                  ?
```
