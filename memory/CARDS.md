# Cards

## Orientation
- **Containing seam:** interaction-family canonicalization across the routed interview surface and workflow runtime (`src/client/routes/project/$id/_view/*`, `src/server/app.ts`, `src/server/phase-intent-runtime.ts`, `src/server/core.ts`, `src/shared/project-state-turn.ts`).
- **Containing frontier item:** `memory/PLAN.md` Active #1 — **Interaction-family canonicalization: durable turn cards plus projected control cards**.
- **Volatile follow-up:** the merged-stream cutover is done, but chat submit plumbing still fabricates transitional kickoff / recovery rows and the dead generic composer seam still lingers in the interview controller/view contract.
- **Main open risk:** if submit/runtime control flow keeps depending on persisted control rows or a dormant composer contract, the new stream model stays truthful only on read, not on mutation.

---

## Card 1 — Phase-intent chat submits without fabricating control rows

_Status: done 2026-04-19 · Verified: `npm run verify`_

### Target Behavior
Submitting a projected kickoff or recovery control through `/api/projects/:id/chat` starts or resumes interviewer generation from derived landing state without creating persisted kickoff or recovery turns.

### Boundary Crossings
→ projected kickoff / recovery control in `src/client/routes/project/$id/_view/-interview-controller.ts`
→ typed `data-phase-intent` message transport in `src/shared/chat.ts` / `src/shared/phase-intents.ts`
→ `/api/projects/:id/chat` runtime orchestration in `src/server/app.ts`
→ phase-intent runtime compatibility seam in `src/server/phase-intent-runtime.ts`
→ prepared interviewer turn / active-path persistence in `src/server/core.ts`

### Risks and Assumptions
- RISK: chat submit may still need a persisted answered control row to preserve interviewer context or replay ordering → MITIGATION: add regressions that assert interviewer streaming still happens and active-path turns stay substantive-only.
- RISK: grounding strategy kickoff selection may regress for legacy seeded kickoff rows → MITIGATION: keep `/api/projects/:id/phase-intent` compatibility tests intact while adding chat-path no-fabrication tests.
- ASSUMPTION: ephemeral phase-intent markers plus the successor substantive turn are sufficient transcript truth for control submissions → VALIDATE: prove no `turn_kind: 'kickoff' | 'recovery'` rows are created on the chat path while kickoff/recovery UX still advances correctly → `memory/SPEC.md` A53, A54; D95, D110.

### Acceptance Criteria
✓ `app.test.ts` — posting a kickoff `data-phase-intent` chat message from landing-only kickoff streams the interviewer and leaves the active path free of `kickoff` / `recovery` rows.
✓ `app.test.ts` — posting a recovery `data-phase-intent` chat message from derived recovery state streams the interviewer and leaves the active path free of fabricated control rows.
✓ `app.test.ts` — legacy seeded kickoff-row compatibility remains available through `/api/projects/:id/phase-intent` without reintroducing chat-path control-row fabrication.

### Verification Approach
- Inner: focused server tests around `/api/projects/:id/chat` and `/api/projects/:id/phase-intent` — prove mutation semantics and compatibility boundaries.
- Middle: `npm run verify` — proves no broader regression across workflow, projection, and interview UI seams.
- Outer: manual browser walkthrough on kickoff-ready and recovery-ready seeded states if time permits — proves the control cards still feel truthful after chat-path simplification.

---

## Card 2 — Remove the dormant generic bottom composer seam from the interview surface

_Status: done 2026-04-19 · Verified: `npm run verify`_

### Target Behavior
The routed interview surface no longer exposes a dormant generic prompt-input contract; card-owned controls remain the only user-input seam for active interview phases.

### Boundary Crossings
→ controller view-state contract in `src/client/routes/project/$id/_view/-interview-controller-core.ts`
→ controller adapter in `src/client/routes/project/$id/_view/-interview-controller.ts`
→ routed interview rendering in `src/client/routes/project/$id/_view/-interview-view.tsx`
→ focused controller/view/transcript tests

### Risks and Assumptions
- RISK: removing the composer contract could accidentally delete a useful debug path or break tests that still assert on hidden visibility flags → MITIGATION: update tests to assert bottom-artifact/card behavior directly instead of hidden prompt state.
- ASSUMPTION: no live product path depends on `promptInput.visible`; it is legacy dead weight after card-owned input canonicalization → VALIDATE: delete the contract and keep interview/controller tests green.

### Acceptance Criteria
✓ `-interview-controller*` tests no longer depend on `promptInput.visible` and still prove kickoff, recovery, submitted-turn, and closed-phase states.
✓ `-interview-view.tsx` no longer imports or conditionally renders the generic prompt input components.
✓ `npm run verify` passes with card-owned question/review/control affordances as the only active input seam.

### Verification Approach
- Inner: focused controller/view tests.
- Middle: `npm run verify`.

---

## Card 3 — Quarantine legacy control-row support to explicit compatibility helpers

_Status: scoped_

### Target Behavior
Legacy kickoff/recovery turn rows are no longer created by general runtime helpers; any remaining support for seeded legacy control rows lives behind explicit compatibility-only helpers and tests.

### Boundary Crossings
→ runtime helper ownership in `src/server/core.ts`
→ compatibility seam in `src/server/phase-intent-runtime.ts`
→ shared landing/control-row classification in `src/shared/project-state-turn.ts`
→ app/core compatibility tests that seed legacy kickoff rows intentionally

### Risks and Assumptions
- RISK: removing general-purpose helpers too early could strand the few remaining compatibility tests or migration-light fixtures that still need seeded legacy rows → MITIGATION: replace them with narrowly named compatibility/test helpers before deleting the broad runtime helper.
- ASSUMPTION: after Card 1, production code no longer needs `ensureProjectFrontier()` to create kickoff/recovery rows → VALIDATE: production search should show legacy control-row creation only in explicit compatibility/test seams.

### Acceptance Criteria
✓ production runtime code no longer calls a general helper that fabricates kickoff/recovery rows as normal frontier behavior.
✓ compatibility tests seed legacy kickoff rows through an explicitly named helper that communicates transitional intent.
✓ search- and test-backed verification shows legacy control rows are compatibility-only, not part of the normal submit/read contract.

### Verification Approach
- Inner: targeted search + focused core/app tests.
- Middle: `npm run verify`.
