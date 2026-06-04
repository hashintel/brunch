# `spatial_graph_layout` — completed-spec fixture (interview + capture map)

Produced by the `spec-fixture` skill (profile: `coverage`). Source-of-truth and
capture map for `seedAcceptedSpatialGraphLayoutSpec` in
`src/server/fixtures/scenarios.ts` (scenario `spatial-graph-layout-all-phases-closed`).

## Spec metadata

| Field | Value |
| --- | --- |
| `name` | `spatial_graph_layout` |
| `mode` | `brownfield` (additive feature on existing graph-mode code) |
| delivery posture | `incremental feature` |
| terminal state | all four phases closed; requirements + criteria reviews accepted |

## Profile: coverage — deliberate stressors

A downstream consumer of this spec has to read the graph, synthesize an order, and
validate. The fixture forces all three:

- 9 `verifies` edges with full coverage of buildable R1–R6; **AC6 verifies two**
  requirements (R4 + R1); **R2 is verified by three** criteria (AC2/AC3/AC4).
- **R7/R8** are non-buildable, constraint-phrased requirements with **no**
  `verifies` edge — the data-quality case a validation pass must catch.
- **Zero req→req `depends_on`** — ordering must be synthesized from content
  (expected latent order `R1 → R2 → {R3, R4, R5, R6}`).
- One adversarial edge `R5 refines R2` (req→req) a graph read must **not** treat as
  build order.

---

> **Fixture fidelity.** The turns below are reproduced verbatim from the seed. Each
> grounding/design turn is a plain question/answer pair — no option chips, no
> preface cards. Edge-styling intent is folded into requirement **R5**; the
> "adjust positions" and "where do positions live" questions are folded into one
> design turn.
>
> **Impact signal.** Each question carries a turn-level `impact` (`high|medium|low`,
> read from `turn.impact`, rendered as the "… Impact" badge; defaults to `low` when
> unset). Assigned by *"how much the answer shapes downstream choices."* Distinct
> from the `none|soft|hard` edit-impact cascade tier.

## Phase 1 — Grounding

> **Interviewer** · _high impact_. Is this a fresh idea, or a change to something
> that already exists in this workspace?

**User:** Brownfield. Graph mode already ships a structured-list layout and a
graph-launched refinement affordance; this adds a second layout.

> **Interviewer** · _medium impact_. Are we specifying the whole graph-mode surface
> end-to-end, or one bounded feature on top of it?

**User:** Incremental feature — just the spatial layout switch; everything else in
graph mode stays as-is.

> **Interviewer** · _high impact_. What's the user-facing goal — what should someone
> be able to do after this ships that they can't today?

**User:** Grasp the topology of their intent graph at a glance — clusters, hubs,
and how items relate spatially — instead of scanning a flat list. It is about
comprehension of structure.

> **Interviewer** · _high impact_. Any hard lines — things this must not do?

**User:** Positions are view-state only — dragging a node never changes the
graph's meaning, an item's content, or any edge. It must not replace or disable
the structured list; it is additive. And no spatial layout outside graph mode —
chat view stays as-is.

**Captured this phase:** `X1` (context) at the novelty turn; `G1` (goal),
`T1` `T2` (terms) at the goal turn; `K1` `K2` (constraints; `K2` non-goal subtype)
at the constraints turn. Grounding closes with a proposal + confirmation turn.

---

## Phase 2 — Design

> **Interviewer** · _medium impact_. For the initial arrangement when a canvas is
> first opened — computed automatically, or placed by hand?

**User:** Automatic. On first open it should already be readable — no overlaps,
everything in view — via a deterministic topology-seeded layout, not random
placement that jumps every reload.

> **Interviewer** · _medium impact_. Once it is auto-arranged, can the user adjust
> it — and where do positions live?

**User:** Drag to reposition, and positions persist per spec and come back on
reload — stored in local `.brunch` state, not in the intent graph, to keep them
out of the semantic layer.

> **Interviewer** · _low impact_. Anything about the data path I should record as an
> assumption?

**User:** Assume the existing graph data layer can hand the canvas all items and
typed edges without a new query surface.

**Captured this phase:** `D1` (decision: deterministic auto-layout) at the layout
turn; `D2` (decision: persist per-spec in `.brunch`) at the persistence turn; `A1`
(assumption: existing data layer suffices) at the data-path turn. Design closes
with a proposal + confirmation turn.

---

## Phase 3 — Requirements review (accepted)

| Code | Requirement | Note |
| --- | --- | --- |
| **R1** | Graph mode exposes a layout switch toggling structured-list ↔ spatial canvas; active choice persists per spec. | — |
| **R2** | The canvas renders every intent item as a positioned node and every typed relationship as a drawn edge, on a pan/zoom surface. | — |
| **R3** | On first open, node positions are computed by a deterministic topology-seeded layout; readable without manual placement. | — |
| **R4** | Users can drag nodes to reposition; positions persist per spec and restore on reload. | — |
| **R5** | Canvas edges are visually distinguished by relation kind, with a legend. | — |
| **R6** | Selecting a node on the canvas offers the same graph-launched refinement as the structured-list route. | — |
| **R7** | Node positions are view-state only; must never alter graph semantics, content, or edges. | *non-buildable; restates K1* |
| **R8** | The spatial canvas must not replace/disable the structured-list route; it is additive. | *non-buildable; negative* |

R7/R8 are deliberately left typed `requirement` (not `constraint`) to reproduce the
real data-quality case. They carry no `verifies` edge.

## Phase 4 — Criteria review (accepted)

| Code | Criterion | Verifies |
| --- | --- | --- |
| **AC1** | Toggling the layout switch swaps list ↔ canvas without losing the current selection. | R1 |
| **AC2** | Every intent item in the spec appears as exactly one node on the canvas. | R2 |
| **AC3** | Every typed relationship appears as exactly one edge on the canvas. | R2 |
| **AC4** | Pan and zoom move/scale the viewport without changing nodes' relative positions. | R2 |
| **AC5** | Opening the canvas on a never-positioned spec yields no overlaps, all nodes in bounds. | R3 |
| **AC6** | After dragging nodes and reloading, node positions **and** the active layout choice are both restored. | **R4 and R1** |
| **AC7** | Each relation kind renders with a distinct edge style matching the legend. | R5 |
| **AC8** | Selecting a canvas node opens the same refinement affordance as the list row. | R6 |

All four phases closed → spec complete.

---

## Capture map (canonical for the seed)

### Nodes (25)

| Ref | kind | content |
| --- | --- | --- |
| G1 | goal | Grasp intent-graph topology at a glance — clusters, hubs, and relationships — as a spatial peer to the structured-list view. |
| T1 | term | Spatial canvas — a pan/zoom 2D surface where intent items are positioned nodes and relationships are drawn edges. |
| T2 | term | Layout switch — the control that toggles graph mode between structured-list and spatial canvas. |
| X1 | context | Graph mode already ships a structured-list layout and a graph-launched refinement affordance; this feature is additive on top. |
| K1 | constraint | Node positions are view-state only and never semantic truth. |
| K2 | constraint (non-goal) | No spatial layout outside graph mode; chat view is unchanged. |
| D1 | decision | Use a deterministic topology-seeded auto-layout (layered/force-directed, fixed seed), not random placement. |
| D2 | decision | Persist node positions per-spec in local `.brunch` state, not in the intent graph. |
| A1 | assumption | The existing graph data layer can supply all items and typed edges to the canvas without a new query surface. |
| R1–R8 | requirement | (see Phase 3) |
| AC1–AC8 | criterion | (see Phase 4) |

### Edges (16)

`verifies` (criterion → requirement) — 9:

```
AC1→R1  AC2→R2  AC3→R2  AC4→R2  AC5→R3  AC6→R4  AC6→R1  AC7→R5  AC8→R6
```

Epistemic edges (the real graph shape — a graph read must ignore these for
ordering) — 7:

```
A1  depends_on   R2
D1  depends_on   R3
D2  depends_on   R4
K1  constrains   R2
K1  constrains   R4
D2  derived_from K1
R5  refines      R2   # adversarial req→req; NOT build order
```

No req→req `depends_on` is seeded.

## Expected downstream behavior (assertions)

- **Graph read / projection:** 8 requirement slices (R1–R8); verification linkage
  from the 9 `verifies` edges; R7/R8 carry none; epistemic + `refines` edges absent
  from any ordering output.
- **Order synthesis:** R7/R8 flagged non-buildable; credible acyclic order over
  R1–R6, expected `R1 → R2 → {R3, R4, R5, R6}`.
- **Validation:** no buildable slice depends on R7/R8 (dangling deps dropped);
  acyclic; every buildable slice gets a synthesized verification target; the
  R7-restates-K1 smear flagged.
