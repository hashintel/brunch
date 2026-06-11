# projections/ — reusable DTO boundaries

SPEC decisions: D52-L, D75-L

## Owns

Structured DTOs derived from graph, session, workspace, or tool facts when the shape is reused across adapters, renderers, RPC, web, probes, or agent context assembly.

Projection modules preserve information; they do not render markdown, perform Pi registration, own transport handlers, mutate graph/session state, or import web/RPC/app adapters.

## Projection shape ledger

PROJECT is the info-preserving stage of the context pipeline (D60-L: PULL → **PROJECT** → RENDER → COMPOSE). Two gates decide each module's disposition, in order:

1. **Earns-its-place.** A projection is justified only when it performs a real transform (selection, flattening, formatting, SDK conversion) *and* its shape is reused across multiple consumers (renderers / RPC / web / probes / agent context). A single-consumer module that only re-wraps its source shape is indirection: delete it and feed the source directly. Not every domain needs a projection.
2. **Oracle.** A surviving projection takes a **shape / no-loss invariant**, not a golden snapshot — the failure that matters is a projection silently dropping a field a downstream renderer also hides, which a golden cannot catch.

This ledger is the closed inventory; every implemented module appears once. Domain folders stay split only while each owns at least one earned projection (e.g. `workspace/` is kept by `workspace-state`, not by `workspace-context`).

Disposition: `✓` locked · `●` keep + lock (earns place, needs invariant) · `◐` keep, decide direct-vs-transitive · `✗` delete / inline (fails earns-its-place) · `○` leave (topology stub / policy data). Consumers = importing modules outside this file.

| Module | Consumers | Disposition | Oracle / reason |
| --- | --- | --- | --- |
| `graph/neighborhood` | 4 | ● | Real `projectNeighborhood` (tagged not-found/success). Invariant: success preserves projected node code + every edge endpoint; not-found exhaustive. |
| `graph/overview` | — | ○ | `export {}` topology stub (Input/Output/Used-by named); no implementation to lock. |
| `graph/commit-result` | — | ○ | `export {}` topology stub. |
| `graph/reconciliation-needs` | — | ○ | `export {}` topology stub. |
| `session/transcript-context` | 2 | ● | Real transform: filters session entries + Pi-SDK convert. Invariant: no non-empty transcript entry dropped. Consumes the Pi SDK (external trust boundary), not a PULL surface we own. |
| `session/runtime-state` | 13 | ● | Most-consumed projection; flattens runtime state. Direct flattened-shape invariant guards the field set every consumer relies on. |
| `session/affordances` | 1 | ✓ | `affordances.test.ts` — gap-driven legality + default-on-switch derivation tested directly. Legal options are a menu projection over capability-readiness; omitted options are not capability refusals (I31-L). |
| `session/capability-readiness` | 1 | ✓ | D74-L/D75-L tracer gate, not a reusable DTO. `capability-readiness.test.ts` locks the explicit capability→node-kind map, proceed / low-epistemic / negotiate outcomes, no-refusal invariant, loud failure when the gap register lacks a required kind, same-kind discrimination through `question`, and live presence-coverage flip. `session/affordances` now consumes it for axis-option legality. |
| `session/readiness-estimate` | — | ✓ | D45-L soft per-band coverage rollup over `ElicitationGap[]`; UI-only and gates nothing. `readiness-estimate.test.ts` locks every-band shape, empty-band zero, importance-weighted mean, honest regression, no grade imports, and no legality-path imports. |
| `session/runtime-policy` | 4 | ○ | Policy/definitions data, not a DTO transform. Affordance legality is guarded via `affordances.test.ts`; dormant prompt manifest grade tables are temporarily local to `.pi/agents/state.ts` until the method/manifest follow-on. |
| `workspace/workspace-context` | 1 | ✗ | Pure `{ mode, data }` tag wrapper — zero transform, single consumer (`.pi/extensions/context/get-cwd.ts`). Source `session/workspace-context.ts` already exports the shapes + `inspect*` and can feed the consumer directly. Delete / inline. |
| `workspace/workspace-state` | 4 | ● | Real flatten of the `WorkspaceSessionState` union to a narrow DTO. Shape invariant across status variants (`ready` / `needs_human` / base). |
| `exchanges/request-choice` | 6 | ✓ | `request-choice.test.ts` (direct). |
| `exchanges/present-options` | 5 | ◐ | Builds `toolResult.details`; covered transitively via `.pi` structured-exchange tests. Decide direct-lock vs keep-transitive at design checkpoint. |
| `exchanges/present-question` | 5 | ◐ | As above. |
| `exchanges/present-review-set` | 5 | ◐ | As above. |
| `exchanges/request-answer` | 5 | ◐ | As above. |
| `exchanges/request-choices` | 6 | ◐ | As above. |
| `exchanges/request-review` | 5 | ◐ | As above. |
| `exchanges/review-set-payload` | 1 | ◐ | Covered transitively via the graph review-set path. |
| `exchanges/present-candidates` | 1 | ○ | `export {}` topology stub (candidate-family, all three layers); leave until the tool lands. |

Aggregate DoD for the PROJECT stage: every `●` row carries a direct shape/no-loss invariant (co-located `*.test.ts`); every `✗` row is deleted/inlined with its consumer fed from the source read; `◐` rows are resolved by an explicit keep-transitive or add-direct decision; `○` rows stay untouched. `topology-boundaries.test.ts` continues to guard that `projections/` imports no adapter/transport layer.

Upstream note (PULL): `●` projections lock against their read sources, so those must be stable first. `graph/neighborhood` sits on the locked, ledgered graph read surface (`graph/queries.ts` + `src/graph/README.md`). The session-domain projections sit on session read sources (`session/workspace-context.ts`, `session/workspace-session-coordinator.ts`, `session/runtime-state.ts`) which are behaviorally tested but not yet inventoried as a closed read-shape ledger — ledger that PULL half before freezing the session/workspace projection invariants.

## Directory layout

```pseudo
projections/
  graph/                 graph read/command DTO projection
  session/               transcript-context and runtime-state DTO projection
  exchanges/             canonical toolResult.details construction and transcript details → domain DTO adapters
  workspace/             workspace/session state DTO projection
```

## Dependency direction

```pseudo
projections/* -> graph/, session/, workspace/ [domain inputs]
projections/  x> .pi/, rpc/, app/, web/
```

Current migration notes:

- `projections/exchanges/*` imports Zod schemas from `.pi/extensions/exchanges/schemas/` because D37-L/D41-L currently place the structured-exchange schema lock at that Pi transcript seam. That is an explicit temporary exception, not a general adapter dependency permission.
- `projections/session/runtime-state.ts` owns flattened runtime-state DTO projection while `session/runtime-state.ts` owns transcript entry facts and append helpers.
