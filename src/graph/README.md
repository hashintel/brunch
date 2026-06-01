# graph/ — Graph domain layer

Canonical reference: `docs/design/GRAPH_MODEL.md`
SPEC decisions: D4-L, D20-L, D51-L, D52-L, D53-L

## Owns

- **CommandExecutor** — the single mutation boundary for all graph writes.
  Hides validation, LSN allocation, change-log append, transaction mechanics.
  Returns structured results: `ok`, `needs_human`, `policy_blocked`,
  `version_conflict`, `structural_illegal`.

- **commitGraph** (D53-L) — atomic batch mutation accepting `{ nodes, edges }`
  with intra-batch refs (`"n1"`) and existing-node refs. One tool call,
  one LSN, all-or-nothing (I34-L). The load-bearing tool for propose-graph.

- **Readers / snapshot functions** — graph queries at multiple detail levels:
  cursory full-graph overview, node-neighborhood with configurable hops (I35-L).
  Called by `agents/contexts/` for prompt injection.

- **Policy** — per-category edge policy (cascade, recon-need triggers,
  criteria-help signals, projection effects).

- **Validators** — structural legality checks: closed edge-category set,
  stance rules, supersession acyclicity, framing matrix, intra-batch
  reference resolution.

- **Change-log replay** — ordered mutation history keyed by LSN.

- **Reconciliation-need substrate** — separate from graph edges;
  target is `{kind:'edge', edgeId}` or `{kind:'node_pair', aId, bId}`.

## Imports from

- `db/` — Drizzle table definitions, connection handle.
  This is the only layer that touches `db/` directly.

## Imported by

- `.pi/extensions/graph/` — Pi tool adapters call CommandExecutor
- `rpc/` — graph.* RPC handlers call readers and CommandExecutor
- `agents/contexts/` — snapshot functions for prompt context

## Current state (Phase 1 stubs)

```
graph/
├── atoms.ts                  NodeId, EdgeId, Lsn type aliases
├── index.ts                  public re-exports
├── schema/
│   ├── edges.ts              GraphEdge, EdgeCategory, EdgeStance, EdgeBasis
│   └── reconciliation-need.ts  ReconciliationNeed types
└── policy/
    └── category-policy.ts    CATEGORY_POLICY table
```

## Target state (after M4)

```
graph/
├── atoms.ts
├── index.ts
├── command-executor.ts       CommandExecutor + result types
├── commit-graph.ts           batch validation + intra-batch ref resolution
├── readers.ts                snapshot queries (cursory, neighborhood)
├── change-log.ts             replay, changesSince
├── schema/
│   ├── edges.ts
│   ├── nodes.ts              Phase 2 — per-plane node kinds
│   └── reconciliation-need.ts
└── policy/
    └── category-policy.ts
```
