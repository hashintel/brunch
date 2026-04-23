<!-- CARDS.md — prepared scope-card queue for one live frontier item.
     Created by ln-scope · Consumed by ln-build · Delete or overwrite when exhausted or superseded. -->

# Cards

## Frontier

Track B / `workflow-ownership-extraction` from [memory/PLAN.md](/Users/lunelson/.conductor/workspaces/brunch/miami/memory/PLAN.md).

## Orientation

- The containing seam is workflow ownership cleanup across persistence-adjacent reads in `src/server/db.ts`, server state projection in `src/server/core.ts`, landing derivation in `src/shared/specification-state.ts`, and transition-heavy handlers in `src/server/app.ts`.
- The relevant frontier item is Track B item 1 in [memory/PLAN.md](/Users/lunelson/.conductor/workspaces/brunch/miami/memory/PLAN.md): extract explicit read-path and write-path workflow seams so continuous workspace can adopt one chat runtime cleanly.
- `HANDOFF.md` is stale volatile state from the completed Track A context-gathering thread and should not steer this queue; the live authority is [memory/SPEC.md](/Users/lunelson/.conductor/workspaces/brunch/miami/memory/SPEC.md) plus [memory/PLAN.md](/Users/lunelson/.conductor/workspaces/brunch/miami/memory/PLAN.md).
- The main open risk is over-queuing into the streaming chat route: `src/server/app.ts` still mixes transition decisions, lifecycle timing, and observer/runtime concerns, so the prepared queue stops before that seam needs to be recut.

## Queue Notes

- These cards stay inside one existing frontier item; they do not imply new tracker items or branches.
- The queue is ordered and safe to build serially because each card should remain valid even if we pause before the next one.
- Stop and rescope after Card 3 before attempting streaming chat-route transition extraction or broader lifecycle cleanup.

## Card 1 — Extract Workflow Projector From `db.ts`

Status: `done`
Weight: `full`

### Target Behavior

Server workflow-state derivation is implemented by a pure projector that consumes a durable workflow snapshot assembled near persistence, while externally visible `WorkflowState` behavior stays unchanged.

### Boundary Crossings

```text
→ persisted turns / phase outcomes / option-backed counts in src/server/db.ts
→ durable workflow snapshot assembly seam
→ pure workflow projector module
→ WorkflowState consumers in src/server/core.ts, src/server/interview.ts, src/server/phase-intent-runtime.ts, and src/server/app.ts
```

### Risks and Assumptions

- RISK: `getCurrentWorkflowState()` currently reaches back into persistence helpers while deriving readiness and closeability, so a shallow extraction could leave DB-owned logic hiding inside the new projector. → MITIGATION: move only pure derivation into the projector and make snapshot inputs explicit enough that the projector never calls DB helpers directly.
- ASSUMPTION: Decisions D110, D113, and D123 can be preserved without landing or runtime behavior changes if the projected `WorkflowState` shape stays byte-for-byte compatible. → VALIDATE: existing workflow/read-model tests remain green without snapshot consumers needing behavioral updates.

### Acceptance Criteria

✓ `src/server/db.ts` no longer owns the workflow interpretation algorithm directly; it delegates to a named pure projector.
✓ Existing workflow semantics for phase `status`, `closeability`, `readiness`, `proposalPending`, `closureBasis`, and `summary` remain unchanged for seeded and test-built states.
✓ `getCurrentPhase()` and any other direct workflow consumers still behave identically against the extracted projector.

### Verification Approach

- Inner: targeted `src/server/db.test.ts` coverage for phase-state derivation plus any new projector-focused tests.
- Middle: `src/server/core.test.ts` and `src/server/export.test.ts` prove state projection consumers still receive the same workflow truth.

## Card 2 — Route Server Read Consumers Through One Projection Helper

Status: `done`
Weight: `full`

### Target Behavior

Server read-model consumers obtain workflow, structural artifact ids, and landing from one shared specification-state projection helper instead of recomputing those pieces ad hoc.

### Boundary Crossings

```text
→ persistence-backed state loading in src/server/core.ts
→ shared specification-state projection helper
→ landing derivation in src/shared/specification-state.ts
→ read-model consumers in src/server/phase-intent-runtime.ts and src/server/app.ts
```

### Risks and Assumptions

- RISK: some consumers need only partial projection data, so a single helper could accidentally widen query/load work or hide ownership behind an over-fat abstraction. → MITIGATION: keep the helper explicit about full vs partial projection inputs and outputs instead of forcing every caller through one maximal shape.
- ASSUMPTION: the existing `deriveSpecificationLanding()` contract is already the right read-model seam for hydration and phase-intent gating, so consolidating callers should be mechanical rather than semantic. → VALIDATE: phase-intent availability and observer-capture eligibility remain unchanged under existing tests.

### Acceptance Criteria

✓ `src/server/phase-intent-runtime.ts` no longer assembles workflow, turns, structural ids, and landing independently when the shared projection helper already owns that combination.
✓ `src/server/app.ts` and `src/server/core.ts` stop duplicating read-model assembly patterns for structural-artifact or landing-aware logic where the shared helper applies.
✓ Export/readiness and landing-gated flows still consume one coherent projection contract with no behavioral drift.

### Verification Approach

- Inner: targeted `src/server/core.test.ts`, `src/server/app.test.ts`, and any added helper tests for projection assembly.
- Middle: `src/server/fixtures/walkthrough.test.ts` or equivalent seeded-state tests prove landing/readiness consumers agree on one truthful projection.

## Card 3 — Extract Turn-Response Review Advancement From `app.ts`

Status: `next`
Weight: `full`

### Target Behavior

Structured turn-response submission and accepted review-set advancement are handled by a dedicated workflow transition helper instead of inline mutation logic inside the `POST /turns/:turnId/response` route.

### Boundary Crossings

```text
→ POST /api/specifications/:id/turns/:turnId/response in src/server/app.ts
→ request validation and transport-only error mapping
→ dedicated turn-response transition helper
→ durable writes in src/server/db.ts for option selection, turn update, mode update, accepted review materialization, and phase outcome confirmation
→ SubmitTurnResponseResponse payload
```

### Risks and Assumptions

- RISK: the route currently mixes three semantics in one path — normal structured responses, grounding-strategy kickoff selection, and accepted review advancement — so extraction could either over-generalize or silently couple unrelated cases. → MITIGATION: extract a helper with typed outcomes that preserves the current endpoint contract while making each transition path explicit.
- ASSUMPTION: this endpoint can be cleaned up independently of the streaming chat route, even though broader write-path extraction is still pending. → VALIDATE: route-level tests for turn responses and accepted review advancement stay green with no changes to the streaming chat handler.

### Acceptance Criteria

✓ The turn-response route in `src/server/app.ts` delegates workflow mutation decisions to a named transition helper and retains only HTTP validation / response mapping.
✓ Requirements and criteria review acceptance still materialize accepted sets and return the same phase-advance response shape.
✓ Grounding-strategy kickoff selection still updates specification mode through the extracted transition seam without regressing existing structured-response behavior.

### Verification Approach

- Inner: targeted `src/server/app.test.ts` coverage for turn-response submission plus any dedicated transition-module tests.
- Middle: `src/client/routes/specification/$id/_view/__tests__/-interview-data.test.ts` or comparable mutation-driven integration tests prove client-visible advancement behavior is unchanged.
