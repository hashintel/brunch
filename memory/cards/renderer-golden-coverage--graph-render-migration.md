# Graph-render migration (house style: G-D overview / G-C neighborhood)

Frontier: renderer-golden-coverage
Status:   active
Mode:     chain
Created:  2026-06-16

## Orientation

- Seam: the graph tool-result renders under `src/renderers/graph/`, migrating onto the D83-L house-style substrate (md-pen + TOON + pseudo edge lines), with the representation already chosen by the 2026-06-16 design-it-twice: **overview => G-D** (TOON node roster + pseudo edge lines), **node-neighborhood => G-C** (per-node adjacency), uniform sets stay TOON.
- Frontier: `renderer-golden-coverage` (FE-870, branch `ln/fe-870-renderer-golden-context-tools`). This file is the follow-on scope after the house-style chain (substrate + `<workspace>` + `<specification>`) landed; it also absorbs the `<specification>` graph block deferred from that chain's Card 3.
- Posture: proving (inherited) — first two scope renders proved the dialect reads well; this migrates the graph surface onto it.
- **Scoping correction (2026-06-16, verified in code):** the graph render surface is NOT one shared renderer. It is three, with different live-ness:
  - `formatGraphOverview` (`graph/graph-slice.ts`) — LIVE: `read_graph` overview / by-kind / by-band modes. (Its docstring claims it is "shared by read_graph and the context-seed payload" — **stale**: the seed does not use it.)
  - `formatNeighborhood` (`graph/node-neighborhood.ts`) — LIVE: `read_graph` neighborhood mode.
  - `formatGraphSlice` + variants `compact-summary` / `grouped-list` / `full-debug` (`graph/graph-slice.ts`) — **DEAD: zero non-test callers**; exercised only by its own golden (5 preview files). The renderers/README ledger row claiming it serves "read_graph list modes + context seed" is inaccurate.
  - `renderGraphSeed` (`session/agent-context-seed.ts`) — LIVE but SEPARATE: the per-turn seed graph block, lens-aware and capped; its own renderer, not in `renderers/`. Its migration belongs with the `<session>`/seed re-cluster, NOT this file.
- Main risk: migrating a render that is shared by multiple `read_graph` modes (overview/by-kind/by-band all call `formatGraphOverview`) re-locks several goldens at once; and the "never truncated" overview policy (formatGraphOverview's stated contract) must be preserved or explicitly revised.
- Cross-cutting obligations: `renderers/` stays free of adapter/transport imports (D52-L); goldens co-located under `__previews__/`; the **legibility rule** (neighborhood projects relations to prose, no structural leak — already an invariant on `formatNeighborhood`) must survive the G-C migration; the design-pass gate (exact output sketched + user-approved before lock) applies to Cards 1 and 3 as it did to `<workspace>`/`<specification>`.

## Dependency Sketch

```text
Card 0  retire dead formatGraphSlice + variants + 5 goldens   [buildable NOW; no design pass]
  └─ shrinks graph-slice.ts to just formatGraphOverview before Card 1 migrates it

Card 1  formatGraphOverview => G-D house style                [Design: PENDING -> then buildable]
  └─ unlocks Card 2 (the <specification> graph block consumes the migrated overview)

Card 2  add the <specification> graph block (absorbs the Card-3 deferral)   [depends on Card 1 built]

Card 3  formatNeighborhood => G-C house style                 [Design: PENDING; independent of Cards 0-2]

Later (NOT in this file):
  - renderGraphSeed (the per-turn seed graph block) migration — belongs with <session>/seed re-cluster
  - exchanges/* render migration onto md-pen
```

Anti-speculation note: Card 0 is a pure deletion (independent). Cards 1 and 3 carry their own design-pass gates and do not depend on each other's findings (G-D/G-C shapes are pre-decided; only exact output is pending). Card 2 depends on Card 1 as a *built* dependency (it imports the migrated overview render), not on Card 1's findings.

---

## Card 0 — Retire dead `formatGraphSlice` + variants

Status: next — buildable now (no design pass; pure deletion + ledger correction)

### Target Behavior

`formatGraphSlice` and its `compact-summary` / `grouped-list` / `full-debug` variants are removed along with their 5 goldens, and the renderers/README ledger no longer claims a dead renderer serves live consumers.

### Full-card cold-start reads

```
- memory/PLAN.md    — frontier: renderer-golden-coverage
- src/renderers/graph/graph-slice.ts          — formatGraphSlice (+ variants) to delete; formatGraphOverview STAYS
- src/renderers/graph/__tests__/graph-slice.test.ts — the only caller (test); prune the formatGraphSlice cases
- src/renderers/graph/__previews__/graph-slice-*-{compact-summary,grouped-list,full-debug}.md — 5 goldens to delete
- src/renderers/README.md                     — ledger row to correct
- AGENTS.md §critical file-safety rule; pre-release deletion posture
```

### Risks and Assumptions

```
- ASSUMPTION: formatGraphSlice has no production caller and is not an intended-future read_graph richness.
    → EVIDENCE: `grep formatGraphSlice` shows zero non-test callers; read_graph uses formatGraphOverview.
    → IMPACT IF FALSE: deleting a planned surface. → VALIDATE: confirm with user before deleting (it is golden-tested, not an export {} topology stub, so the topology-stub guard does not auto-protect it, but intent confirmation is cheap).
- RISK: formatGraphOverview lives in the SAME file; deletion must not perturb it or its read_graph wiring.
    → MITIGATION: delete only the formatGraphSlice symbols + variant helpers they uniquely use; run read_graph tests.
```

### Acceptance Criteria

```
✓ deleted        — formatGraphSlice + the 3 variant formatters + helpers used only by them are gone; formatGraphOverview + formatNeighborhood unchanged.
✓ goldens-pruned — the 5 formatGraphSlice variant previews are removed; remaining graph goldens unchanged.
✓ ledger-correct — renderers/README graph-slice row reflects reality (formatGraphOverview => read_graph overview/by-kind/by-band; NOT the seed); no row claims formatGraphSlice serves live consumers.
✓ green          — read_graph tests + `npm run verify` pass.
```

### Expected touched paths (tentative)

```
src/renderers/graph/
├── graph-slice.ts                 ~   (remove formatGraphSlice + variants; keep formatGraphOverview)
├── __tests__/graph-slice.test.ts  ~   (prune variant cases)
└── __previews__/                  -   (5 variant goldens)
src/renderers/README.md            ~   (correct the graph-slice ledger row)
```

---

## Card 1 — Migrate `formatGraphOverview` to the G-D house style

Status: blocked — design pass pending (exact G-D output)
Design: PENDING — sketch the G-D output (TOON node roster + pseudo edge lines, md-pen substrate), user red-lines, append approved sketch here, then build.

### Target Behavior

`read_graph`'s overview / by-kind / by-band output renders in the G-D house style (a TOON node roster + pseudo edge lines on the md-pen substrate), golden-locked to the approved sketch, preserving the uncapped-overview contract.

### Full-card cold-start reads

```
- memory/SPEC.md   — D83-L (house style), D52-L (renderers boundary), the legibility rule
- memory/PLAN.md    — frontier: renderer-golden-coverage (graph migration: overview => G-D)
- THIS card's appended Design sketch — REQUIRED before build
- src/renderers/graph/graph-slice.ts          — formatGraphOverview (post-Card-0)
- src/renderers/{markdown,toon,tree,section}.ts — substrate
- src/.pi/extensions/graph/index.ts           — read_graph dispatch (3 modes call formatGraphOverview with different headings)
- src/renderers/graph/__previews__/           — overview goldens to re-lock
```

### Data sources (structural scope)

```
- nodes : GraphSlice.nodes {code (formatGraphNodeCode), plane, kind, title, detail?}  → TOON node roster
- edges : GraphSlice.edges {id, sourceId, category, stance?, targetId}                → pseudo edge lines (source -[category stance]- target)
- header: heading + LSN + node/edge counts (the 3 modes pass distinct headings)       → md
```

### Design-pass questions (resolve in the sketch)

```
- node TOON field projection (code/plane/kind/title? include detail flag?)
- edge line format (codes + [category stance]; how to render missing endpoints)
- header/heading line + the by-kind / by-band heading variants (one render, 3 headings)
- empty-graph case; the "never truncated" overview contract (G-D must not silently cap)
- is the read_graph overview section-wrapped, or bare body? (it is a tool result, not a <section> scope block — likely bare; the <specification> graph block in Card 2 wraps/labels it)
```

### Invariants

```
- the overview stays UNCAPPED (formatGraphOverview's contract); G-D must not truncate
- renderers/ imports stay clean (D52-L); legibility rule preserved
- all 3 read_graph modes (overview/by-kind/by-band) render through the one migrated function
```

### Acceptance Criteria (skeleton — finalized by the design pass)

```
✓ overview-g-d   — read_graph overview renders G-D (TOON node roster + pseudo edge lines); 3 mode-headings preserved.
✓ uncapped       — full node/edge sets render; no silent truncation.
✓ golden         — read_graph overview goldens re-locked to the approved sketch (after user eyeball).
✓ invariant      — uncapped; clean imports; legibility preserved.
```

### Expected touched paths (tentative)

```
src/renderers/graph/
├── graph-slice.ts                 ~   (formatGraphOverview => G-D)
├── __tests__/                     ~
└── __previews__/                  ~   (re-lock overview goldens)
src/renderers/README.md            ~   (ledger row)
```

---

## Card 2 — `<specification>` graph block (absorb the Card-3 deferral)

Status: blocked — depends on Card 1 (consumes the migrated overview); own mini-design pass for the `Graph:` sub-block placement/label.

Sketch: add a `Graph:` labeled sub-block to the `<specification>` render between Overview and Sessions (or after Gaps — design-pass call), embedding the Card-1 G-D overview. Re-lock the `<specification>` golden. Removes the "graph deferred; Overview carries size only" note from the spec render.

## Card 3 — Migrate `formatNeighborhood` to G-C

Status: blocked — design pass pending (exact G-C output); independent of Cards 0-2.

Sketch: migrate `formatNeighborhood` to the G-C per-node adjacency form (`<-`/`->` grouped) on the md-pen substrate, **preserving the no-structural-leak legibility invariant** (relations as prose, no raw ids / role tokens). Re-lock the 6 neighborhood goldens. Design-pass-gated.
