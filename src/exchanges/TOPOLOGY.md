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
    present-candidates.ts canonical present_candidates details construction
    present-digest.ts     canonical present_digest details construction
    present-question.ts   canonical present_question details construction
    present-review-set.ts canonical present_review_set details construction
    request-response.ts   canonical request_response result details construction
```

`request-response.ts` is the public request-side projection entrypoint. The
preserved `request_answer` / `request_choice` / `request_choices` /
`request_review` discriminants live in transcript details, not in the public file
topology; per-discriminant constructors are private helpers under
`projections/request-response/`. `request_review` projection callers must pass the
present-tool discriminator (`present_review_set` or `present_digest`) because
both presents close through the same terminal detail kind while capture reads
them differently; digest approval also requires the accepted abstract echo.

## Dependency direction

```pseudo
exchanges/schemas/          -> graph/ only for graph-owned review-set boundary teaching
exchanges/projections/      -> exchanges/schemas/, graph/
exchanges/recovery.ts       -> exchanges/schemas/
exchanges/editor-envelope.ts -> exchanges/schemas/
exchanges/                  x> .pi/, rpc/, app/, web/, agents/contexts/
```
