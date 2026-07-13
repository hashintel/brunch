/**
 * Canonical projection for open reconciliation-need context.
 *
 * Scope: the PERSISTED needs render path — `ReconciliationNeed[]` from
 * `graph/queries.ts` shaped for LLM inspection. Still a stub; deferred until an
 * agent-context consumer needs it.
 *
 * Input:
 * - ReconciliationNeed[] from graph/queries.ts
 *
 * Output:
 * - compact typed shape grouped and ordered for LLM inspection
 * - normalized target references and omission policy
 *
 * Future users:
 * - agents/contexts/data-model/graph/reconciliation-needs.ts
 * - pushed prompt context and/or future read tools
 *
 * NOT the home of the derived `edge_revalidation` staleness tracer
 * (reconciliation-derivation frontier). That derivation is a pure graph-layer
 * projection over `updated_at_lsn` + `EDGE_CATEGORY_METADATA`, so it lives at
 * `graph/projection/derived-revalidation.ts` with its DB read in
 * `graph/queries.ts` (`getDerivedEdgeRevalidations`) — alongside the persisted
 * needs it will eventually be reconciled against, not in this LLM-render stub.
 * The derived-vs-persisted shape this stub was blocked on is now decided; a
 * future projection here may render both, keeping the derived read distinct
 * (`derived: true`, no need id).
 */

export {};
