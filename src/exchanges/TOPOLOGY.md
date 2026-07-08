# exchanges/ — structured-exchange core contracts

SPEC decisions: D41-L, D105-L, D106-L, D107-L, D108-L

Owns structured-exchange schemas, transcript detail constructors, and read-side
recognizers (consolidated here from `src/.pi/extensions/exchanges/schemas/` and
`src/projections/exchanges/` by D108-L). Pi extension tools collect and register
runtime surfaces; agent context modules render model-facing content.

## Public paths

```text
exchanges/
  schemas/                Zod-authored params, details, capture, and editor envelopes
  recovery.ts             transcript detail recognizers and pending-present scan
  editor-envelope.ts      request_choices editor wire-envelope prefill/parse helpers
  projections/
    ask.ts                canonical standalone ask details construction
    present-candidates.ts canonical present_candidates details + ask continuation construction
    present-digest.ts     canonical present_digest details + ask continuation construction
    present-question.ts   legacy present_question details construction (unregistered; kept for old persisted reads/tests)
    present-review-set.ts canonical present_review_set details + ask continuation construction
    request-response.ts   canonical preserved request-detail construction
```

`ask.ts` is the standalone question terminal projection: one request-schema toolResult carries the question echo and answer together. Offer presents now declare their `ask` continuation in details, and the registered `ask` tool emits preserved request-detail discriminants (`request_choice` / `request_review`) when called by reference. `request-response.ts` remains as the canonical constructor home for those preserved transcript details and legacy reads; `request_response` is no longer the registered collection tool. `request_review` projection callers must pass the present-tool discriminator (`present_review_set` or `present_digest`) because both presents close through the same terminal detail kind while capture reads them differently; digest approval also requires the accepted abstract echo.

## Dependency direction

```pseudo
exchanges/schemas/          -> graph/ only for graph-owned review-set boundary teaching
exchanges/projections/      -> exchanges/schemas/, graph/
exchanges/recovery.ts       -> exchanges/schemas/
exchanges/editor-envelope.ts -> exchanges/schemas/
exchanges/                  x> .pi/, rpc/, app/, web/, agents/contexts/
```
