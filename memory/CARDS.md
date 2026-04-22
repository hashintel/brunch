# Cards — Review revision card contract consistency

Containing frontier item: `memory/PLAN.md` → `Active` → `Track A — Interaction model` → `Review revision card contract consistency`

Queue discipline:
- All cards stay inside the same settled frontier item.
- These are ordered for serial execution, but each card is scoped so it should remain valid even if we pause after the previous one.
- Stop the queue if prompt-side/source-side findings suggest the client-side normalization fallback can be removed or if durable review semantics widen beyond this frontier.

---

## Card 1 — done

### Title
Accepted revised reviews keep predecessor metadata when the successor review set is sparse

### Objective
Accepting a regenerated requirements or criteria review materializes the same rationale-bearing durable entities the user saw on the review card, even when the latest persisted review set omits unchanged metadata that existed on the predecessor revision.

### Acceptance Criteria
- ✓ Accepting a regenerated **requirements** review with a sparse successor review set preserves predecessor-carried rationale on unchanged surviving items.
- ✓ Accepting a regenerated **criteria** review with a sparse successor review set preserves predecessor-carried rationale on unchanged surviving items.
- ✓ The acceptance path still consumes the persisted successor review set rather than falling back to the broad project inventory.

### Verification Approach
- Inner: targeted server tests around review acceptance/materialization (`src/server/app.test.ts`, `src/server/db.test.ts` as needed)
- Middle: targeted vitest run for touched server files
- Outer: none

### Promotion Check
- [ ] requirement change
- [ ] assumption change
- [ ] non-trivial design decision reversal
- [ ] new seam-level invariant
- [ ] crosses more than two major seams
- [ ] first touch in unfamiliar seam
- [ ] containing seam unclear

Current judgment: all no; keep light.

---

## Card 2 — next

### Title
Review-regeneration context and prompt carry explicit metadata and badge semantics at the source

### Objective
Requirements/criteria regeneration asks the interviewer for the same review-item metadata the UI contract expects, including reference codes, rationale, grounding refs, and explicit new/revised badge semantics.

### Acceptance Criteria
- ✓ Review-regeneration context exposes enough predecessor detail for the model to preserve item identity plus reference code, rationale, and grounding refs while revising the set.
- ✓ Requirements and criteria review prompts explicitly instruct regenerated `reviewSet` output to preserve carried metadata and set `isUserCreated` / `isRevised` when appropriate.
- ✓ Unit tests pin the prompt/context contract so later prompt edits cannot silently drop those fields.

### Verification Approach
- Inner: targeted unit tests for `src/server/context.ts` / `src/server/interview.ts`
- Middle: targeted vitest run for touched prompt/context files
- Outer: none

### Promotion Check
- [ ] requirement change
- [ ] assumption change
- [ ] non-trivial design decision reversal
- [ ] new seam-level invariant
- [ ] crosses more than two major seams
- [ ] first touch in unfamiliar seam
- [ ] containing seam unclear

Current judgment: all no; keep light.

---

## Card 3 — queued

### Title
Regenerated review-card contract is proved across criteria and source-owned examples

### Objective
Criteria-phase regenerated review turns and supporting seeded/examples surfaces prove the same explicit review-revision contract as requirements, including carried metadata plus `Added in revision` / `Revised` badge semantics.

### Acceptance Criteria
- ✓ Routed criteria-phase review tests cover regenerated review turns in active and replayed states with explicit revision metadata.
- ✓ If a pending/streamed regenerated review turn is represented in fixtures or UI tests, it proves the same badge and metadata contract before route invalidation.
- ✓ Seed/story/example surfaces used to reason about review revisions show canonical badge copy (`Added in revision`, `Revised`) and representative revision metadata.

### Verification Approach
- Inner: targeted client/fixture/story tests for touched files
- Middle: targeted vitest run for routed review tests plus any fixture/helper coverage
- Outer: none

### Promotion Check
- [ ] requirement change
- [ ] assumption change
- [ ] non-trivial design decision reversal
- [ ] new seam-level invariant
- [ ] crosses more than two major seams
- [ ] first touch in unfamiliar seam
- [ ] containing seam unclear

Current judgment: all no; keep light.

---

## Queue boundary

Not pre-scoping beyond Card 3 yet. After these land, the next honest question is whether the source-owned regenerated review contract is strong enough to retire some projector-side normalization/fallback logic; that depends on implementation evidence from Cards 1–3.
