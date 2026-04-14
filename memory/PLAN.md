<!-- PLAN.md — single source of truth for the live frontier.
     Created by ln-plan · Read by all skills · Updated by ln-build and ln-sync.
     Older completed work lives in docs/archive/PLAN_HISTORY.md. -->

# Plan

## Active

1. **Drizzle Kit audit remediation** — hardening `[status: not-started]`
   - Objective: move off the vulnerable `drizzle-kit` loader chain without regressing the packaged app, migrations, or studio workflow.
   - Why now / unlocks: clears the current dependency-risk seam before more packaging and operational hardening stack on top of it.
   - Acceptance: chosen `drizzle-kit` version removes the vulnerable dependency path, keeps `drizzle.config.ts` compatible, preserves the existing SQLite migration history, and leaves `npm run studio` working.
   - Verification: inner — dependency tree / audit check plus config-load and migration smoke tests. Outer — manual `npm run studio` walkthrough against an existing local project.
   - Traceability: → Requirement 1; Invariants I4, I100.

2. **Review lifecycle refinement across requirements + criteria** — bounded feature `[status: not-started]`
   - Objective: add the deferred richer review actions and stale / invalidation semantics across requirements and criteria without regressing the thin end-to-end workflow.
   - Why now / unlocks: completes the thin review model before revisit work starts depending on invalidation and re-resolution behavior.
   - Acceptance: richer review actions can land behind one cross-cutting refinement pass, and completion / export / workflow-state coherence still hold.
   - Verification: inner — review-state mutation and read-model tests. Outer — manual cross-phase review walkthrough in the routed phase views.
   - Traceability: → Requirements 11, 12, 13; Assumptions A15, A40, A44; Invariants I72, I87.

## Next

1. **Edit mode + cascade preview** — bounded feature `[status: not-started]`
   - Objective: let the user enter edit mode from the ViewLayout knowledge surface, select knowledge items, and see an accurate cascade preview before any mutation is committed.
   - Why now / unlocks: proves the user-facing revisit affordance and de-risks cascade execution before secondary-thread lifecycle work lands.
   - Acceptance: selecting items shows affected downstream knowledge and reopened phases, and exiting without confirmation leaves project state unchanged.
   - Verification: inner — graph traversal and preview projection tests. Outer — manual edit-mode walkthrough in chat and graph views.
   - Traceability: → Requirement 10; Assumptions A48, A50; Decisions D80, D86; Invariants I48, I102.

2. **Cascade execution + secondary thread lifecycle** — structural `[status: not-started]`
   - Objective: confirming a cascade writes invalidation state, reopens affected phases, and spawns a modal secondary thread that can re-resolve the affected knowledge.
   - Why now / unlocks: turns preview-only revisit into a full recovery loop and restores export viability after upstream changes.
   - Acceptance: confirmed cascade creates a coherent secondary thread, reopened phases can be re-closed after resolution, and export becomes valid again when the work is complete.
   - Verification: inner — secondary-thread lifecycle and invalidation tests. Middle — round-trip project-state reload tests. Outer — manual revisit walkthrough.
   - Traceability: → Requirement 10; Assumptions A48, A49; Decision D80; Invariants I48, I72.

## Horizon

- MCP server adapter for core operations.
- Exploratory pathway for users whose goal itself is unclear.
- Hard turn-tree branching UX beyond the linked-list substrate.
- Git-friendly file-based persistence representation for diffable specs.
- Headless interview driver for scripted end-to-end probes.
- More granular caching if layout-level `router.invalidate()` becomes too coarse.

## Recently Completed

- 2026-04-13 — **Routing & layout refactor** — Done: directory routes, three layout shells, per-phase views, sidebar relocation, and graph-view stub shipped. Verified: `npm run verify`. Watch: graph view is still a stub.
- 2026-04-13 — **Fixture hardening + capture-backed corpus** — Done: trusted runtime-shaped manifests now drive both seeding and observer probes. Verified: `npm run verify`. Watch: curated manual captures still need expansion over time.
- 2026-04-13 — **Typing hygiene** — Done: Zod now stays at LLM and HTTP boundaries instead of mirrored internal seams. Verified: `npm run verify`. Watch: none.

Older history: `docs/archive/PLAN_HISTORY.md`

## Dependencies

```
review-lifecycle-refinement ───────────────┐
                                           ├─ independent active work
drizzle-kit-audit-remediation ─────────────┘

edit-mode-cascade-preview ──→ cascade-execution-secondary-thread
```
