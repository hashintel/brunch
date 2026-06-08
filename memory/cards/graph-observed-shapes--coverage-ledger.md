# Graph observed-shape coverage ledger

Frontier: graph-observed-shapes
Status:   active
Mode:     single
Created:  2026-06-08

## Orientation

- **Containing seam:** the graph read surface — domain reads in
  [src/graph/queries.ts](file:///Users/lunelson/Code/hashintel/brunch-next/src/graph/queries.ts)
  exposed to three consumers: the Pi `read_graph` tool
  ([src/.pi/extensions/graph/index.ts](file:///Users/lunelson/Code/hashintel/brunch-next/src/.pi/extensions/graph/index.ts)),
  public RPC ([src/rpc/methods/graph.ts](file:///Users/lunelson/Code/hashintel/brunch-next/src/rpc/methods/graph.ts)),
  and the web observer ([src/web/queries/graph.ts](file:///Users/lunelson/Code/hashintel/brunch-next/src/web/queries/graph.ts)).
  Spec-scoped reader wiring is in [src/graph/workspace-store.ts](file:///Users/lunelson/Code/hashintel/brunch-next/src/graph/workspace-store.ts) (`SpecScopedReaders` / `forSpec`).
- **Relevant frontier item:** `graph-observed-shapes` in
  [memory/PLAN.md](file:///Users/lunelson/Code/hashintel/brunch-next/memory/PLAN.md) §Frontier Definitions
  (`Status: next`, `Certainty: proving`). Its execution pointer says: author via `ln-scope` as a
  coverage ledger once the active frontier closes. This card is that ledger slice.
- **Volatile state:** the read surface is **asymmetric by consumer**. The `read_graph` tool exposes
  6 shapes (`overview`, `neighborhood`, `list_by_kind`, `list_by_band`, `gaps`, `related`); RPC and
  web expose only 2 (`overview`, `neighborhood`). Two further graph-owned register reads
  (`getOpenReconciliationNeeds`, `getOpenElicitationBacklogEntries`) have **no transport consumer
  yet** (tests only; `elicitation_backlog` read-back is the per-turn-driver follow-on from FE-823).
- **Main open risk / insight:** the asymmetry is **probably correct, not a gap**. The frontier's real
  job is to *decide and ratify* which shapes each consumer needs — agent/RPC-only shapes are allowed
  to stay agent/RPC-only — and to guard that decision so new shapes don't bleed onto the web
  accidentally. The risk is treating "tool has 6, web has 2" as a coverage hole and over-promoting.

Posture: **proving** (inherited from `graph-observed-shapes`). Reshaped to give the decision teeth:
landing this slice *stabilizes the D60-L read-shape ownership seam* (invariants axis) via a durable
ledger + a coverage-guard test, rather than being a pure study/doc step.

Frontier-level cross-cutting obligations (from the frontier definition):

- **D60-L:** read-shape ownership stays explicit; each required consumer shape has exactly one
  canonical owner (the domain read in `graph/queries.ts`), not adapter-local formatting standing in
  for a durable read shape.
- **D33-L:** web is a read-only observer; web adoption of a shape must be deliberate, never accidental
  bleed-through from agent/RPC needs.
- **D52-L:** `src/projections/` exists only for reusable multi-consumer DTOs. Single-owner reads stay
  in their owning domain. Do not create a graph projection module to host a single-consumer shape.
- Keep graph-owned read logic out of `db/`; keep `renderers/` limited to durable LLM/session text,
  not arbitrary observer DTOs.

### Target Behavior

A closed observed-shape coverage ledger exists as a durable artifact that classifies every
`src/graph/queries.ts` read shape as required or deferred per consumer with one named canonical owner,
and a guard test asserts each consumer's actual graph-read surface equals its ledger-required set.

### Boundary Crossings

```
→ src/graph/queries.ts            (the canonical read shapes — owners)
→ src/graph/README.md             (ledger artifact: shape × consumer matrix + owner column)
→ src/rpc/README.md               (consumer-subset note pointing at the ledger)
→ src/web/README.md               (consumer-subset note pointing at the ledger)
→ a coverage-guard test           (asserts actual surfaces == ledger-required sets)
```

### Risks and Assumptions

```
- RISK: the ledger could be read as a mandate to add the 4 tool-only shapes to RPC/web.
    → MITIGATION: the ledger marks list_by_kind/list_by_band as "web-eligible, DEFERRED until a web
      feature needs them" and related/gaps as "agent/RPC-only"; no transport shape is added in this
      slice. Any "required but missing" row spawns a SEPARATE follow-on alignment card (scoped after
      the ledger is accepted, because its scope depends on this card's decisions).
- RISK: a coverage-guard test that hardcodes string lists could rot silently.
    → MITIGATION: derive the actual sets from the real surfaces where cheap (read_graph mode union,
      web query-keys graph group, RPC graph method names) and compare to the ledger's declared sets,
      so adding a real shape without updating the ledger fails the test.
- ASSUMPTION: the current asymmetry (tool 6 / RPC 2 / web 2) is intentional, not a delivery gap.
    → IMPACT IF FALSE: if a POC web feature actually needs list_by_kind/list_by_band now, this slice
      under-delivers and an alignment card is needed immediately — but that card is cheap and additive
      and does not invalidate the ledger.
    → VALIDATE: the ledger decision itself; the frontier definition already states list_by_kind/
      list_by_band are "plausible web shapes" (eligible, not yet required) and related/gaps "may
      remain agent/RPC-only".
    → [→ memory/SPEC.md D60-L read-shape ownership]
```

### Posture check

Proving posture. This slice scores on the **invariants** axis: it locates and stabilizes the
read-shape ownership seam (D60-L) by ratifying the consumer-specific inventory and installing a
regression guard against accidental web/RPC bleed-through. It is reshaped from a pure decision/doc
step into a slice with a failing-then-passing test, so it *tells us something*: it proves the
tool-vs-transport asymmetry is the intended contract. No high-impact assumption is left unretired —
the only assumption (asymmetry is intentional) is the decision this card closes.

### Acceptance Criteria

```pseudo tree
observed-shape coverage ledger
├── ledger artifact (src/graph/README.md)
│   ├── ✓ every src/graph/queries.ts read shape appears as a row (8 shapes incl. both register reads)
│   ├── ✓ each row marks required | deferred | n/a for each consumer (tool, RPC, web)
│   ├── ✓ each required shape names exactly one canonical owner (graph/queries.ts function)
│   └── ✓ deferred rows carry a one-line reason (e.g. "web-eligible, await web feature";
│         "agent/RPC-only"; "agent-internal register read, no transport consumer yet")
├── decisions encoded
│   ├── ✓ overview + neighborhood = required for tool, RPC, and web (already present)
│   ├── ✓ list_by_kind + list_by_band = required tool; web-eligible but DEFERRED; RPC follows web
│   ├── ✓ gaps + related = required tool; agent/RPC-only; NOT web
│   └── ✓ reconciliation_needs + elicitation_backlog = agent-internal; deferred from RPC/web
├── consumer-subset notes
│   ├── ✓ src/rpc/README.md states its graph subset {overview, nodeNeighborhood} + points at the ledger
│   └── ✓ src/web/README.md states its graph subset {overview, nodeNeighborhood} + points at the ledger
└── guard test
    ├── ✓ asserts read_graph tool mode set == ledger tool-required set
    ├── ✓ asserts RPC graph method set == ledger RPC-required set {overview, nodeNeighborhood}
    └── ✓ asserts web graph query-key group == ledger web-required set {overview, nodeNeighborhood}
```

### Verification Approach

```
- Inner: unit/structural test — the coverage-guard test (derives actual consumer surfaces, compares
  to declared ledger-required sets); existing graph query / RPC / web query tests still pass.
- Inner (gate): `npm run verify` (fix → test → build) proves no surface or wiring regressed.
- Middle/Outer: none — no new transport shape ships in this slice, so no observer/probe change is
  needed. (A future alignment card, if one is spawned, owns its own middle-tier read-path proof.)
```

### Cross-cutting obligations

```
- D60-L: one canonical owner per required shape; no adapter-local read shape masquerading as durable.
- D33-L: web stays read-only; no web shape added in this slice; ledger makes web adoption deliberate.
- D52-L: no new src/projections/ module for a single-consumer shape; the only shared DTOs are the
  existing GraphOverview / NeighborhoodResult types already imported by web — confirm, don't expand.
- Keep graph read logic out of db/; keep renderers/ for durable text, not observer DTOs.
```

### Expected touched paths (tentative)

```pseudo tree
src/graph/
├── README.md                          ~   (ledger artifact: shape × consumer matrix + owner column)
├── observed-shapes-coverage.test.ts   +   (coverage-guard test) — OR extend an existing graph test
└── queries.ts                         ?   (read-only; touched only if a row needs an owner comment)
src/rpc/README.md                      ~   (graph consumer-subset note → ledger)
src/web/README.md                      ~   (graph consumer-subset note → ledger)
```

No overlap with the active `crosscut-know--resource-body-depth` builder (`src/.pi/skills/**`) or any
`src/db/**` work. This card writes only to `src/graph/`, `src/rpc/README.md`, `src/web/README.md`.

## Follow-on note (do NOT pre-scope here)

If the ledger marks any shape **required but missing** for a transport consumer, that alignment
(graph → RPC → web wiring for that shape) is a separate card scoped *after* this ledger is accepted —
its scope depends on this card's decisions, so per the chain anti-speculation rule it is not
pre-scoped. The expected outcome is that **no transport shape is currently required-but-missing**, so
the frontier likely closes with ratification + guard rather than new wiring.

### Traceability

- **SPEC:** D60-L (read-shape ownership), D33-L (web read-only observer), D52-L (projections =
  reusable multi-consumer DTOs only), D51-L (graph code projection), D64-L (readiness bands feeding
  `list_by_band`).
- **Frontier:** closes the `graph-observed-shapes` "closed enumerated coverage ledger" and
  "one canonical owner per required shape" acceptance leaves; ratifies the consumer-specific
  asymmetry the frontier was created to make legible.
- **Design docs:** `src/graph/README.md`, `src/rpc/README.md`, `src/web/README.md`.
