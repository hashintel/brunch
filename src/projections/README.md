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

Disposition: `✓` resolved (direct lock or accepted transitive proof) · `●` keep + lock (earns place, needs invariant) · `◐` keep, decide direct-vs-transitive · `✗` delete / inline (fails earns-its-place) · `○` leave (topology stub / policy data). Consumers = importing modules outside this file.

| Module | Consumers | Disposition | Oracle / reason |
| --- | --- | --- | --- |
| `graph/neighborhood` | — | ○ | Deprecated topology stub. Node-local graph facts stay as `NodeNeighborhood` from `graph/queries.ts`; renderers/RPC/web consume that typed PULL shape directly, so no projection layer is materialized for symmetry. |
| `graph/overview` | — | ○ | `export {}` topology stub (Input/Output/Used-by named); no implementation to lock. |
| `graph/commit-result` | — | ○ | `export {}` topology stub. |
| `graph/reconciliation-needs` | — | ○ | `export {}` topology stub. |
| `session/transcript-context` | 2 | ✓ | `transcript-context.test.ts` — no non-empty markdown-bearing message disappears across the Pi `buildSessionContext()` + `convertToLlm()` seam; non-renderable entries drop at the projection boundary. |
| `session/runtime-state` | 13 | ✓ | `runtime-state.test.ts` — direct flattened-shape invariant for defaults, last-writer-wins runtime posture, mentions/world/lifecycle slots, and non-linear transcript rejection. |
| `session/affordances` | 1 | ✓ | `affordances.test.ts` — gap-driven legality + default-on-switch derivation tested directly. Legal options are a menu projection over capability-readiness; omitted options are not capability refusals (I31-L). |
| `session/capability-readiness` | 1 | ✓ | D74-L/D75-L tracer gate, not a reusable DTO. `capability-readiness.test.ts` locks the explicit capability→node-kind map, proceed / low-epistemic / negotiate outcomes, no-refusal invariant, loud failure when the gap register lacks a required kind, same-kind discrimination through `question`, and live presence-coverage flip. `session/affordances` now consumes it for axis-option legality. **D86-L: capability-readiness gates AUTO axis menus (`strategy`/`lens`) and the non-graph-write `review-for-gaps` method only — it never withholds a graph-write tool. `mutate_graph` and the review-set tools (`present_review_set`/`request_response`) are floor in elicit mode (their `commit-graph`/`generate-proposal` methods are absent from `METHOD_CAPABILITY` in `.pi/extensions/agent-runtime/runtime/state.ts`); `negotiate` is advisory (establishment offer + epistemic scaling), proven by `state.test.ts` + the tier-2 live-boot legality test.** |
| `session/readiness-estimate` | — | ✓ | D45-L soft per-band coverage rollup over `ElicitationGap[]`; UI-only and gates nothing. `readiness-estimate.test.ts` locks every-band shape, empty-band zero, importance-weighted mean, honest regression, no grade imports, and no legality-path imports. |
| `session/runtime-policy` | 4 | ○ | Policy/definitions data, not a DTO transform. Gap-driven legality is guarded via `affordances.test.ts`; no runtime grade table remains. |
| `session/assistant-visible-watermark` | 2 | ✓ | Carrier projection over the authoritative `continuity-entry-classifier` watermark set. Unit tests guard seed/overview/own-mutation/`worldUpdate` carriers, narrow-read exclusion, and cross-spec failure. |
| `session/continuity-entry-classifier` | 2 | ✓ | Shared FE-847 taxonomy for watermark-carrier vs continuity-only-non-debt vs debt-bearing entries; consumed by watermark projection and origination tail classification. |
| `session/sweep-watermark` | 1 | ✓ | FE-861 D80-L sweep-window projection. `sweep-watermark.test.ts` locks the transcript-backed marker, conversational/digest tail classification, raw-background exclusion, monotonic idempotent advance, and graph-LSN watermark separation. |
| `workspace/workspace-context` | — | ✗ | Deleted/inlined. `read_workspace_context` and `renderers/workspace/workspace-context.ts` now consume `workspace/cwd-inventory.ts` and `session/workspace-overview-context.ts` source shapes directly; no replacement wrapper survives. |
| `workspace/workspace-state` | 4 | ✓ | `workspace-state.test.ts` — direct variant-shape invariant over `ready`, `needs_human`, and base `select_spec`; chrome/session-manager internals and retired phase/chat fields stay out of the DTO. |
| `exchanges/request-choice` | 6 | ✓ | `request-choice.test.ts` (direct). |
| `exchanges/present-question` | 6 | ✓ | Keep-transitive — `.pi/__tests__/structured-exchange-present-request.test.ts` proves question/body/options projection, and `session/exchange-projection.test.ts` proves the same details survive session reconstruction. |
| `exchanges/present-review-set` | 5 | ✓ | Keep-transitive — `.pi/__tests__/structured-exchange-present-request.test.ts` proves proposal payload projection, while `session/structured-exchange-loop.test.ts` and `probes/project-graph-review-cycle-proof.test.ts` prove review-mode reconstruction and downstream use. |
| `exchanges/request-answer` | 5 | ✓ | Keep-transitive — `session/exchange-projection.test.ts` proves prompt/response pairing over persisted `toolResult.details`, and the structured-exchange `.pi` tests prove submit-time materialization. |
| `exchanges/request-choices` | 6 | ✓ | Keep-transitive — `.pi/__tests__/structured-exchange-present-request.test.ts` proves multi-select persistence and comment rules, and `session/exchange-projection.test.ts` proves the terminal tuple reconstruction. |
| `exchanges/request-review` | 5 | ✓ | Keep-transitive — `.pi/__tests__/structured-exchange-present-request.test.ts` proves approve/request-changes/reject persistence, and `probes/project-graph-review-cycle-proof.test.ts` proves the review cycle at the owning seam. |
| `exchanges/review-set-payload` | 1 | ✓ | Keep-transitive — `session/structured-exchange-loop.test.ts` reconstructs `reviewSet` from persisted details, and `probes/project-graph-review-cycle-proof.test.ts` proves the downstream review path. |
| `exchanges/present-candidates` | 2 | ✓ | `present-candidates.test.ts` — direct schema round-trip plus display normalization and candidate rubric preservation; consumed by the `present_candidates` tool and renderer. |

Aggregate DoD for the PROJECT stage: every `●` row carries a direct shape/no-loss invariant (co-located `*.test.ts`); every `✗` row is deleted/inlined with its consumer fed from the source read; `◐` rows are resolved by an explicit keep-transitive or add-direct decision; `○` rows stay untouched. `topology-boundaries.test.ts` continues to guard that `projections/` imports no adapter/transport layer, that `workspace/` remains a cwd-owned leaf without domain/adapter imports, and that direct-read graph neighborhood consumers do not accidentally adopt the deprecated projection stub. This frontier is now closed: no `●` or `◐` rows remain.

Upstream note (PULL): `●` projections lock against their read sources, so those must be stable first. Graph neighborhood remains a direct PULL read from the locked graph surface (`graph/queries.ts` + `src/graph/README.md`) rather than a PROJECT survivor. The session-domain projections sit on session read sources (`session/workspace-overview-context.ts`, `session/workspace-session-coordinator.ts`, `session/runtime-state.ts`) now inventoried in `src/session/README.md`; keep those PULL rows stable while freezing the remaining session/workspace projection invariants.

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
