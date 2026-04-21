<!-- PLAN.md — single source of truth for the live frontier.
     Created by ln-plan · Read by all skills · Updated by ln-build and ln-sync.
     Older completed work lives in docs/archive/PLAN_HISTORY.md. -->

# Plan

The naming/ownership cleanup is now retired. The break-and-fix cutover is complete: canonical browser and HTTP entry seams use `/specification/...` and `/api/specifications/...`, durable/shared/server identity uses `specification` / `specification_id`, the first workflow key is physically `grounding`, and `src/` no longer carries `project` alias/adaptation seams on the happy path. Because local data is unstable and fixtures are cheap to regenerate, destructive reseed remains the intended recovery path; a freshly reseeded manual resume/export walkthrough is still the outer-loop watch after the destructive cut.

Active work now turns to user-visible completion and cumulative-workspace ownership. Start by making output/export and close-phase semantics truthful, then extract workflow ownership before the continuous workspace pass. The grounding interaction-model slices (grounding free-text questions, phase section headers, and later context-gathering capability) remain near horizon, but now follow the continuity pass so they target the stabilized center-pane shape rather than the current routed split. Most of the dramaturgical audit hardening landed during the just-closed slices, so any remaining proof or polish stays incidental rather than owning the frontier. Revisit/cascade and infrastructure/tooling remain on the true horizon.

## Active

1. **Output route and markdown export refinement** — bounded feature `[status: not-started]`
   - Objective: make the output route, preview, and markdown export truthful and legible under the canonical specification terminology without reopening workflow-complete semantics.
   - Why now / unlocks: export is the clearest user-visible completion seam after the naming cutover. Landing it first gives the following close-phase and workspace-continuity work a truthful completion target.
   - Acceptance: the output route, preview, and markdown export present accepted review outputs cleanly under the renamed terminology and remain available only when all interview phases are closed.
   - Verification: `npm run verify` plus a manual export walkthrough on a completed seeded specification.
   - Traceability: D101; I24, I87, I104.

2. **Close Phase confirmation modal** — bounded feature `[status: not-started]`
   - Objective: complete the remaining phase-exit UX by showing a confirmation modal with readiness/turn-count context before closing in-progress non-review phases.
   - Why now / unlocks: makes closure intent explicit before workflow extraction and cumulative workspace rendering start depending on closeability semantics.
   - Acceptance: in-progress non-review phases show a confirmation modal with readiness/turn-count context and gating that matches closeability rules.
   - Verification: `npm run verify` plus manual close/reject/confirm walkthroughs on grounding and elicitation phases.
   - Traceability: D104, D65, D66; I72.

3. **Workflow ownership extraction** — structural `[status: not-started]`
   - Objective: extract projector and `app.ts` workflow ownership so lifecycle orchestration and stream projection are easier to reason about without introducing a second durable workflow model.
   - Why now / unlocks: once export and close-phase semantics are truthful, this is the right architectural cleanup before the continuous workspace pass.
   - Acceptance: workflow projection and transition orchestration become easier to reason about without changing phase semantics or adding a second durable workflow model.
   - Verification: `npm run verify` plus focused regression reads on seeded landing/recovery/progression flows.
   - Traceability: D110, D112, D113; I24, I72, I104.

## Next

Near-horizon work is now ordered around cumulative workspace ownership first, then grounding interaction-model follow-ons, then deeper grounding/context-gathering capability.

### Ownership refinement

1. **Continuous workspace / phase-addressable interview surface** — user-facing continuity pass after workflow ownership is clearer.
   - Why now / unlocks: once workflow projection and lifecycle ownership are clearer, separate cumulative rendering from routed phase addressability so later grounding and router/query work target the right center-pane seam.
   - Acceptance: the center pane renders one cumulative workspace stream where realized grounding / design / requirements / criteria sections remain visible as record, the current reachable section owns the only actionable frontier, future sections do not render until reachable, the left sidebar acts as truthful section-jump navigation for realized sections, and direct future-phase deep links redirect to the current reachable phase without introducing a second durable workflow model.
   - Verification: `npm run verify` plus manual walkthroughs for deep-link redirects, scroll/focus transitions, close-to-next-phase motion, and reload/resume on a partially completed specification.
   - Traceability: A58; D86, D87, D103, D107, D110, D113, D114; I24, I102.

2. **Router / query ownership refinement for interview surfaces** — final near-horizon cleanup after workflow ownership and workspace continuity are clearer.
   - Why now / unlocks: should harvest the real invalidation/loader boundaries exposed by the preceding completion and workspace-ownership passes instead of guessing early.
   - Acceptance: coarse route-wide invalidation is replaced by clearer loader/query ownership without stale transcript or handoff regressions.
   - Verification: `npm run verify` plus manual mutation/observer refresh walkthroughs.
   - Traceability: D87, D113; A20, A50; I24, I54, I102.

### Grounding interaction-model follow-ons

3. **Grounding free-text question format** — switch grounding from option selection to open response.
   - Why now / unlocks: once the cumulative workspace shape is settled, this can safely reshape grounding's schema, prompt, and response seams without targeting the wrong center-pane contract.
   - Acceptance: `structuredQuestionSchema` accepts grounding questions without required options; the grounding system prompt produces open exploratory questions; the response schema and UI accept `freeText`-only submissions; elicitation and later phases still require options.
   - Verification: `npm run verify` plus manual greenfield grounding walkthrough confirming open questions, free-text response, and correct observer capture.
   - Traceability: D115; A59; Requirement 4.

4. **Phase section headers** — orient each realized phase section without persisting extra turns.
   - Why now / unlocks: fits more naturally once the center pane is cumulative and phase sections are explicit rendered regions rather than per-route remounts.
   - Acceptance: each realized phase section in the workspace stream opens with a projected header stating the phase purpose and captured knowledge kinds; the header re-projects on hydration and is not persisted as a turn row.
   - Verification: `npm run verify` plus manual walkthrough on a multi-phase specification confirming headers appear, survive reload, and do not duplicate.
   - Traceability: D116; A60; Requirement 24.

### Grounding / context-gathering capability

5. **Grounding-card transcript primitive** — establish the visible provisional-context seam.
   - Why now / unlocks: once the cumulative workspace and revised grounding question format are in place, grounding cards become the enabling transcript primitive for analysis-first grounding and later reusable context gathering.
   - Acceptance: the workspace stream can render grounding cards with optional comment + continue semantics while keeping card content provisional rather than durable knowledge.
   - Verification: `npm run verify` plus seeded transcript/replay walkthroughs covering continue, reload, observer non-capture, and cumulative-workspace replay.
   - Traceability: D83, D89, D91, D99, D112; I24, I54, I101, I104.

6. **Brownfield workspace-analysis grounding brief** — deliver the first analysis-first grounding path on top of grounding cards.
   - Why now / unlocks: proves the provisional grounding-card seam against real brownfield repos once the cumulative workspace surface is stable enough to replay that opening brief truthfully.
   - Acceptance: brownfield grounding can run read-only workspace analysis, show a concise visible grounding brief/card, and hand off into the first substantive grounding question.
   - Verification: `npm run verify` plus manual brownfield walkthroughs on representative repos.
   - Traceability: D32, D83, D99; A47, A56; I101.

7. **Reusable interviewer-invoked context gathering beyond opening grounding** — generalize context gathering once the brownfield opening path proves out.
   - Why now / unlocks: broadens grounding capability without inventing a second artifact model, and only makes sense after grounding cards plus the brownfield brief are stable inside the cumulative workspace surface.
   - Acceptance: the interviewer can invoke approved context-gathering capabilities during grounding as visible grounding cards beyond the opening move.
   - Verification: `npm run verify` plus manual mid-grounding context-gathering walkthroughs.
   - Traceability: D99, D30, D32, D83; I101, I104.

## Horizon

### Completion / reporting follow-ons

- Dashboard / result summaries and completeness metrics.

### Revisit / cascade

- Edit mode + cascade preview.
- Cascade execution + secondary thread lifecycle.

### Infrastructure / tooling / extensions

- Drizzle Kit audit remediation.
- Git-friendly file-based persistence representation for diffable specs.
- Headless interview driver for scripted end-to-end probes.
- MCP server adapter for core operations.

## Recently Completed

- [2026-04-20] Alias deletion retired the naming frontier — Done: removed the remaining `/api/projects/...` compatibility entry points and deleted shared/server `project` alias seams from the happy path. Verified: `npm run verify`. Watch: freshly reseeded manual resume/export walkthrough still matters after the destructive cut.
- [2026-04-20] Specification routes moved to canonical ownership — Done: routed workspace/export entry now flows through `/specification/...`, and client fetch/mutation seams now target `/api/specifications/...` on the happy path. Verified: `npm run verify`. Watch: none.
- [2026-04-20] Durable `specification` record identity landed — Done: schema/migration ownership, DB helpers, shared transport contracts, and state/entity payloads now treat `specification` / `specification_id` as the canonical durable identity. Verified: `npm run verify`. Watch: none.

Older history: `docs/archive/PLAN_HISTORY.md`

## Dependencies

```text
output-route-and-markdown-export-refinement
  ├──→ close-phase-confirmation-modal
  └──→ workflow-ownership-extraction
        └──→ continuous-workspace-phase-addressable-interview-surface
              └──→ router-query-ownership-refinement

grounding-free-text-question-format
  └──→ grounding-card-transcript-primitive
        └──→ brownfield-workspace-analysis-grounding-brief
              └──→ reusable-interviewer-invoked-context-gathering

continuous-workspace-phase-addressable-interview-surface
  └──→ phase-section-headers
```
