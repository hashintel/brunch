# exchanges/ — structured-exchange Pi tools

Owns Pi registration, live UI collection, and TUI transcript `renderResult`
wiring for the structured-exchange tool family (`present_question`,
`present_review_set`, `present_candidates`, and `request_response`). Result
details are constructed only through `src/exchanges/projections/*` and validated
against the Zod schemas in `schemas/` (see `schemas/README.md` for the details
contract). D104-L (as revised 2026-07-02) sets the render rule: `renderResult`
is the Markdown pass-through of the formatter's `content` string — the content
formatters in `agents/contexts/exchanges/` are the designed surface, and the
render-honesty contract (details → content; elision lists beside the
formatters) lives there. A details-built TUI-only render is the named upgrade
path if exchange blocks should diverge from the content register.

## The two envelopes

There are two distinct envelopes in this seam — do not conflate them:

- **Editor wire envelope** (`schemas/editor.ts`,
  `brunch.structured_exchange.request_choices.editor`). Pi UI built-ins cover
  every other `request_*` response shape, but the multi-choice
  `request_choices` payload cannot ride them, and Pi's `ctx.ui.custom` cannot
  cross RPC. So TUI uses a Brunch checkbox picker first, while RPC/headless
  fallback still prefills this JSON envelope into `ctx.ui.editor` for the
  client to edit and return. Its `status` string is wire-level editor state
  only.
- **Transcript result envelope** (`schemas/request.ts`,
  `brunch.structured_exchange.request`). The outcome of a request is carried in
  transcript details as key presence — `answered` / `cancelled` /
  `unavailable` — never a status string.

## Answer sources

See [`docs/design/STRUCTURED_EXCHANGE_ANSWERING_PATHS.md`](../../../../docs/design/STRUCTURED_EXCHANGE_ANSWERING_PATHS.md)
for the underlying mechanism (why `ctx.hasUI`/`ctx.ui.custom` are a process-boot-time fact, not
a per-caller one; the three distinct answering paths; and per-kind coverage) rather than
re-deriving it from `pi-coding-agent` source each time it matters.

`request_response` is dual-homed for free-text prompts because interactive TUI
sessions and headless web-driver sessions close the same transcript result
through different live surfaces. It routes through `shared/answer-source.ts`:
when `ctx.hasUI` and `ctx.ui.editor` are present, the TUI editor is the
authoritative response surface; the live broker is the fallback for headless /
web-driver turns. A future web-as-driver race across both sources needs an
awaiter-cancel path before it can replace this precedence rule.

`present_question` is the merged prompt anchor. `options[]` presence derives the
response kind: no options → free-text `answer`, options → single `choice`, and
options + `multiple` → `choices`. `request_response` finds the pending `present_question`
from the current session transcript and dispatches by that server-owned kind.
Choice and multi-choice response paths intentionally remain TUI-only for this
slice; without `ctx.ui` they return `unavailable`, matching the retired choice
tools rather than inventing a broker choice surface.

## Single terminal

`request_response` is the **only** terminal tool. It routes by the pending
present's `tool_meta.curr`: `present_question` to the answer/choice/choices
sources above, `present_review_set` to `shared/review-source.ts`
(approve / request-changes / reject, with a required change-request comment),
and `present_candidates` to the single-choice UI source with candidate
provenance preserved for later `capture_candidate`.
The retired `request_answer` / `request_choice` / `request_choices` /
`request_review` names survive only as transcript **result-detail discriminants**
(`tool_meta.curr` on the request details and the `capture_*` chains). The public
projection and content surfaces are now the single `request-response.ts`
entrypoints, with per-discriminant helpers hidden below them; `request_response`
derives the response kind from the pending present and emits those same
canonical request details.
`shared/ui-context.ts` is the one structural `ctx` slice every collector reads,
so the tool casts the runtime `ctx` once at the boundary.
For D106-L, `request_response` passes the pending present's listed options (or
candidate titles) into the projection constructors so `request_choice` /
`request_choices` details carry the full answer echo without re-listing literals
inside collectors or formatters.
For D107-L, `present_review_set` enriches valid graph proposals with real
`review_set.nodes[*].proposed_code` values before persistence; later approval
must commit under those exact codes or fail as structural illegal.

## Dependency rules

```pseudo
exchanges/*        -> src/exchanges/, agents/contexts/exchanges/, .pi/components/
exchanges/shared/  -> shared UI dispatch/render helpers only; no tool-result detail literals
```

`structured-exchange-boundaries.test.ts` enforces these boundaries.
