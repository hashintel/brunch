# agents/contexts/exchanges/ — structured-exchange result text

SPEC decisions: D13-L, D84-L, D96-L

Owns model-facing text for structured-exchange tool results (`present_*` and preserved canonical `request_*` detail discriminants). Pi exchange adapters own schemas, registration, TUI collection, and details-backed `renderResult`; this directory formats the returned text that becomes tool-result context. D104-L keeps this home because model-facing content is a separate audience from TUI transcript rendering.

`request_response` is the live terminal tool name, but successful responses emit canonical `request_answer` / `request_choice` / `request_choices` / `request_review` details, so model-facing success text stays with those preserved result-detail discriminants. `request-response.ts` is retained only for model-facing diagnostics when no matching pending present can be served.

```text
exchanges/
  present-question.ts      model-facing text for present_question display/options; concise option hierarchy, not TUI chrome
  present-candidates.ts    model-facing comparison text for recognition-only candidates
  present-review-set.ts    model-facing batch-review text, including role-named edge labels
  request-answer.ts        model-facing free-text response outcome
  request-choice.ts        model-facing single-choice/candidate-pick outcome
  request-choices.ts       model-facing multi-choice outcome
  request-review.ts        model-facing review decision outcome
  request-response.ts      diagnostic text for request_response when no canonical request details exist
```

`present_review_set` renders role-named edge drafts as plain-language relations (for example, `req-1 bounds goal-1`) rather than raw structural arrows; the role-named payload remains the proposal grammar, while model-facing text uses the graph label projection.
