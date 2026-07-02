# Content grammar: ★ pattern across formatters + option-echo payload + tuple goldens

Frontier: exchange-rendering
Status:   active
Mode:     single
Created:  2026-07-02

Posture: proving (contract widening + grammar decision — second structural slice of
the sweep; supersedes the F7 template shape the head slice landed)

Full scope card. Closes ledger rows: `request answered: choice`, `choices`,
`answer`; re-goldens `present_question` in tuple form.

## Target Behavior

Every question→response tuple in the closed inventory reads in the transcript
`content` register as the ★ grammar — `## Question:` frame, blockquote reason,
em-dash rationale on numbered options, `## Answer` echo showing the full option
field (chosen bold, rejected struck, numbering retained), blockquote comment —
with tuple-form dual-family goldens locking it.

## Cold-start reads

```
- src/agents/contexts/exchanges/design-permutations.md — ★ pattern (h2 revision),
  answer-echo variant A, candidates ★ extension; scope = content property only
- memory/SPEC.md — D104-L; §Design Notes "Exchange-presentation oracle design"
  (tuple-golden revision 2026-07-02)
- memory/cards/exchange-rendering--sweep.md — ledger rows + contract finding
- src/.pi/extensions/exchanges/schemas/request.ts — zChoiceAnsweredPayload /
  zChoicesAnsweredPayload (the widening target)
- src/.pi/extensions/exchanges/TOPOLOGY.md — two-envelopes note, single-terminal rule
```

## Boundary Crossings

```
→ schemas/request.ts (answered payloads gain the echoed option field)
→ request_response construction (already holds pending present's options — echo at build time)
→ agents/contexts/exchanges formatters (★ grammar: present-question, request-choice,
  request-choices, request-answer)
→ exchange-renderer-inventory.test.ts (tuple-form dual-family goldens)
→ dev/component-preview/exchange-fixtures.ts (tuple fixtures)
```

## Implementation directive (user, 2026-07-02)

Compose the content strings with **md-pen** (existing dependency, v1.2.0) instead of
hand-rolled string concatenation — via the existing house wrapper
`src/agents/shared/markdown.ts` (extend it with what the grammar needs: `ol`,
`taskList`, `strikethrough`, `bold`, `hr`). The full ★ grammar maps onto its API
(`heading(_,2)`, `blockquote`, `ol`, `taskList`, `bold`/`strikethrough`, `table`).
Use md-pen's `escape` for option content / user answers embedded in composed
structure (labels containing `**` or `1.` must not corrupt the grammar); evaluate
retiring the regex `markdownEscape` in `src/.pi/extensions/exchanges/shared/markdown.ts`
if it ends up caller-free.

## Decisions this card must record (→ SPEC on landing)

1. **Answered-payload option echo.** Widen choice/choices answered payloads to carry
   the full option field (chosen + rejected). New SPEC decision; capture_* consumers
   verified unaffected.
2. **★ content grammar** as the family-wide content template rule (one line in
   `src/agents/contexts/exchanges/TOPOLOGY.md`).

## Risks and Assumptions

```
- RISK: payload widening ripples into capture chains / projections consuming choice
  details → MITIGATION: grep consumers before widening; additive optional-then-required
  per pre-release posture (prefer required if all constructors can supply it).
- RISK: ★ grammar churns model-facing snapshots wholesale → tier-2 dual-audience
  probe MUST run after landing (SPEC oracle design); batch all formatter changes in
  this one slice so the probe fires once, not per-row.
- ASSUMPTION: response formatter can echo options without reading the paired present
  at format time (they ride the widened payload) → IMPACT IF FALSE: cross-entry
  lookup, which was rejected → VALIDATE: the widening itself removes the need.
```

## Acceptance Criteria

```
✓ zChoiceAnsweredPayload / zChoicesAnsweredPayload carry the full option field; fixtures regenerated
✓ formatters emit ★ grammar: h2 Question/Answer frames, blockquote reason+comment, em-dash rationale
✓ answer echo (final shape, design-permutations.md §Final resolution): checkbox echo with embedded
  numbers and struck rejected items — `- [ ] ~~1. **iTerm2**~~` / `- [x] 2. **Kitty**`; one grammar
  for choice and choices (single-choice = exactly one `[x]`); Other write-ins unnumbered, unstruck
✓ tuple-form goldens: question(answer|choice|choices) tuples — content family only (renderResult
  family suspended per D104-L revision 2026-07-02: renderResult = Markdown pass-through of content);
  per-renderer present_question snapshots superseded and deleted
✓ renderResult revert rides this slice: present_question renderResult back to renderMarkdownResult;
  details-built box renderer + its goldens/metamorphic retired; render-honesty invariant retargeted
  at the content string; preview entry shows the Markdown render
✓ render-honesty invariant green for each touched formatter/renderer pairing (echoed options are
  required rendering)
✓ structured-exchange-boundaries.test.ts green; capture/projection consumers of choice details unaffected
✓ tier-2 dual-audience probe run (or explicitly scheduled) — model-facing content changed wholesale
```

## Verification Approach

- Inner: tuple-form dual-family goldens (`exchange-renderer-inventory.test.ts`).
- Middle: render-honesty invariant per formatter; metamorphic (existing); boundaries test.
- Outer: tier-2 dual-audience probe (mandatory this slice); walkthrough re-observation rides the sweep close.

## Cross-cutting obligations

- renderResult is the Markdown pass-through of content (D104-L revision 2026-07-02; ledger row
  "renderResult = Markdown pass-through" rides this slice) — TUI-only divergence is a future ceiling.
- Do not touch live-picker collection paths.

## Expected touched paths (tentative)

```
src/.pi/extensions/exchanges/
├── schemas/request.ts                                  ~
├── request-response.ts                                 ~  (construct echoed options)
└── TOPOLOGY.md                                         ~
src/agents/contexts/exchanges/
├── present-question.ts                                 ~
├── request-choice.ts                                   ~
├── request-choices.ts                                  ~
├── request-answer.ts                                   ~
├── TOPOLOGY.md                                         ~
├── __tests__/exchange-renderer-inventory.test.ts       ~
└── __snapshots__/…                                     ~ (tuple files replace per-renderer)
src/dev/component-preview/exchange-fixtures.ts          ~
src/projections/exchanges/…                             ?  (request projections carry the echo)
memory/SPEC.md                                          ~  (payload-echo decision)
```
