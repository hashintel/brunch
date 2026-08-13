# projections/ — reusable DTO boundaries

SPEC decisions: D52-L, D75-L, D104-L, D133-L, I65-L

## Owns

Structured DTOs derived from graph, session, workspace, or tool facts when the shape is reused across adapters, renderers, RPC, web, probes, or agent context assembly.

Projection modules preserve information; they do not render markdown, perform Pi registration, own transport handlers, mutate graph/session state, or import web/RPC/app adapters.

## Projection shape ledger

PROJECT is the info-preserving stage of the context pipeline (D60-L: PULL → **PROJECT** → RENDER → COMPOSE). Two gates decide each module's disposition, in order:

1. **Earns-its-place.** A projection is justified only when it performs a real transform (selection, flattening, formatting, SDK conversion) *and* its shape is reused across multiple consumers (renderers / RPC / web / probes / agent context). A single-consumer module that only re-wraps its source shape is indirection: delete it and feed the source directly. Not every domain needs a projection.
2. **Oracle.** A surviving projection takes a **shape / no-loss invariant**, not a golden snapshot — the failure that matters is a projection silently dropping a field a downstream renderer also hides, which a golden cannot catch.

This ledger is the closed inventory; every implemented projection appears once. Domain folders stay split only while each owns at least one earned projection (e.g. `workspace/` is kept by `workspace-state`, not by `workspace-context`).

Disposition: `✓` resolved (direct lock or accepted transitive proof) · `●` keep + lock (earns place, needs invariant) · `◐` keep, decide direct-vs-transitive · `✗` delete / inline (fails earns-its-place) · `○` leave (topology stub / policy data). Consumers count production importers outside `src/projections/`; tests and the module's own file are excluded.

| Module                                | Consumers | Disposition | Oracle / reason                                                                                                                                                                                                                                         |
| ------------------------------------- | --------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `graph/neighborhood`                  | —         | ○           | Deprecated topology stub. Node-local graph facts stay as `NodeNeighborhood` from `graph/queries.ts`; renderers/RPC/web consume that typed PULL shape directly, so no projection layer is materialized for symmetry.                                     |
| `graph/overview`                      | —         | ○           | `export {}` topology stub (Input/Output/Used-by named); no implementation to lock.                                                                                                                                                                      |
| `graph/commit-result`                 | —         | ○           | `export {}` topology stub.                                                                                                                                                                                                                              |
| `graph/reconciliation-needs`          | —         | ○           | `export {}` topology stub.                                                                                                                                                                                                                              |
| `session/session-presentation`       | 6         | ✓           | `session-presentation.test.ts` — stable semantic ordinary-message, full ask-family, and candidate/digest/review-set identities from canonical JSONL; present and terminal details validate once, unresolved asks project as one semantic open control and converge to their terminal, recognized non-offer failures are omitted, malformed rivals fail closed, and approved review terminals preserve the exact receipt. Consumers: hosted RPC, React hydration, and runtime-contract witnesses. |
| `session/live-session-events`        | 2         | ✓           | Projects cumulative Pi updates into transport-neutral semantic deltas and treats only real `agent_settled` as convergence. Consumed by the TUI adapter, standalone host, and React/runtime-contract witnesses; focused tests lock ordinary text, ask, settlement, and malformed-event behavior. |
| `session/transcript-context`          | 2         | ✓           | `transcript-context.test.ts` — no non-empty markdown-bearing message disappears across the Pi `buildSessionContext()` + `convertToLlm()` seam; non-renderable entries drop at the projection boundary.                                                  |
| `session/runtime-state`               | 4         | ✓           | `runtime-state.test.ts` — direct flattened-shape invariant for defaults, last-writer-wins operational mode, mentions/world/lifecycle slots, and non-linear transcript rejection.                                                                        |
| `session/assistant-visible-watermark` | 2         | ✓           | Carrier projection over the authoritative `continuity-entry-classifier` watermark set. Unit tests guard seed/overview/own-mutation/`worldUpdate` carriers, narrow-read exclusion, and cross-spec failure.                                               |
| `session/continuity-entry-classifier` | 5         | ✓           | Shared FE-847 taxonomy for watermark-carrier vs continuity-only-non-debt vs debt-bearing entries; consumed by watermark projection and origination tail classification.                                                                                 |
| `session/sweep-watermark`             | 2         | ✓           | FE-861 D80-L sweep-window projection. `sweep-watermark.test.ts` locks the transcript-backed marker, conversational tail classification, raw-background and legacy digest-custom exclusion, `present_*`/reserved `capture_*` toolResult exclusion with `ask` + legacy `request_*` terminal inclusion (FE-1135/FE-1136/FE-1164), monotonic idempotent advance, and graph-LSN watermark separation. Classification is include-list by decision (D117-L: fail-closed toward background); the admitted terminal name is currently a string literal — anchoring it to the exchanges-family constant is the owed hardening named there. |
| `workspace/workspace-context`         | —         | ✗           | Deleted/inlined. `read_workspace_context` and `agents/contexts/data-model/workspace/workspace-context.ts` now consume `workspace/cwd-inventory.ts` and `session/workspace-overview-context.ts` source shapes directly; no replacement wrapper survives. |
| `workspace/workspace-state`           | 5         | ✓           | `workspace-state.test.ts` — direct variant-shape invariant over `ready`, `needs_human`, and base `select_spec`; chrome/session-manager internals and retired phase/chat fields stay out of the DTO.                                                     |

Aggregate DoD for the PROJECT stage: every `●` row carries a direct shape/no-loss invariant (co-located `*.test.ts`); every `✗` row is deleted/inlined with its consumer fed from the source read; `◐` rows are resolved by an explicit keep-transitive or add-direct decision; `○` rows stay untouched. `topology-boundaries.test.ts` continues to guard that `projections/` imports no adapter/transport layer, that `workspace/` remains a cwd-owned leaf without domain/adapter imports, and that direct-read graph neighborhood consumers do not accidentally adopt the deprecated projection stub. This frontier is now closed: no `●` or `◐` rows remain.

Upstream note (PULL): `●` projections lock against their read sources, so those must be stable first. Graph neighborhood remains a direct PULL read from the locked graph surface (`graph/queries.ts` + `src/graph/TOPOLOGY.md`) rather than a PROJECT survivor. The session-domain projections sit on session read sources (`session/workspace-overview-context.ts`, `session/workspace-session-coordinator.ts`, `session/runtime-state.ts`) inventoried in `src/session/TOPOLOGY.md`; keep those PULL rows stable when changing these closed projection invariants.

## Directory layout

```pseudo
projections/
  graph/                 graph read/command DTO projection
  session/               presentation/live-event, transcript-context, runtime-state, and watermark DTO projections
  workspace/             workspace/session state DTO projection
```

`session/readiness-estimate.ts` was deleted (D45-L, I31-L, `elicitation-gap-guidance` frontier): there is no soft, count-based readiness DTO. Readiness is a just-in-time judgment over graph facts + the `latestExpectedBand` scalar (`graph/schema/nodes.ts`), not a projection-owned rollup.

## Dependency direction

```pseudo
projections/* -> graph/, session/, workspace/ [domain inputs]
projections/  x> .pi/, rpc/, app/, web/
```

Current migration notes:

- `projections/session/runtime-state.ts` owns flattened runtime-state DTO projection while `session/runtime-state.ts` owns transcript entry facts and append helpers. Public projections report operational mode and role only; they do not own agent body locations, capability-readiness, runtime affordance menus, or tool policy.
- The former `projections/exchanges/` detail constructors moved to `src/exchanges/projections/` (D108-L, 2026-07-03); structured-exchange detail projection is no longer owned by this directory.
