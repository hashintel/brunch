# One-shot ask terminal — rich-body picker, ask cutover, declared continuations

Frontier: exchange-ask-refinement (FE-1164)
Status:   active
Mode:     slices
Created:  2026-07-07

> Branch: `ln/fe-1164-ask-terminal`, stacked on the tied-off `ln/fe-1115-tui-refinements-1` (PR #301).
> Design authority: SPEC D116-L. Posture: proving (inherited from exchange-ask-refinement).
> Sequence discipline: cards are sequential; none depends on implementation *findings* of an
> earlier card — the design is settled by D116-L. If card 2 surfaces a schema/conduct surprise
> that would reshape card 3, stop and route back through `ln-spec`.

## Orientation

- **Containing seam:** the structured-exchange tool family — `src/exchanges/` (schemas/projections/recovery), `src/.pi/extensions/exchanges/` (registration + collection), `src/agents/contexts/exchanges/` (content formatters), `src/.pi/components/` (answering UI).
- **Frontier:** `exchange-ask-refinement` (PLAN Active; FE-1164). D116-L is the decision; A39-L defers headless discovery.
- **Cross-cutting obligations (frontier-level):** capture semantics must survive the rewiring (I57-L digest supersession probes, `respondsToPresentTool` reads, sweep-window exclusions); D37-L (durable semantics in details, `renderCall` non-semantic); D104-L render-honesty (populated detail leaves appear in content, named display text, or an elision list); new ask params born with `zNonBlankMarkdown` boundaries (do not create blank-carrier debt for the Horizon sweep).
- **Main open risk:** model conduct with the new tool shape (mitigated by harness priors — ask-tools are the shape models already know) and the golden/snapshot churn of retiring `present_question` content formatters.
- **Known flake:** `src/probes/__tests__/structured-exchange-ordering-proof.test.ts` failed once under full-suite parallel load (2026-07-07). Treat a failure there as possible flake first: rerun in isolation before diagnosing.

---

## Card 1 — rich-body picker surface [done]

Light scope card.

### Objective

The bordered answering components can render a rich markdown question body inside the box —
markdown-themed, scrollable when long, options stacked below — previewable in `dev:components`,
without changing any tool or schema.

### Light-card cold-start reads

```
- memory/SPEC.md   — D116-L (presentation half: rounded-box picker family, border-label channel)
- memory/PLAN.md    — frontier: exchange-ask-refinement
- src/.pi/components/exchange-decision-picker.ts, multi-choice-picker.ts — current prompt-only box stacking
- src/.pi/components/rounded-box.ts — stackSections/projectRoundedBox/topLabel/bottomLabel (label channel already exists)
- src/.pi/extensions/exchanges/shared/markdown.ts — createStructuredExchangeMarkdownTheme (the body's theme)
- src/dev/component-preview/registry.ts — preview entry contract
```

### Acceptance Criteria

```
✓ decision picker renders optional markdown `body` inside the box: mdHeading/quote/list ANSI present,
  body wrapped to inner width, options below, hint line last (stackSections ordering test)
✓ multi-choice picker accepts the same optional body (shared helper, not copy-paste)
✓ long body + options stay usable: scroll behavior does not regress the existing MAX_VISIBLE choice window
✓ border-label channel: a picker constructed with topLabel/bottomLabel renders them (chrome-annotation
  compatibility per D116-L — content vs label ownership stays with the caller)
✓ dev:components preview entries show a rich-body variant for both pickers (theme-testbed-grade fixture)
✓ existing picker tests and exchange answering tests stay green (no call-site is forced to pass a body)
```

### Verification Approach

```
- Inner: vitest on src/.pi/components/__tests__ — render-line assertions (ANSI + layout), existing suites
- Outer: manual — npm run dev:components, both picker entries, ctrl+t both variants
```

### Cross-cutting obligations

```
- Box module owns spacing (stackSections rule): body supplies only its own lines, no blank-margin authoring
- No schema/tool change in this card — presentation only
```

### Assumption dependency

None.

### Expected touched paths (tentative)

```
src/.pi/components/
├── exchange-decision-picker.ts    ~  (optional body: markdown lines section)
├── multi-choice-picker.ts         ~  (same seam)
├── exchange-markdown-body.ts      +  (shared body→lines helper, if extraction earns it)
└── __tests__/                     ~
src/dev/component-preview/
└── registry.ts                    ~  (rich-body preview variants)
```

---

## Card 2 — standalone ask cutover [next]

Full scope card.

### Target Behavior

A simple question is one `ask` tool call: params carry body/options/mode, the rich-body picker
collects the answer while the call is open, and the single durable toolResult renders question +
answer together — with `present_question` and the question discriminants of `request_response` retired.

### Full-card cold-start reads

```
- memory/SPEC.md   — D116-L (design), D37-L, D105-L, D106-L; A39-L (deferred headless discovery)
- memory/PLAN.md    — frontier: exchange-ask-refinement (absorbed follow-ups list)
- src/exchanges/TOPOLOGY.md + src/exchanges/schemas/TOPOLOGY.md — details contract, projection homes
- src/.pi/extensions/exchanges/TOPOLOGY.md — answering paths, the two envelopes, single-terminal shape being revised
- docs/design/STRUCTURED_EXCHANGE_ANSWERING_PATHS.md — hasUI/custom/broker precedence (unchanged mechanism)
- src/.pi/extensions/exchanges/shared/answer-source.ts + choice-source.ts — the collection precedence to inherit
- src/exchanges/recovery.ts — the pending-present scan the question kind exits
- ~/.pi/agent/extensions/ask-user-question.ts — prior-art shape reference (params, Other handling, result text)
```

### Boundary Crossings

```
→ model tool call (ask params: body markdown, options?, multiple?, Other/None policy)
→ Zod param validation (zNonBlankMarkdown on body/labels; reserved escape ids per FE-1138 conventions)
→ TUI collection: rich-body picker via ctx.ui.custom (working indicator hidden) | ctx.ui.editor fallback
  (free-text) | broker awaitAnswer | unavailable (headless, until A39-L seam lands)
→ result projection (src/exchanges/projections/) + content formatter (agents/contexts/exchanges/)
→ durable toolResult: details carry question + options echo + answer (D106-L self-containment);
  renderResult = markdown pass-through of content (D104-L)
→ capture sweep: answered ask details are sweep-visible carriers exactly as request details were
```

### Risks and Assumptions

```
- RISK: model keeps calling retired present_question (stale conduct priors in prompts/skills)
  → MITIGATION: retire the tool registration outright (unknown tool = loud); sweep conduct docs in the
    same slice; the ask shape matches external harness priors so drift pressure is toward ask, not away
- RISK: golden/snapshot churn (content goldens organized as present+request tuples)
  → MITIGATION: regenerate deliberately; the tuple-golden family for questions collapses to single-result
    goldens — a designed change, reviewed as such (D104-L render-honesty still binds)
- ASSUMPTION: cancel/unavailable semantics port unchanged (presence-keyed answered/cancelled/unavailable,
  terminate-on-cancel)
    → IMPACT IF FALSE: conduct regressions in esc-inert behavior → VALIDATE: existing behavior tests
      ported to ask; no new SPEC assumption needed (D116-L already binds this)
```

### Posture check

Proving. Scores on all three axes: **proof of life** (the one-shot ask path end to end), **invariants**
(the terminal seam future cards aim from), **uncertainty** (retires the model-conduct question — does the
model use the new shape correctly — which no study step can answer).

### Acceptance Criteria

```
✓ ask registered: options[] presence derives mode (absent → free-text, present → single, multiple → multi);
  params validated with zNonBlankMarkdown body/labels; reserved escape ids (other/none) enforced
✓ present_question and its pi registration retired; question discriminants removed from request_response
  dispatch (request_response survives for offer terminals only, until card 3 revisits it)
✓ recovery.ts: question kind no longer produces pending presents; offer kinds unchanged
✓ TUI: rich-body picker collects single/multi; editor component collects free-text; cancel → cancelled
  details + terminate; hasUI-false + no broker → unavailable
✓ durable result: details carry question + full options echo + answer; content renders question + answer
  together; render-honesty check passes
✓ exchange-family-completeness test updated: ask has formatter, preview entry, snapshot coverage
✓ sweep-window tests: answered ask is sweep-visible; open-call/offer exclusions unchanged
✓ conduct/prompt guidance swept: no reference to present_question or question-mode request_response remains
✓ full verify gate green (ordering-proof flake rule applies)
```

### Verification Approach

```
- Inner: vitest — param validation, projection/formatter units, picker collection tests over fake ctx.ui,
  completeness + sweep-window suites; content goldens regenerated deliberately
- Middle: tier-2 real-boot faux turn asking via ask (session construction + registration on the product path)
- Outer: manual live session — model asks a real question; box shows rich body + options; scrollback holds;
  answered transcript shows question+answer as one artifact
```

### Cross-cutting obligations

```
- D37-L: renderCall stays non-semantic/invisible; semantics only in the result
- D104-L render-honesty binds the new formatter; content goldens are the single family (pass-through rule)
- FE-1138 hardening inherits: empty-answer rejection, None exclusivity, working-indicator hidden, box-owned spacing
- normalizeOptionalText hoist (5× duplicated in src/exchanges/projections/) lands while touching these files
```

### Expected touched paths (tentative)

```
src/exchanges/
├── schemas/            ~  (ask params/details; present_question question schemas retired)
├── projections/        ~  (ask result projection; question request projections retired; normalizeOptionalText hoist)
└── recovery.ts         ~
src/.pi/extensions/exchanges/
├── ask.ts              +  (registration + collection routing)
├── present-question.ts -
├── request-response.ts ~  (question dispatch removed)
├── index.ts            ~
└── shared/             ~  (answer/choice sources re-aimed at ask)
src/agents/contexts/exchanges/   ~  (ask formatter; question formatters retired; conduct guidance sweep)
src/.pi/extensions/__tests__/    ~  (completeness)
src/dev/component-preview/       ~  (ask preview entry)
src/exchanges/TOPOLOGY.md, src/.pi/extensions/exchanges/TOPOLOGY.md  ~  (D116-L materialization)
```

---

## Card 3 — offer declared continuations [pending]

Full scope card.

### Target Behavior

Offer presents (`present_candidates`, `present_digest`, `present_review_set`) declare their expected
ask continuation in tool-result details, and the terminal ask is invoked by reference
(`continues: <exchange_id>`) with the runtime filling the payload from the declaration — retiring
`request_response` and the hand-taught per-kind dispatch entirely.

### Full-card cold-start reads

```
- memory/SPEC.md   — D116-L (declared continuation, reference invocation), D106-L, D107-L, D110-L, I57-L
- memory/PLAN.md    — frontier: exchange-ask-refinement
- src/exchanges/TOPOLOGY.md — request-response projection topology being absorbed
- src/.pi/extensions/exchanges/TOPOLOGY.md — review-source/choice-source routing, the two envelopes
- src/exchanges/recovery.ts — offer-side pending scan (survives, now declaration-driven)
- src/rpc/methods/session.ts — session.pendingExchange / submitExchangeResponse readers of the same facts
```

### Boundary Crossings

```
→ present_* projections: details gain `continuation` (tool + full ask payload: body, options/vocabulary, mode,
  comment requirements) — declared in details, never content (D37-L)
→ model calls ask with `continues: <exchange_id>` (+ optional preface line)
→ runtime resolves the declaration from the pending offer's details; fills the payload; model-authored
  payload on a continuing ask is rejected (declaration is load-bearing, not advisory)
→ collection routes by declared vocabulary (review → approve/request-changes/reject + comment rules;
  candidates → titles with provenance)
→ terminal details keep capture-compatible discriminants (respondsToPresentTool, accepted_abstract echo)
→ recovery/pendingExchange: pending = offer whose declared continuation has no matching ask result
```

### Risks and Assumptions

```
- RISK: capture/sweep regressions — the highest-value invariant surface in this family
  → MITIGATION: I57-L probes and capture-contract tests run unmodified in intent: terminal details keep the
    discriminant fields those reads consume even as the collecting tool changes name; treat any I57-L red
    as a stop-and-respec signal, not a test to update
- RISK: RPC parity — session.submitExchangeResponse reconstructs review-mode pending exchanges today
  → MITIGATION: it reads the same declaration; parity test extended so TUI and RPC answering stay identical (D110-L)
- ASSUMPTION: reference-based fill is enough (no legitimate case where a continuing ask must vary from
  its declaration)
    → IMPACT IF FALSE: needs a declared-override design → back to ln-spec; blast radius is this card only
    → VALIDATE: walkthrough beats on candidates + digest + review-set through the new terminal
```

### Posture check

Proving. **Invariants** axis primarily: locks the declared-continuation seam (the thing review-commentary-
widening and future exchange kinds will aim from); **uncertainty**: proves reference invocation is
conduct-workable. Landing it deletes `request_response`, the per-kind dispatch, and the exchange-specific
pending machinery — closure as a side effect of the proof.

### Acceptance Criteria

```
✓ present_* details carry validated `continuation` declarations (schema-authored; content unchanged)
✓ ask accepts `continues:`; runtime fills payload from declaration; model payload on continuing ask rejected
✓ request_response retired: registration, dispatch, and question/review routing gone; result detail
  discriminants preserved for capture reads (tool_meta.curr vocabulary unchanged on the wire)
✓ review vocabulary flows as declared payload: approve/request-changes/reject with required-comment rule
  enforced from the declaration; digest approval still echoes accepted_abstract (D110-L)
✓ candidates: titles + provenance flow through declaration; capture_candidate chain unaffected
✓ recovery + session.pendingExchange + submitExchangeResponse read declaration-based pending; RPC/TUI
  parity test green
✓ I57-L supersession/cancel probes green unmodified in intent
✓ completeness test: every offer kind has a declaration; every declaration has collection + snapshot coverage
✓ full verify gate green
```

### Verification Approach

```
- Inner: schema round-trips, declaration-fill units, rejection tests, parity tests, I57-L probes
- Middle: tier-2 real-boot offer→ask chains per kind (candidates, digest, review-set)
- Outer: manual walkthrough — digest request-changes → regenerate → approve through the new terminal
```

### Cross-cutting obligations

```
- I57-L and capture-contract semantics are stop-the-line invariants, not updatable fixtures
- D107-L proposed codes ride the declaration unchanged (commit under exact codes or fail loudly)
- Editor wire envelope (request_choices JSON-over-editor fallback): re-home under ask's RPC fallback,
  do not silently drop the headless multi-choice path
- Topology reconciliation: exchanges TOPOLOGY files + the D116-L decision row's "unbuilt" markers cleared;
  Lexicon rows (Ask tool, Declared continuation, Pending exchange, Response tool) flipped from target to current
```

### Expected touched paths (tentative)

```
src/exchanges/
├── schemas/                 ~  (continuation declaration; request_response schemas absorbed/retired)
├── projections/             ~  (present projections declare; request-response/ absorbed into ask)
└── recovery.ts              ~  (declaration-driven pending)
src/.pi/extensions/exchanges/
├── ask.ts                   ~  (continues: mode)
├── request-response.ts      -
├── present-candidates.ts    ~
├── present-digest.ts        ~
├── present-review-set.ts    ~
└── shared/review-source.ts  ~
src/rpc/methods/session.ts   ~  (pendingExchange/submitExchangeResponse over declarations)
src/session/live-exchange-broker.ts  ?
src/agents/contexts/exchanges/       ~  (formatters + conduct guidance)
memory/SPEC.md               ~  (clear "unbuilt" markers, flip lexicon rows — reconciliation, not new rows)
```
