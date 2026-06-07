# Seam 1 READ — graph slice queries

Frontier: n/a (cross-cut READ seam; see `memory/CROSS_CUT_PLAN.md` §Seam 1)
Status:   active
Mode:     chain
Created:  2026-06-07

## Orientation

- **Seam:** Seam 1 — READ / context (`.pi/extensions/graph/`, `graph/snapshot.ts`, `renderers/`). Cross-cut, not a PLAN frontier; D60-L is the governing decision.
- **Frontier item:** none — this is a CROSS_CUT_PLAN capability-surface slice. No new Linear issue/branch by default; attach to whatever branch is active when built.
- **Volatile state:** `read_graph` today exposes only `overview` | `neighborhood(nodeCode, hops)`. The pull layer (`graph/snapshot.ts`) already has `GraphProjection = active_context | graph_truth`, `getGraphOverview`, `getNodeNeighborhood`, `resolveGraphNodeCode`. The D60-L filtered-slice pulls are not built.
- **Open risk:** keeping the read surface from drifting into a generic records API (D60-L explicitly bounds it to the three observed query shapes).
- **Posture:** proving (the read family is the substrate the elicitor steers on; each card lights up a new read path).
- **Cross-cutting obligations:** reads bypass `CommandExecutor` (D60-L: pull is read-only); every graph pull must honor the `graph_truth` vs `active_context` projection and omit edges with hidden endpoints (no dangling refs); render projected node codes (D62-L) as primary handles, not raw ids.
- **Q1 / IS_NOT is excluded** from this chain — it is a net-new absence-predicate beyond D60-L and needs a one-line design decision first; it gets its own card after that.

---

## Card A — flat filtered list reads (by kind, by band) — `done`

### Objective

The elicitor can read graph slices filtered by node kind(s) or by D64-L readiness band(s), under an explicit `graph_truth | active_context` projection, via `read_graph`.

### Acceptance Criteria

```
✓ snapshot lists nodes by one or more `kind` values, projection-aware
✓ snapshot lists nodes by one or more readiness band(s) (grounding | elicitation | commitment), projection-aware
✓ read_graph exposes the new list modes; results render projected node codes (D62-L)
✓ active_context hides superseded nodes; graph_truth includes them — asserted on both modes
✓ empty/unknown filter inputs return an empty slice, not an error
```

### Verification Approach

```
- Inner: graph/snapshot.test.ts — list-by-kind / list-by-band pulls over a seeded spec, both projections
- Inner: graph extension tool test — read_graph list modes return rendered slice + typed details
```

### Cross-cutting obligations

```
- pulls are read-only (no CommandExecutor); projection rule honored; no dangling-endpoint edges in output
- bounded query surface — list modes only, not a generic predicate API (D60-L)
```

### Assumption dependency

Depends on: D60-L (read-family shape is designed and settled), D64-L (readiness bands). Both are live, locked decisions; building against them is low-risk.

### Expected touched paths (tentative)

```
src/graph/
├── snapshot.ts        ~   (add list-by-kind / list-by-band pulls)
└── snapshot.test.ts   ~
src/.pi/extensions/graph/
├── index.ts           ~   (read_graph list modes)
├── tool-schemas.ts    ~   (ReadGraphParams: list mode + kind/band filters)
└── command-adapter.ts ?
src/renderers/graph/   ?   (slice renderer, if not colocated)
```

---

## Card B — relational find-related-to-anchor — `next`

### Objective

The elicitor can read nodes related to anchor node(s) by edge category, direction, and hop depth, projection-aware, via `read_graph`.

### Acceptance Criteria

```
✓ snapshot finds nodes related to anchor node code(s) filtered by edge category (D51-L set) and direction (outgoing | incoming | both)
✓ hop depth is bounded and honored (default 1)
✓ projection-aware (active_context omits superseded nodes and edges with hidden endpoints)
✓ read_graph exposes the related mode; unknown/unresolvable anchor returns STRUCTURAL_ILLEGAL diagnostics (matching existing neighborhood behavior)
✓ results render projected node codes and the connecting edge category/direction
```

### Verification Approach

```
- Inner: graph/snapshot.test.ts — find-related pull over a seeded multi-edge spec; category/direction/hop variations; both projections
- Inner: graph extension tool test — read_graph related mode returns rendered slice + typed details; bad anchor → diagnostics
```

### Cross-cutting obligations

```
- read-only; projection rule + no dangling-endpoint edges; projected codes as handles
- traversal stays bounded (hop cap); not a generic graph-query language (D60-L)
```

### Assumption dependency

Depends on: D60-L (find-related shape designed), D51-L (closed edge-category set + direction semantics). Both live and locked.

### Expected touched paths (tentative)

```
src/graph/
├── snapshot.ts        ~   (add find-related-to-anchor pull)
└── snapshot.test.ts   ~
src/.pi/extensions/graph/
├── index.ts           ~   (read_graph related mode)
└── tool-schemas.ts    ~   (related mode params: anchors, edge category, direction, hops)
src/renderers/graph/   ?
```

---

## Not in this chain (deferred siblings, separate files)

- **Q1 / IS_NOT absence queries** — "kind K with no edge of category C", "thesis with no proof". Net-new beyond D60-L; needs a micro-decision (absence flag on the related filter vs a distinct `gaps` mode) before scoping. High value for the "what to ask next" loop (D65-L elicitation_backlog).
- **Workspace context reads** — 1-level tree + file counts (gitignore-aware), specs overview (title, session count, node count), sessions overview (turn count, grade). D60-L `cwd` subject + workspace projection. Disjoint write paths (`.pi/extensions/context/`, `session/`). **Scoped:** `crosscut-read--workspace-context.md` (chain: Card A cwd filesystem snapshot; Card B specs/sessions DB overview).
- **Session context read tool** — agent-facing current binding + runtime-state frame (D60-L pulled surface). Projection already exists (`projectSessionRuntimeState`); needs renderer + tool. **Scoped:** `crosscut-read--session-context.md`.
