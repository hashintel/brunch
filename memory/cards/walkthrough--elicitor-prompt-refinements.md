# Elicitor prompt refinements: concision directive, multi-select nudge, stale gap vocabulary

Frontier: n/a (walkthrough doctor-pass fixes; see TESTING_FINDINGS.md F5, F9 + cross-checks)
Status:   active
Mode:     single
Created:  2026-07-02

## Light card — prompt-text-only edits in the elicitor persona and tool promptGuidelines

### Objective

The elicitor persona carries an explicit concision/style directive and a multi-select preference nudge, and no live prompt text references the retired "ranked elicitation gaps" vocabulary.

Note: F5's verbosity evidence was gathered while the persona was NOT reaching the provider (F1). Land after (or alongside) the F1 fix; re-observe verbosity in the walkthrough before tuning further.

### Light-card cold-start reads

```
- memory/SPEC.md      — D101-L (persisted/ranked gaps retired; session-local scratchpad), D98-L (elicitor persona is the Specify-mode prompt)
- TESTING_FINDINGS.md — F5, F9, "Cross-checks recorded in passing" (stale vocabulary item)
- src/agents/prompts/elicitor.md — persona body (style directive home)
- src/.pi/extensions/exchanges/present-question.ts — tool description + promptGuideline (multi-select nudge home)
- src/.pi/extensions/brunch-data/ — read_specification_context promptGuideline containing "ranked elicitation gaps"
```

### Edits

1. **Concision directive (F5)** in `elicitor.md`: clear-and-concise style block — may sacrifice grammar for clarity; prefer structural forms (lists, pseudocode, diagrams) where they carry the content; avoid over-reliance on inline bold/italic styling.
2. **Multi-select nudge (F9)**: in the elicitor persona and/or `present_question` promptGuideline: prefer `multiple: true` when options are not mutually exclusive; single-select only when exactly one answer is wanted.
3. **Stale vocabulary**: replace "ranked elicitation gaps" in the `read_specification_context` promptGuideline with current D101-L language (session-local scratchpad / graph-fact reasoning; no ranking).

### Acceptance Criteria

```
✓ grep guard — no live prompt/promptGuideline text matches "ranked elicitation gaps" (extend the elicitation-gap-guidance closure test if cheap)
✓ persona directive — composed elicitor prompt contains the concision/style block (assert via compose-live-prompt test)
✓ multi-select nudge — composed prompt or present_question guideline contains the mutually-exclusive heuristic
✓ no behavior regressions — existing prompt-composition and registry tests pass unchanged
```

### Verification Approach

```
- Inner: npm run fix; vitest for prompt composition (src/agents/runtime/elicitor) and skills/registry tests
- Outer: walkthrough thread re-observes verbosity and question-style choice on subsequent beats (post-F1)
```

### Cross-cutting obligations

- D101-L closure stays closed: do not reintroduce gap-ranking vocabulary anywhere in live prompts.

### Assumption dependency

None (style tuning is judgment; the walkthrough is the feedback loop).

### Expected touched paths (tentative)

```
src/agents/prompts/elicitor.md                       ~
src/.pi/extensions/exchanges/present-question.ts     ~   (description/promptGuideline text only — no rendering changes; F7/F8 excluded)
src/.pi/extensions/brunch-data/                      ~   (read_specification_context guideline text)
src/graph/__tests__/elicitation-gap-guidance-closure.test.ts ?  (extend grep guard)
```

### Promotion checklist

All no — stays light. Text-only edits inside settled prompt homes; rendering code untouched.
