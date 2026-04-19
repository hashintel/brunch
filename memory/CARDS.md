# CARDS — Active item 1 serial queue

## Orientation
- **Containing seam:** closed-phase projection and control-card rendering across `src/client/components/control-cards.tsx`, `src/client/routes/project/$id/_view/-interview-view.tsx`, and the workspace-stream projector/controller seams that surface `phase-handoff` / `workflow-complete` artifacts.
- **Frontier item:** `Phase transition and handoff stabilization on the cleaned model` in `memory/PLAN.md`.
- **Volatile state:** no `HANDOFF.md` is present; the previous cards for requirements/criteria acceptance and closure cleanup proved already satisfied on this branch, so the next honest slice is the remaining non-review handoff/completion artifact cleanup.
- **Main open risk:** the generic `workspace-state-card` shell still masks non-review closed-phase semantics, so grounding/design handoffs read as generic state rather than explicit next-action artifacts.

Prepared queue discipline: only one card is queued now. Additional follow-on cards would likely depend on how the non-review handoff artifact lands, so pre-queuing them would hide uncertainty rather than reduce churn.

---

## Card 1 — Non-review closed phases render explicit handoff cards
- **Status:** next
- **Weight:** full

### Target Behavior
Closed grounding and elicitation phases bottom out in a dedicated non-review handoff card with explicit next-phase language and CTA instead of the generic workspace-state shell.

### Boundary Crossings
```text
→ closed phase workflow state and bottom-artifact projection (`src/client/routes/project/$id/_view/-interview-controller-core.ts`, `-workspace-stream-projector.ts`)
→ non-review handoff/completion card rendering (`src/client/routes/project/$id/_view/-interview-view.tsx`, `src/client/components/control-cards.tsx`)
→ closed-phase stories and tests (`src/client/stories/blocks/ctrl-cards/phase-closure.story.tsx`, `src/client/routes/project/$id/_view/InterviewView.test.tsx`, `-workspace-stream-projector.test.ts`, and any targeted fixture assertions)
```

### Risks and Assumptions
- RISK: broadening the new card family too far could accidentally reshape kickoff/recovery or review-phase completion copy in the same component file → MITIGATION: keep this slice scoped to `phase-handoff` / non-review completion rendering only, and leave kickoff/recovery/proposal behavior untouched.
- RISK: replacing the generic shell could accidentally collapse the accepted-closure replay + handoff ordering into one artifact → MITIGATION: preserve existing projector ordering tests and assert that accepted closure stays above the explicit handoff card.
- ASSUMPTION: the current workflow semantics and bottom-artifact types are already correct; only the non-review closed-phase affordance copy/component shape is lagging behind → VALIDATE: change rendering/story/test seams without altering `landing`, workflow status, or closure confirmation behavior. → `memory/SPEC.md` Decisions D94, D95, D110.

### Acceptance Criteria
- ✓ **InterviewView handoff test** — a closed grounding or elicitation phase renders a dedicated non-review handoff card with explicit phase-complete copy and a next-phase CTA; the generic `workspace-state-card` is no longer the closed-phase handoff artifact for those states.
- ✓ **Projector ordering test** — accepted-closure replay still appears before the non-review handoff artifact in the ordered workspace stream.
- ✓ **Story / fixture coverage** — the phase-closure story (or equivalent targeted render coverage) includes the non-review handoff variant so the remaining generic-shell usage is visibly constrained to kickoff/recovery states.

### Verification Approach
- **Inner:** focused `InterviewView` and workspace-stream projector tests, plus any narrow control-card/story coverage needed for the new handoff variant.
- **Middle:** targeted seeded closed-phase reopen assertion if the implementation touches fixture/read-model projection beyond pure rendering.
- **Outer:** quick browser walkthrough of a closed grounding or design phase to confirm the bottom artifact reads as an explicit handoff, not a generic state block.

---

## Not queued yet
- **Non-review proposal-card / kickoff / recovery family cleanup** is not pre-scoped yet. Those slices likely depend on the component boundary and copy decisions that Card 1 establishes.
- **Router/query ownership refinement follow-ons** remain explicitly deferred to the later frontier item unless this card uncovers a minimal enabling ownership fix.
