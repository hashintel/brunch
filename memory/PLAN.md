<!-- PLAN.md — single source of truth for the live frontier.
     Created by ln-plan · Read by all skills · Updated by ln-build and ln-sync.
     Older completed work lives in docs/archive/PLAN_HISTORY.md. -->

# Plan

## Active

1. **Fixture-backed walkthrough workspace** — hardening `[status: not-started]`
   - Objective: expand trusted seed scenarios into a fuller manual-walkthrough workspace that can exercise phase transitions, export markdown, missing-view discovery, and resume behavior without ad hoc database edits.
   - Why now / unlocks: gives every other refinement lane a shared proving ground and makes parallel agent work compare against the same seeded states.
   - Acceptance: seedable scenarios cover kickoff, in-flight phase states, review-ready states, and export-ready states; manual testing can validate phase progression and markdown output from seeded projects; missing or weak views can be named from concrete walkthroughs instead of guesswork.
   - Verification: inner — seed CLI / manifest / fixture tests. Outer — manual seeded walkthroughs plus export markdown inspection.
   - Verification approach: middle — round-trip/replay oracles over seed → load → export → resume; outer — fixture-backed dramaturgical see-and-inspect walkthroughs on named scenarios; see `memory/SPEC.md` §Verification Design.
   - Traceability: → Requirements 13, 14, 15; Decision D81; Invariants I100, I103.

2. **Brownfield kickoff rehabilitation** — structural `[status: not-started]`
   - Objective: repair brownfield scope kickoff so exploration reliably grounds the first interview turn for feature-area specs, including the observer handoff and partial-scope framing/UX.
   - Why now / unlocks: this is a workflow-entry seam; if kickoff stays shallow, the manual walkthrough wave cannot prove the brownfield story or partial-scope elicitation credibly.
   - Acceptance: the chosen kickoff mode yields usable grounding for the first scope turn, observer capture is coherent with that mode, and partial-codebase / partial-timeline wording fits feature-area elicitation instead of whole-product assumptions.
   - Verification: inner — interviewer-context, observer-boundary, and kickoff transport tests. Middle — kickoff round-trip state tests. Outer — manual brownfield runs across varied repos.
   - Verification approach: middle — structural kickoff/observer boundary tests plus persistence round-trips; outer — lightweight qualitative brownfield walkthroughs proving durable useful knowledge and a grounded first question; see `memory/SPEC.md` §Verification Design.
   - Potential follow-up: if manual brownfield walkthroughs show the current prompt-shaped handoff is still brittle, promote kickoff grounding into an explicit typed transport that persists repo findings separately from the first question's `why` field so grounding survives persistence, hydration, and observer extraction without relying on phrasing conventions.
   - Traceability: → Requirements 3, 16; Assumption A47; Decisions D32, D82, D83; Invariant I101.

3. **Story-first phase and transcript patterns** — bounded feature `[status: not-started]`
   - Objective: prototype phase-differentiated layouts plus transcript-state patterns inside `src/client/stories/` so UI affordances can evolve in parallel with app wiring.
   - Why now / unlocks: gives low-conflict parallel work to UI-focused agents while server and routing work proceeds elsewhere.
   - Acceptance: story patterns cover kickoff states, waiting/question-formation states, transcript artifact states, and at least one differentiated layout direction for the major workflow phases; adoption notes point back to the routed app surfaces.
   - Verification: inner — story build / typecheck. Outer — design review against seeded walkthrough findings.
   - Verification approach: inner — typed story-state fixtures and build checks; outer — dramaturgical review of phase differentiation and transcript patterns against seeded walkthrough findings; see `memory/SPEC.md` §Verification Design.
   - Traceability: → Requirement 5; Decisions D86, D87.

4. **Router/query ownership refinement for interview surfaces** — structural `[status: not-started]`
   - Objective: replace coarse route-wide invalidation with deliberate loader/query ownership so observer and workflow refreshes stop tearing down more UI than necessary.
   - Why now / unlocks: the current `router.invalidate()` pattern is the main architectural reason live chat state gets blown away after data changes.
   - Acceptance: workflow, entity, and phase-local interview data have explicit ownership boundaries; mutations refresh only the surfaces they own; chat-local artifacts no longer disappear on unrelated data refresh.
   - Verification: inner — loader/query integration tests and mutation invalidation tests. Middle — route reload regression coverage. Outer — manual live-chat latency and refresh walkthroughs.
   - Verification approach: middle — route/query ownership contract tests that prove refresh boundaries stay local; outer — browser see-and-inspect review for perceived teardown, latency, and disappearance bugs; see `memory/SPEC.md` §Verification Design.
   - Traceability: → Requirements 5, 7, 14; Assumptions A20, A50; Decisions D22, D86, D87; Invariants I24, I102.

5. **Transcript fidelity and in-flight status surfaces** — structural `[status: not-started]`
   - Objective: make the main chat surface faithfully render persisted assistant artifacts and expose clear waiting / lock states while questions, summaries, and observer updates are in flight.
   - Why now / unlocks: users currently lose visibility into tool activity and intermediate waiting states, which weakens trust and makes manual diagnosis harder.
   - Acceptance: persisted turns rehydrate with the intended assistant artifacts, live turns show meaningful in-flight status while question cards or summaries are forming, and the chat surface distinguishes the major waiting states instead of one opaque loading condition.
   - Verification: inner — hydration/render-state tests. Middle — persistence and reload regression tests. Outer — manual chat walkthroughs through question generation, response submission, and observer refresh.
   - Verification approach: middle — replay/hydration assertions plus explicit in-flight state-model tests; outer — dramaturgical transcript review focused on legible placeholders and visible waiting states; see `memory/SPEC.md` §Verification Design.
   - Traceability: → Requirement 5; Decisions D24, D30, D86, D87; Invariants I24, I44.

## Next

1. **Review lifecycle refinement across requirements + criteria** — bounded feature `[status: not-started]`
   - Objective: add the deferred richer review actions plus stale / invalidation semantics across requirements and criteria without regressing completion and export coherence.
   - Why now / unlocks: should follow once transcript/state ownership stops shifting under the review surfaces.
   - Verification approach: inner — review-state mutation/read-model tests; middle — export/readiness regression checks after invalidation semantics change; outer — manual cross-phase review walkthrough; see `memory/SPEC.md` §Verification Design.
   - Traceability: → Requirements 11, 12, 13; Assumptions A15, A40, A44; Invariants I72, I87.

2. **Drizzle Kit audit remediation** — hardening `[status: not-started]`
   - Objective: move off the vulnerable `drizzle-kit` loader chain without regressing the packaged app, migrations, or studio workflow.
   - Why now / unlocks: remains an independent dependency-risk seam that can run once the current product-facing refinement wave is staffed.
   - Verification approach: inner — dependency tree, config-load, and migration smoke checks; outer — manual `npm run studio` walkthrough against an existing project; see `memory/SPEC.md` §Verification Design.
   - Traceability: → Requirement 1; Invariants I4, I100.

3. **Edit mode + cascade preview** — bounded feature `[status: not-started]`
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

- 2026-04-14 — **Routing & layout refactor** — Done: directory routes, three layout shells, per-phase views, entity sidebar relocation, and graph-view entry all shipped. Verified: `npm run verify`. Watch: graph view is still intentionally shallow.
- 2026-04-14 — **Trusted fixture hardening + capture-backed corpus** — Done: runtime-shaped manifests now drive seeding and observer probes through one trusted seam. Verified: `npm run verify`. Watch: walkthrough coverage still needs broader seeded scenarios.
- 2026-04-14 — **Distribution + brownfield kickoff baseline** — Done: local-first launch flow and first-pass brownfield exploration shipped. Verified: `npm run verify`. Watch: kickoff grounding and observer handoff remain too shallow for feature-area work.

Older history: `docs/archive/PLAN_HISTORY.md`

## Dependencies

```text
fixture-backed-walkthrough-workspace ──→ story-first-phase-and-transcript-patterns ─┐
                                                                                     ├──→ transcript-fidelity-and-in-flight-status-surfaces ──→ review-lifecycle-refinement
router-query-ownership-refinement-for-interview-surfaces ────────────────────────────┘

brownfield-kickoff-rehabilitation ─────────────────────────────────────────────────── independent active lane

drizzle-kit-audit-remediation ─────────────────────────────────────────────────────── independent next lane

edit-mode-cascade-preview ──→ cascade-execution-secondary-thread-lifecycle
```
