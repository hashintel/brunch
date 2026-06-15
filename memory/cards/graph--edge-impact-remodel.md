# Edge-category metadata: declared propagation (`affected` + `impactKind`)

Frontier: graph-model-doc-retirement (graph-schema concern; folds into the GRAPH_MODEL.md retirement — see memory/PLAN.md)
Status:   proposed — ready; `kind-metadata-drift` is done (card retired 2026-06-17), so sequence with the GRAPH_MODEL.md retirement (`graph-model-doc-retirement` in memory/PLAN.md), after the renders land
Mode:     single
Created:  2026-06-16 (thinned to the net-win core; the `tail`/`head` rename was considered and cut — see §Out)

## Orientation

- Surfaced designing the graph-render edge column, which normalizes edges to *impact direction* via `edgeImpact()`. This promotes that already-derived semantics into **declared** edge-category metadata + an explicit invariant, so impact direction stops being inferable from storage order.
- Graph-schema change, separate from the renderer cards. The per-category table is also GRAPH_MODEL.md content, so land it in code **with** the GRAPH_MODEL.md retirement (`graph-model-doc-retirement`, same `graph/schema` + `policy` area). The earlier `kind-metadata-drift` reconciliation is done.
- Canonical today: `EDGE_CATEGORY_METADATA` (`src/graph/policy/category-policy.ts`) with `impactOnSourceChange`/`impactOnTargetChange`; `edgeImpact()` (`projection/direction.ts`) derives `{downstreamEndpoint, strength}` from them.

## Target Behavior

`EDGE_CATEGORY_METADATA` declares impact as `affected` (which endpoint receives impact) + `impactKind` (`cascade`/`advisory`/`none`), replacing the `impactOnSourceChange`/`impactOnTargetChange` pair; the metadata can no longer represent "impact in both directions"; `edgeImpact()` becomes a thin accessor.

## The change (net-win core)

Replace the two `impactOn*Change` fields with two declarative fields; **keep** the rest of the metadata:

```ts
interface EdgeCategoryMetadata {
  sourceRole: EdgeEndpointRole;
  targetRole: EdgeEndpointRole;
  impactKind: 'cascade' | 'advisory' | 'none';  // replaces impactOnSourceChange/impactOnTargetChange
  affected: EdgeEndpoint | null;                 // 'source' | 'target'; null only for symmetric association
  stanceRequired: boolean;                       // NEW — table-drives the proof/support stance rule
  criteriaHelpSignal: boolean;                   // KEEP — interviewer "suggest a criterion" cue
  projectionEffect: ProjectionEffect;            // KEEP — supersession hides predecessor from active context
}
```

| Category | source role | target role | impactKind | affected | stanceRequired |
| --- | --- | --- | --- | --- | --- |
| `dependency` | dependency | dependent | `cascade` | `target` | false |
| `proof` | oracle | claim | `advisory` | `source` | true |
| `support` | support | claim | `advisory` | `source` | true |
| `realization` | abstract | concrete | `advisory` | `target` | false |
| `boundary` | boundary | subject | `advisory` | `target` | false |
| `composition` | whole | part | `advisory` | `source` | false |
| `supersession` | successor | predecessor | `advisory` | `source` | false |
| `association` | peer | peer | `none` | `null` | false |

(`affected`/`impactKind` cross-checked against the current impact columns — they match `edgeImpact()`'s derivation exactly. `criteriaHelpSignal` is true only for `proof`; `projectionEffect` is `hide_predecessor_from_active_context` only for `supersession` — unchanged.)

Why it's a win (model integrity, Minsky): the two-field form *can* encode the invalid "impact in both directions" state; `affected` (a single endpoint) cannot — the existing "a well-formed category drives impact in at most one direction" comment becomes structural. `stanceRequired` retires the hardcoded `category === 'proof' || 'support'` check in `assertStanceLocality`. Net owned surface does not grow; it normalizes.

## Invariant (write at the top of the metadata)

> Endpoint storage order (`source`/`target`) carries no impact meaning. Impact *direction* is given solely by `affected`; *transitivity* by `impactKind`. Consult the metadata — never infer direction from which node was stored as `source`.

## Propagation rule (documented now; the traversal is future M4/M5 reconciliation work, not built here)

> For a changed node `N` and incident edge `E` of category `c`: if `N` is on `E`'s *non-*`affected` endpoint, `N`'s change propagates to the node at `E[affected]`; recurse from there iff `impactKind === 'cascade'`. If `N` is on the `affected` endpoint, the edge is inert for this traversal. `association` (`affected: null`) never propagates.

## Acceptance Criteria

```
✓ fields          — EDGE_CATEGORY_METADATA carries affected + impactKind + stanceRequired; impactOnSourceChange/impactOnTargetChange removed; criteriaHelpSignal + projectionEffect retained.
✓ accessor        — edgeImpact() reads affected/impactKind directly (thin accessor or retired); relationFromAnchor unchanged in behavior.
✓ stance-table    — assertStanceLocality reads stanceRequired instead of the hardcoded proof/support check.
✓ invariant-doc   — the "endpoint order carries no impact meaning" invariant is stated at the metadata head.
✓ guard           — a test pins the per-category affected/impactKind/stanceRequired mapping.
✓ green           — npm run verify; no behavior change to existing edge validation/reconciliation surfaces.
```

## Out (considered, not in this card)

- **`source`/`target` → `tail`/`head` rename.** Cut: large mechanical blast radius (schema, db columns, `mutateGraph` input, role-named-edge-draft, projections, queries, tests, fixtures, the render) for a nominal clarity gain that the invariant + `affected` already deliver. If pursued, it's a separate, isolated rename pass — not a prerequisite for this remodel.

## Expected touched paths (tentative)

```
src/graph/policy/category-policy.ts                  ~   (affected/impactKind replace impactOn*Change; add stanceRequired; keep criteriaHelpSignal/projectionEffect)
src/graph/projection/direction.ts                    ~   (edgeImpact => thin accessor)
src/graph/command-executor/role-named-edge-draft.ts  ~   (assertStanceLocality reads stanceRequired)
src/graph/policy/__tests__/                          +?  (per-category mapping guard)
docs/design/GRAPH_MODEL.md                           ~   (per-category table → code; rides the retirement Follow-on)
```
