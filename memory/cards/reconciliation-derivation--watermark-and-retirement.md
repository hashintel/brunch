# Reconciliation derivation: acknowledged-LSN watermark, clearing, persisted-kind retirement

Frontier: reconciliation-derivation
Status:   active
Mode:     slices
Created:  2026-07-13

Three-card sequence completing the frontier's declared shape, unblocked by the tracer's
2026-07-13 PROCEED verdict (0 false positives on real graphs; watermark named as the
noise-control lever). Posture: earned — the uncertainty was retired by the tracer; this
sequence materializes the settled shape, canonicalizes the derived read as the one
edge_revalidation source, and deletes the obsolete persisted kind.

**Sequence stop rule:** if any card surprises into a requirement/assumption/decision/
invariant change beyond the SPEC text updates card 3 already declares, STOP the sequence
and route through ln-spec/ln-plan. In particular: if clearing turns out to need reviewer-
agent write authority (I16-L widening), stop — that is a SPEC decision, not a build call.

## Shared cold-start reads (all cards)

```
- memory/SPEC.md   — D8-L (substrate + spec-local LSN), D51-L (category policy),
                     I16-L (reviewer write boundary — must NOT widen), A8-L (one
                     substrate for the three judgment kinds — survives)
- memory/PLAN.md   — frontier: reconciliation-derivation — the three scope-bounding
                     corrections AND the Tracer verdict block (acknowledged-LSN proxy
                     rationale lives there)
- src/graph/projection/derived-revalidation.ts — the tracer; its docstring names the
                     proxy the watermark replaces
- src/graph/TOPOLOGY.md — graph read/write path rules
```

---

## Card 1 — per-edge acknowledged-LSN watermark + derivation switch  [status: done]

Full card (schema migration).

**Target Behavior:** each edge carries a nullable `acknowledged_lsn`, and the derived
`edge_revalidation` staleness test treats an edge as stale only when its upstream
endpoint's `updatedAtLsn` exceeds the edge's effective acknowledgement — the greater of
`acknowledged_lsn` and the edge's own `updatedAtLsn` (so a fuller downstream edit still
clears, per the frontier's correction 3).

**Acceptance:**
```
✓ schema — drizzle migration adds nullable acknowledged_lsn to edges; row-schema
  round-trip test (src/db/row-schemas.test.ts extension)
✓ derivation switch — derived-revalidation tests: acknowledged edge (watermark ≥
  upstream LSN) derives nothing; new upstream churn past the watermark re-derives;
  edge-content update (updatedAtLsn advance) also clears; null watermark behaves
  exactly as the tracer's proxy did (existing tracer tests stay green unmodified
  where semantics are unchanged)
✓ read path — getDerivedEdgeRevalidations consumes the watermark; graph-side test
  extended
```

**Invariants preserved:** read path stays write-free (tracer's I16-L read-only test
green); A8-L table untouched; no consumer of existing edge reads breaks (full verify).

**Touched paths:** `src/db/schema.ts ~`, `drizzle/0010_* +`, `src/db/row-schemas.test.ts ~`,
`src/graph/projection/derived-revalidation.ts ~ (+tests)`, `src/graph/queries.ts ~ (+tests)`.

---

## Card 2 — acknowledgement command (clearing write path)  [status: next]

Light card.

**Objective:** a product-owned CommandExecutor command acknowledges a derived
edge_revalidation by bumping that edge's `acknowledged_lsn` to the current spec LSN —
the first and only write in this frontier, structurally separate from the derivation.

**Acceptance:**
```
✓ command — command-executor test: acknowledge sets acknowledged_lsn to the spec's
  current LSN; idempotent re-acknowledge; unknown edge id → structured error consistent
  with sibling commands
✓ end-to-end clearing — graph-side test: derive → acknowledge → derives nothing →
  upstream churn → derives again
✓ authority boundary — the command is a general graph command; NO reviewer-agent
  wiring added (I16-L untouched) — review check on the diff, and no change to the
  reviewer/need-substrate authority surface
```

**Surface note:** command layer + tests are the card; exposing it as an agent tool in
the brunch-data graph extension is included ONLY if that is the idiomatic single place
sibling graph commands surface (follow the existing pattern; do not invent a new
surface). TUI affordance is out of scope (post-frontier UX).

**Touched paths:** `src/graph/command-executor.ts ~ (or command module) (+tests)`,
`src/graph/command-executor/command-types.ts ~`, `src/.pi/extensions/brunch-data/graph/index.ts ~?`.

---

## Card 3 — retire the persisted edge_revalidation kind  [status: next]

Light card (deletion / vocabulary convergence; pre-release posture licenses deletion).

**Objective:** the derived read becomes the ONLY `edge_revalidation` source: the
persisted-need create path stops accepting kind `edge_revalidation`, existing fixtures/
tests regenerate without persisted rows of that kind, and the substrate keeps exactly
the three judgment kinds (possible_relation, possible_duplicate, semantic_conflict).

**Acceptance:**
```
✓ create path — command/tool schema for create_reconciliation_need rejects (or no
  longer offers) edge_revalidation; test pins the accepted kind set to the three
  judgment kinds
✓ no orphaned expectations — grep-level check: no production code or fixture still
  creates or asserts persisted edge_revalidation rows; suites touching needs stay green
  after fixture regeneration
✓ SPEC reconciliation — D8-L/A8-L/Lexicon text updated to record the split (three
  persisted judgment kinds + derived edge_revalidation); this is recording the
  frontier's pre-decided shape — anything MORE than that trips the sequence stop rule
```

**Touched paths:** `src/graph/schema/* ~` (need-kind vocabulary home),
`src/graph/command-executor* ~ (+tests)`, fixtures under `src/**/__tests__/` and
`.fixtures/seeds ~?` (regenerate), `memory/SPEC.md ~`, `memory/PLAN.md ~` (frontier
closes if all three cards land; else status).

---

## Verification (all cards)

- Inner: per-card unit suites + `npm run fix`
- Middle: `npm run verify` green before every commit (gate is green on this branch;
  baseline 1931 pass / 2 skipped before card 1)
- Outer: none owed by this sequence — the noise verdict (outer evidence) landed with
  the tracer; surfacing derived staleness in product UX is a separate post-frontier
  concern, not deferred evidence from these cards
