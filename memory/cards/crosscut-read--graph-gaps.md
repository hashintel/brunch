# Seam 1 READ — graph gap (IS_NOT) queries

Frontier: n/a (cross-cut READ seam; see `memory/CROSS_CUT_PLAN.md` §Seam 1, Q1)
Status:   done
Mode:     single
Created:  2026-06-07

## Orientation

- **Seam:** Seam 1 — READ / context. Closes the last ● READ row: *graph slice — IS_NOT /
  absence queries*. Resolves Q1.
- **Frontier item:** none — CROSS_CUT capability-surface slice. No new Linear issue/branch by
  default; attach to whatever branch is active when built.
- **Q1 decision (resolved):** add a **dedicated `gaps` mode** to `read_graph` (over a `negate`
  flag on list/related). A *named observed shape* matches D60-L's enumeration style and resists
  "any predicate can be negated" creep, and keeps the positive list modes pure.
- **SPEC touch (RATIFIED 2026-06-07):** D60-L now enumerates a **fourth** observed read shape —
  "find class-members lacking an edge of a given category in a given direction (gap query — a
  single named absence shape, not a generic NOT-predicate language)" — alongside the three
  positive shapes (list-by-kind, list-by-band, find-related); the glossary Snapshot entry echoes
  it. No further SPEC action needed for build.
- **Volatile state — most infra exists:** `src/graph/snapshot.ts` has `getGraphSliceByKinds`,
  `getGraphSliceByReadinessBands`, `getProjectionState`, `RelatedDirection`, and the projection
  machinery (visible nodes/edges, superseded hiding). `read_graph` already dispatches 5 modes
  with a discriminated-union schema (`tool-schemas.ts`). The gap read is the **absence
  counterpart of `related`**, computed over the same projection state.
- **Why it matters:** directly serves the D65-L `elicitation_backlog` "what to ask next"
  driver — theses without proof, requirements without realization, claims without support.
- **Cross-cutting obligations:** read-only (no `CommandExecutor`); projection-aware; render
  projected node codes (D62-L); bounded — single `absentEdgeCategory`, not a query language.

---

## Card — `gaps` read mode — `done`

### Objective

The elicitor can read graph gaps: nodes in a base class (by kind(s) and/or readiness band(s))
that have **no** edge of a given category in a given direction — via `read_graph` mode `gaps`.

### Design

```
mode: 'gaps'
  kinds?: string[]                              // base class filter (union with bands)
  readinessBands?: string[]                     // base class filter
  absentEdgeCategory: EdgeCategory              // REQUIRED — the missing relation
  direction?: 'outgoing' | 'incoming' | 'both'  // default 'both'
  projection?: GraphProjection                  // default active_context
→ nodes in the base class with NO edge of absentEdgeCategory in direction
```

Implementation: reuse `getGraphSliceByKinds` / `getGraphSliceByReadinessBands` for the base
set over the chosen projection, then subtract nodes that have a **visible** edge of
`absentEdgeCategory` in `direction` (using the same `getProjectionState` visibility used by
`getRelatedNodes`). Add `getGraphGaps(db, specId, options)` to `snapshot.ts`.

### Acceptance Criteria

```
✓ returns nodes in the base class (kinds and/or bands) lacking an edge of absentEdgeCategory
  in the requested direction (outgoing | incoming | both, default both)
✓ projection-aware: under active_context a node whose ONLY qualifying edge is superseded is
  reported as a gap; under graph_truth it is not — asserted on both projections
✓ empty/unknown base filter (no valid kinds/bands) returns an empty slice, not an error
✓ missing absentEdgeCategory → STRUCTURAL_ILLEGAL diagnostics (matching related-mode pattern)
✓ no base filter at all (neither kinds nor readinessBands) → STRUCTURAL_ILLEGAL
✓ results render projected node codes (D62-L)
✓ read_graph exposes mode 'gaps'; tool returns rendered slice + typed details (I33-L)
```

### Verification Approach

```
- Inner: src/graph/snapshot.test.ts — getGraphGaps over a seeded multi-edge spec (use the
  edge-spread fixture: node 1 "Unproven thesis" is the canonical gap; supersession pairs prove
  the active_context-vs-graph_truth distinction); both projections, all three directions
- Inner: src/.pi/__tests__/graph-tools.test.ts — read_graph 'gaps' returns rendered + typed
  details; missing-category and no-base-filter → diagnostics
```

### Cross-cutting obligations

```
- read-only (no CommandExecutor); projection rule honored; no dangling-endpoint edges
- bounded — one absentEdgeCategory, named gap shape; NOT a generic NOT-predicate language (D60-L)
- the edge-spread fixture already seeds the absence case; do not invent a new fixture
```

### Assumption dependency

Depends on: D60-L (extended — ratify the 4th shape), D51-L (edge categories), the graph-slices
reads + projection machinery (have), the `edge-spread` fixture (have). Low risk — additive read
over existing projection infra; the only spec-level action is ratifying the D60-L addition.

### Expected touched paths (tentative)

```
src/graph/snapshot.ts                        ~   (getGraphGaps over projection state)
src/graph/snapshot.test.ts                   ~
src/graph/index.ts                           ~   (re-export getGraphGaps + options type)
src/.pi/extensions/graph/tool-schemas.ts     ~   (gaps mode params + union member)
src/.pi/extensions/graph/index.ts            ~   (gaps mode dispatch + diagnostics)
src/.pi/extensions/graph/command-adapter.ts  ~   (gap-result formatter, projected codes)
src/.pi/__tests__/graph-tools.test.ts        ~
src/app/brunch-tui.ts                         ?  (binding if the reader surface widens)
memory/SPEC.md                               ~   (D60-L 4th shape, on ratification)
```

### Note — shares the graph read path

This touches the **same** files as the (now-consumed) graph-slices cards (`snapshot.ts`,
`read_graph` index/schema/adapter). It is a continuation of that chain, scoped separately only
because Q1 needed resolving first. Coordinate if built concurrently with other graph-read work.
