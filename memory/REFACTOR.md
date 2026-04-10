<!-- REFACTOR.md — temporary refactor plan. Delete when all commits are complete. -->

# Refactor: Unify review seam duplication

## Problem Statement

The requirement-review and criterion-review implementations in `db.ts` and `chat.ts` are near-identical copies that differ only by knowledge kind (`requirement` vs `criterion`) and schema field name (`review` vs `criterionReview`). This duplication makes the review seam shallow — every future review-kind addition (13a) would require copying ~120 lines. The `review` field name on `structuredQuestionSchema` is also unqualified, creating an asymmetry with `criterionReview`.

## Solution

1. Unify the duplicated review-status projection, review-extraction, and review-recording functions in `db.ts` into single parameterized versions.
2. Rename the `review` field on `structuredQuestionSchema` to `requirementReview` for naming symmetry.
3. Unify the superRefine validation for both review fields into a single helper.
4. Collapse `RequirementReviewStatus` / `CriterionReviewStatus` into a single `ReviewStatus` type.

## Commits

1. **Rename `review` → `requirementReview` on `structuredQuestionSchema`** — rename the field, update the superRefine, update the type export, update all consumers in `db.ts` and test fixtures. This is a rename-only commit — no logic changes.

2. **Extract shared `getReviewStatusesOnActivePath(db, projectId, kind)` from the two projection functions** — parameterize by `kind`, delete both originals, update callers. Collapse `RequirementReviewStatus` / `CriterionReviewStatus` into `ReviewStatus`.

3. **Extract shared `getReviewFromTurn(turn, field)` from the two extraction functions** — parameterize by field name, delete both originals, update callers.

4. **Extract shared `recordReviewFromTurnResponse(db, turn, positions, field, kind)` from the two recording functions** — parameterize by extraction function and expected kind, delete both originals, update `app.ts` to call the unified version. Collapse the two `app.ts` import/call sites into one.

5. **Extract shared `validateReviewOptionPosition` helper in `structuredQuestionSchema` superRefine** — deduplicate the two parallel validation blocks.

## Decisions

- The `review` → `requirementReview` rename is a breaking change for any `assistant_parts` JSON persisted before this commit. Acceptable because: (a) the app is pre-distribution, (b) review linkage is already durably persisted in `turn_knowledge_item` so projections survive, and (c) only `recordRequirementReviewFromTurnResponse` replay on old turns would silently no-op, which has no user-visible effect.
- The unified `ReviewStatus` type replaces both `RequirementReviewStatus` and `CriterionReviewStatus`. The semantic space is identical.
- The unified `recordReviewFromTurnResponse` remains two call sites in `app.ts` (one per kind) rather than a single call with a loop, to keep the call site explicit about which kinds are handled.

## Testing Decisions

- No new tests needed. Existing tests for both requirement and criterion review seams (db.test.ts: 6 tests, app.test.ts: 4 tests) serve as characterization tests. All must pass after each commit.
- Test fixtures in `app.test.ts` must be updated in commit 1 to use `requirementReview` field name.

## Out of Scope

- Unifying the `requirementReview` / `criterionReview` fields into a single discriminated `review` union on `structuredQuestionSchema` — this is a deeper schema design question better deferred to 13a when review lifecycle refinement may change the shape anyway.
- Making `reviewStatus` non-optional on entity types (finding 9 from the review) — trivial but separate from this duplication refactor.
- Any 13a review lifecycle changes (edit/merge/split/stale semantics).
