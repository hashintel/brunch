# agents/contexts/exchanges/ — structured-exchange result text

SPEC decisions: D13-L, D84-L, D96-L, D104-L, D106-L, D108-L

Owns model-facing text for structured-exchange tool results (`present_*` and preserved canonical `request_*` detail discriminants). `src/exchanges/` owns the schemas and detail projections (D108-L); Pi exchange adapters own registration, TUI collection, and `renderResult` (Markdown pass-through of the `content` string per revised D104-L); this directory formats the returned text that becomes tool-result context. D104-L keeps this home because model-facing content is a separate audience from TUI transcript rendering.

The current question/answer grammar is the ★ pattern from the `exchange-rendering` frontier: h2 `Question:` / `Answer` frames, blockquoted body/comment text, numbered options with em-dash rationales, and checkbox answer echoes over the full option field from D106-L (`answered.options`; chosen options checked, rejected listed options struck, write-ins unnumbered).

`request_response` is the live terminal tool name. Successful responses still emit canonical `request_answer` / `request_choice` / `request_choices` / `request_review` detail discriminants, but the public content entrypoint is `request-response.ts`; the per-discriminant formatters live under `request-response/` as private implementation helpers. The same public entrypoint owns model-facing diagnostics when no matching pending present can be served.

```text
exchanges/
  present-question.ts      model-facing text for present_question display/options; concise option hierarchy, not TUI chrome
  present-candidates.ts    model-facing comparison text for recognition-only candidates
  present-review-set.ts    model-facing batch-review text, including role-named edge labels
  request-response.ts      model-facing request_response outcomes and diagnostics
  request-response/        private per-discriminant request formatter helpers
```

`present_review_set` renders role-named edge drafts as plain-language relations (for example, `req-1 bounds goal-1`) rather than raw structural arrows; the role-named payload remains the proposal grammar, while model-facing text uses the graph label projection.
