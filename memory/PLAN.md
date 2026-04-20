<!-- PLAN.md — single source of truth for the live frontier.
     Created by ln-plan · Read by all skills · Updated by ln-build and ln-sync.
     Older completed work lives in docs/archive/PLAN_HISTORY.md. -->

# Plan

Current frontier remains the naming/ownership cleanup. The low-risk compatibility slices inside that frontier have now landed: persisted specification `cwd` is gone, client-owned specification wording is in place across the workspace shell, client-facing state seams default to `Specification*` aliases, specification/workspace helper names have replaced the remaining client runtime `project` wording, and the canonical browser/HTTP path family now speaks in `/specification/...` and `/api/specifications/...` terms while legacy `/project/...` and `/api/projects/...` aliases remain explicit compatibility seams. The remaining burden inside this frontier is the higher-risk physical identity work — especially the durable DB/storage `project` → `specification` rename and any later `scope` → `grounding` persistence migration that still proves worth doing. After that, the near horizon is intentionally ordered around user-visible completion and grounding seams before deeper workflow and router/query cleanup. Revisit/cascade and infrastructure/tooling remain on the true horizon for now.

## Active

1. **Canonical terminology and record-identity normalization** — structural `[status: in-progress]`
   - Objective: finish aligning durable record names, route/display terminology, and workspace ownership with the settled product language by completing the remaining `project` → `specification` identity work, deciding how far the `scope` → `grounding` migration should become physical rather than helper-level, and retiring any temporary compatibility wording still left after the completed low-risk slices.
   - Why now / unlocks: the handoff/transition frontier is retired, so mixed naming is now the main legacy burden shaping every fresh slice. Landing this first prevents the next completion, grounding, and workflow passes from layering on top of ambiguous terminology.
   - Acceptance: schema/API/routes/fixtures/tests/export speak one canonical vocabulary; any temporary alias is explicit and documented; runtime behavior stays truthful through the rename.
   - Progress so far: persisted specification `cwd` has been removed in favor of runtime workspace context; client-owned workspace surfaces now say specification where appropriate; client-facing state seams now default to `Specification*` aliases instead of `Project*` compatibility names; specification/workspace helper and module names now replace the remaining client runtime `project` terminology where wire/storage ownership is not involved; shared/client route helpers now generate specification-named phase paths; canonical browser and HTTP entry seams now flow through `/specification/...` and `/api/specifications/...` with explicit legacy aliases for `/project/...` and `/api/projects/...`; persisted workflow keys still remain `scope`. 
   - Verification: run `npm run fix` after each safe slice; gate with `npm run verify`; manually walk at least one seeded resume/export path after route/name changes.
   - Traceability: D81, D97, D98, D101, D109, D113; I24, I100, I101, I102, I104.

## Next

Near-horizon work is grouped by theme: first completion/closure surfaces, then grounding/context-gathering capability, then workflow ownership cleanup, then router/query refinement.

### Completion / closure surfaces

1. **Output route and markdown export refinement** — first completion-surface follow-on once naming settles.
   - Why now / unlocks: after canonical terminology lands, export becomes the clearest user-visible completion seam to make truthful and legible.
   - Acceptance: the output route, preview, and markdown export present accepted review outputs cleanly under the renamed terminology without reopening workflow-complete semantics.
   - Verification: `npm run verify` plus a manual export walkthrough on a completed seeded specification.
   - Traceability: D101; I24, I87, I104.

2. **Close Phase confirmation modal** — complete the remaining phase-exit UX after export/output cleanup.
   - Why now / unlocks: makes closure intent explicit before deeper grounding and workflow work add more state to closeability paths.
   - Acceptance: in-progress non-review phases show a confirmation modal with readiness/turn-count context and gating that matches closeability rules.
   - Verification: `npm run verify` plus manual close/reject/confirm walkthroughs on grounding and elicitation phases.
   - Traceability: D104, D65, D66; I72.

### Grounding / context-gathering capability 

3. **Grounding-card transcript primitive** — establish the visible provisional-context seam.
   - Why now / unlocks: completion surfaces can land first; then grounding cards become the enabling transcript primitive for analysis-first grounding and later reusable context gathering.
   - Acceptance: the workspace stream can render grounding cards with optional comment + continue semantics while keeping card content provisional rather than durable knowledge.
   - Verification: `npm run verify` plus seeded transcript/replay walkthroughs covering continue, reload, and observer non-capture.
   - Traceability: D83, D89, D91, D99, D112; I24, I54, I101, I104.

4. **Brownfield workspace-analysis grounding brief** — deliver the first analysis-first grounding path on top of grounding cards.
   - Why now / unlocks: proves the provisional grounding-card seam against real brownfield repos before wider context-gathering generalization.
   - Acceptance: brownfield grounding can run read-only workspace analysis, show a concise visible grounding brief/card, and hand off into the first substantive grounding question.
   - Verification: `npm run verify` plus manual brownfield walkthroughs on representative repos.
   - Traceability: D32, D83, D99; A47, A56; I101.

5. **Reusable interviewer-invoked context gathering beyond opening grounding** — generalize context gathering once the brownfield opening path proves out.
   - Why now / unlocks: broadens grounding capability without inventing a second artifact model, and only makes sense after grounding cards plus the brownfield brief are stable.
   - Acceptance: the interviewer can invoke approved context-gathering capabilities during grounding as visible grounding cards beyond the opening move.
   - Verification: `npm run verify` plus manual mid-grounding context-gathering walkthroughs.
   - Traceability: D99, D30, D32, D83; I101, I104.

### Workflow ownership cleanup

6. **Workflow ownership extraction** — architectural cleanup after the user-visible completion and grounding seams land.
   - Why now / unlocks: delayed intentionally until output/grounding surfaces stop moving; then extract projector and `app.ts` workflow ownership while preserving behavior.
   - Acceptance: workflow projection and transition orchestration become easier to reason about without introducing a second durable workflow model or changing phase semantics.
   - Verification: `npm run verify` plus focused regression reads on seeded landing/recovery/progression flows.
   - Traceability: D110, D112, D113; I24, I72, I104.

### Ownership refinement

7. **Continuous workspace / phase-addressable interview surface** — user-facing continuity pass after workflow ownership is clearer.
   - Why now / unlocks: the hybrid workspace idea should not preempt the current naming frontier or the earlier output / grounding seams, but once workflow projection and lifecycle ownership are clearer it becomes the right seam to separate continuous rendering from routed phase addressability. Landing that distinction first gives router/query cleanup a truer target instead of optimizing around the current per-phase rendering split by accident.
   - Acceptance: the center pane can render one continuous workspace stream with grounding / design / requirements / criteria sections, the left sidebar can act as truthful section-jump / scroll-spy navigation, and phase deep-linking / gating remain routed and honest without introducing a second durable workflow model.
   - Verification: `npm run verify` plus manual walkthroughs for deep-link entry, scroll/focus transitions, close-to-next-phase motion, and reload/resume on a partially completed specification.
   - Traceability: A58; D86, D87, D103, D107, D110, D113, D114; I24, I102.

8. **Router / query ownership refinement for interview surfaces** — final near-horizon cleanup after workflow ownership and workspace continuity are clearer.
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

- [2026-04-20] Canonical specification-named browser and HTTP path family landed under the naming frontier — Done: routed workspace/export entry now flows through `/specification/...`, client fetch/mutation seams now target `/api/specifications/...`, and legacy `/project/...` plus `/api/projects/...` entry points survive only as explicit redirect/alias compatibility seams. Verified: `npm run verify`. Watch: the remaining frontier work is now the higher-risk durable DB/storage identity rename.
- [2026-04-20] Client-owned terminology cleanup slices landed under the naming frontier — Done: client-facing state seams now default to `Specification*` aliases, specification/workspace helper and module names replaced remaining client runtime `project` wording, and exhausted execution-queue artifacts were retired without changing DB identifiers. Verified: `npm run verify`. Watch: the remaining frontier work is now the higher-risk physical identity migration across transport/storage seams.
- [2026-04-19] Phase transition and handoff stabilization retired from the active frontier — Done: requirements acceptance now advances directly into criteria kickoff, criteria acceptance closes the workflow into export-ready state, and closed phases project explicit handoff/completion artifacts. Verified: `npm run verify`. Watch: none.

Older history: `docs/archive/PLAN_HISTORY.md`

## Dependencies

```text
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
