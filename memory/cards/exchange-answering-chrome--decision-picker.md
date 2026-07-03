# Bordered decision picker for structured exchanges

Frontier: exchange-answering-chrome
Status:   done
Mode:     single
Created:  2026-07-03

## Orientation

- Containing seam: `src/.pi/extensions/exchanges/` owns live structured-exchange response collection; `src/.pi/components/` owns reusable Pi-native presentation components.
- Frontier item: `exchange-answering-chrome` / FE-1138 on branch `ln/fe-1138-answering-chrome`; this card narrows the frontier to the non-text decision paths that currently use raw `ctx.ui.select`.
- Handoff state: `/tmp/brunch-ship-gate-handoffs/FE-1138-answering-chrome.md` names the mission and warns not to touch persistent main editor chrome or transcript rendering except preview/test parity.
- Main open risk: the UI swap must preserve terminal outcome semantics (`answered` / `cancelled` / `unavailable`) exactly, because FE-1135's capture contract will consume those outcomes.

Posture: proving (inherited from `exchange-answering-chrome`).

## Completion

Built 2026-07-03. Choice, candidate-choice, and review collectors route through `ctx.ui.custom` + `ExchangeDecisionPickerComponent`; `ctx.ui.select` is no longer a fallback. `MultiChoicePickerComponent` now renders in the same rounded-border shell. Targeted verification passed for component direct/harness tests, exchange collector tests, existing RPC handler coverage, and the adjusted same-message ordering proof. `npm run build` passed. `npm run verify` is blocked by pre-existing/out-of-scope `src/agents/contexts/exchanges/__tests__/present-review-set.test.ts` render-honesty failure on `review_set.nodes.2.body`.

## Full scope card

### Target Behavior

Local-TUI non-text structured-exchange responses — single-choice, candidate-choice, review, and multi-choice — resolve through Brunch-bordered picker chrome.

### Full-card cold-start reads

- `memory/SPEC.md` — requirements 17, 23, 24, 28; decisions D37-L, D38-L, D41-L, D104-L, D105-L, D106-L, D108-L; invariant I23-L; lexicon entries for Structured exchange / Response tool / Offer response / JSON-editor fallback.
- `memory/PLAN.md` — frontier: `exchange-answering-chrome` under the `exchange-presentation` arc.
- `/tmp/brunch-ship-gate-handoffs/FE-1138-answering-chrome.md` — volatile branch/scope/verification focus.
- `docs/design/STRUCTURED_EXCHANGE_ANSWERING_PATHS.md` — three answering paths, coverage matrix, and the column-A vs column-B non-regression claim.
- `src/.pi/components/TOPOLOGY.md` — component ownership, dependency rules, and direct-render/harness test convention.
- `src/.pi/extensions/exchanges/TOPOLOGY.md` — answer-source policy, single `request_response` terminal, and dependency rules.
- Existing implementation anchors: `src/.pi/extensions/exchanges/shared/choice-source.ts`, `src/.pi/extensions/exchanges/shared/review-source.ts`, `src/.pi/extensions/exchanges/shared/choices-editor.ts`, `src/.pi/components/multi-choice-picker.ts`, `src/.pi/components/rounded-box.ts`, `src/.pi/components/scroll-viewport.ts`.

### Boundary Crossings

```text
→ request_response tool execution
→ pending present details recovered from Pi JSONL branch
→ choice / candidate-choice / review collector
→ ctx.ui.custom component factory in local TUI
→ Brunch-bordered decision picker component
→ existing projection constructors under src/exchanges/projections/request-response.ts
→ existing content formatters under src/agents/contexts/exchanges/request-response.ts
→ request_response toolResult details/content
```

Public RPC boundary to preserve:

```text
→ session.submitExchangeResponse
→ acceptedResponseFromParams / structured-exchange-loop materialization
→ synthetic request_response toolCall + toolResult transcript pair
x> ctx.ui.* / request_response.execute()
```

### Risks and Assumptions

- RISK: the new picker silently regresses duplicate-label mapping for `present_question` choices or duplicate candidate titles.
  → MITIGATION: keep stable ids in the picker result and retain/extend existing duplicate-label tests that select the second duplicate.
- RISK: the component handles long option lists poorly in real terminal dimensions.
  → MITIGATION: use `projectScrollViewport` with selection-follow windowing and cover movement through direct + VirtualTerminal harness tests.
- RISK: replacing `ctx.ui.select` makes headless/RPC behavior look coupled to the local-TUI UI mechanism.
  → MITIGATION: retire the `select` branch for choice/review collectors; when `ctx.ui.custom` is absent, return the same `unavailable` terminal outcome as the current no-UI path.
- RISK: the UI swap changes terminal outcome semantics while still producing plausible details.
  → MITIGATION: pin cancellation, empty-Other, missing required comment, option echo, and `respondsToPresentTool` behavior in collector tests.
- ASSUMPTION: local Brunch TUI sessions expose `ctx.ui.custom` when `ctx.hasUI` is true, matching the answering-path document and the shipped `request_choices` pattern.
  → IMPACT IF FALSE: choice/review local TUI answering returns `unavailable` instead of falling back to raw Pi select; FE-1138 exposes a Pi binding regression rather than preserving unowned chrome.
  → VALIDATE: collector tests assert `custom` is the only local picker path, and existing no-UI behavior remains terminal `unavailable`.
- ASSUMPTION: comments and `Other` text may continue to use existing `ctx.ui.input` in this slice because the gate blocker is raw select chrome, not text-entry chrome; this matches the shipped `choices` flow, whose custom picker still collects its comment through `ctx.ui.input`.
  → IMPACT IF FALSE: this card must widen into a combined picker+comment component, colliding with the later free-text answer component shape.
  → VALIDATE: keep acceptance focused on picker chrome; defer composite picker+text entry as a post-gate upgrade if product review demands it.
- DECISION (user, 2026-07-03): `MultiChoicePickerComponent` gets the bordered treatment in this card — wrap its existing render in the same `projectRoundedBox` shell so the whole exchange picker family is bordered at the gate. Behavior (toggle, commit, cancel, warning, comment flow) stays unchanged; single/multi component unification is explicitly deferred — do not rebuild the choices result/comment flow.

### Posture check

This is a proving tracer because it:

- Lights up the first production answering surface that uses Brunch-owned bordered chrome instead of Pi's raw `ctx.ui.select`.
- Stabilizes the column-A local-TUI UI seam by making `ctx.ui.custom` the single picker mechanism for choice/review collectors.
- Exercises the shipped `projectRoundedBox` / `projectScrollViewport` primitives in their intended live exchange-answering context.

### Acceptance Criteria

✓ Direct component test — renders a rounded border with prompt, numbered options, active marker, help text, and scroll thumb when options exceed the viewport.

✓ VirtualTerminal harness test — arrow/j-k movement, Enter commit, and Esc/q cancel route through a real `TUI` focus/input path and resolve stable option ids.

✓ `request_response` choice collector test — for `present_question` single-choice, `ctx.ui.custom` returns the selected stable id, preserves the optional comment path, and no longer calls `ctx.ui.select`.

✓ `request_response` candidate collector test — duplicate candidate titles still map to the selected candidate id through the custom picker.

✓ `request_response` review collector test — approve/request-changes/reject decisions use the custom picker, preserve the required-comment rule for request-changes, and keep cancellation/unavailable terminal outcomes.

✓ Terminal-outcome tests — Esc/q commits `cancelled`; Other selected with empty text commits `cancelled`; missing required comment for Other/None or request-changes commits `unavailable` with the existing message; option echo and `respondsToPresentTool` are unchanged.

✓ No-select fallback test — when `ctx.ui.custom` is absent, choice and review responses return the existing no-UI `unavailable` outcomes instead of falling back to raw `ctx.ui.select`.

✓ Multi-choice bordered wrap test — `MultiChoicePickerComponent` renders inside the same rounded-border shell; toggle/commit/cancel/warning behavior and the choices comment flow are unchanged.

✓ RPC boundary check — existing `session.submitExchangeResponse` coverage is inspected and extended only if needed to show the handler remains independent of local `ctx.ui.*` / `request_response.execute()` wiring.

✓ Preview registry — `npm run dev:components` exposes at least one preview entry for the bordered decision picker treatment.

### Verification Approach

- Inner: direct-render component tests and collector unit tests — prove render shape, keyboard state, stable-id return values, terminal outcomes, and existing request detail projections.
- Middle: VirtualTerminal harness tests — prove the component behaves through the same TUI focus/input machinery as production `ctx.ui.custom` surfaces.
- Middle: outcome-preservation tests over `request_response` collectors — prove the UI swap cannot corrupt sibling FE-1135 capture inputs.
- Middle: RPC boundary check — prove, preferably by extending existing handler coverage only if needed, that the public RPC answer path stays separate from local TUI collection.
- Outer: manual physical-terminal smoke only if the implementation changes mouse/scroll behavior beyond keyboard selection-follow windowing.

### Cross-cutting obligations

- Preserve D37-L/I23-L: durable semantics live in `toolResult.details` / formatter content, not in live UI state or `renderCall`.
- Preserve D38-L and `STRUCTURED_EXCHANGE_ANSWERING_PATHS.md`: `ctx.ui.custom` is a local-TUI column-A mechanism; public RPC `session.submitExchangeResponse` is column-B product mutation.
- Preserve D106-L: choice request details carry the full offered option echo, including candidate-title options.
- Defer GitHub-style per-item review commentary; widening the review answer payload is outside the ship-gate picker slice and would affect FE-1135/FE-1136 contracts.
- Keep `exchange-rendering` closed: do not reopen transcript renderers except if preview registry parity requires adding a live component preview.
- Do not wire persistent main editor chrome; `ctx.ui.setEditorComponent` belongs to `main-editor-chrome`.
- Keep the picker keys-only; do not introduce wheel-scroll production behavior in this slice.

### Expected touched paths (tentative)

```text
src/.pi/components/
├── exchange-decision-picker.ts                 +
├── multi-choice-picker.ts                      ~
├── TOPOLOGY.md                                 ~
└── __tests__/
    ├── exchange-decision-picker.test.ts         +
    ├── exchange-decision-picker.harness.test.ts +
    └── multi-choice-picker.test.ts              +?

src/.pi/extensions/exchanges/
├── TOPOLOGY.md                                 ~
└── shared/
    ├── choice-source.ts                         ~
    └── review-source.ts                         ~

src/.pi/extensions/__tests__/
└── exchanges-present-request.test.ts            ~

src/rpc/__tests__/
└── handlers.test.ts                             ?

src/dev/component-preview/
└── registry.ts                                  ~

docs/design/
└── STRUCTURED_EXCHANGE_ANSWERING_PATHS.md       ~
```
