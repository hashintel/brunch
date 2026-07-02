# Structured-exchange transcript rendering — sweep ledger

Frontier: exchange-rendering
Status:   active
Mode:     sweep
Created:  2026-07-02

## Sweep preflight

1. **Boundary.** In scope: persisted `content` formatters (`src/agents/contexts/exchanges/*`) and `renderResult` renderers (`src/.pi/extensions/exchanges/*`) for every registered exchange kind — the two transcript render surfaces. Out of scope: live pickers / answer collection (`shared/choice-source.ts`, `choices-editor.ts` UI paths — owned by `exchange-answering-chrome`); web-observer render parity (SPEC blind spot, revisit trigger named there).
2. **Source-of-truth inputs.** Exchange schemas + `details` contracts (`src/agents/contexts/exchanges/schemas/`), projection shape ledger (`src/projections/TOPOLOGY.md`), TESTING_FINDINGS F7/F8/F11, existing snapshots in `__snapshots__/`.
3. **Row ownership + closure.** Each row names its formatter and renderer files. Row closure = formatter honest + renderResult-from-details + `dev:components` preview entry + snapshot pair green + render-honesty invariant green (the four-oracle compound, SPEC §Design Notes "Exchange-presentation oracle design").
4. **Class.** Buildable-now. No evidence or wait gates; all inputs exist. The only gate is internal: the head slice must land before any row fill.
5. **Closed?** Yes — inventory enumerates every registered exchange kind plus the two cross-cutting rows (terminal states, renderCall). The family-completeness registry test makes the closure executable; a new exchange kind fails that test rather than silently extending this ledger.

## Head-slice gate

No row may be filled before `memory/cards/exchange-rendering--head-render-from-details.md` is built and its two decisions are recorded (formatter-home; render-honesty oracle shape). The head slice closes the `present_question` row as its witness.

## Ledger

| Capability | Status | Req | Fill | Owner / next | Notes |
| --- | --- | --- | --- | --- | --- |
| content grammar + option-echo payload + tuple goldens | new | ● | proving | **`memory/cards/exchange-rendering--content-grammar.md`** — build next | Collated 2026-07-02 from design session (`design-permutations.md`): ★ grammar across formatters, answered-payload option echo (contract widening), tuple-form goldens (SPEC oracle-design revision). Closes the choice/choices/answer rows below; supersedes the head slice's F7 template shape. |
| renderResult text handling | new | ● | proving | `.pi/components/rounded-box.ts` + `present-question-renderer.ts` pipeline | From head-slice review: (a) rounded-box path truncates long lines instead of wrapping — content loss; (b) inline-markdown handling for `zMarkdown` detail fields (raw `**` displays literally — F8 resurfaced); (c) TUI answer-echo styling (checkbox-style visual echo; rejection styling renderer-chosen). renderResult design surface only — content grammar is the card above. |
| present_question | built | ● | proving | head-slice card (`exchange-rendering--head-render-from-details.md`) | Built 2026-07-02. F7 template redesigned; render from `PresentQuestionDetails`; render-honesty helper at `src/.pi/extensions/exchanges/shared/render-honesty.ts`; dual snapshots split into content vs renderResult. Re-goldens in tuple form when the tuple harness row lands. |
| request answered: choice | partial | ● | proving | → `exchange-rendering--content-grammar.md`; fmt `agents/contexts/exchanges/request-choice.ts`, render `.pi/extensions/exchanges/request-response.ts` renderResult | F11 flat "# Response"; tie answer back to its question. Working direction (2026-07-02) for the **content string** (design scope of `src/agents/contexts/exchanges/design-permutations.md` — renderResult is a separate design surface): ★ pattern — `## Question:` frame (h2), blockquote reason, em-dash inline rationale on numbered options, `## Answer` echo with full option field visible; answer-echo lead shape: checkbox echo with embedded original numbers (`- [x] 2. **Kitty**`); strike variant (A) alternate for single-choice — final pick at build. Blockquote comment. **Contract finding:** `zChoiceAnsweredPayload` carries only the selected choice — checkbox echo requires widening the answered payload with the full option field (`request_response` already holds the pending present's options at construction). Schema change → record as SPEC decision when the row lands; fill is proving, not earned |
| request answered: choices | partial | ● | proving | → `exchange-rendering--content-grammar.md`; fmt `agents/contexts/exchanges/request-choices.ts`, render same renderResult | multi-select display; same ★ direction + contract widening as choice row |
| request answered: answer | partial | ● | earned | → `exchange-rendering--content-grammar.md`; fmt `agents/contexts/exchanges/request-answer.ts`, render same renderResult | free-text display; ★ frame + blockquoted verbatim answer |
| request answered: review | partial | ● | earned | fmt `agents/contexts/exchanges/request-review.ts`, render same renderResult | decision + comment display; representation map (e.g. `request_changes` → "Changes requested") feeds elision/representation list |
| request terminal states | partial | ● | earned | fmt per-kind cancelled/unavailable branches + `request-response.ts` diagnostic, render same renderResult | cancelled / unavailable / diagnostic; quiet styling; fixtures hand-authored (rare live). Note: all `request_*` rows share one renderResult — expect one details-dispatching renderer, not four |
| present_candidates | partial | ● | earned | fmt `agents/contexts/exchanges/present-candidates.ts`, render `.pi/extensions/exchanges/present-candidates.ts` | rubric table renders honestly; candidates→cards is a fill-time micro-decision (`projectRoundedBox` available, not obligatory) |
| present_review_set | partial | ● | earned | fmt `agents/contexts/exchanges/present-review-set.ts`, render `.pi/extensions/exchanges/present-review-set.ts` | deepest details contract; drafts/edges/settlement honesty — render-honesty invariant does the heavy lifting. Presentation candidates in `design-permutations.md` §Review-set evaluation (numbered-drafts-as-vocabulary / nested edges / table+sentences — pick at fill time via preview gallery). Decision renders ★-consistently (checkbox echo over the verdict enum + blockquote comment) — no contract change. **Out of this row:** GitHub-style per-item commentary = answered-payload widening + collection UI; payload half is a SPEC decision, UI half is `exchange-answering-chrome` — route through `ln-plan` if pursued |
| STRUCTURAL_ILLEGAL / recovery | partial | ● | earned | `formatExchangeStructuralIllegal`, `agents/contexts/exchanges/shared/recovery.ts` | agent-facing but user-visible on failure; hand-authored fixtures |
| renderCall coverage | partial | ● | earned | all exchange tool registrations in `.pi/extensions/exchanges/` | per-kind micro-decision: stay empty or minimal call line; record the rule once, apply per row |
| present_alternatives | have | ○ | — | `.pi/components/alternatives.ts` | D104-L decision: stays a standalone card-set message family, not a structured-exchange render row, unless a future frontier explicitly folds it into registered exchange tools. |

DoD: every ● row `built` (or `have`) + family-completeness registry test green + `structured-exchange-boundaries.test.ts` green + `src/.pi/extensions/exchanges/TOPOLOGY.md` and `src/projections/TOPOLOGY.md` shape ledger reconciled.

## Verification (all rows)

Four-oracle compound per `memory/SPEC.md` §Design Notes "Exchange-presentation oracle design":

- Inner: dual-family **tuple** goldens — each golden shows a present result + its request_response result together in transcript order (`content` family + `renderResult` family; the family split is the dual-audience gate). Tuple inventory: question(free-text)→answer · question(choice)→choice (listed / Other / ±comment) · question(choices)→choices · candidates→choice (provenance) · review_set→review (approve / request_changes / reject) · terminal states (cancelled / unavailable / diagnostic — solo where no pair exists) · STRUCTURAL_ILLEGAL (solo).
- Middle: render-honesty invariant (every populated `details` leaf rendered or in the renderer's declared elision list); live/persisted metamorphic render equality; family-completeness registry test (= executable DoD).
- Outer: preview-gallery review per row closure (human aesthetic judgment — acknowledged blind spot); walkthrough re-observation (TESTING_PLAN.md scenarios 3/5) after the sweep; tier-2 dual-audience probe fires when any model-facing `content` snapshot changes.

## Cross-cutting obligations (every row fill)

- Dual-audience discipline: persisted `content` changes are model-context changes — keep model-facing text concise/stable; visual work goes in renderResult.
- Preview-harness parity: every changed renderer lands with its `dev:components` entry (`src/dev/component-preview/registry.ts`).
- Boundary rule: never touch `shared/choice-source.ts` / `choices-editor.ts` UI collection; consume result details only.
