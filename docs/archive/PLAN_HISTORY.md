# Plan History

Archived from the legacy phase-ledger form of `memory/PLAN.md` on 2026-04-14 during FE-584.

## Completed Phases

- 2026-04-14 — **Phase 1: Foundation** — walking skeleton proved SDK → SSE → React end to end, then SQLite persistence landed.
- 2026-04-14 — **Phase 2: Architecture** — turn-tree schema, Drizzle core extraction, and multi-project routing became the durable app spine.
- 2026-04-14 — **Phase 3: Interview Engine** — rich chat UI, structured scope interview, parts-based persistence, observer extraction, and the AI SDK pivot all shipped.
- 2026-04-14 — **Phase 4: Interaction + Knowledge Foundations** — streaming fixes, flexible turn responses, generic knowledge persistence, and phase-aware observer widening landed.
- 2026-04-14 — **Phase 5: Mode Closure + Full Interview** — explicit phase outcomes, canonical knowledge model, design mode, requirements review, and criteria review all closed the full interview loop.
- 2026-04-14 — **Phase 6: Readiness Surfaces + Export** — dashboard workflow state, knowledge workspace review surface, export, and richer fixture seeding shipped.
- 2026-04-14 — **Phase 7: Distribution + Brownfield + UI Alignment** — UI alignment, shiki/debug cleanup, local-first `npx` distribution, and brownfield kickoff all shipped.
- 2026-04-14 — **Phase 10: Route Ownership Refactor** — router seam characterization, route wrapper extraction, file-route infrastructure, and final route-directory consolidation all completed.
- 2026-04-14 — **Phase 11: Routing & Layout Refactor** — directory-based routing, three layout shells, per-phase views, entity sidebar relocation, and graph-view stub all completed.

## Completed Hardening / Meta Work

- 2026-04-14 — **Ad-hoc: Typing Hygiene** — Zod was removed from non-LLM boundaries while preserving LLM and HTTP validation seams.
- 2026-04-14 — **Phase 9 completed items** — launcher/runtime guard hardening (14b), trusted fixture hardening (16a), and capture-backed golden corpus work (16b) all shipped.

- 2026-04-14 — **Phase terminal staging and auto-present current turn** — open phases auto-initiate the current turn, answered-turn replay filters control/closure artifacts, closed phases end with handoff/completion card.

## Recent Frontier Archives

- 2026-04-16 — **Criteria review accept-to-close wiring** — accepting the criteria full-set review now marks the presented criterion set approved, closes criteria on the same durable turn, makes the workflow output-ready, and suppresses the stale review text from being forwarded into chat after workflow completion.
- 2026-04-16 — **Lightweight review turn v1 across requirements + criteria** — both review phases now use full-set review turns with stable item reference codes, one review note, explicit `Accept review` / `Request changes` actions, and accept-to-close progression into the next kickoff/output frontier.
- 2026-04-16 — **Criteria full-set review turn parity** — criteria gained the same full-set review prompt/context/UI seam as requirements, including current criterion inventory, stable criterion reference codes, one review note, and explicit `Accept review` / `Request changes` actions.
- 2026-04-16 — **Requirements review accept-to-close wiring** — accepting the requirements full-set review now marks the presented requirement set approved, closes requirements on the same durable turn, creates the criteria kickoff frontier, and suppresses the stale review text from being forwarded into criteria chat.
- 2026-04-15 — **Center pane sticky header and ChatScroll integration** — `InterviewView` now renders phase metadata and state-gated actions in the sticky center header, with `ChatScroll` as the route-owned transcript container.
- 2026-04-15 — **Knowledge sidebar grouping registry** — `EntitySidebar` now groups visible knowledge kinds behind the hard-coded display registry with compact `DrawerCard` items and stable reference-code display.
- 2026-04-15 — **Phase stepper sidebar** — `PhaseNavigationSidebar` now renders the sticky specification header, sequential phase timeline, and conditional Output row.
- 2026-04-15 — **Top bar and phase label canonicalization** — RouteRoot gained the canonical top bar and shared phase-label registry across dashboard, sidebar, transcript copy, and fixtures.
- 2026-04-15 — **Story-first turn-card refinement** — DrawerCard, question/knowledge detail cards, chat transcript story, and token scale canon landed as the presentational base for route integration.
- 2026-04-14 — **Turn-owned captured-item projection and trailing observer attachment** — answered turns project captured knowledge with stable reference codes and keep late observer completion attached to the originating turn.
- 2026-04-14 — **Turn-owned submit/interviewer-processing choreography** — active turns stay mounted through submit, lock inline during processing, and collapse only when the next state is ready.
- 2026-04-14 — **Workspace shell first honesty pass** — dashboard links became real, root/dashboard scrolling was fixed, future phases became visible-but-disabled, review phases gained distinct shell framing, and transcript replay shifted from user bubbles toward compact answered-turn cards plus control markers.
- 2026-04-14 — **Fixture-backed walkthrough workspace** — walkthrough-ready seed scenarios now front-load the public seed catalog, prove resume after re-open, and cover export-ready/manual-inspection states.

Use `memory/PLAN.md` for the live frontier only.
