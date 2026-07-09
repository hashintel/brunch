# agents/contexts/exchanges/ — structured-exchange result text

SPEC decisions: D13-L, D84-L, D96-L, D104-L, D106-L, D108-L, D116-L

Owns model-facing text for structured-exchange tool results (`ask`, `present_*`,
and preserved canonical `request_*` detail discriminants). `src/exchanges/`
owns schemas and projections; Pi exchange adapters own registration, TUI
collection, and `renderResult` (validated details-backed rich renderers with
Markdown pass-through fallback where a family opts in, per D104-L). This
directory formats returned text that becomes tool-result context.

`ask` is the active terminal formatter for standalone questions. It renders the
question body, answer, selected/listed options, and optional comment/Other
framing prompts from the durable question echo so recorded comments remain
legible without the transient UI state. Offer continuations are collected by the
registered `ask` tool, but their durable result details intentionally keep the
existing `request_choice` / `request_review` discriminants so capture/sweep
readers keep their semantic vocabulary.

`present_candidates` uses persisted-content comparison lines rather than
card-like sections: each candidate is an h2 with labeled bold rubric lines. The
TUI transcript renderer separately projects the same validated details as
recognition-proposal cards; this formatter remains the canonical model-facing
record. Structural ids, continuation declarations, meta-rubric bookkeeping, and
graph refs are declared content elisions.

`present_digest` renders prose digest facets directly (`Abstract`, optional
`Analysis`, optional `Recommendation`). The paired approval terminal is still a
`request_review` detail discriminant; its formatter echoes
`answered.accepted_abstract` so sweep-visible accepted digest material is present
in model-facing content too.

```text
exchanges/
  ask.ts                   model-facing standalone ask outcomes
  present-question.ts      legacy present_question formatter for old persisted reads/tests
  present-candidates.ts    model-facing comparison text for recognition-only candidates
  present-digest.ts        model-facing prose digest text for large-source review
  present-review-set.ts    model-facing batch-review text, including role-named edge labels
  request-response.ts      model-facing preserved request-detail outcomes and diagnostics
  request-response/        private per-discriminant request formatter helpers
```

`present_review_set` renders role-named edge drafts as plain-language relations
rather than raw structural arrows; the role-named payload remains the proposal
grammar, while model-facing text uses the graph label projection.
