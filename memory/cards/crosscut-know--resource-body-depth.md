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
- **Relevant frontier item:** none in `memory/PLAN.md`; this stays the remaining temporary
  cross-cut completion work after D65-L `elicitation_backlog` was promoted back into PLAN.
  It is the earned content half of cross-cut working-order step 4.
- **Volatile state:** the bodies are genuinely thin — every resource is ~5 lines
  (`goals/*`, `lenses/*`, `methods/{commit-graph,read-context,review-for-gaps}`, all four
  non-freestyle `strategies/*`); only `methods/{infer-and-capture,generate-proposal,run-structured-exchange}`
  reach 12–15 lines (use these three as the **shape exemplar** for body depth).
- **Source-anchoring gotcha (new-thread-critical):** only **strategies/** and **lenses/** have a
  README contract; **goals/** and **methods/** do **not**. Do not invent content — anchor every
  body to the authoritative source named in §Content sources below. The one-line manifest
  descriptions in [`.pi/agents/state.ts`](file:///Users/lunelson/Code/hashintel/brunch-next/src/.pi/agents/state.ts)
  (`GOAL_RESOURCES`, `STRATEGY_RESOURCES`, `LENS_RESOURCES`, `METHOD_RESOURCES`) already encode
  each resource's intended one-line intent; the body expands that intent, it must not contradict it.
- **Concurrency note (new-thread-critical):** another agent is actively building the
  `elicitation-backlog` frontier in `src/graph/` and `src/db/`. This card touches **only**
  `src/.pi/skills/**/*.md` (plus optionally `state.ts` descriptions / `compose.test.ts`). Do **not**
  edit `graph/`, `db/`, or the elicitation-backlog card — that is another tenant's blast radius.
- **Drift note (handled in reconciliation, not here):** the Seam 3b *exchange-tool
  `.description()` / `promptGuidelines`* ● row is **already done** — all 7 exchange tools under
  `src/.pi/extensions/exchanges/` carry `description` + `promptGuidelines`. That row is reclassified
  `built` in the ledger; it is **out of scope** for this card.
- **Main open risk:** prose *quality* stays partly judgment-based, but acceptance does not depend on
  it — a required structural test (§Verification Approach) gives every body an objective non-trivial-depth
  floor and a self-checkable facet checklist (§Content sources) replaces "read it and decide."

Posture: **earned** (inherited from cross-cut Seam 3a/3b — Fill=`earned`; settled scaffolding,
just unbuilt bodies). This is content materialization into existing topology, not a new seam.

Frontier-level cross-cutting obligations:

- **D58-L:** bodies stay Brunch-owned markdown loaded on demand; the manifest advertises
  `{name, description, location}`, the body carries detail. Do not move detail into code or descriptions.
- **D39-L:** resource location stays code-owned in `.pi/agents/state.ts`; this card edits bodies
  only, not the manifest registry.
- Keep each body scoped to its own axis; do not duplicate cross-axis content (goal vs strategy vs
  lens vs method are orthogonal, D59-L/D25-L).

### Content sources (per family — read these before writing any body)

Every body expands its **manifest one-liner** in `.pi/agents/state.ts`; that one-liner is the
binding intent the body may not contradict. Beyond that, each family has a distinct authoritative
anchor and facet checklist:

```pseudo tree
goals/  (4: grounding-advance, elicit-expand, commit-converge, capture-posture)
  authority   SPEC D59-L (defines all four goals + grade-derivation) + GOAL_RESOURCES one-liner
  no README   — D59-L IS the contract
  facets      what the agent pursues · what evidence advances it · what NOT to claim/do ·
              how it relates to its grade band (D64-L) · capture-posture never writes spec/graph truth
strategies/ (4 remaining: step-wise-decision-tree, step-wise-disambiguate, propose-graph, project-graph)
  authority   strategies/README.md §"Prompt resource contents" + STRATEGY_RESOURCES one-liner + SPEC D25-L/D26-L
  exemplar    strategies/freestyle.md (recently deepened — match this depth)
  facets      what the agent does · turn structure · commitment mechanism (D26-L) ·
              available graph ops · category-selection rubric for graph-writing strategies
lenses/  (3: intent, design, oracle)
  authority   lenses/README.md §"Topology-driven question ranking" + LENS_RESOURCES one-liner + SPEC D25-L/D56-L
  facets      topical/plane focus · favored kinds/edges · how it shapes interpretation ·
              topology-driven "what to ask next" heuristics from the README table
methods/ (6: run-structured-exchange, infer-and-capture, commit-graph, read-context, generate-proposal, review-for-gaps)
  authority   SPEC D58-L ("method resources are the prompt-level home for tool-routing/sequencing guidance") + METHOD_RESOURCES one-liner
  no README   — D58-L IS the contract
  exemplar    methods/{generate-proposal,run-structured-exchange,infer-and-capture}.md (already 12–15 lines)
  facets      concrete tool-routing/sequencing (NOT a restatement of the tool description) ·
              when to invoke · what to compose it with · what stays out of scope
```

### Objective

Deepen the thin `.pi/skills/{goals,strategies,lenses,methods}` resource bodies so each carries the
real per-axis instruction its authoritative source (§Content sources) requires, without changing the
manifest registry.

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
    ├── ✓ no body contradicts its §Content sources authority or another axis's responsibility
    ├── ✓ each body expands (does not contradict) its state.ts manifest one-liner
    └── ✓ no new capability/authority/tool invented beyond what the source already grants
```

### Verification Approach

Builder-portable, no human-only step required to pass the card:

```
- Self-check (objective): for each body, walk its §Content sources facet checklist and confirm
  every facet is addressed in prose; confirm the body still reads as an expansion of its
  state.ts one-liner and invents no new authority/tool.
- Structural test (REQUIRED): extend the existing compose/readability test (compose.test.ts) to assert,
  for every manifest entry across all four families, that location resolves to a readable file whose
  body exceeds a non-trivial line/char threshold (i.e. beyond the current ~5-line placeholders).
  This converts "bodies are thin" into a failing assertion before the pass and a passing one after.
- Gate: `npm run verify` (fix → test → build) — proves all resources still load and the manifest
  location wiring is intact.
- Human review is optional polish AFTER the gate is green; it is not required for acceptance.
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
└── methods/{run-structured-exchange,infer-and-capture,commit-graph,read-context,generate-proposal,review-for-gaps}.md   ~
src/.pi/agents/state.ts            ?   (only if a manifest description needs to match a deepened body)
src/.pi/agents/compose.test.ts     ~   (REQUIRED: structural non-trivial-depth + location-resolves assertion)
```

Stay inside this tree. Do **not** touch `src/graph/**`, `src/db/**`, or `memory/PLAN.md` /
`memory/CROSS_CUT_PLAN.md` — the `elicitation-backlog` builder owns those concurrently.

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
