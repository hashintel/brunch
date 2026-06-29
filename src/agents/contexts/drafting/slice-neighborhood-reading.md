# Slice: reading an anchored neighborhood

> Draft injectable context slice (scratch; not wired). Inject when an agent consumes an anchored neighborhood / context pack and must reason about consequences, dependencies, or drift. Direction and labels are projected from `src/graph/policy/category-policy.ts` via `src/graph/projection/{labels,direction}.ts`.

An edge-local neighborhood is a stronger context object than "all goals, all requirements." It anchors on one node and groups incident edges by **impact direction**, each rendered with an **anchor-relative label**. Read the grouping and the label as the meaning — never reconstruct direction from the English verb or from `sourceId`/`targetId`.

## How to read a pack

```
anchor node
- REQ1: Stage 2 configuration-space requirement (hub anchor)

upstream nodes — review the anchor if these change
- depends on A1: Local-only execution assumption
- expresses INV1: No network call invariant
- bounded by CON1: No cloud dependencies constraint

downstream nodes — reconcile these if the anchor changes
- required by D1: Two-stage split decision {hard}
- implemented by MOD1: SQLite configuration store module
- witnessed by AC1: Airplane-mode acceptance criterion
- challenged by EX1: Network-outage counterexample
- superseded by REQ2: Revised configuration-space requirement

lateral nodes — cross-check with the anchor if either changes
- related to G1: Offline-first product goal
```

Reading rules:

- **upstream** = premises the anchor relies on; if they change, **review the anchor**.
- **downstream** = claims affected if the anchor changes; **reconcile them** on edit. `{hard}` marks a cascade-strength (`dependency`) edge.
- **lateral** = symmetric `cross_reference` peers; no impact direction.

## Anchor-relative label table

The same edge reads differently from each endpoint. Labels are projections of `(category, anchor end, stance)`.

| Category | Anchor = source side | Anchor = target side |
| --- | --- | --- |
| `dependency` | required by | depends on |
| `witness` (for / against) | witnesses / refutes | witnessed by / challenged by |
| `rationale` (for / against) | supports / argues against | motivated by / opposed by |
| `realization` | realized by | realizes |
| `refinement` | refined by | refines |
| `exclusion` | bounds | bounded by |
| `composition` | contains | part of |
| `supersession` | supersedes | superseded by |
| `cross_reference` | related to | related to |

Kind-sharpened `realization` verbs: requirement/interface → module render "implemented by / implements"; requirement → slice render "established by / establishes"; invariant → requirement render "expressed by / expresses".

## Direction is metadata, not verb

```
x> do NOT infer upstream/downstream from the verb ("depends on" sounds passive)
x> do NOT infer direction from which node is stored as sourceId
-> direction = the category's `affected` endpoint (direction projection)
-> label    = the category + anchor end + stance (label projection)
```

`reconciliation_need` records are advisory side-channel items, **not** edges; they will not appear as neighborhood edges even though they point at graph state.

## What a pack is good for

```
why does this item stand?   -> read upstream (premises, constraints, assumptions, motivating goals)
what breaks if I change it?  -> read downstream (impact; reconcile these)
is it verified?              -> read witness/criterion/evidence neighbors
is there drift/contradiction?-> check for reconciliation_needs touching the anchor
```
