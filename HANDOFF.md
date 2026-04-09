# Handoff

> Updated 2026-04-09T20:05Z after completing slice 9.2 work. Read this file to resume quickly.

## Goal

Continue Phase 5 requirements-review work from the newly landed 9.2 tracer bullet without re-deriving the explicit review-state seam.

## Session State

- **Last completed skill**: `ln-build`
- **Completed slice**: `memory/PLAN.md` slice `9.2` — targeted requirement approval + explicit pending/approved review projection
- **Current branch**: `ln/fe-568-requirements-review`
- **Immediate pending action**: commit the completed 9.2 work (all verification already passed)

## What 9.2 established

This session implemented the first explicit requirement-level review action.

### Target behavior now true
- a requirements-review question can carry explicit review metadata naming one requirement and its approval option
- choosing that approval option persists a durable active-path `turn_knowledge_item(relation='reviewed')` link for that requirement
- the entities read model projects requirement review state as:
  - `approved` for explicitly reviewed requirements
  - `pending` for untouched requirements
- the requirements sidebar renders visible `Approved` / `Pending` badges
- requirements still remains `in_progress` and not yet closeable

### Deliberately not done yet
- no edit / reject / merge / stale lifecycle
- no requirements closeability / closure proposal changes
- no full `knowledge_review` table yet

## Files changed

### Product code
- `src/shared/chat.ts`
  - widened `structuredQuestionSchema` with optional targeted requirement-approval review metadata
- `src/server/interview.ts`
  - requirements prompt now instructs the interviewer to include explicit review metadata for one-at-a-time requirement approval turns
- `src/server/db.ts`
  - added explicit requirement-approval extraction from assistant parts
  - recorded approval via active-path `turn_knowledge_item(relation='reviewed')`
  - projected `requirements[].reviewStatus` as `approved | pending`
  - made repeated turn/item link insertion idempotent with `onConflictDoNothing()`
- `src/server/app.ts`
  - response handler now records targeted requirement approval state after applying turn-response selections
- `src/client/components/EntitySidebar.tsx`
  - requirement cards render `Approved` / `Pending` badges

### Tests
- `src/server/db.test.ts`
  - added read-model test for approved vs pending requirement projection
- `src/server/app.test.ts`
  - added round-trip test for targeted requirement approval through the response seam
  - adjusted requirements entity expectations to include `reviewStatus: 'pending'`
- `src/server/interview.test.ts`
  - tightened requirements prompt expectation to mention `requirement-approval`
- `src/client/components/EntitySidebar.test.tsx`
  - new UI test covering visible approved / pending requirement badges

### Memory / traceability
- `memory/SPEC.md`
  - validated `A45`
  - added `D77`
  - added `I89`, `I90`
  - updated requirements-review oracle notes and current coverage
- `memory/PLAN.md`
  - recorded `9.2` as done
  - updated slice 9 observed state / verification notes

## Verification status

All verification is green for the current worktree.

- `npm run fix` ✅
- `npm run verify` ✅
  - check ✅
  - test ✅ (191 passed)
  - build ✅

## Key design seam to preserve

9.2 intentionally chose the thinner path:

- **write seam**: targeted approval metadata rides on the existing structured ask-question payload
- **durable record**: approval is stored as an active-path `turn_knowledge_item(relation='reviewed')` link
- **read seam**: requirements project as `approved | pending`

This is intentionally a bridge toward the fuller `knowledge_review` lifecycle, not the final model.

## Repo state

### Recent commits
- `3d3c834 feat: ground the first requirements-review loop`
- `1e022da cleanup and sync`
- `d2189fd feat: deepen the shared phase-close module`

### Dirty files expected before commit
- `HANDOFF.md`
- `memory/PLAN.md`
- `memory/SPEC.md`
- `src/shared/chat.ts`
- `src/server/interview.ts`
- `src/server/interview.test.ts`
- `src/server/app.ts`
- `src/server/app.test.ts`
- `src/server/db.ts`
- `src/server/db.test.ts`
- `src/client/components/EntitySidebar.tsx`
- `src/client/components/EntitySidebar.test.tsx`

## Recommended next steps

1. Commit this slice as its own checkpoint.
   - Suggested message: `feat: persist explicit requirement approval state`
2. Scope the next tracer bullet in slice 9.
   - strongest candidates:
     - **9.3** first-class `add missing requirement` review action
     - **9.4** requirements closeability / closure proposal
3. Optionally run `ln-review` before widening the review model further if the team wants an architectural audit on the interim `reviewed` link seam.

## Open questions

- Should the next slice add **add-missing** as an explicit structured action before edit/reject?
- When should the project promote from the current `reviewed` link seam to the fuller `knowledge_review` lifecycle?
- Should requirements closeability remain fully deferred until after at least one more explicit review action lands?

## Resume prompt

Paste this into a new session:

> Read `HANDOFF.md` in the repo root.
> Slice 9.2 is implemented and verified but may not be committed yet.
> Start by checking `git status`, then either commit with `feat: persist explicit requirement approval state` or scope slice 9.3 on top of this state.
