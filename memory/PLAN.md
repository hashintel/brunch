<!-- PLAN.md — single source of truth for WHAT we're doing next.
     Created by ln-plan · Read by all skills · Updated by ln-sync, ln-build, ln-spike.
     Authority: phases, slices, spikes, ordering, status, and traceability to SPEC.md.

     Re-run ln-plan frequently to retire completed slices, occasionally to add new ones.
     Every slice and spike names its dependent requirements and assumptions from SPEC.md.
     Invalidating an assumption in SPEC surfaces every slice it touches here. -->

# Plan

<!-- Phases are temporal groups, ordered. Within each phase, slices and spikes are ordered
     by uncertainty first, dependency second (retire risk early).
     Status: not-started | in-progress | done -->

## Phase 1: Foundation

<!-- Prove the stack works end-to-end, then add persistence. All subsequent phases depend on this. -->

### Slices

1. **Walking skeleton: SDK → SSE → React** `FE-534` — Prove the integration seam: the highest-uncertainty slice, retires the most risk. `done`
   - Requirements: → SPEC.md §Requirements #1, #3
   - Assumptions: → SPEC.md §Assumptions A1, A2, A8, A10
   - Invariants established: → SPEC.md §Invariants I1, I2, I3, I4
   - Acceptance: `npm run dev` opens browser, type a message, see streamed response with visible thinking and text. `useChat` manages all state
   - Blocks: all subsequent slices
   - Branch: `ln/fe-534-walking-skeleton`

2. **SQLite foundation + project persistence** `FE-535` — Replace Dolt with `better-sqlite3`. Schema: `project`, `interview_exchange`, `spec_output`. Auto-create DB on startup. Session CRUD. Resume via Claude Agent SDK `resume`. `not-started`
   - Requirements: → SPEC.md §Requirements #9
   - Assumptions: → SPEC.md §Assumptions A5
   - Invariants to establish: DB lifecycle (create → persist → close → reopen → intact)
   - Invariants to respect: → SPEC.md §Invariants I1, I2, I3
   - Acceptance: create project, close browser, reopen, resume conversation
   - Branch: `ln/fe-535-sqlite-persistence`

## Phase 2: Interview Core

<!-- Basic interview loop with entity extraction and dashboard. The product becomes usable. -->

### Slices

3. **Interview Phase 1: scope establishment** `FE-536` — System prompt drives scope elicitation. LLM presents structured questions with options. Exchanges stored in `interview_exchange`. `not-started`
   - Requirements: → SPEC.md §Requirements #2, #5
   - Assumptions: → SPEC.md §Assumptions A7
   - Acceptance: user describes goal, LLM asks structured scope questions, exchanges persisted
   - Branch: `ln/fe-536-interview-phase-1`

4. **Entity extraction pipeline** `FE-537` — After each exchange, separate `queryStructured` call extracts entities. Materialize into entity tables. Emit `data-entities` SSE event. `not-started`
   - Requirements: → SPEC.md §Requirements #4
   - Assumptions: → SPEC.md §Assumptions A3, A4
   - Acceptance: entity dashboard shows extracted items within 1-3s of answering
   - Branch: `ln/fe-537-entity-extraction`

5. **Entity dashboard UI** `FE-538` — React sidebar showing accumulated entities by type. Updates live via `data-entities` events. Read-only. `not-started`
   - Requirements: → SPEC.md §Requirements #4
   - Assumptions: —
   - Acceptance: entities appear in categorized lists as interview progresses
   - Branch: `ln/fe-538-entity-dashboard`

## Phase 3: Full Interview Flow

<!-- All interview phases, transitions, side-channel. The interview experience is complete. -->

### Slices

6. **Phase transition: scope → design** `FE-539` — LLM proposes transition with summary. User confirms. Phase stored on project. Dashboard shows indicator. `not-started`
   - Requirements: → SPEC.md §Requirements #7
   - Assumptions: —
   - Acceptance: LLM summarizes scope, user confirms, design phase begins
   - Branch: `ln/fe-539-phase-transition`

7. **Interview Phase 2: design tree exploration** `FE-540` — LLM works down design tree with structured questions. Decisions extracted and materialized. `not-started`
   - Requirements: → SPEC.md §Requirements #2, #5
   - Assumptions: —
   - Acceptance: design questions with options, decisions in dashboard
   - Branch: `ln/fe-540-interview-phase-2`

8. **Freeform side-channel** `FE-541` — "Ask about this" escape hatch. Separate `useChat` scoped to current question. Doesn't pollute main transcript. `not-started`
   - Requirements: → SPEC.md §Requirements #6
   - Assumptions: —
   - Acceptance: digress, get answer, return to main flow unchanged
   - Branch: `ln/fe-541-side-channel`

9. **Interview Phase 3: acceptance criteria validation** `FE-542` — LLM surfaces criteria, proposes additions, walks risks. `acceptance_criterion` and `risk` tables populated. `not-started`
   - Requirements: → SPEC.md §Requirements #2
   - Assumptions: —
   - Acceptance: criteria and risks appear in dashboard after validation
   - Branch: `ln/fe-542-interview-phase-3`

## Phase 4: Distribution

<!-- Export, versioning, and packaging. The product ships. -->

### Slices

10. **Spec export** `FE-543` — Flatten entity state to markdown. LLM generates from entities + exchanges. Download button. `not-started`
    - Requirements: → SPEC.md §Requirements #8, #10
    - Assumptions: —
    - Acceptance: click export, markdown downloads. Re-export after changes updates spec
    - Branch: `ln/fe-543-spec-export`

11. **Snapshot versioning** `FE-544` — `project_snapshot` table. Auto-snapshot at phase transitions. Restore from previous. `not-started`
    - Requirements: → SPEC.md §Requirements #10
    - Assumptions: → SPEC.md §Assumptions A6
    - Acceptance: snapshot, change, restore, state reverts
    - Branch: `ln/fe-544-snapshot-versioning`

12. **npx distribution** `FE-545` — `bin` entry, launcher script, single port, opens browser. Single env var: `ANTHROPIC_API_KEY`. `not-started`
    - Requirements: → SPEC.md §Requirements #1
    - Assumptions: → SPEC.md §Assumptions A8
    - Acceptance: `npx brunch` with key in scope opens working app
    - Branch: `ln/fe-545-npx-distribution`

## Phase 5: Horizon

<!-- Future work not yet broken into slices. Revisit after Phase 4. -->

- Pre-prompting phase (Phase 0) — category-narrowing quiz
- Decision DAG tracking (join tables, graph visualization)
- Assumption↔decision links and belief invalidation
- Multi-provider support via AI SDK server-side (if Claude Agent SDK becomes limiting)
- Entity editing outside interview flow (direct CRUD on dashboard)
- Export to GitHub Issues, Linear, YAML task definitions

## Dependencies

<!-- Blocking relationships between slices. Update when slices are added or retired. -->

```
Phase 1:  1 (skeleton) ──→ 2 (SQLite)
Phase 2:  2 ──→ 3 (scope) ──→ 4 (extraction) ──→ 5 (dashboard)
Phase 3:  5 ──→ 6 (transition) ──→ 7 (design) ──→ 9 (criteria)
          3 ──→ 8 (side-channel) [independent after 3]
Phase 4:  9 ──→ 10 (export)
          2+5 ──→ 11 (snapshots) [independent after 2+5]
          10 ──→ 12 (npx) [or parallelizable earlier]
```

### Parallelism opportunities

- Slices 8 (side-channel) and 6-7 (phase transition + design) can run in parallel after slice 5
- Slice 11 (snapshots) can run in parallel with slices 6-10
- Slice 12 (npx) can start as soon as slice 1 is done (basic launcher), with full completion after slice 10
