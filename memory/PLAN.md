<!-- PLAN.md — single source of truth for the live frontier.
     Created by ln-plan · Read by all skills · Updated by ln-build and ln-sync.
     Older completed work lives in docs/archive/PLAN_HISTORY.md. -->

# Plan

## Active

This wave now treats Brunch as a **structured interview workspace**, not a generic chat interface. Scope/design use active-turn cards; requirements/criteria use review sets; and phase entry, handoff, and completion states may have no live turn at all. The first active slice should make that semantic contract truthful in the live app before deeper visual refinement.


1. **Workspace semantic shell scaffolding** — structural `[status: not-started]`
   - Objective: make the live workspace structurally honest in low fidelity: show the right data in the right places, expose the correct affordances, and make real interactions work even before final pattern/styling refinement.
   - Why now / unlocks: the walkthrough showed that the main problem is not visual polish but missing or misleading semantics — bare composer-only states, missing next actions, weak phase-state signaling, bad link behavior, and absent transcript/meta placeholders. Until the shell is truthful, later refinement risks polishing the wrong contract.
   - Acceptance: dashboard/project navigation behaves correctly; unopened phases are visible-but-disabled; unstarted phases are labeled truthfully; each phase exposes explicit entry / active / handoff / completion affordances; review phases visibly differ from active-turn phases; transcript/meta slots exist for the real artifacts and statuses even if rendered as rough placeholders.
   - Verification: inner — route/component tests for shell semantics, phase gating, and placeholder state projection. Outer — seeded walkthrough confirmation that the workspace no longer strands the user in empty or misleading states.
   - Verification approach: inner — focused route/sidebar/transcript-shell tests; outer — browser walkthrough on seeded kickoff, scope-closed, design-active, criteria-ready, and completed projects; see `memory/SPEC.md` §Verification Design.
   - Traceability: → Requirements 2, 4, 5, 8, 11, 12, 15, 17; Assumptions A51, A52, A53; Decisions D89, D90, D91, D92.

2. **Story-first interaction pattern refinement** — bounded feature `[status: not-started]`
   - Objective: refine the now-truthful shell into coherent reusable patterns inside `src/client/stories/`: kickoff entry states, active-turn cards, review-set layouts, handoff/completion states, and stronger left/right sidebar patterns.
   - Why now / unlocks: once the live app exposes the right moving parts, stories can improve real interaction contracts instead of inventing around missing behavior.
   - Acceptance: stories cover kickoff entry, active structured-question states, already-answered/current-turn states, review-set list states, handoff/completion states, and at least one stronger sidebar/navigation direction; adoption notes point back to routed app surfaces.
   - Verification: inner — story build / typecheck. Outer — design review against seeded walkthrough findings and the rough shell implementation.
   - Verification approach: inner — typed story-state fixtures and build checks; outer — dramaturgical review of active-turn, review-set, and phase-entry/handoff patterns against `docs/design/WAVE_2_FINDINGS.md`; see `memory/SPEC.md` §Verification Design.
   - Traceability: → Requirements 2, 4, 11, 12, 17; Assumptions A51, A52; Decisions D89, D90, D91.

3. **Router/query ownership refinement for interview surfaces** — structural `[status: not-started]`
   - Objective: replace coarse route-wide invalidation with deliberate loader/query ownership so observer and workflow refreshes stop tearing down more UI than necessary.
   - Why now / unlocks: this remains the main structural blocker independent of the interaction redesign; if kept narrow, it can proceed without absorbing transcript, kickoff, or review-set UX work.
   - Acceptance: workflow, entity, and phase-local interview data have explicit ownership boundaries; mutations refresh only the surfaces they own; routine chat-local freshness no longer depends on broad `router.invalidate()`.
   - Verification: inner — loader/query integration tests and mutation invalidation tests. Middle — route reload regression coverage. Outer — manual live-chat latency and refresh walkthroughs.
   - Verification approach: middle — route/query ownership contract tests that prove refresh boundaries stay local; outer — browser see-and-inspect review for perceived teardown, latency, and disappearance bugs; see `memory/SPEC.md` §Verification Design.
   - Traceability: → Requirements 5, 7, 14; Assumptions A20, A50; Decisions D22, D86, D87; Invariants I24, I102.

## Next

1. **Kickoff and phase-entry workspace adoption** — structural `[status: not-started]`
   - Objective: port the approved interaction patterns into the routed app so greenfield/brownfield kickoff, scope entry, and phase handoff states live in the project workspace instead of root-route modals or bare composer-only shells.
   - Why now / unlocks: this closes the most visible workflow-entry failure once story patterns settle and establishes the real home for the new active-turn model.
   - Verification approach: inner — routed kickoff/sidebar state tests; outer — manual walkthrough of new project greenfield/brownfield plus `issue-tracker-kickoff-ready` and `issue-tracker-scope-closed`; see `memory/SPEC.md` §Verification Design.
   - Traceability: → Requirements 2, 3, 17; Assumptions A47, A51; Decisions D82, D83, D89, D91.

2. **Transcript fidelity and durable live-artifact placeholders** — structural `[status: not-started]`
   - Objective: make the main workspace transcript faithfully render interviewer-side history and preserve inert placeholders for live-only thinking/tool-use artifacts across hydration, replay, and phase filtering.
   - Why now / unlocks: the walkthrough showed that transcript trust is still broken even when phase filtering works; this should follow once interaction patterns are clearer and route ownership is less coarse.
   - Verification approach: middle — replay/hydration assertions plus placeholder persistence checks; outer — manual transcript review on seeded design/criteria/completed scenarios; see `memory/SPEC.md` §Verification Design.
   - Traceability: → Requirements 4, 5, 14; Assumption A53; Decisions D24, D30, D57, D92; Invariants I24, I44.

3. **Review-set implementation across requirements + criteria** — bounded feature `[status: not-started]`
   - Objective: replace repeated micro-interview review turns with synthesized per-item approve / reject / comment lists plus list-level confirmation in requirements and criteria.
   - Why now / unlocks: the spec now treats review as a distinct interaction family; this should follow once story patterns define the review-set shape and transcript/state ownership stops shifting underneath it.
   - Verification approach: inner — review-state mutation/read-model tests; middle — export/readiness regression checks after review-set transitions change; outer — manual requirements/criteria walkthrough on seeded projects; see `memory/SPEC.md` §Verification Design.
   - Traceability: → Requirements 11, 12, 13, 17; Assumptions A44, A52; Decisions D90; Invariants I72, I87.

4. **Brownfield kickoff typed grounding transport** — structural `[status: conditional]`
   - Objective: if workspace kickoff walkthroughs still show the current prompt-shaped handoff is brittle, move kickoff grounding into an explicit typed transport that persists repo findings separately from the first scope turn's `why` field.
   - Why now / unlocks: the merged kickoff repair is good enough for now, but typed grounding may still be warranted after the new kickoff workspace flow lands.
   - Verification approach: middle — persistence/hydration round-trips for typed grounding artifacts; outer — qualitative brownfield walkthrough confirming the first scope turn still feels grounded; see `memory/SPEC.md` §Verification Design.
   - Traceability: → Requirements 3, 14, 16; Assumption A47; Decisions D24, D32, D83, D91; Invariants I44, I101.

5. **Drizzle Kit audit remediation** — hardening `[status: not-started]`
   - Objective: move off the vulnerable `drizzle-kit` loader chain without regressing the packaged app, migrations, or studio workflow.
   - Why now / unlocks: remains an independent dependency-risk seam that can run once the current product-facing refinement wave is staffed.
   - Verification approach: inner — dependency tree, config-load, and migration smoke checks; outer — manual `npm run studio` walkthrough against an existing project; see `memory/SPEC.md` §Verification Design.
   - Traceability: → Requirement 1; Invariants I4, I100.

6. **Edit mode + cascade preview** — bounded feature `[status: not-started]`
   - Objective: let the user enter edit mode from the ViewLayout knowledge surface, select knowledge items, and see an accurate cascade preview before any mutation is committed.
   - Why now / unlocks: remains the next user-facing revisit affordance once the current interview-surface refinement wave settles.
   - Verification approach: inner — graph traversal and preview projection tests; outer — manual edit-mode walkthrough in chat and graph views; see `memory/SPEC.md` §Verification Design.
   - Traceability: → Requirement 10; Assumptions A48, A50; Decisions D80, D86; Invariants I48, I102.

## Horizon

- **Cascade execution + secondary thread lifecycle** — structural follow-on after preview-only revisit is stable.
- **Dashboard/result summaries and completeness metrics** — once workflow entry, review, and transcript trust are no longer masking basic usability.
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
workspace-semantic-shell-scaffolding ─┬──→ story-first-interaction-pattern-refinement
                                       ├──→ kickoff-and-phase-entry-workspace-adoption
                                       ├──→ transcript-fidelity-and-durable-live-artifact-placeholders
                                       └──→ review-set-implementation-across-requirements-and-criteria

story-first-interaction-pattern-refinement ─┬──→ kickoff-and-phase-entry-workspace-adoption
                                             ├──→ transcript-fidelity-and-durable-live-artifact-placeholders
                                             └──→ review-set-implementation-across-requirements-and-criteria

router-query-ownership-refinement-for-interview-surfaces ──→ transcript-fidelity-and-durable-live-artifact-placeholders

kickoff-and-phase-entry-workspace-adoption ──→ brownfield-kickoff-typed-grounding-transport (conditional if kickoff still feels brittle)

drizzle-kit-audit-remediation ───────────────────────────────────────────────────── independent next lane

edit-mode-cascade-preview ──→ cascade-execution-secondary-thread-lifecycle
```
