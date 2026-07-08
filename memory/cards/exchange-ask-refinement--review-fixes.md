# Ask cutover review fixes — declaration-driven collection, legacy deletion, suite un-skip

Frontier: exchange-ask-refinement (FE-1164)
Status:   active
Mode:     single
Created:  2026-07-08

> Branch: `ln/fe-1164-ask-terminal`. Follows the 2026-07-08 `ln-review` + `ln-judo-review` +
> `ln-induct` pass over build commits `11031569`/`734b334e`/`60a885d9`. One coherent
> restructuring: the un-skipped test suite is the red, the restructure is the green.

## Orientation

- **Containing seam:** `src/.pi/extensions/exchanges/` (ask collection + legacy stack), `src/exchanges/` (schemas/projections), plus the skipped suites under `src/.pi/extensions/__tests__/`, `src/dev/__tests__/`, `src/probes/__tests__/`.
- **Frontier:** `exchange-ask-refinement` (FE-1164) — built but not done: 22 silent test skips, two fallback-ladder regressions, unretired legacy cluster, declaration not driving dispatch.
- **Posture:** proving (inherited). The un-skipped suite is the uncertainty being retired.
- **Known flake:** `structured-exchange-ordering-proof.test.ts` under parallel load — rerun in isolation before diagnosing (its skipped test is also being rewritten here, which may retire the flake).

## Target Behavior

Every previously-skipped exchange test passes un-skipped against a single declaration-driven ask collection engine, with the legacy present-question/request-response stack deleted and its two lost fallback rungs (stubbed-custom → editor; multi-choice → editor envelope) restored.

## Full-card cold-start reads

```
- memory/SPEC.md   — D116-L (declaration is load-bearing), D105-L (validate at boundaries, shared predicates), D110-L/I57-L (capture semantics), D37-L
- memory/PLAN.md    — frontier: exchange-ask-refinement (review-fix status)
- src/.pi/extensions/exchanges/ask.ts — current shape (5 collectors, per-kind switch, hardcoded REVIEW_CHOICES)
- src/.pi/extensions/exchanges/shared/{answer-source,choice-source,review-source,choices-editor}.ts — the hardened ladders being ported/deleted
- src/.pi/extensions/__tests__/exchanges-present-request.test.ts — the 20 skipped tests (several pre-renamed to ask semantics)
- docs/design/STRUCTURED_EXCHANGE_ANSWERING_PATHS.md — the precedence-ladder contract (custom → editor → broker → unavailable)
- src/exchanges/schemas/shared.ts — zAskContinuationDeclaration (what the declaration carries today)
```

## Boundary Crossings

```
→ ask tool params (discriminated union: standalone | continuing — replaces superRefine + casts)
→ payload resolution: standalone args | declared continuation (runtime fill; fallbackContinuationParams deleted — undeclared offer fails loudly)
→ ONE collection engine by mode (free-text | single | multi), full precedence ladders:
   free-text: custom → stubbed-custom editor fallback → editor → broker → unavailable
   single:    custom picker (+ Other/None, comment rules via the shared schema predicate) → unavailable
   multi:     custom picker → editor-envelope fallback (requestChoicesViaEditor re-homed) → unavailable
→ result projection adapter keyed by origin (standalone → ask details; continuation → request_choice/request_review details via respondsToPresentTool)
→ transcript: unchanged detail vocabulary (capture/sweep readers untouched)
```

## Risks and Assumptions

```
- RISK: un-skipped tests encode legacy tool registration (present_question/request_response execute paths)
  → MITIGATION: convert to ask-driven equivalents preserving each test's behavioral claim; a test whose
    claim is purely "legacy tool exists" is deleted with the legacy tool, named in the commit message
- RISK: review continuations rendering declared options changes picker copy (labels from projections)
  → MITIGATION: projections already author approve/request-changes/reject labels; snapshot diffs reviewed
    deliberately, not regenerated blind
- RISK: web-driver convergence proof (skipped) may fail for a real reason once un-skipped
  → MITIGATION: it proves the broker rung this card restores; if still red after the port, stop and diagnose
    (ln-diagnose), do not re-skip
- ASSUMPTION: TUI-only stance for single-choice/review continuation collection remains deliberate
    → IMPACT IF FALSE: needs a broker/editor rung for choice too → small follow-up, not this card
    → VALIDATE: name the stance in a comment where the rung would go (induct finding 3 repair)
```

## Posture check

Proving: retires the "does the cutover preserve the FE-1138 behavioral surface" uncertainty (the suite is
the proof), stabilizes the declaration-driven terminal seam future exchange kinds aim from, and deletes
the dead parallel stack — closure as a side effect.

## Acceptance Criteria

```
✓ zero uncommented .skip in the three touched suites; repo skip count back to baseline (2 condition/reason-named)
✓ exchanges-present-request suite converted to ask and green: editor precedence, stubbed-custom fallback,
  cancellation+terminate, broker, Other/None + comment rules, unavailable mapping, duplicate-label mapping
✓ web-driver convergence proof green un-skipped (broker rung); ordering proof rewritten for ask-or-deleted
  with its claim absorbed (named in commit message)
✓ stubbed ctx.ui.custom (undefined result) falls back to ctx.ui.editor, not cancelled (answer-source parity)
✓ multi-choice without custom UI falls back to the editor envelope (requestChoicesFromSources rung re-homed
  under ask); headless multi-choice no longer unavailable when ctx.ui.editor exists
✓ continuation collection driven by the declaration: declared options render (hardcoded REVIEW_CHOICES gone
  from ask.ts), per-kind switch reduced to a result-projection adapter keyed by respondsToPresentTool
✓ fallbackContinuationParams deleted; undeclared offer → loud unavailable naming the missing declaration
✓ legacy cluster deleted: present-question.ts + request-response.ts tools, answer-source.ts, choice-source.ts,
  review-source.ts (choices-editor.ts survives — its envelope rung is live again via ask + the RPC probe)
✓ zAskParams is a discriminated union (standalone | continuing); the `as` casts in ask.ts removed
✓ comment-requirement rule expressed once via the shared schema predicate for both standalone and continuing paths
✓ normalizeOptionalText hoisted to one home (src/exchanges/ shared), 6 copies deleted
✓ empty free-text answer re-prompts (required-input discipline) instead of terminal 'unavailable'
✓ I57-L probes + capture-contract + sweep-window + RPC parity tests green unmodified in intent
✓ TOPOLOGY files + SPEC lexicon rows re-checked against the post-deletion shape (request-response.ts gone)
✓ full verify gate green; skip-count delta stated in the completion report
```

## Verification Approach

```
- Inner: the un-skipped suite itself (red first), ladder unit tests over fake ctx variants
  (custom present/stubbed/absent × editor present/absent × broker present/absent)
- Middle: tier-2 real-boot ask turn; RPC parity proof; I57-L supersession probes
- Outer: manual — dev:components picker entries unchanged; one live session ask beat
```

## Cross-cutting obligations

```
- Capture semantics are stop-the-line: any I57-L / capture-contract red is a respec signal, not a fixture update
- D37-L renderCall stays non-semantic; detail vocabulary on the wire unchanged
- Deliberate narrowings (TUI-only rungs) get a naming comment where the rung would go — no silent narrowing
- Completion report enumerates acceptance leaves explicitly (induct lens 3: no silent obligation drops)
```

## Expected touched paths (tentative)

```
src/.pi/extensions/exchanges/
├── ask.ts                          ~  (collection engine + projection adapters; shrinks)
├── present-question.ts             -
├── request-response.ts             -
└── shared/
    ├── answer-source.ts            -
    ├── choice-source.ts            -
    ├── review-source.ts            -
    ├── choices-editor.ts           ~  (re-homed under ask's multi-choice ladder)
    └── markdown.ts                 ~  (normalizeOptionalText moves out)
src/exchanges/
├── schemas/params.ts               ~  (discriminated union)
├── schemas/shared.ts               ~  (comment-rule in declaration or shared predicate wiring)
├── projections/                    ~  (normalizeOptionalText hoist; possible label tweaks)
└── text.ts                         +  (or existing shared home for normalizeOptionalText)
src/.pi/extensions/__tests__/exchanges-present-request.test.ts  ~  (un-skip + convert)
src/dev/__tests__/web-driver-streaming.exchange-convergence.test.ts  ~  (un-skip)
src/probes/__tests__/structured-exchange-ordering-proof.test.ts      ~  (rewrite for ask or delete)
src/.pi/extensions/exchanges/TOPOLOGY.md, src/exchanges/TOPOLOGY.md  ~
memory/SPEC.md                      ~  (lexicon: request_response file references)
```
