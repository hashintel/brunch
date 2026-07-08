# B2 — details-backed rendering for present_review_set (and assess present_digest)

Frontier: main-editor-chrome
Status:   active
Mode:     slices
Created:  2026-07-08

Orientation:

- Containing seam: the details-backed transcript render path established by D104-L's 2026-07-08 revision — `renderDetailsOrMarkdownResult` (`src/.pi/extensions/exchanges/shared/details-rendering.ts`) + a per-family presentation component, first adopted by `present-candidates.ts` / `ExchangeCandidatesResultComponent`.
- Frontier: `main-editor-chrome` (FE-1169), thread 3's remaining half — the executed `--details-driven-rendering.md` card adopted `present_candidates` only. This card is the named B2 fast-follow from the retired 2026-07-08 handoff, folded into #305 before tie-off (user decision 2026-07-08).
- The D104-L SPEC row currently fences `present_digest` / `present_review_set` / `ask` as "content pass-through until separately scoped" — this card is that separate scoping; the row needs an `ln-sync` touch at landing.
- Main open risk: rendering a review-set proposal in a way that visually implies graph commitment (see obligations — this is the stop-the-line concern, not a style nit).

Posture: earned (downgraded from the frontier's proving — the render path, fallback rule, schemas, and golden-family pattern are all landed and witnessed by the candidates adopter; this is pattern replication plus one assess decision).

## Slice 1 (light) — present_review_set renders from validated details

### Objective

`present_review_set` toolResults render richly from `PresentReviewSetDetails` (proposed node/edge drafts with their persisted proposed codes) with Markdown pass-through fallback, following the candidates pattern exactly.

### Light-card cold-start reads

```
- memory/SPEC.md   — D104-L (two render sources, render-honesty, fallback rule), D27-L (review-set
  proposal carriage), D107-L (proposed codes persisted in details), §Verification Design
  (exchange-presentation oracle compound, item 1: per-adopter renderResult golden family)
- memory/PLAN.md    — frontier: main-editor-chrome, thread 3
- src/.pi/extensions/exchanges/present-candidates.ts + src/.pi/components/exchange-candidates-result.ts
  — the adopter pattern to replicate (incl. the shared-schema import and fallback wiring)
- src/exchanges/schemas/present.ts — zPresentReviewSetDetails (review_set payload shape)
```

### Acceptance Criteria

```
✓ present-review-set renderResult — renders via renderDetailsOrMarkdownResult with
  zPresentReviewSetDetails; malformed/absent details fall back to renderMarkdownResult
  (unit test alongside the existing exchanges suites)
✓ exchange-review-set-result golden family — new component renders node/edge drafts with proposed
  codes across the width/theme matrix, per SPEC §Verification Design item 1 (mirror
  exchange-candidates-result.test.ts)
✓ dev:components registry — a present_review_set transcript-render entry from the existing
  exchange fixtures (mirror the present-candidates entry; presentedLike updated from pass-through)
✓ npm run verify — gate green; exchange-family-completeness and content goldens unchanged
  (content formatters are untouched — details is the only new render source)
```

## Slice 2 (light) — assess present_digest; adopt or decline explicitly

### Objective

`present_digest` either adopts the same details-backed pattern (component + golden family + registry entry) or is explicitly declined with the rationale recorded, so the D104-L fence can name its final state instead of "until separately scoped".

### Light-card cold-start reads

```
- memory/SPEC.md   — D104-L; D110-L (digest capture semantics — unchanged either way)
- src/.pi/extensions/exchanges/present-digest.ts — current pass-through renderer
- src/exchanges/schemas/present.ts — zPresentDigestDetails (digest material shape)
```

### Acceptance Criteria

```
✓ decision recorded — adopt (same three artifacts as slice 1) or decline (one-line rationale in the
  commit + this card's completion report; e.g. digest abstract is already prose — markdown
  pass-through may simply be the right renderer)
✓ if adopted: same oracle set as slice 1 (renderResult unit test, golden family, registry entry)
✓ D104-L row updated via ln-sync at landing — the "until separately scoped" fence rewritten to name
  the actual adopter set and ask's continued pass-through status
```

## Invariants preserved (both slices)

- **Proposal vocabulary (stop-the-line):** review-set rendering must not visually imply graph
  commitment — no accepted/committed/applied register; acceptance language stays on the terminal
  ask path (D27-L: commitment happens only through review-set approval) — guarded by: golden-family
  review + the wording check in the component tests (pin the card-status string as the candidates
  renderer pins "Recognition proposal")
- **Render honesty (D104-L):** populated detail leaves appear in formatted content, named display
  text, or an elision list — guarded by: existing render-honesty suites over the content formatters
  (untouched by this card)
- **Model-facing content unchanged:** `formatPresentReviewSet` / digest formatter output is
  byte-identical — guarded by: existing content goldens staying green unchanged
- **Structural-illegal path:** `present_review_set`'s `StructuralIllegal` details must keep falling
  back to markdown (they don't parse as zPresentReviewSetDetails — the fallback rule covers this by
  construction) — guarded by: a unit case asserting illegal-details results render via fallback

## Verification Approach

```
- Inner: renderResult unit tests + golden families (vitest); npm run fix per edit
- Gate: npm run verify per slice commit
- Outer: the frontier's manual beat session adds a review-set render check to the gallery walk
  (both themes) — extend the beat checklist, don't run a separate session
```

## Cross-cutting obligations

```
- Per-adopter golden family is a SPEC obligation (§Verification Design, exchange-presentation
  compound item 1), not optional polish
- Canonical theme contract: the new component takes LabTheme (per the review-contract-followups
  fix) — no local ThemeLike re-declarations
- D104-L reconciliation at landing (ln-sync touch), since this card closes the row's fence
```

## Assumption dependency

None — schemas, render seam, and fallback rule are landed; D107-L guarantees proposed codes are
present in the details this card renders.

## Expected touched paths (tentative)

```
src/.pi/extensions/exchanges/
├── present-review-set.ts                     ~
├── present-digest.ts                         ?
└── TOPOLOGY.md                               ~
src/.pi/components/
├── exchange-review-set-result.ts             +
├── exchange-digest-result.ts                 ?
└── __tests__/exchange-review-set-result.test.ts +
src/dev/component-preview/
├── registry.ts                               ~
└── exchange-fixtures.ts                      ?
memory/SPEC.md                                ~   (D104-L row, at landing)
```
