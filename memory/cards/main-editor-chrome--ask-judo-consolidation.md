# Ask judo consolidation — dedupe collection steps, flatten continuation, fractal split

Frontier: main-editor-chrome
Status:   active
Mode:     slices
Created:  2026-07-08

Orientation:

- Containing seam: the ask collection surface, `src/.pi/extensions/exchanges/ask.ts` and its `shared/required-input.ts` step vocabulary (established by the consumed `--ask-step-refactor.md` fix card).
- Frontier: `main-editor-chrome` (FE-1169). Source: 2026-07-08 judo review #2 (range `dd330a85..8b343ca9`), findings 1–5. This is the second review's fix card, sibling of the consumed `--ask-step-refactor.md`.
- Volatile state: `ask.ts` is at 810 lines with a standing ~1k fractal-split watch (HANDOFF.md §Review debt); D3's continuation machinery (+271 lines this range) is the growth driver and forms a coherent private seam.
- Main open risk: behavior drift in the continuation paths, which have thinner test coverage than the standalone ask paths — mitigated by the invariants list below.

Posture: earned (downgraded from the frontier's proving — pure closure refactors over landed, tested behavior; nothing unknown).

All four slices are behavior-preserving. Run in order; each is one commit gated by `npm run verify`.

## Slice 1 (done) — one comment-collection helper

### Objective

The required/optional comment decision lives in one helper instead of three near-identical blocks (`collectPickedSingleChoice`, `collectPickedMultiChoices`, `collectContinuationReviewComment`).

### Light-card cold-start reads

```
- memory/SPEC.md   — None binding; response-comment rule lives in structuredExchangeResponseRequiresComment
- memory/PLAN.md    — frontier: main-editor-chrome
- src/.pi/extensions/exchanges/shared/required-input.ts — StepResult vocabulary + collectCommentStep
- src/.pi/extensions/exchanges/ask.ts — the three duplicated blocks (≈279–300, 395–416, 662–681)
```

### Acceptance Criteria

```
✓ shrink — one helper (e.g. collectAskComment) computes the requirement from choiceKinds |
  reviewDecision internally; the three call sites are single calls; net line count drops
✓ npm test src/.pi/extensions/__tests__ src/agents/contexts/exchanges/__tests__ — ask suites
  (ask-response-export, ask-runtime-mount, exchanges-present-request, exchange-family-completeness,
  ask.test) stay green unchanged
```

### Completion Report

| Leaf | Outcome | Evidence |
| ---- | ------- | -------- |
| one helper computes comment requirement; three call sites single calls; line count drops | met | `src/.pi/extensions/exchanges/ask.ts`; helper `collectAskComment`; three collector call sites delegate |
| focused ask suites stay green unchanged | met | `npm test src/.pi/extensions/__tests__ src/agents/contexts/exchanges/__tests__` — 32 files / 294 tests passed |
| skipped-test-count delta vs parent | met | no skipped tests reported in focused run |

## Slice 2 (done) — flatten continuation projections, reuse the picker helper

### Objective

`continuationReviewDetails` becomes one `projectRequestReview` call with computed fields, and `collectContinuingCandidateChoice` reuses `presentSingleChoicePicker` instead of an inline duplicate.

### Light-card cold-start reads

```
- memory/PLAN.md    — frontier: main-editor-chrome
- src/.pi/extensions/exchanges/ask.ts — continuationReviewDetails (≈683–733),
  collectContinuingCandidateChoice (≈569–615), presentSingleChoicePicker (≈242–261)
```

### Acceptance Criteria

```
✓ shrink — continuationReviewDetails computes respondsToPresentTool / acceptedAbstract / comment
  defaulting once and makes a single projection call; the five branches are gone
✓ delete — the inline custom() picker in collectContinuingCandidateChoice is replaced by the shared
  presentSingleChoicePicker; whether the continuation path gains the standalone path's back-navigation
  loop is decided explicitly in the commit message (asymmetry is currently accidental)
✓ commands-runtime-switch.test.ts + exchanges-present-request.test.ts — continuation projections
  byte-identical for the covered cases (suites stay green)
```

### Completion Report

| Leaf | Outcome | Evidence |
| ---- | ------- | -------- |
| `continuationReviewDetails` computes fields once and calls one projection | met | `src/.pi/extensions/exchanges/ask.ts`; single `projectRequestReview` call in `continuationReviewDetails` |
| continuation candidate picker reuses `presentSingleChoicePicker`; loop decision explicit | met | `src/.pi/extensions/exchanges/ask.ts`; no new back-navigation loop because the candidate continuation has no nested collection step to return from |
| continuation projection suites stay green | met | `npm test src/.pi/extensions/__tests__/commands-runtime-switch.test.ts src/.pi/extensions/__tests__/exchanges-present-request.test.ts` — 2 files / 41 tests passed |
| skipped-test-count delta vs parent | met | no skipped tests reported in focused run |

## Slice 3 (light) — collectFreeText as a first-available-collector chain

### Objective

`collectFreeText` tries collectors in order (custom editor → plain editor → answer broker → unavailable) with one cancellation exit, deleting the pasted-twice editor fallback and the four repeated cancel-hint blocks.

### Light-card cold-start reads

```
- memory/PLAN.md    — frontier: main-editor-chrome
- src/.pi/extensions/exchanges/ask.ts — collectFreeText (≈131–200)
- src/.pi/extensions/commands/index.ts — the pi 0.80.x stub-custom note (headless custom resolves
  undefined), which is why the custom→editor fallthrough exists at all
```

### Acceptance Criteria

```
✓ spaghetti — the ctx.ui.editor path appears once; surfaceContinueHint + cancelled-terminal appears
  once; the stub-custom fallthrough is a named step in the chain, not a nested else-if
✓ ask-response-export.test.ts + ask-runtime-mount.test.ts — free-text answer, cancel, empty-answer,
  broker, and unavailable behaviors unchanged (suites stay green)
```

## Slice 4 (light) — fractal split: ask/continuation.ts

### Objective

The continuation machinery (continuation terminal, declared-continuation narrowing, both continuing collectors, review projection) moves to a private `ask/continuation.ts`; `ask.ts` stays the public root and sole importer, per AGENTS.md §code organization.

### Light-card cold-start reads

```
- memory/PLAN.md    — frontier: main-editor-chrome
- AGENTS.md         — §code organization (fractal sub-tree pattern: public root, private folder)
- src/.pi/extensions/exchanges/ask.ts — the continuation block (≈466–733 pre-slices-1–3)
```

### Acceptance Criteria

```
✓ file-size — ask.ts is well under the ~1k watch line (expected ≈450–550 after slices 1–3 + split);
  external importers (commands/index.ts, registry) still import only from ask.ts
✓ move-not-rewrite — the split commit is a mechanical move of the post-slice-1–3 code; no logic edits
✓ npm run verify — full gate green (lint/type-check catches any import-path misses)
```

## Invariants preserved (applies to all slices)

- Continuation recovery loop: `/brunch:continue` re-presents the newest incomplete declared ask continuation and records a synthetic pair — guarded by: `commands-runtime-switch.test.ts` (D3 coverage) + `exchange-family-completeness.test.ts`
- Hierarchical esc semantics (root cancel emits the `/brunch:continue` hint; nested input dismiss = back to picker) — guarded by: ask suites above + `STRUCTURED_EXCHANGE_ANSWERING_PATHS.md` as the named contract
- Required-comment rule: `other`/`none` selections and `request_changes` reviews never submit without a comment — guarded by: `structuredExchangeResponseRequiresComment` call sites surviving the dedupe (slice 1) + existing ask suites
- Degraded-context ladder (no-UI → broker → unavailable; stub custom falls through to editor) — guarded by: `ask-runtime-mount.test.ts`; if a case is uncovered, pin it in the slice-3 commit rather than relying on the old shape

## Verification Approach

```
- Inner: existing ask/commands vitest suites per slice (named above); npm run fix after each edit
- Gate: npm run verify per slice commit
- Outer: none new — the frontier's outer manual beat session (HANDOFF.md) already covers the ask
  surfaces and runs after this card
```

## Cross-cutting obligations

```
- B2 (review-set details renderer, HANDOFF.md §In-flight) does not touch ask.ts; this card must land
  before the next ask-surface slice so that slice starts from the split topology
- No rendering/UX changes ride along — projection output and component options stay byte-identical
```

## Expected touched paths (tentative)

```
src/.pi/extensions/exchanges/
├── ask.ts                                   ~
├── ask/
│   └── continuation.ts                      +
├── shared/required-input.ts                 ~
src/.pi/extensions/__tests__/
├── ask-response-export.test.ts              ?
├── ask-runtime-mount.test.ts                ?
└── commands-runtime-switch.test.ts          ?
```
