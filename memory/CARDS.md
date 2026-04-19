# Cards

## Orientation
- **Containing seam:** interaction-family canonicalization across the routed interview surface and workflow runtime (`src/client/routes/project/$id/_view/*`, `src/client/components/*`, `src/server/app.ts`, `src/server/interview.ts`, `src/server/observer.ts`, `src/shared/chat.ts`, `src/shared/project-state-turn.ts`).
- **Containing frontier item:** `memory/PLAN.md` Active #1 — **Interaction-family canonicalization: durable turn cards plus projected control cards**.
- **Volatile follow-up:** the six scoped interaction-family cleanup slices in this session are complete; the next frontier now shifts to phase transition and handoff stabilization on the cleaned interaction model.
- **Main open risk:** grounding/context-gathering work could either reintroduce turn-shaped control exceptions or let provisional repo-analysis content leak into durable observer capture.

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

_Status: done 2026-04-19 · Verified: `npm run verify`_

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

---

## Card 4 — Grounding cards become a first-class turn contract in the workspace stream

_Status: done 2026-04-19 · Verified: `npm run verify`_

### Target Behavior
A scope-phase turn can persist and replay a provisional grounding card with optional user note plus explicit continue, and that card is rendered distinctly from substantive question/review turns while remaining outside observer durability.

### Boundary Crossings
→ interviewer/tool payload contract in `src/shared/chat.ts`
→ turn persistence + response reuse in `src/server/interview.ts`, `src/server/app.ts`, `src/server/db.ts`
→ turn classification / replay helpers in `src/shared/project-state-turn.ts`
→ routed interview projection + rendering in `src/client/routes/project/$id/_view/*` and `src/client/components/*`
→ observer gating in `src/server/app.ts` / `src/server/observer.ts`

### Risks and Assumptions
- RISK: a grounding card could get mistaken for a normal question turn and show the wrong affordances or feed the observer → MITIGATION: add explicit persisted grounding-card metadata plus projector/render regressions and skip observer capture for grounded provisional turns.
- RISK: optional comment + continue could fight the existing structured-response seam → MITIGATION: reuse the turn-response transport with an explicit continue action carried by the card contract rather than inventing a second submit path.
- ASSUMPTION: a distinct persisted assistant-part contract is enough to classify grounding cards without adding a new DB table or reopening control-row persistence → VALIDATE: prove seeded/persisted grounding-card turns replay correctly and do not project as generic question cards → `memory/SPEC.md` D83, D89, D91, D99, I24, I101.

### Acceptance Criteria
✓ `parts.test.ts` / `project-state-turn.test.ts` — persisted assistant parts can round-trip grounding-card metadata and classify those turns distinctly from generic questions and control artifacts.
✓ `InterviewView.test.tsx` / `-workspace-stream-projector.test.ts` — active and answered grounding cards render a summary/detail + note + continue affordance instead of option checkboxes.
✓ `app.test.ts` — answering a grounding card does not run observer capture for that turn and still advances the stream to the successor interviewer turn.

### Verification Approach
- Inner: focused shared/client/server tests for parts, classification, view projection, and observer gating.
- Middle: `npm run verify`.
- Outer: manual seeded browser check once the primitive lands — prove the card reads as provisional context rather than a disguised question.

---

## Card 5 — Brownfield kickoff opens with a workspace-analysis grounding card

_Status: done 2026-04-19 · Verified: `npm run verify`_

### Target Behavior
Selecting brownfield grounding causes the first scope-phase interviewer turn to use read-only workspace analysis to produce a visible grounding card instead of embedding repo facts inside the first substantive question’s `why` text.

### Boundary Crossings
→ grounding-strategy kickoff selection in `src/server/phase-intent-runtime.ts` / `src/server/app.ts`
→ brownfield interviewer instructions + tool availability in `src/server/interview.ts`
→ persisted first-turn assistant parts in `src/server/app.ts`
→ workspace stream rendering in `src/client/routes/project/$id/_view/*`
→ seeded kickoff / app / interview tests

### Risks and Assumptions
- RISK: the model may skip the grounding-card tool and jump straight to `ask_question` because the prompt still frames the first turn as a question → MITIGATION: tighten the brownfield scope prompt and add server tests that lock the expected first-turn contract.
- RISK: workspace analysis summaries could become too verbose or file-list-like to feel like user-facing grounding → MITIGATION: constrain the grounding-card schema to concise summary/detail fields and assert on brief-oriented copy in tests.
- ASSUMPTION: the current read-only exploration tools (`read_file`, `grep`, `find_files`, `list_directory`) are sufficient to synthesize the first grounding brief without a separate analysis pipeline → VALIDATE: prove the first persisted turn is a grounding card after brownfield kickoff and that the follow-up substantive question happens only after continue → `memory/SPEC.md` A47, A56, D32, D83, D91, D99.

### Acceptance Criteria
✓ `interview.test.ts` — the brownfield scope prompt/tool contract explicitly directs the first scope turn to emit a grounding card after read-only exploration.
✓ `app.test.ts` — a brownfield kickoff from landing-only state streams and persists a grounding-card first turn rather than a normal `ask_question` turn with repo-summary `why` text.
✓ `InterviewView.test.tsx` — the projected brownfield opening state shows a grounding card after kickoff selection and not an ordinary question card.

### Verification Approach
- Inner: focused interview/app/view tests.
- Middle: `npm run verify`.
- Outer: manual browser walkthrough on a seeded brownfield start if time permits.

---

## Card 6 — Brownfield scope context gathering becomes reusable after kickoff

_Status: done 2026-04-19 · Verified: `npm run verify`_

### Target Behavior
Brownfield scope turns use exploration-first instructions only for the opening grounding brief, while later scope turns retain reusable read-only context-gathering plus grounding-card emission when the interviewer still lacks enough orientation.

### Boundary Crossings
→ brownfield scope-state detection in `src/server/interview.ts`
→ interviewer context/history shaping in `src/server/context.ts`
→ app stream orchestration in `src/server/app.ts`
→ scope-phase transcript projection tests and any observer prompt assumptions about “brownfield kickoff”

### Risks and Assumptions
- RISK: keeping the current brownfield prompt on every scope turn will repeatedly force repo exploration and prevent the model from moving into normal grounding dialogue → MITIGATION: make brownfield instructions state-aware based on whether a grounding brief or substantive scope history already exists.
- RISK: enabling later context gathering could blur the boundary between provisional grounding cards and substantive questions → MITIGATION: preserve the same grounding-card contract for later gathers and keep observer capture gated to substantive turns only.
- ASSUMPTION: active-path turn history is sufficient to tell whether brownfield scope is still in opening analysis or already inside ongoing grounding → VALIDATE: unit-test instruction/tool selection for opening vs post-kickoff brownfield scope and replay a later grounding-card case through the workspace stream → `memory/SPEC.md` D99, A47, A56, I101.

### Acceptance Criteria
✓ `interview.test.ts` — brownfield scope uses exploration-first instructions for opening analysis but falls back to ordinary scope questioning after the initial grounding-card handoff while still exposing reusable read-only tools.
✓ `context.test.ts` / `InterviewView.test.tsx` — later grounding cards replay as provisional context in the same stream without being confused with the initial kickoff or ordinary question turns.
✓ `observer.test.ts` / `app.test.ts` — brownfield observer/prompt behavior no longer treats every scope turn as a special kickoff case once substantive grounding is underway.

### Verification Approach
- Inner: focused interview/context/observer/app tests.
- Middle: `npm run verify`.
- Outer: manual resumed brownfield walkthrough if time permits — prove later context gathering feels like a reusable move instead of a one-shot ritual.
