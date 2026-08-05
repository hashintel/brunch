# Review sets

Status: retained mechanism rationale; live shape is owned by code and topology
Reconciled: 2026-08-05

A review set is a structured batch proposal presented for user adjudication
before graph mutation. The durable mechanism is:

1. `present_review_set` persists the exact proposal the user can inspect.
2. The declared `ask` continuation gathers review feedback.
3. Request-changes appends a successor proposal rather than rewriting history.
4. Approval settles the exact persisted nodes and edges through one shared
   local/RPC operation.
5. The accepted batch commits atomically; partial acceptance is not a product
   primitive.

This remains long-form rationale for `memory/SPEC.md` D27-L and D28-L. It is not
the payload schema, exchange tool contract, or future-work queue.

## Current authority

- [`src/exchanges/schemas/present.ts`](../../src/exchanges/schemas/present.ts)
  owns `zReviewSetDetailsPayload`, the canonical `{nodes, edges}` proposal
  shape.
- [`src/graph/review-set.ts`](../../src/graph/review-set.ts) owns review-set
  validation and graph mutation.
- [`src/session/review-set-settlement.ts`](../../src/session/review-set-settlement.ts)
  owns shared settlement over persisted proposal details.
- [`src/exchanges/TOPOLOGY.md`](../../src/exchanges/TOPOLOGY.md) and
  [`src/.pi/extensions/exchanges/TOPOLOGY.md`](../../src/.pi/extensions/exchanges/TOPOLOGY.md)
  own exchange behavior and adapter registration.
- [`src/session/TOPOLOGY.md`](../../src/session/TOPOLOGY.md) owns transcript and
  settlement carriers.

The historical M5 payload sketch, lens taxonomy, and proposed reviewer routing
were removed because they duplicated or contradicted those authorities.

## Regeneration and projection

Request-changes preserves append-only transcript history. A successor proposal
supersedes its predecessor; the prior offer remains auditable but no longer
drives the live projection. This keeps raw history complete while allowing
agent-facing projections to prefer the latest applicable proposal.

## Atomic acceptance

Local and RPC approval share one settlement operation. Settlement revalidates
the exact persisted proposal, commits the reviewed nodes and edges through the
command layer, and records acceptance only after the commit succeeds.

Consequences:

- one atomic reviewed mutation;
- no accepted terminal for a failed commit;
- no silent translation between what the user reviewed and what is committed;
- no post-approval completion path for omitted proposal items; and
- request-changes, rejection, and mixed settlement remain explicit transcript
  outcomes.

## Historical boundaries

The original document described generative lenses, an M5
`entity_drafts`/`edge_drafts` payload, reviewer-agent triggering, and candidate
artefacts as future work. None of those descriptions owns current behavior or
sequencing. Current future direction belongs in `memory/SPEC.md`; current work
belongs in `memory/PLAN.md`.

## Cross-references

- [Elicitation lenses — historical note](ELICITATION_LENSES.md)
- [Structured-exchange request collapse — historical note](STRUCTURED_EXCHANGE_COLLAPSE.md)
- `memory/SPEC.md` D27-L, D28-L, D105-L, D110-L, and D116-L
