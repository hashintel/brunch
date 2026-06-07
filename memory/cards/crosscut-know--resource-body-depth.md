# Prompt-resource body depth (Seam 3a/3b content pass)

Frontier: n/a (cross-cut Seam 3a/3b; D58-L) | tracker/branch = the active cross-cut push
Status:   active
Mode:     single
Created:  2026-06-07

## Orientation

- **Containing seam:** the KNOW layer's Brunch-owned prompt resources under
  `src/.pi/skills/{goals,strategies,lenses,methods}` — the markdown bodies the agent loads with
  `read` when an axis is active (D58-L manifest mechanism). `CROSS_CUT_PLAN.md` Seam 3a/3b both
  carry a *content depth* ● row: "scaffolding present, bodies thin."
- **Relevant frontier item:** none in `memory/PLAN.md`; this is the earned content half of
  cross-cut working-order step 4. Card lives under `crosscut-know--`. No new Linear/branch.
- **Volatile state:** the bodies are genuinely thin — every resource is ~5 lines
  (`goals/*`, `lenses/*`, `methods/{commit-graph,read-snapshot,review-for-gaps}`, all four
  non-freestyle `strategies/*`); only `methods/{infer-and-capture,generate-proposal,run-structured-exchange}`
  reach 12–15 lines. The contracts for what each body should contain already exist in the
  family READMEs ([strategies/README.md](file:///Users/lunelson/Code/hashintel/brunch-next/src/.pi/skills/strategies/README.md)
  lists the required facets; [lenses/README.md](file:///Users/lunelson/Code/hashintel/brunch-next/src/.pi/skills/lenses/README.md)).
- **Drift note (handled in reconciliation, not here):** the Seam 3b *exchange-tool
  `.description()` / `promptGuidelines`* ● row is **already done** — all 7 exchange tools under
  `src/.pi/extensions/exchanges/` carry `description` + `promptGuidelines`. That row is reclassified
  `built` in the ledger; it is **out of scope** for this card.
- **Main open risk:** prose quality is eyeball-judged — verification is review-based, not a test.

Posture: **earned** (inherited from cross-cut Seam 3a/3b — Fill=`earned`; settled scaffolding,
just unbuilt bodies). This is content materialization into existing topology, not a new seam.

Frontier-level cross-cutting obligations:

- **D58-L:** bodies stay Brunch-owned markdown loaded on demand; the manifest advertises
  `{name, description, location}`, the body carries detail. Do not move detail into code or descriptions.
- **D39-L:** resource location stays code-owned in `.pi/agents/state.ts`; this card edits bodies
  only, not the manifest registry.
- Keep each body scoped to its own axis; do not duplicate cross-axis content (goal vs strategy vs
  lens vs method are orthogonal, D59-L/D25-L).

### Objective

Deepen the thin `.pi/skills/{goals,strategies,lenses,methods}` resource bodies so each carries the
real per-axis instruction its README contract requires, without changing the manifest registry.

### Acceptance Criteria

```pseudo tree
resource body depth
├── goals (4)
│   └── ✓ each goal body states the objective, what evidence advances it, and what NOT to claim/do
├── strategies (4 remaining; freestyle already deepened)
│   └── ✓ each body covers the strategies/README facets: what the agent does, turn structure,
│         commitment mechanism, available graph ops, and category-selection rubric where applicable
├── lenses (3)
│   └── ✓ each lens body states its topical focus, what kinds/edges it favors, and how it shapes interpretation
├── methods (6)
│   └── ✓ each method body gives concrete tool-routing/sequencing guidance (the D58-L method role),
│         not a restatement of the tool description
└── consistency
    ├── ✓ no body contradicts its README contract or another axis's responsibility
    └── ✓ manifest descriptions in state.ts still match each deepened body's intent
```

### Verification Approach

```
- Inner: review-based — each body read against its family README contract; build/lint proves resources still load.
- Inner (light, if cheap): a structural test asserting each resource exceeds a trivial threshold
  and the manifest location resolves to a readable file (extends existing compose/readability tests).
```

### Cross-cutting obligations

```
- Bodies are prompt resources, not code: keep instruction in markdown, not in descriptions/manifest.
- Preserve orthogonality (D59-L/D25-L): a strategy body must not absorb goal/lens content.
- Do not touch the exchange-tool description row (already built) or the manifest registry (D39-L).
```

### Assumption dependency

`None` — this slice's correctness does not hinge on a live `memory/SPEC.md` §Assumption; the
axis scaffolding and the D58-L manifest mechanism are settled and built.

### Expected touched paths (tentative)

```pseudo tree
src/.pi/skills/
├── goals/{grounding-advance,elicit-expand,commit-converge,capture-posture}.md   ~
├── strategies/{step-wise-decision-tree,step-wise-disambiguate,propose-graph,project-graph}.md   ~
├── lenses/{intent,design,oracle}.md                                             ~
└── methods/{run-structured-exchange,infer-and-capture,commit-graph,read-snapshot,generate-proposal,review-for-gaps}.md   ~
src/.pi/agents/state.ts            ?   (only if a manifest description needs to match a deepened body)
src/.pi/agents/compose.test.ts     ?   (only if a light structural/readability assertion is added)
```

### Promotion checklist

All **no** — stays a light/earned content card:

- Changes a requirement? No. — Creates/retires an assumption? No. — Depends on unvalidated
  high-impact assumption? No. — Makes/reverses a design decision? No. — New seam invariant? No.
- Changes a cross-cutting verification layer? No. — Crosses >2 seams? No (one resource tree).
- First touch in an unfamiliar seam? No. — Can't name the seam/rationale? No (D58-L, the READMEs).

### Traceability

- **SPEC:** D58-L (resource-manifest mechanism), D59-L/D25-L (axis orthogonality).
- **Cross-cut:** closes `CROSS_CUT_PLAN.md` Seam 3a *goal/strategy/lens content depth* ● and
  Seam 3b *method content depth* ●. The Seam 3b *exchange-tool description* ● is reclassified
  `built` (drift) during reconciliation, not by this card.
