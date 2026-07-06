# Structured-exchange answering paths

Sibling to [`STRUCTURED_EXCHANGE_COLLAPSE.md`](./STRUCTURED_EXCHANGE_COLLAPSE.md). That document covers
the exchange *model* (tool families, schema shapes, the `request_response` collapse). This one covers a
different question that keeps needing painful re-derivation from `pi-coding-agent` source each time it
matters: **how does a structured-exchange response actually get submitted, mechanically, across the
local TUI, Brunch's public RPC, and the live web-driver — and what does that imply for which response
kinds can get a Brunch-owned custom UI component?**

`src/.pi/extensions/exchanges/TOPOLOGY.md`'s "Answer sources" section states the resulting *policy*
correctly and should stay the first stop for orientation. This document is the *mechanism* underneath it,
with anchors into `pi-coding-agent` internals — cross-cutting enough (spans `exchanges/`, `rpc/`,
`session/`, and a dependency's internals with no home under `src/`) that it doesn't fit any one co-located
`TOPOLOGY.md`.

**Verified against:** `@earendil-works/pi-coding-agent` v0.80.3 (Brunch's installed dependency,
`package.json`'s `^0.80.3`; re-verified 2026-07-06 on the 0.79.10 → 0.80.3 bump via the checklist
below). The internals cited below (`ExtensionMode`, `bindExtensions`,
`ExtensionRunner.setUIContext`/`hasUI()`, `noOpUIContext`, the RPC mode's `ExtensionUIContext`) are
**implementation details, not public API** — nothing in `@earendil-works/pi-coding-agent`'s documented
surface promises they stay this shape. Re-verify this document whenever Brunch's pinned
`pi-coding-agent` version bumps a minor or major (D67-L: Brunch tracks latest pi routinely, so this
will happen). The public, stable part — `ExtensionUIContext`'s method signatures (`custom`,
`setEditorComponent`, `setWidget`, `setFooter`, `setHeader` take a factory; `select`/`confirm`/
`input`/`editor` do not) — is much less likely to change and is the load-bearing fact for the rest of
this document.

**0.80.3 drift notes (found by the checklist):**

- `rpc-mode.ts` moved to `modes/rpc/rpc-mode.ts` (`dist/modes/rpc/rpc-mode.js`).
- The RPC mode's `ExtensionUIContext` no longer *omits* `custom`/`editor`: `custom()` is a stub that
  resolves `undefined`, and **`editor()` is now a real RPC relay** (pending-request round trip to the
  client). Brunch never constructs `RpcMode`, so the column-A/column-B analysis below is unchanged for
  Brunch — but the "omission" phrasing of the old checklist item no longer holds.
- `noOpUIContext` now carries stub *functions* for `custom`/`editor`/`select`/`input` (resolving
  `undefined`). `hasUI()` stays identity-based (`uiContext !== noOpUIContext`), so it is still the only
  trustworthy headless signal: **capability checks must gate on `ctx.hasUI` first** — shape checks like
  `typeof ctx.ui.custom === 'function'` now pass in headless contexts and would misread the stub's
  `undefined` as a user cancellation.

## The binding mechanism

The question "does this tool call get a real `ctx.ui.custom`, or not?" is answered **once, at process
boot**, not per request or per connected client. There is no per-caller "is this a TUI human or an RPC
caller" branch anywhere in this path.

```
brunch-tui.ts (the ONE Brunch entry point — the only caller of pi-coding-agent's InteractiveMode
                anywhere in Brunch; RpcMode/PrintMode from pi-coding-agent are never constructed)
  -> new InteractiveMode(runtime)
    -> InteractiveMode.bindCurrentSessionExtensions()
      -> this.createExtensionUIContext()                    # builds {select, input, editor, custom, ...}
      -> session.bindExtensions({ uiContext, mode: "tui" })  # ALWAYS "tui" for Brunch
        -> ExtensionRunner.setUIContext(uiContext, "tui")
          -> this.uiContext = uiContext   # not noOpUIContext
          -> this.mode = "tui"

x> the only way hasUI() is ever false for a real tool call:
     bindExtensions() is never called at all (no InteractiveMode in the process)
       -> this.uiContext stays the module default, noOpUIContext
       -> hasUI() === false
     Confirmed exercised exactly once in Brunch's own tests:
     src/dev/__tests__/web-driver-streaming.exchange-convergence.test.ts overrides
     runBrunchTui's launchInteractive to skip InteractiveMode and call
     createAgentSessionRuntime() directly — a genuinely headless AgentSession, not
     "a TUI session that also happens to have a remote client attached."
```

**Anchors** (pi-coding-agent, `dist/` paths — stable across the installed package; `src/` paths for the
`pi-mono` source checkout when deeper reading is needed):

- `ExtensionMode = "tui" | "rpc" | "json" | "print"` — `dist/core/extensions/types.d.ts` /
  `src/core/extensions/types.ts`.
- `ExtensionRunner.setUIContext(uiContext?, mode)`, `.hasUI()`, module-level `noOpUIContext` —
  `dist/core/extensions/runner.js` / `src/core/extensions/runner.ts`.
- `AgentSession.bindExtensions({ uiContext, mode, ... })` — `dist/core/agent-session.js` /
  `src/core/agent-session.ts`.
- The one real call site, `mode: "tui"` hardcoded — `InteractiveMode.bindCurrentSessionExtensions()`,
  `dist/modes/interactive/interactive-mode.js` / `src/modes/interactive/interactive-mode.ts`.
- Brunch's only `InteractiveMode` construction — `src/app/brunch-tui.ts`.

## The three answering paths

```
actors:
  llm:               agent turn
  request_response:  the Pi tool (src/.pi/extensions/exchanges/request-response.ts)
  local_tui:         the one real terminal InteractiveMode owns
  rpc_client:         any JSON-RPC / web caller of Brunch's own public RPC
  broker:            LiveExchangeBroker (src/session/live-exchange-broker.ts)

# Path A — ordinary local-TUI answering (the common case; all four response kinds today)
messages:
  llm               -> request_response: tool call                        #A1
  request_response  -> local_tui:  ctx.ui.select / .editor / .custom      #A2
  local_tui         <- request_response: renders in the ONE terminal      #A3
  local_tui         -> request_response: keystroke -> resolved value      #A4
  request_response  <- llm:  tool result appended to Pi JSONL             #A5

# Path B — Brunch's own public RPC surface (session.submitExchangeResponse)
# Never touches ctx.ui. request_response.execute() is not invoked at all — this is
# a distinct, Brunch-owned mutation path, not a client relaying into the tool's UI.
messages:
  rpc_client -> session.submitExchangeResponse:  { exchangeId, answer }        #B1
  session.submitExchangeResponse -> transcript:  synthesizes toolCall + toolResult
                                                  directly (src/rpc/methods/session.ts,
                                                  handleSubmitExchangeResponse)          #B2
  session.submitExchangeResponse <- rpc_client:  { status: "accepted", ... }            #B3

# Path C — live web-driver broker (FE-873; answer/free-text ONLY today)
# The tool genuinely executes live, but no InteractiveMode is bound (a headless
# AgentSession), so ctx.hasUI is false and the collector falls through to the broker.
messages:
  llm               -> request_response:  tool call                                  #C1
  request_response  -> answer-source.ts:  ctx.hasUI? -> false                          #C2
  answer-source.ts  -> broker.awaiter:    awaitAnswer(exchangeId)                      #C3   [blocks]
  rpc_client        -> session.answerExchange:  { exchangeId, answer }                 #C4
  session.answerExchange -> broker.answerer:  submitAnswer(...)                        #C5
  broker.answerer   ~> broker.awaiter:  resolves the pending promise                   #C6
  answer-source.ts  <- request_response: tool result appended normally, same shape as A #C7

notes:
  - #A2/#C2: Path A and Path C are the SAME tool execution reaching the SAME collector code
    (src/.pi/extensions/exchanges/shared/*-source.ts) — they differ in exactly one runtime fact,
    whether InteractiveMode is bound, not in the tool or its params.
  - #B2: Path B is architecturally distinct from A and C, not a variant of either — it's a Brunch
    RPC handler directly authoring transcript entries, matching D49-L ("Brunch-owned over public
    RPC... rather than raw Pi RPC") and D38-L ("JSON-over-editor is the Pi-RPC compatibility seam,
    not a second product API").
  - #C4/#C5: `session.answerExchange` is only discoverable on the `/rpc/driver` connection when a
    live broker handle is attached (src/rpc/TOPOLOGY.md) — it is not a general-purpose method.

open:
  - Path C currently exists only for `answer` (free-text). choice/choices/review have no
    broker-equivalent; see the coverage matrix below.
```

## Coverage, per response kind

```
policy: current-state coverage, not a design rule

kind     | local-TUI (A)                                   | RPC direct-submit (B)         | live-driver headless (C)
---------|--------------------------------------------------|--------------------------------|---------------------------
answer   | ctx.ui.editor                                    | works (uniform, see notes)    | broker (built, FE-873)
choice   | ctx.ui.custom (ExchangeDecisionPickerComponent) + ctx.ui.input | works (uniform, see notes) | x> unavailable, no broker
choices  | ctx.ui.custom (MultiChoicePickerComponent), falls back to ctx.ui.editor JSON envelope | works (uniform, see notes) | x> unavailable — no broker, and the JSON-envelope fallback also needs ctx.ui, absent here too
review   | ctx.ui.custom (ExchangeDecisionPickerComponent) + ctx.ui.input | works (uniform, see notes) | x> unavailable, no broker

notes:
  - Column B is genuinely uniform across all four kinds: `session.submitExchangeResponse`
    (src/rpc/methods/session.ts) never routes through ctx.ui for any kind, so it is UNAFFECTED
    by whatever mechanism column A uses for a given kind.
  - The `review` kind serves two pending-present sources: `present_review_set` and
    `present_digest` (FE-1136, D110-L). Column B reconstructs both as review-mode pending
    exchanges via a required `respondsToPresentTool` discriminator; review-set approval may
    commit graph drafts, while digest approval is terminal-only (mints `request_review` with
    the accepted abstract echo, no graph review outcome). A new `present_*` kind that answers
    through an existing response kind must be taught to the column-B pending/accepted
    reconstruction (src/session/structured-exchange-loop/) or it is silently unanswerable
    outside the local TUI — the exact gap FE-1136's repair slice closed.
  - Column C's gap (choice/choices/review) is a pre-existing, independently tracked gap —
    docs/archive/PLAN_HISTORY.md's FE-873 entry ("Remaining web-driver legs stay in the
    web-driver-streaming Horizon frontier") and PLAN.md's `web-driver-streaming` Horizon bullet
    ("remaining consumer/UI and non-freeform answer legs"). It is orthogonal to column A.

open:
  - The column A choice/review picker mechanism now uses `ctx.ui.custom`, matching what choices
    already did. Column B did not change (still bypasses ctx.ui) and column C did not change
    (still needs a broker that doesn't exist for these kinds regardless of what column A renders
    with). This column-A UI swap is safe with respect to both B and C.
```

## Implications for component-dx / request_* picker work

- **Restyling `choice`/`review`/`answer` with a Brunch-owned bordered component only touches
  column A.** The choice/review half is now landed through a custom decision picker. It does not put
  Brunch's tested RPC-driven structured-exchange proof (SPEC requirement 24) at risk, because that
  proof exercises column B, which never reaches `ctx.ui` at all.
- **It does not create or worsen the column-C gap.** That gap already exists today for
  choice/choices/review regardless of which column-A mechanism is used; a UI swap is orthogonal to
  it, not a regression against it.
- **`choices` (`MultiChoicePickerComponent`) already proved the whole column-A pattern**:
  `ctx.ui.custom` first, `ctx.ui.editor` JSON-envelope fallback for the rare case `hasUI` is false.
  Extending `choice`/`review` to custom picker chrome was additive, not a new architecture; the
  remaining `answer` restyle is still the same column-A-only kind of change.
- **If Brunch ever wants to close the column-C gap for choice/choices/review**, that is a separate,
  already-named Horizon-frontier concern (`web-driver-streaming`) — building a
  `LiveChoiceBroker`-equivalent to `LiveExchangeBroker`. It is not blocked by, or a prerequisite
  for, any column-A restyling work.

## Re-verification checklist (when `pi-coding-agent` bumps a minor/major)

Last run: 2026-07-06 against v0.80.3 (all pass; drift recorded in the header notes).

- [ ] `ExtensionUIContext`'s method list still has the same custom-injection-vs-sealed split
      (`custom`/`setEditorComponent`/`setWidget`/`setFooter`/`setHeader` take a factory;
      `select`/`confirm`/`input`/`editor` do not).
- [ ] `bindExtensions`/`setUIContext`/`hasUI()`/`noOpUIContext` still exist with the same shape in
      `core/extensions/runner.ts` and `core/agent-session.ts`, and `hasUI()` is still the identity
      check `uiContext !== noOpUIContext` (since 0.80.x the no-op context carries stub functions, so
      method-shape checks are not a headless signal).
- [ ] `InteractiveMode.bindCurrentSessionExtensions()` still hardcodes `mode: "tui"`.
- [ ] The RPC mode's `createExtensionUIContext()` (`modes/rpc/rpc-mode.ts` since 0.80.x) still has no
      `custom` relay (stub resolving `undefined`) — its `editor` **is** a relay since 0.80.x. If a
      `custom` relay appears, the column-A/column-B distinction in this document needs re-deriving,
      not just re-reading.
- [ ] `setWorkingVisible` still exists on `ExtensionUIContext` and still no-ops headless — the
      exchange collectors bracket every interactive await with it
      (`shared/ui-context.ts` `withWorkingIndicatorHidden`).
