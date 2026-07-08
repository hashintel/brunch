# Ask collection step refactor — StepResult, shared comment step, choice-row hoist, loop export

Frontier: main-editor-chrome
Status:   active
Mode:     single
Created:  2026-07-08

Orientation:

- Containing seam: the ask collection flows in `src/.pi/extensions/exchanges/ask.ts` (post-A2 shape) and the picker row helpers in `src/.pi/components/`.
- Source: ln-judo-review findings 3–5 over commits `97b1da35`/`c0aadfd6`, plus the A2 obligation gap (re-present loop never exported). **Sequence before D2 and D3** — D2 consumes the hoisted row helper; D3 consumes the exported loop and the shared comment step.
- Main open risk: none structural — behavior-preserving refactor over suites that already pin the behavior (27 A2 tests + runtime-mount battery).

Posture: earned (downgraded from the frontier's proving — pure closure over just-landed behavior; nothing unknown).

## Card (full) — behavior-preserving consolidation of the ask step machinery

### Target Behavior

The ask collection flows express nested steps through one named `StepResult<T>` union, one shared comment-collection step, and one exported re-present loop entry, with both pickers sharing the choice-line accumulator — and every existing ask/picker test stays green unchanged.

### Full-card cold-start reads

```
- memory/SPEC.md   — D104-L/D106-L (content contract untouched), I57-L (capture reads details)
- memory/PLAN.md    — frontier: main-editor-chrome (judo-review addendum)
- src/.pi/extensions/exchanges/ask.ts — the three duplicated step blocks + tri-state unions
- src/.pi/components/{exchange-decision-picker,multi-choice-picker,choice-row}.ts — the duplicated
  #choiceLines accumulator
- memory/cards/main-editor-chrome--commands-and-menus.md — Card 3's loop-entry requirement
```

### Boundary Crossings

```
→ ask.ts internal: StepResult<T> = answered<T> | back | unavailable(message) replaces the three
  ad-hoc unions; collectCommentStep(requirement, prompt, ctx) replaces the 3x required/optional block
→ ask.ts public: export the re-present collection entry (name it at build time; takes
  CollectableAskParams + question + ctx, runs the presentation loop) — the D3 seam
→ components: #choiceLines accumulator hoists into choice-row.ts beside describedChoiceLines;
  both pickers call it
→ boundary narrowing: present* helpers receive the checked custom fn (no ctx.ui!.custom!);
  hasOptions type predicate replaces the CollectableAskWithOptions cast
```

### Risks and Assumptions

```
- RISK: refactor drifts behavior in an untested corner (fallback editor path, broker path)
  → MITIGATION: no test edits allowed except additions; the diff must keep all 27 A2-era tests
    plus ask-runtime-mount green byte-identical
- ASSUMPTION: D2's consult menu can consume the hoisted accumulator as-is
    → IMPACT IF FALSE: minor — D2 shapes its own rows; the hoist still pays for the two pickers
    → VALIDATE: D2 build (not this card)
```

### Posture check

Earned. Closes: the tri-state union sprawl and triplicated comment step (dual shapes of one idea).
Canonicalizes: `StepResult<T>`, the comment step, the choice-line accumulator, and the loop entry
name. Deletes: ~60 lines of duplicated step logic and the inline non-null assertions. Locks in:
"nested ask steps are compositions of named steps" — the shape D3 builds on.

### Acceptance Criteria

```
✓ all existing suites green unchanged — exchanges-present-request.test.ts, ask-runtime-mount.test.ts,
  exchange-decision-picker.test.ts, multi-choice-picker.test.ts, required-input.test.ts (named; no
  assertion edits)
✓ new export test — the re-present loop entry is importable and drives one full
  picker→back→picker→answer cycle over a scripted ctx (the D3 contract, proven here)
✓ shrink check — ask.ts line count decreases (759 baseline); rg finds zero `ui!.custom!` and zero
  `as CollectableAskWithOptions` in ask.ts
✓ choice-row test — the accumulator has direct coverage; both pickers' rendering suites stay green
```

### Invariants preserved

```
- All A2 esc semantics (root cancel / nested back / multi state restore) — guarded by: the named
  suites above, unedited
- Content/details contracts (D104-L/D106-L/I57-L) — guarded by: writer goldens + capture probes
  (no formatter or projection files in the touched set)
```

### Verification Approach

```
- Inner: existing suites as the behavior oracle (unedited) + the new export/accumulator tests
- Middle: npm run verify before commit (full gate)
```

### Cross-cutting obligations

```
- ask.ts fractal-split watch: if this refactor plus D3 pushes past ~900 lines, split collectors into
  ask/ per the code-organization rule — this card may do it early if the diff is cleaner that way
- No behavior change: this card must not alter any user-visible flow (refactor-shaped; stop-the-line
  on any golden/snapshot churn)
```

### Expected touched paths (tentative)

```
src/.pi/extensions/exchanges/
├── ask.ts                                    ~  (or ask.ts + ask/ if split triggers)
└── shared/required-input.ts                  ?  (StepResult home candidate)
src/.pi/components/
├── choice-row.ts                             ~  (accumulator hoist + test)
├── exchange-decision-picker.ts               ~
├── multi-choice-picker.ts                    ~
└── __tests__/choice-row.test.ts              +
src/.pi/extensions/__tests__/                 ~  (new export test only; no edits to existing)
```
