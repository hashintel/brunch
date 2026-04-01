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
   - Assumptions: → SPEC.md §Assumptions A5 (validated), A11 (workaround validated), A12 (validated)
   - Invariants established: → SPEC.md §Invariants I5, I6
   - Invariants respected: → SPEC.md §Invariants I1, I2, I3
   - Acceptance: create project, send message, refresh page, see history, continue conversation
   - Branch: `ln/fe-535-sqlite-persistence`

## Phase 2: Turn Model + Extraction

<!-- Migrate from flat chat to the turn-tree schema. Retire the two highest-risk
     assumptions (A14: observer fidelity, A13: SDK skills) before building the
     full interview flow. -->

### Spikes

1. **Observer extraction fidelity** — Can the LLM reliably extract decisions, assumptions, and dependency edges from a single turn's Q&A? Test with realistic fixture turns across different question types (scope, design, constraints). Measure extraction consistency across runs. `not-started`
   - Assumptions: → SPEC.md §Assumptions A14, A3
   - Time box: 2 hours
   - Success: ≥80% of expected entities captured with correct dependency edges across 5+ fixture turns

### Slices

3. **Turn tree schema + API** `FE-544` — Migrate from message table to the full schema.dbml model (turn, option, decision, assumption, requirement, criterion + all join tables). Update API: POST /api/chat creates turns, GET /api/projects/current returns turns on the active path. Project gets `active_turn_id`. Tests verify turn tree CRUD and active path resolution. `done`
   - Requirements: → SPEC.md §Requirements #14
   - Assumptions: → SPEC.md §Assumptions A6
   - Invariants established: → SPEC.md §Invariants I6 (updated), I9, I10
   - Invariants respected: → SPEC.md §Invariants I1, I2, I3
   - Acceptance: create project, create turns with parent chain, resolve active path, close and reopen with state intact
   - Branch: `ln/fe-544-turn-tree-schema`

3b. **Rich chat UI: tool calls + reasoning rendering** `FE-541` — Extend SSE adapter to emit `tool-call-streaming-start`, `tool-call-delta`, `tool-call`, and `tool-result` events for SDK `tool_use` content blocks. Install AI Elements components (`Tool`, `Reasoning`, `ChainOfThought`, `Message`, `PromptInput`) via `npx ai-elements`, restyle to match brunch design. Replace hand-rolled `App.tsx` message rendering with part-type switching (`text`, `reasoning`, `tool-{name}`, `step-start`). Establish user-testability for the streaming pipeline per verification policy — all part types visible in browser. `not-started`
    - Requirements: → SPEC.md §Requirements #4
    - Assumptions: → SPEC.md §Assumptions A16, A17
    - Invariants to establish: → SPEC.md §Invariants I7, I8
    - Invariants to respect: → SPEC.md §Invariants I1, I2, I3
    - Acceptance: `npm run dev`, send a message that triggers tool use, see tool call with state transitions (pending → running → completed/error), see reasoning in collapsible block, all rendered via AI Elements components. SSE adapter tests cover tool_use content blocks.
    - Branch: `ln/fe-541-rich-chat-ui`

4. **Structured interview: scope phase** — Replace flat chat with structured turns. Implement the scope phase as an agent skill — the agent generates a question with options, grounding ("why this matters"), and impact signal. User selects an option or types a response. Turn persists with phase provenance. UI renders the turn card (question + options + grounding). `not-started`
   - Requirements: → SPEC.md §Requirements #2, #3
   - Assumptions: → SPEC.md §Assumptions A7, A13
   - Invariants to respect: → SPEC.md §Invariants I1, I2, I3, I5, I6
   - Acceptance: start a project, agent asks structured scope questions with options and grounding, user answers, turns persist with parent chain

5. **Observer agent + entity persistence** — After each answered turn, a second agent call extracts decisions and assumptions. Writes to decision/assumption tables with turn linkage (turn_decision, turn_assumption) and dependency edges (decision_parent_decision, decision_parent_assumption, assumption_parent_assumption). `not-started`
   - Requirements: → SPEC.md §Requirements #5
   - Assumptions: → SPEC.md §Assumptions A3, A4, A14 (validated by spike)
   - Acceptance: answer a scope question, observer extracts decision + assumptions, dependency edges visible in DB, extraction completes within user think time

6. **Decision + assumption dashboard** — React sidebar showing decisions and assumptions on the active path. Updates after each observer extraction. Dependency edges visible (what does this decision depend on?). `not-started`
   - Requirements: → SPEC.md §Requirements #6
   - Assumptions: —
   - Acceptance: entities appear in categorized lists as interview progresses, dependency links navigable

## Phase 3: Full Interview

<!-- All four phases working end-to-end. Phase transitions, resolution, and the review phases
     for requirements and criteria. The product becomes usable. -->

### Slices

7. **Phase transition + resolution** — Interviewing agent judges when scope phase is complete (is_resolution). Summary presented to user. User confirms to advance. UI shows phase completion state. `not-started`
   - Requirements: → SPEC.md §Requirements #7, #8
   - Assumptions: → SPEC.md §Assumptions A15
   - Acceptance: agent marks resolution, summary shows, user confirms, UI reflects phase completion

8. **Design drill-down phase** — Second agent skill. Walks the design tree with structured questions. Decisions extracted by observer. Continues until agent judges resolution. `not-started`
   - Requirements: → SPEC.md §Requirements #2, #3
   - Assumptions: → SPEC.md §Assumptions A13 (validated by slice 4)
   - Acceptance: design questions with options, decisions extracted and shown in dashboard, agent resolves when understanding is reached

9. **Requirements review phase** — Third agent skill. Walks accumulated requirements list. Agent checks for gaps, proposes additions. User confirms each. Requirements get `reviewed_at` stamped. `not-started`
   - Requirements: → SPEC.md §Requirements #11
   - Assumptions: —
   - Acceptance: agent presents requirements, suggests gaps, user confirms, reviewed_at updated

10. **Criteria phase** — Fourth agent skill. For each confirmed requirement, agent proposes testable criteria. User selects/edits/confirms. Criteria get `reviewed_at` stamped. `not-started`
    - Requirements: → SPEC.md §Requirements #12
    - Assumptions: —
    - Acceptance: agent proposes criteria per requirement, user confirms, spec readiness predicate evaluable

## Phase 4: Revisit + Export

<!-- Decision revisit (branch forking), soft invalidation, and spec export.
     The product is complete when all phases are resolved and export works. -->

### Slices

11. **Decision revisit: turn tree branching** — Navigate to a previous decision in the dashboard. Fork a new branch from the source turn. Move HEAD. Abandoned branches can be restored (move HEAD back). Active path recomputation. `not-started`
    - Requirements: → SPEC.md §Requirements #9, #10
    - Assumptions: → SPEC.md §Assumptions A6
    - Acceptance: revisit a decision, new branch created, interview resumes from fork point, abandon returns to previous path

12. **Soft invalidation** — When HEAD moves to a new branch, requirements traced to superseded decisions are flagged (stale reviewed_at). Criteria inherit flag transitively. Dashboard shows invalidation state. Re-entering requirements/criteria phase re-qualifies flagged entities. `not-started`
    - Requirements: → SPEC.md §Requirements #9
    - Assumptions: —
    - Acceptance: fork a branch, requirements show "needs review" state, re-review clears flags

13. **Spec export** — Render markdown spec from active path entities (decisions, assumptions, requirements, criteria). Export enabled only when spec readiness predicate is true (all phases resolved + reviewed). Download button. `not-started`
    - Requirements: → SPEC.md §Requirements #13
    - Assumptions: —
    - Acceptance: complete all phases, click export, markdown downloads with all active-path entities

## Phase 5: Distribution

<!-- Package and ship. -->

### Slices

14. **npx distribution** — `bin` entry, launcher starts Express (serves built Vite assets + API on one port), opens browser. Single env var: `ANTHROPIC_API_KEY`. `not-started`
    - Requirements: → SPEC.md §Requirements #1
    - Assumptions: → SPEC.md §Assumptions A8 (validated)
    - Acceptance: `npx brunch` with key in scope opens working app

## Horizon

<!-- Future work not yet broken into slices. Revisit after Phase 5. -->

- Exploratory pathway (for projects where the goal itself is unclear)
- Multi-provider support via AI SDK server-side (if Claude Agent SDK becomes limiting)
- Entity editing outside interview flow (direct CRUD on dashboard)
- Export to GitHub Issues, Linear, YAML task definitions
- Assumption graph visualization (explore dependency chains)
- Decision graph visualization (tree/DAG view)
- Project dashboard with phase completion overview (→ SPEC.md §Requirements #15)

## Dependencies

<!-- Blocking relationships between slices. Update when slices are added or retired. -->

```
Phase 1:  1 (skeleton) ──→ 2 (SQLite)
Phase 2:  2 ──→ 3 (turn schema) ──→ 3b (rich chat UI) ──→ 4 (scope interview)
          spike (observer) ──→ 5 (observer agent)
          3 ──→ 5 (observer agent) ──→ 6 (dashboard)
          4 ──→ 5
Phase 3:  6 ──→ 7 (transitions) ──→ 8 (design) ──→ 9 (requirements) ──→ 10 (criteria)
Phase 4:  6 ──→ 11 (branching) ──→ 12 (invalidation)
          10 ──→ 13 (export)
Phase 5:  13 ──→ 14 (npx)
```

### Parallelism opportunities

- Slice 3b (rich chat UI) and observer spike can proceed in parallel after slice 3 lands
- Slice 6 (dashboard) and slice 7 (transitions) can start in parallel once slice 5 lands
- Slice 11 (branching) can start after slice 6, independent of slices 7-10
- Slice 14 (npx) can start early with a basic launcher, completing after slice 13
