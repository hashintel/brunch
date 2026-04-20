<!-- PLAN.md — single source of truth for the live frontier.
     Created by ln-plan · Read by all skills · Updated by ln-build and ln-sync.
     Older completed work lives in docs/archive/PLAN_HISTORY.md. -->

# Plan

Current frontier remains the naming/ownership cleanup. The low-risk wording slices have landed: persisted specification `cwd` is gone, client-owned specification wording is in place across the workspace shell, and canonical browser/HTTP entry seams already speak in `/specification/...` and `/api/specifications/...` terms. The remaining burden inside this frontier is the higher-risk physical identity work — make `specification` the only durable record identity, retire `project` aliases/adapters instead of preserving them, and physically rename the first workflow key from `scope` to `grounding`. Because local data is unstable and fixtures are cheap to regenerate, destructive reseed is preferred over migration or legacy-adaptation work.

Three new near-horizon items emerged from a dramaturgical audit of the grounding phase interaction model: a hardening pass for six code bugs/gaps (duplicate answered cards, inflated readiness, term visibility, stale markers, divider width, sidebar sync), a grounding question-format change from option-selection to free-text-first (D115), and phase section headers (D116). All three are unblocked — they don't depend on the naming frontier. After those, the existing near horizon continues around completion/closure surfaces, grounding/context-gathering capability, workflow ownership cleanup, and router/query refinement. Revisit/cascade and infrastructure/tooling remain on the true horizon.

## Active

1. **Canonical terminology and record-identity normalization** — structural `[status: in-progress]`
   - Objective: finish aligning durable record names, route/display terminology, and workspace ownership with the settled product language by completing the physical `project` → `specification` identity migration, physically renaming the workflow key `scope` → `grounding`, and deleting alias/adaptation seams instead of preserving them.
   - Why now / unlocks: the handoff/transition frontier is retired, so mixed naming is now the main legacy burden shaping every fresh slice. Landing this first prevents the next completion, grounding, and workflow passes from layering on top of ambiguous terminology.
   - Acceptance: schema/API/routes/fixtures/tests/export speak one canonical vocabulary; no legacy `project`/`scope` compatibility layer remains on the happy path; runtime behavior stays truthful after destructive reseed and fixture regeneration.
   - Progress so far: persisted specification `cwd` has been removed in favor of runtime workspace context; client-owned workspace surfaces now say specification where appropriate; the first workflow key is now physically `grounding` across shared contracts, persistence, runtime logic, fixtures, and tests; specification/workspace helper and module names now replace much of the remaining client runtime `project` wording; canonical browser and HTTP entry seams already flow through `/specification/...` and `/api/specifications/...`; the durable/shared/server record-identity cutover is now landed through schema, DB helpers, migrations, shared contracts, and tests, so the remaining work is alias / adaptation deletion.
   - Verification: run `npm run fix` after each safe slice; gate with `npm run verify`; manually walk at least one freshly reseeded resume/export path after the identity cuts.
   - Traceability: D81, D97, D98, D100, D101, D109, D111, D113; I24, I100, I101, I102, I104.

## Next

Near-horizon work is grouped by theme: first a dramaturgical-audit hardening pass, then grounding interaction-model fixes, then completion/closure surfaces, then grounding/context-gathering capability, then workflow ownership cleanup, then router/query refinement.

### Dramaturgical audit hardening

1. **Dramaturgical audit bug and gap fixes** — hardening
   - Objective: fix the six code-level issues surfaced by the dramaturgical audit — duplicate answered cards, inflated readiness, `term` in captured items, generic "Interview started" marker, non-full-width divider, sidebar/card capture sync gap.
   - Why now / unlocks: these are live bugs visible to users on every fresh specification; the duplicate-card and readiness issues erode transcript and workflow trust. All six are small, independent of the naming frontier, and can land without waiting for terminology to finish.
   - Acceptance: each commit passes `npm run verify`; manual walkthrough confirms no duplicate cards, correct readiness at phase entry, no `term` badges, no stale marker, full-width divider, and sidebar counts sync with card capture display.
   - Verification: `npm run verify` plus manual walkthrough on a fresh greenfield specification through grounding Q1→Q2.
   - Traceability: D22, D94, D95, D110; I24, I48.

### Grounding interaction model

2. **Grounding free-text question format** — bounded feature
   - Objective: grounding questions use an open free-text format (question + why + response note) instead of the option-selection format used in elicitation, so the grounding phase performs as context-gathering rather than decision-making.
   - Why now / unlocks: independent of grounding cards and naming work; changes the schema, prompt, and response seams that shape every grounding session. Landing early prevents further grounding work (cards, brownfield briefs) from building on the wrong interaction model.
   - Acceptance: `structuredQuestionSchema` accepts questions without options; the grounding system prompt produces open exploratory questions; the response schema and UI accept `freeText`-only submissions; elicitation and later phases still require options.
   - Verification: `npm run verify` plus manual greenfield grounding walkthrough confirming open questions, free-text response, and correct observer capture.
   - Traceability: D115; A59; R4.

3. **Phase section headers** — bounded feature
   - Objective: each phase section in the workspace stream opens with a projected header stating the phase purpose and what kinds of knowledge are captured there, so users are oriented at phase entry without needing the kickoff card alone to carry that burden.
   - Why now / unlocks: independent of grounding cards, naming, and question format. Small projected-artifact addition to the stream projector; can land anytime after the current projector contract is stable.
   - Acceptance: phase section headers render at the top of each phase section, re-project on hydration, are not persisted as turn rows, and show phase-specific copy (grounding: goals/terms/context/constraints; elicitation: design decisions; requirements: review; criteria: verification).
   - Verification: `npm run verify` plus manual walkthrough on a multi-phase specification confirming headers appear, survive reload, and don't duplicate.
   - Traceability: D116; A60; R24.

### Completion / closure surfaces

4. **Output route and markdown export refinement** — first completion-surface follow-on once naming settles.
   - Why now / unlocks: after canonical terminology lands, export becomes the clearest user-visible completion seam to make truthful and legible.
   - Acceptance: the output route, preview, and markdown export present accepted review outputs cleanly under the renamed terminology without reopening workflow-complete semantics.
   - Verification: `npm run verify` plus a manual export walkthrough on a completed seeded specification.
   - Traceability: D101; I24, I87, I104.

5. **Close Phase confirmation modal** — complete the remaining phase-exit UX after export/output cleanup.
   - Why now / unlocks: makes closure intent explicit before deeper grounding and workflow work add more state to closeability paths.
   - Acceptance: in-progress non-review phases show a confirmation modal with readiness/turn-count context and gating that matches closeability rules.
   - Verification: `npm run verify` plus manual close/reject/confirm walkthroughs on grounding and elicitation phases.
   - Traceability: D104, D65, D66; I72.

### Grounding / context-gathering capability 

6. **Grounding-card transcript primitive** — establish the visible provisional-context seam.
   - Why now / unlocks: completion surfaces can land first; then grounding cards become the enabling transcript primitive for analysis-first grounding and later reusable context gathering.
   - Acceptance: the workspace stream can render grounding cards with optional comment + continue semantics while keeping card content provisional rather than durable knowledge.
   - Verification: `npm run verify` plus seeded transcript/replay walkthroughs covering continue, reload, and observer non-capture.
   - Traceability: D83, D89, D91, D99, D112; I24, I54, I101, I104.

7. **Brownfield workspace-analysis grounding brief** — deliver the first analysis-first grounding path on top of grounding cards.
   - Why now / unlocks: proves the provisional grounding-card seam against real brownfield repos before wider context-gathering generalization.
   - Acceptance: brownfield grounding can run read-only workspace analysis, show a concise visible grounding brief/card, and hand off into the first substantive grounding question.
   - Verification: `npm run verify` plus manual brownfield walkthroughs on representative repos.
   - Traceability: D32, D83, D99; A47, A56; I101.

8. **Reusable interviewer-invoked context gathering beyond opening grounding** — generalize context gathering once the brownfield opening path proves out.
   - Why now / unlocks: broadens grounding capability without inventing a second artifact model, and only makes sense after grounding cards plus the brownfield brief are stable.
   - Acceptance: the interviewer can invoke approved context-gathering capabilities during grounding as visible grounding cards beyond the opening move.
   - Verification: `npm run verify` plus manual mid-grounding context-gathering walkthroughs.
   - Traceability: D99, D30, D32, D83; I101, I104.

### Workflow ownership cleanup

9. **Workflow ownership extraction** — architectural cleanup after the user-visible completion and grounding seams land.
   - Why now / unlocks: delayed intentionally until output/grounding surfaces stop moving; then extract projector and `app.ts` workflow ownership while preserving behavior.
   - Acceptance: workflow projection and transition orchestration become easier to reason about without introducing a second durable workflow model or changing phase semantics.
   - Verification: `npm run verify` plus focused regression reads on seeded landing/recovery/progression flows.
   - Traceability: D110, D112, D113; I24, I72, I104.

### Ownership refinement

10. **Continuous workspace / phase-addressable interview surface** — user-facing continuity pass after workflow ownership is clearer.
   - Why now / unlocks: the hybrid workspace idea should not preempt the current naming frontier or the earlier output / grounding seams, but once workflow projection and lifecycle ownership are clearer it becomes the right seam to separate continuous rendering from routed phase addressability. Landing that distinction first gives router/query cleanup a truer target instead of optimizing around the current per-phase rendering split by accident.
   - Acceptance: the center pane can render one continuous workspace stream with grounding / design / requirements / criteria sections, the left sidebar can act as truthful section-jump / scroll-spy navigation, and phase deep-linking / gating remain routed and honest without introducing a second durable workflow model.
   - Verification: `npm run verify` plus manual walkthroughs for deep-link entry, scroll/focus transitions, close-to-next-phase motion, and reload/resume on a partially completed specification.
   - Traceability: A58; D86, D87, D103, D107, D110, D113, D114; I24, I102.

11. **Router / query ownership refinement for interview surfaces** — final near-horizon cleanup after workflow ownership and workspace continuity are clearer.
   - Why now / unlocks: should harvest the real invalidation/loader boundaries exposed by the preceding naming, completion, grounding, and workflow passes instead of guessing early.
   - Acceptance: coarse route-wide invalidation is replaced by clearer loader/query ownership without stale transcript or handoff regressions.
   - Verification: `npm run verify` plus manual mutation/observer refresh walkthroughs.
   - Traceability: D87, D113; A20, A50; I24, I54, I102.

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

- [2026-04-20] Durable `specification` record identity landed under the naming frontier — Done: schema/migration ownership, DB helpers, shared transport contracts, state/entity payloads, and verification now treat `specification` / `specification_id` as the canonical durable identity instead of `project` / `project_id`. Verified: `npm run verify`. Watch: `/project/...`, `/api/projects/...`, and remaining compatibility wrappers still exist until the alias-deletion card lands; manual resume/export walkthrough still matters after that cut.
- [2026-04-20] Canonical `grounding` workflow key landed under the naming frontier — Done: the first phase now uses `grounding` across shared contracts, persistence/runtime logic, fixtures, tests, and export/read-model seams instead of preserving `scope` as the internal key. Verified: `npm run verify`. Watch: the remaining frontier work is the durable `project` → `specification` record-identity cut plus alias deletion.
- [2026-04-20] Canonical specification-named browser and HTTP path family landed under the naming frontier — Done: routed workspace/export entry now flows through `/specification/...`, client fetch/mutation seams now target `/api/specifications/...`, and legacy `/project/...` plus `/api/projects/...` entry points survive only as explicit redirect/alias compatibility seams. Verified: `npm run verify` plus manual seeded deep-link/reload/export walkthroughs on `issue-tracker-all-phases-closed` and `issue-tracker-design-recovery`. Watch: the remaining frontier work is now the higher-risk durable DB/storage identity rename.
- [2026-04-20] Client-owned terminology cleanup slices landed under the naming frontier — Done: client-facing state seams now default to `Specification*` aliases, specification/workspace helper and module names replaced remaining client runtime `project` wording, and exhausted execution-queue artifacts were retired without changing DB identifiers. Verified: `npm run verify`. Watch: the remaining frontier work is now the higher-risk physical identity migration across transport/storage seams.
- [2026-04-19] Phase transition and handoff stabilization retired from the active frontier — Done: requirements acceptance now advances directly into criteria kickoff, criteria acceptance closes the workflow into export-ready state, and closed phases project explicit handoff/completion artifacts. Verified: `npm run verify`. Watch: none.

Older history: `docs/archive/PLAN_HISTORY.md`

## Dependencies

```text
dramaturgical-audit-bug-and-gap-fixes  (no blockers)
grounding-free-text-question-format    (no blockers)
phase-section-headers                  (no blockers)

canonical-terminology-and-record-identity-normalization
  ├──→ output-route-and-markdown-export-refinement
  ├──→ close-phase-confirmation-modal
  ├──→ grounding-card-transcript-primitive
  │     └──→ brownfield-workspace-analysis-grounding-brief
  │           └──→ reusable-interviewer-invoked-context-gathering
  └──→ workflow-ownership-extraction
        └──→ continuous-workspace-phase-addressable-interview-surface
              └──→ router-query-ownership-refinement
```
