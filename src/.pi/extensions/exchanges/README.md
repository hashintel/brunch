# exchanges/ — structured-exchange Pi tools

Owns Pi registration and live UI collection for the structured-exchange tool
family (`present_*` / `request_*`). Result details are constructed only through
`projections/exchanges/*` and validated against the Zod schemas in `schemas/`
(see `schemas/README.md` for the details contract).

## The two envelopes

There are two distinct envelopes in this seam — do not conflate them:

- **Editor wire envelope** (`schemas/editor.ts`,
  `brunch.structured_exchange.request_choices.editor`). Pi UI built-ins cover
  every other `request_*` response shape, but the multi-choice
  `request_choices` payload cannot ride them, and Pi's `ctx.ui.custom` cannot
  cross RPC. So `request_choices` prefills this JSON envelope into
  `ctx.ui.editor` for the client to edit and return. Its `status` string is
  wire-level editor state only.
- **Transcript result envelope** (`schemas/request.ts`,
  `brunch.structured_exchange.request`). The outcome of a request is carried in
  transcript details as key presence — `answered` / `cancelled` /
  `unavailable` — never a status string.

## Answer sources

`request_answer` is dual-homed because interactive TUI sessions and headless
web-driver sessions close the same transcript result through different live
surfaces. When `ctx.hasUI` and `ctx.ui.editor` are present, the TUI editor is the
authoritative response surface; the live broker is the fallback for headless /
web-driver turns. A future web-as-driver race across both sources needs an
awaiter-cancel path before it can replace this precedence rule.

## Dependency rules

```pseudo
exchanges/*        -> schemas/, projections/exchanges/, renderers/exchanges/
exchanges/schemas/ -> zod only (pi-schema.ts is the lone TSchema adapter)
```

`structured-exchange-boundaries.test.ts` enforces these boundaries.
