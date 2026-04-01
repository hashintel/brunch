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
   - Requirements: → SPEC.md §Requirements #1, #4
   - Assumptions: → SPEC.md §Assumptions A1, A2, A8, A10
   - Invariants established: → SPEC.md §Invariants I1, I2, I3, I4
   - Acceptance: `npm run dev` opens browser, type a message, see streamed response with visible thinking and text. `useChat` manages all state
   - Branch: `ln/fe-534-walking-skeleton`

2. **SQLite foundation + project persistence** `FE-535` — Replace Dolt with `better-sqlite3`. Basic persistence with project + message tables. Conversation history replay. `done`
   - Requirements: → SPEC.md §Requirements #14
   - Assumptions: → SPEC.md §Assumptions A5 (validated), A11 (validated), A12 (validated)
   - Invariants established: → SPEC.md §Invariants I5, I6
   - Invariants respected: → SPEC.md §Invariants I1, I2, I3
   - Acceptance: create project, send message, refresh page, see history, continue conversation
   - Branch: `ln/fe-535-sqlite-persistence`

## Phase 2: Architecture

<!-- Migrate to the turn-tree schema, then evolve the stack: Drizzle for migrations,
     core service layer for interface-agnostic logic, TanStack Router for client routing.
     Infrastructure that makes every subsequent slice cheaper. -->

### Slices

3. **Turn tree schema + API** `FE-544` — Migrate from message table to the full schema.dbml model (turn, option, decision, assumption, requirement, criterion + all join tables). Update API: POST /api/chat creates turns, GET /api/projects/current returns turns on the active path. Project gets `active_turn_id`. Tests verify turn tree CRUD and active path resolution. `done`
   - Requirements: → SPEC.md §Requirements #14
   - Assumptions: → SPEC.md §Assumptions A6
   - Invariants established: → SPEC.md §Invariants I6 (updated), I9, I10
   - Invariants respected: → SPEC.md §Invariants I1, I2, I3
   - Acceptance: create project, create turns with parent chain, resolve active path, close and reopen with state intact
   - Branch: `ln/fe-544-turn-tree-schema`

3c. **Drizzle ORM + core extraction** `FE-552` — Migrate raw DDL to Drizzle schema (`drizzle/schema.ts`) with migration runner. Extract interview orchestration from `app.ts` into `core.ts` — `conductTurn()` returns `AsyncIterable<DomainEvent>`. Express handler becomes a thin adapter translating DomainEvents to SSE. `done`
    - Requirements: → SPEC.md §Requirements #14
    - Assumptions: → SPEC.md §Assumptions A18 (validated), A19 (validated)
    - Decisions: → SPEC.md §Decisions D18, D19
    - Invariants established: → SPEC.md §Invariants I11, I12, I13
    - Invariants respected: → SPEC.md §Invariants I1, I2, I3, I5, I6, I9, I10
    - Acceptance: 51 tests pass (39 existing + 12 new core tests); Drizzle migrate() auto-applies at startup; conductTurn() yields DomainEvents consumed by Express adapter via createDomainAdapter()
    - Branch: `ln/fe-552-drizzle-core-extraction`

3d. **Multi-project routing** — Install `@tanstack/react-router`. Three client routes: project list (`/`), interview workspace (`/project/:id`), export preview (`/project/:id/export`). Route loaders replace `useEffect` hydration. Server API becomes project-scoped (`/api/projects/:id/...`). Project list page with phase badges. `not-started`
    - Requirements: → SPEC.md §Requirements #1, #15
    - Decisions: → SPEC.md §Decisions D9 (updated)
    - Invariants to respect: → SPEC.md §Invariants I1, I2, I3, I6, I9, I10
    - Acceptance: navigate between project list and interview workspace; create new project from list; project-scoped API routes work; route loaders fetch data on navigation
    - Ref: → docs/design/BREADBOARD.md §Places, §Wiring

## Phase 3: Interview Engine

<!-- Build the structured interview with observer extraction. Retire the two highest-risk
     assumptions (A14: observer fidelity, A13: SDK skills) before building the full flow.
     Rich chat UI comes first to establish the rendering foundation. -->

### Spikes

1. **Observer extraction fidelity** — Can the LLM reliably extract decisions, assumptions, and dependency edges from a single turn's Q&A? Test with realistic fixture turns across different question types (scope, design, constraints). Measure extraction consistency across runs. `not-started`
   - Assumptions: → SPEC.md §Assumptions A14, A3
   - Time box: 2 hours
   - Success: ≥80% of expected entities captured with correct dependency edges across 5+ fixture turns

### Slices

3b. **Rich chat UI: tool calls + reasoning rendering** `FE-541` — Extend SSE adapter to emit tool-call events for SDK `tool_use` content blocks. Install AI Elements components (`Tool`, `Reasoning`, `ChainOfThought`, `Message`, `PromptInput`) via `npx ai-elements`, restyle to match brunch design. Replace hand-rolled message rendering with part-type switching. `not-started`
    - Requirements: → SPEC.md §Requirements #4
    - Assumptions: → SPEC.md §Assumptions A16, A17
    - Invariants to establish: → SPEC.md §Invariants I7, I8
    - Invariants to respect: → SPEC.md §Invariants I1, I2, I3
    - Acceptance: send a message that triggers tool use, see tool call with state transitions, reasoning in collapsible block, all via AI Elements. SSE adapter tests cover tool_use content blocks.
    - Branch: `ln/fe-541-rich-chat-ui`

4. **Structured interview: scope phase** — Replace flat chat with structured turns. Implement the scope phase as an agent skill — the agent generates a question with options, grounding ("why this matters"), and impact signal. User selects an option or types a response. Turn persists with phase provenance. UI renders the turn card (question + options + grounding). `not-started`
   - Requirements: → SPEC.md §Requirements #2, #3
   - Assumptions: → SPEC.md §Assumptions A7, A13
   - Invariants to respect: → SPEC.md §Invariants I1, I2, I3, I5, I6
   - Acceptance: start a project, agent asks structured scope questions with options and grounding, user answers, turns persist with parent chain

5. **Observer agent + entity persistence** — After each answered turn, core invokes a second agent call that extracts decisions and assumptions. Writes to decision/assumption tables with turn linkage and dependency edges. Core yields `observer-complete` DomainEvent; web adapter signals client to refetch entities. `not-started`
   - Requirements: → SPEC.md §Requirements #5
   - Assumptions: → SPEC.md §Assumptions A3, A4, A14 (validated by spike)
   - Acceptance: answer a scope question, observer extracts decision + assumptions, dependency edges in DB, extraction within user think time, sidebar refetch triggered

6. **Entity sidebar (read-only)** — React sidebar in interview workspace showing decisions, assumptions, requirements, and criteria on the active path. Tabbed display. Updates after each observer extraction via `observer-complete` event. Dependency edges visible. Stale badges for soft-invalidated entities. `not-started`
   - Requirements: → SPEC.md §Requirements #6
   - Assumptions: —
   - Invariants to respect: → SPEC.md §Invariants I9, I10
   - Acceptance: entities appear in categorized tabs as interview progresses, dependency links navigable, stale badges render correctly
   - Ref: → docs/design/BREADBOARD.md §UI Affordances → P2 Entity sidebar

## Phase 4: Full Interview

<!-- All four phases working end-to-end. Phase transitions, resolution, and the review phases
     for requirements and criteria. The product becomes usable. -->

### Slices

7. **Phase transition + resolution** — Agent judges when scope phase is complete (`is_resolution`). Core yields `phase-resolved` DomainEvent. Client shows summary modal. User confirms to advance. Phase indicator updates. `not-started`
   - Requirements: → SPEC.md §Requirements #7, #8
   - Assumptions: → SPEC.md §Assumptions A15
   - Acceptance: agent marks resolution, summary shows, user confirms, phase indicator reflects completion

8. **Design drill-down phase** — Second agent skill. Walks the design tree with structured questions. Decisions extracted by observer. Continues until agent judges resolution. `not-started`
   - Requirements: → SPEC.md §Requirements #2, #3
   - Assumptions: → SPEC.md §Assumptions A13 (validated by slice 4)
   - Acceptance: design questions with options, decisions extracted and shown in sidebar, agent resolves when understanding is reached

9. **Requirements review phase** — Third agent skill. Walks accumulated requirements list. Agent checks for gaps, proposes additions. User confirms each. Requirements get `reviewed_at` stamped. `not-started`
   - Requirements: → SPEC.md §Requirements #11
   - Assumptions: —
   - Acceptance: agent presents requirements, suggests gaps, user confirms, reviewed_at updated

10. **Criteria phase** — Fourth agent skill. For each confirmed requirement, agent proposes testable criteria. User selects/edits/confirms. Criteria get `reviewed_at` stamped. `not-started`
    - Requirements: → SPEC.md §Requirements #12
    - Assumptions: —
    - Acceptance: agent proposes criteria per requirement, user confirms, spec readiness predicate evaluable

## Phase 5: Revisit + Export

<!-- Decision revisit (branching), entity lifecycle (sidebar writes), soft invalidation,
     and spec export. The product is complete. -->

### Slices

11. **Decision revisit: branch + checkout** — Click "revisit" on a decision in the sidebar → confirmation → `POST /api/projects/:id/branch` → HEAD moves to fork point → conversation rewinds → stale entities leave active path (path exclusion). Branch dropdown shows available branches. Checkout to switch. `not-started`
    - Requirements: → SPEC.md §Requirements #9, #10
    - Assumptions: → SPEC.md §Assumptions A6
    - Decisions: → SPEC.md §Decisions D17 (path exclusion)
    - Acceptance: revisit a decision, new branch created, interview resumes from fork point, checkout returns to previous path
    - Ref: → docs/design/BREADBOARD.md §Wiring → Decision revisit

12. **Entity lifecycle API** — CRUD + review + verify/falsify endpoints for sidebar writes. `PUT .../assumptions/:id` with action (verify/falsify/update) triggers flag propagation per D17. `PUT .../requirements/:id` cascades to criteria. `PUT .../requirements/:id/review` and `.../criteria/:id/review` stamp `reviewed_at`. `not-started`
    - Requirements: → SPEC.md §Requirements #9, #11, #12
    - Decisions: → SPEC.md §Decisions D17 (flag propagation)
    - Acceptance: falsify an assumption → dependent entities flagged; edit a requirement → criteria flagged; review stamps reviewed_at
    - Ref: → docs/design/BREADBOARD.md §Code Affordances → Entity lifecycle

13. **Spec export** — Render markdown spec from active path entities (decisions, assumptions, requirements, criteria). Export route (`/project/:id/export`) shows preview. Download button. Enabled only when spec readiness predicate is true (all phases resolved + reviewed). `not-started`
    - Requirements: → SPEC.md §Requirements #13
    - Assumptions: —
    - Acceptance: complete all phases, navigate to export, markdown preview with all active-path entities, download .md file
    - Ref: → docs/design/BREADBOARD.md §Places → P3

## Phase 6: Distribution

<!-- Package and ship. -->

### Slices

14. **npx distribution + CLI** — `bin` entry, launcher starts Express (serves built Vite assets + API on one port), opens browser. `npx brunch` for web UI. `npx brunch [command]` for CLI operations. Single env var: `ANTHROPIC_API_KEY`. `not-started`
    - Requirements: → SPEC.md §Requirements #1
    - Assumptions: → SPEC.md §Assumptions A8 (validated)
    - Decisions: → SPEC.md §Decisions D20
    - Acceptance: `npx brunch` with key in scope opens working app

## Horizon

<!-- Future work not yet broken into slices. Revisit after Phase 6. -->

- CLI interactive interview mode (terminal-based interview using core's DomainEvent stream)
- MCP server adapter (expose core operations as MCP tools)
- Turn tree visualization (git-log-style branch graph in sidebar)
- Entity graph visualization (decision + assumption DAG view)
- Exploratory pathway (for projects where the goal itself is unclear)
- Multi-provider support via AI SDK server-side (if Claude Agent SDK becomes limiting)
- Export to GitHub Issues, Linear, YAML task definitions

## Dependencies

<!-- Blocking relationships between slices. Update when slices are added or retired. -->

```
Phase 1:  1 (skeleton) ──→ 2 (SQLite)
Phase 2:  2 ──→ 3 (turn schema) ──→ 3c (Drizzle+core) ──→ 3d (routing)
Phase 3:  3c ──→ 3b (rich chat UI) ──→ 4 (scope interview) ──→ 5 (observer)
          spike (observer fidelity) ──→ 5
          3d + 5 ──→ 6 (entity sidebar)
Phase 4:  6 ──→ 7 (transitions) ──→ 8 (design) ──→ 9 (requirements) ──→ 10 (criteria)
Phase 5:  6 ──→ 11 (branching)
          6 ──→ 12 (entity lifecycle API)
          10 ──→ 13 (export)
Phase 6:  13 ──→ 14 (npx + CLI)
```

### Parallelism opportunities

- Slice 3b (rich chat UI) and 3d (routing) can proceed in parallel after 3c lands
- Observer spike can proceed any time after slice 3 — independent of 3c/3d
- Slice 7 (transitions) and 11 (branching) can start in parallel once slice 6 lands
- Slice 12 (entity lifecycle API) can proceed in parallel with slice 11
- Slice 14 (npx) can start early with a basic launcher, completing after slice 13
