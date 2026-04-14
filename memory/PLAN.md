<!-- PLAN.md — single source of truth for the live frontier.
     Created by ln-plan · Read by all skills · Updated by ln-build and ln-sync.
     Older completed work lives in docs/archive/PLAN_HISTORY.md. -->

# Plan

## Active

1. **Story-first phase and transcript patterns** — bounded feature `[status: not-started]`
   - Objective: prototype phase-differentiated layouts plus transcript-state patterns inside `src/client/stories/` so UI affordances can evolve in parallel with app wiring.
   - Why now / unlocks: the fixture workspace is now in place, so UI-focused work can explore phase differentiation and waiting-state affordances against named walkthrough states.
   - Acceptance: story patterns cover kickoff states, waiting/question-formation states, transcript artifact states, and at least one differentiated layout direction for the major workflow phases; adoption notes point back to the routed app surfaces.
   - Verification: inner — story build / typecheck. Outer — design review against seeded walkthrough findings.
   - Verification approach: inner — typed story-state fixtures and build checks; outer — dramaturgical review of phase differentiation and transcript patterns against seeded walkthrough findings; see `memory/SPEC.md` §Verification Design.
   - Traceability: → Requirement 5; Decisions D86, D87.

2. **Router/query ownership refinement for interview surfaces** — structural `[status: not-started]`
   - Objective: replace coarse route-wide invalidation with deliberate loader/query ownership so observer and workflow refreshes stop tearing down more UI than necessary.
   - Why now / unlocks: kickoff and fixture grounding improved; the next structural blocker is the current `router.invalidate()` pattern that still tears down too much UI.
   - Acceptance: workflow, entity, and phase-local interview data have explicit ownership boundaries; mutations refresh only the surfaces they own; chat-local artifacts no longer disappear on unrelated data refresh.
   - Verification: inner — loader/query integration tests and mutation invalidation tests. Middle — route reload regression coverage. Outer — manual live-chat latency and refresh walkthroughs.
   - Verification approach: middle — route/query ownership contract tests that prove refresh boundaries stay local; outer — browser see-and-inspect review for perceived teardown, latency, and disappearance bugs; see `memory/SPEC.md` §Verification Design.
   - Traceability: → Requirements 5, 7, 14; Assumptions A20, A50; Decisions D22, D86, D87; Invariants I24, I102.

3. **Transcript fidelity and in-flight status surfaces** — structural `[status: not-started]`
   - Objective: make the main chat surface faithfully render persisted assistant artifacts and expose clear waiting / lock states while questions, summaries, and observer updates are in flight.
   - Why now / unlocks: this is now the main user-visible refinement lane after fixture and kickoff groundwork; it should follow once story references and data ownership are clearer.
   - Acceptance: persisted turns rehydrate with the intended assistant artifacts, live turns show meaningful in-flight status while question cards or summaries are forming, and the chat surface distinguishes the major waiting states instead of one opaque loading condition.
   - Verification: inner — hydration/render-state tests. Middle — persistence and reload regression tests. Outer — manual chat walkthroughs through question generation, response submission, and observer refresh.
   - Verification approach: middle — replay/hydration assertions plus explicit in-flight state-model tests; outer — dramaturgical transcript review focused on legible placeholders and visible waiting states; see `memory/SPEC.md` §Verification Design.
   - Traceability: → Requirement 5; Decisions D24, D30, D86, D87; Invariants I24, I44.

## Next

1. **Brownfield kickoff typed grounding transport** — structural `[status: conditional]`
   - Objective: if manual brownfield walkthroughs show the current prompt-shaped handoff is still brittle, move kickoff grounding into an explicit typed transport that persists repo findings separately from the first question's `why` field.
   - Why now / unlocks: the merged kickoff repair is good enough for now, but transcript fidelity and observer work will be simpler if kickoff grounding stops depending on phrasing conventions.
   - Verification approach: middle — persistence/hydration round-trips for typed grounding artifacts; outer — qualitative brownfield walkthrough confirming the first question still feels grounded; see `memory/SPEC.md` §Verification Design.
   - Traceability: → Requirements 3, 14, 16; Assumption A47; Decisions D24, D32, D83; Invariants I44, I101.

2. **Review lifecycle refinement across requirements + criteria** — bounded feature `[status: not-started]`
   - Objective: add the deferred richer review actions plus stale / invalidation semantics across requirements and criteria without regressing completion and export coherence.
   - Why now / unlocks: should follow once transcript/state ownership stops shifting under the review surfaces.
   - Verification approach: inner — review-state mutation/read-model tests; middle — export/readiness regression checks after invalidation semantics change; outer — manual cross-phase review walkthrough; see `memory/SPEC.md` §Verification Design.
   - Traceability: → Requirements 11, 12, 13; Assumptions A15, A40, A44; Invariants I72, I87.

3. **Drizzle Kit audit remediation** — hardening `[status: not-started]`
   - Objective: move off the vulnerable `drizzle-kit` loader chain without regressing the packaged app, migrations, or studio workflow.
   - Why now / unlocks: remains an independent dependency-risk seam that can run once the current product-facing refinement wave is staffed.
   - Verification approach: inner — dependency tree, config-load, and migration smoke checks; outer — manual `npm run studio` walkthrough against an existing project; see `memory/SPEC.md` §Verification Design.
   - Traceability: → Requirement 1; Invariants I4, I100.

4. **Edit mode + cascade preview** — bounded feature `[status: not-started]`
   - Objective: let the user enter edit mode from the ViewLayout knowledge surface, select knowledge items, and see an accurate cascade preview before any mutation is committed.
   - Why now / unlocks: remains the next user-facing revisit affordance once the current interview-surface refinement wave settles.
   - Verification approach: inner — graph traversal and preview projection tests; outer — manual edit-mode walkthrough in chat and graph views; see `memory/SPEC.md` §Verification Design.
   - Traceability: → Requirement 10; Assumptions A48, A50; Decisions D80, D86; Invariants I48, I102.

## Horizon

- **Cascade execution + secondary thread lifecycle** — structural follow-on after preview-only revisit is stable.
- **Exploratory pathway for users whose goal itself is unclear** — separate from the main brownfield kickoff repair.
- **Git-friendly file-based persistence representation for diffable specs**.
- **Headless interview driver for scripted end-to-end probes**.
- **More granular caching if refined route/query ownership is still too coarse in runtime use**.
- **MCP server adapter for core operations**.

## Recently Completed

- 2026-04-14 — **Fixture-backed walkthrough workspace** — Done: walkthrough-ready seed scenarios now front-load the public seed catalog, prove resume after re-open, and cover export-ready/manual-inspection states. Verified: `npm run verify`. Watch: story adoption and transcript-state inspection still need the next UI-facing lanes.
- 2026-04-14 — **Brownfield kickoff rehabilitation** — Done: the first brownfield scope question now carries a transcript-visible grounding handoff and the observer sees brownfield-aware context. Verified: `npm run verify`. Watch: if manual repo walkthroughs still feel brittle, promote typed grounding transport.
- 2026-04-14 — **Routing & layout refactor** — Done: directory routes, three layout shells, per-phase views, entity sidebar relocation, and graph-view entry all shipped. Verified: `npm run verify`. Watch: graph view is still intentionally shallow.

Older history: `docs/archive/PLAN_HISTORY.md`

## Dependencies

```text
story-first-phase-and-transcript-patterns ─┐
                                            ├──→ transcript-fidelity-and-in-flight-status-surfaces ──→ review-lifecycle-refinement
router-query-ownership-refinement-for-interview-surfaces ─┘

brownfield-kickoff-typed-grounding-transport ──→ conditional follow-on if manual kickoff walkthroughs stay brittle

drizzle-kit-audit-remediation ─────────────────────────────────────────────────────── independent next lane

edit-mode-cascade-preview ──→ cascade-execution-secondary-thread-lifecycle
```
