# exchanges/ — structured-exchange Pi tools

Owns Pi registration, live UI collection, and TUI transcript `renderResult`
wiring for the structured-exchange tool family (`ask`, `present_review_set`,
`present_candidates`, `present_digest`). Result details are constructed only
through `src/exchanges/projections/*` and validated against the Zod schemas in
`src/exchanges/schemas/` (D108-L). D104-L sets the render rule:
`renderResult` may render from validated details for a family-specific rich
component, and must fall back to Markdown pass-through of the formatter's
`content` string when details are malformed or no rich renderer exists.
Render-honesty (details → content; elision lists beside formatters) stays owned
in `agents/contexts/exchanges/`.

## Answer sources

See [`docs/design/STRUCTURED_EXCHANGE_ANSWERING_PATHS.md`](../../../../docs/design/STRUCTURED_EXCHANGE_ANSWERING_PATHS.md)
for the underlying mechanism.

`ask` is the only registered interactive terminal. For standalone questions its
params carry the markdown body and optional options; no options means free text,
options means single choice, and options + `multiple` means multi-choice. For
offer continuations the model calls `ask({ continues })`; the runtime reads the
referenced offer's declared continuation and fills the body/options/review
vocabulary from details. Model-authored payload fields on a continuing ask are
rejected at the params boundary.

Free text uses the bordered answer editor, then the sealed editor fallback, then
the live broker when present. Choice/review continuations use Brunch-owned
`ctx.ui.custom` pickers. Mounted answer/picker borders take the current
operational-mode color role through the shared component border-color seam;
workspace/consult surfaces keep their own surface-identity colors. Picker-root
dismissal is terminal `cancelled`; nested Other/comment input steps share one
`StepResult`-shaped collector and return to the picker, with multi-choice
checkbox state restored. No-UI option asks return `unavailable` until A39-L /
headless ask discovery lands.

## Declared continuations

Surviving offer presents declare their terminal in `details.continuation`:

```pseudo
present_candidates/present_digest/present_review_set result details
  -> continuation: { tool: "ask", params: { body, options, ... } }
  -> model calls ask({ continues: exchange_id })
  -> ask collector emits canonical request detail discriminants
```

The collecting tool name is `ask`, but offer answers preserve the request-detail
vocabulary on the wire: `request_choice` for candidates and `request_review` for
review-set/digest. Digest approval still echoes `answered.accepted_abstract`.
Those discriminants are capture/sweep semantics, not registration topology.

`present_question` and `request_response` are no longer registered and their Pi
adapter modules are deleted. Legacy transcript discriminants remain only in
`src/exchanges/` schemas/projections so old persisted details can still be read
and capture-facing offer answers keep their historical wire vocabulary.

## Dependency rules

```pseudo
exchanges/*        -> src/exchanges/, agents/contexts/exchanges/, .pi/components/
exchanges/shared/  -> shared UI dispatch/render helpers only; no tool-result detail literals
```

`present_candidates` is the first details-backed transcript renderer: it parses
`PresentCandidatesDetails` and renders proposal cards through
`ExchangeCandidatesResultComponent`, with shared `details-rendering.ts` keeping
legacy/malformed result fallback on canonical `content`. `ask`,
`present_digest`, and `present_review_set` still use Markdown pass-through.

`src/exchanges/schemas/__tests__/source-boundary.test.ts` guards the
details-contract half. `src/.pi/extensions/__tests__/exchange-family-completeness.test.ts`
guards the aggregate DoD: every registered structured-exchange tool and every
preserved request-detail discriminant has formatter, preview, and snapshot coverage.
