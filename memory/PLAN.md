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

3d. **Multi-project routing** `FE-553` — TanStack Router with three routes: project list (`/`), interview workspace (`/project/:id`), export preview placeholder (`/project/:id/export`). Route loaders replace `useEffect` hydration. Server API project-scoped (`/api/projects`, `/api/projects/:id`, `/api/projects/:id/chat`). `done`
    - Requirements: → SPEC.md §Requirements #1, #15
    - Decisions: → SPEC.md §Decisions D9 (updated)
    - Invariants established: → SPEC.md §Invariants I14, I15
    - Invariants respected: → SPEC.md §Invariants I1, I2, I3, I6, I9, I10
    - Acceptance: 72 tests pass (11 new: 6 db, 5 app); project-scoped API routes; TanStack Router with code-based routing; route loaders fetch data; DefaultChatTransport for project-scoped chat endpoint
    - Branch: `ln/fe-553-multi-project-routing`
    - Ref: → docs/design/BREADBOARD.md §Places, §Wiring

## Phase 3: Interview Engine

<!-- Build the structured interview with observer extraction. Retire the two highest-risk
     assumptions (A14: observer fidelity, A13: SDK skills) before building the full flow.
     Rich chat UI comes first to establish the rendering foundation. -->

### Spikes

1. **Observer extraction fidelity** `FE-557` — Can the LLM reliably extract decisions, assumptions, and dependency edges from a single turn's Q&A? Test with realistic fixture turns across different question types (scope, design, constraints). Measure extraction consistency across runs. `done`
   - Assumptions: → SPEC.md §Assumptions A14, A3
   - Time box: 2 hours
   - Success: ≥80% of expected entities captured with correct dependency edges across 5+ fixture turns
   - **Verification approach**: differential oracle — fixture turns (input) → observer extraction (output) → compare against hand-labeled golden master. Spike must produce ≥5 reusable fixtures with expected entities as proof artifact. → SPEC.md §Oracle Strategy (middle loop), §Observer History Projection

### Slices

3b. **Rich chat UI: tool calls + reasoning rendering** `FE-541` — Extend SSE adapter and core to emit tool-call lifecycle events for SDK `tool_use` content blocks. Part-type rendering for tool calls (with state indicator) and reasoning (collapsible block). AI Elements deferred — hand-built rendering sufficient for now. `done`
    - Requirements: → SPEC.md §Requirements #4
    - Assumptions: → SPEC.md §Assumptions A16 (partially validated — SSE + client work, browser outer-loop pending), A17 (not yet tested — AI Elements not installed)
    - Invariants established: → SPEC.md §Invariants I7
    - Invariants respected: → SPEC.md §Invariants I1, I2, I3
    - Acceptance: 61 tests pass (10 new: 6 SSE adapter, 3 core, 1 app integration); tool-call-streaming-start/delta/tool-call SSE events emitted for SDK tool_use blocks; client renders dynamic-tool parts with state labels
    - Branch: `ln/fe-541-rich-chat-ui`

4. **Structured interview: scope phase (server)** `FE-554` — Replace flat chat with structured turns. Implement the scope phase as an agent skill — the agent generates a question with options, grounding ("why this matters"), and impact signal via `ask_question` MCP tool. Turn persists with phase provenance (question, why, impact, options). `done`
   - Requirements: → SPEC.md §Requirements #2, #3
   - Assumptions: → SPEC.md §Assumptions A7, A13 (validated)
   - Invariants established: → SPEC.md §Invariants I16
   - Invariants respected: → SPEC.md §Invariants I1, I2, I3, I5, I6, I12, I13
   - Acceptance: 90 tests pass (16 new interview tests, 2 new app integration); `ask_question` MCP tool validates agent output via Zod schema; per-turn MCP server created via closure over db + turnId; `getSystemPrompt(phase)` returns phase-specific prompt; structured turn fields (question, why, impact, options) persist correctly
   - Branch: `ln/fe-554-structured-interview`
   - **Verification approach**: inner — schema validation on agent tool output (Zod parse, establishes I16); unit tests for phase-tagged turn persistence. Middle — round-trip: structured turn → persist → active path query → verify phase provenance intact. Outer — manual interview walkthrough, assess question quality. → SPEC.md §Oracle Strategy, §Acknowledged Blind Spots (interview quality)

4a. **Parts-based persistence + context builders** `FE-555` — Schema migration: add `user_parts` and `assistant_parts` JSON columns to turn table. Server-side: assemble final assistant `parts[]` from DomainEvents on stream finish, persist alongside scalars. Define `BrunchUIMessage` type with custom Data Parts (`data-option-selection`, `data-confirmation`). Extract `formatHistory()` into typed context builders (`buildInterviewerContext`, `buildObserverContext`). No backward-compatible fallback — DB can be re-initialized if needed. `done`
    - Requirements: → SPEC.md §Requirements #4, #14
    - Assumptions: → SPEC.md §Assumptions A22, A23
    - Decisions: → SPEC.md §Decisions D23, D24, D25
    - Invariants established: → SPEC.md §Invariants I17, I18, I19
    - Invariants respected: → SPEC.md §Invariants I1, I5, I6, I11, I12, I13, I16
    - Acceptance: schema migration adds parts columns; assistant parts persisted on stream finish (reasoning, tool-call states, text); Data Part schemas validated via Zod on write/read (I17); parts round-trip: DomainEvents → assemble → persist → load → hydrate matches original (I18); `buildInterviewerContext()` produces equivalent output to current `formatHistory()` (I19); observer context builder produces extraction-optimized projection
    - Branch: `ln/fe-555-parts-persistence`
    - **Verification approach**: inner — round-trip oracle for parts fidelity (I18); Zod schema validation on Data Parts (I17); unit tests for context builder output shape and equivalence (I19). → SPEC.md §Oracle Strategy (inner: fast unit tests — parts). Middle — integration: full `conductTurn()` → parts persisted → reload → hydration matches live state. Outer — manual resume test via `/cli-cdp` (reasoning + tool states visible on refresh). → SPEC.md §Acknowledged Blind Spots (parts/scalar consistency).

4b. **Structured interview: client UI** `FE-556` — Turn card rendering (question + options + grounding + impact badge). Option selection UI using `data-option-selection` Data Part (persist `is_selected` + structured answer). Enriched API: turns with options + validated parts deserialization. Hydration from `assistant_parts`. Outer-loop visual verification via `/cli-cdp`. Also addresses review findings: validated deserialization (review #1) and DB lifecycle parts round-trip test (review #2). `done`
    - Requirements: → SPEC.md §Requirements #2, #3
    - Assumptions: → SPEC.md §Assumptions A22, A23
    - Decisions: → SPEC.md §Decisions D23, D24
    - Invariants established: → SPEC.md §Invariants I17 (strengthened), I18 (strengthened)
    - Invariants respected: → SPEC.md §Invariants I1, I16
    - Acceptance: enriched API returns turns with options + validated parts; turn card rendering; option selection persists as data-option-selection + is_selected; hydration from assistant_parts; refresh preserves state; outer-loop visual verification via `/cli-cdp`
    - Branch: `ln/fe-556-interview-client-ui`
    - **Verification approach**: inner — validated deserialization rejects malformed JSON (I17 strengthened); DB lifecycle round-trip covers parts (I18 strengthened); unit tests for select endpoint. Outer — manual interview walkthrough via `/cli-cdp`. → SPEC.md §Acknowledged Blind Spots (interview quality)

4c. **UI foundation: shadcn/ui + Tailwind 4 + AI Elements** `FE-558` — Infrastructure realignment before slice 5. Install Tailwind 4 + `@tailwindcss/vite`, run `shadcn init`, install AI Elements core chat components (conversation, message, reasoning, tool, prompt-input, shimmer). Update `ai` + `@ai-sdk/react` to latest. Migrate InterviewWorkspace to AI Elements, ProjectList + root layout to shadcn + Tailwind. Zero server-side changes. `done`
    - Requirements: → SPEC.md §Requirements #4
    - Assumptions: → SPEC.md §Assumptions A17 (validates)
    - Decisions: → SPEC.md §Decisions D14 (completes — AI Elements adopted)
    - Invariants respected: → SPEC.md §Invariants I1, I7, I8, I15, I17, I18
    - Acceptance: `npm run verify` passes; AI Elements render messages/reasoning/tool states; shadcn Card/Button on project list; zero changes to src/server/*, src/core/*, drizzle/*
    - Branch: `ln/fe-558-ui-foundation`
    - **Verification approach**: inner — `npm run verify` (lint, format, type-check, all tests, build). Outer — manual visual inspection of interview workspace and project list in dev mode.

5. **Observer agent + entity persistence** `FE-537` — After each answered turn, core invokes a second agent call that extracts decisions and assumptions. Writes to decision/assumption tables with turn linkage and dependency edges. Core yields `observer-complete` DomainEvent **post-commit** (after SQLite transaction); SSE adapter emits as typed data part on existing chat stream (in-band sync per D22). Context builders upgraded to use `md-pen` for structured entity rendering (tables, checklists) in observer context. Agent pattern refactored: conductTurn() is thin sequencer, each agent is async generator composed via yield* (D27). Observer uses outputFormat for structured JSON extraction (D28). ResultMessage inspection for agent metrics (D29). `done`
   - Requirements: → SPEC.md §Requirements #5
   - Assumptions: → SPEC.md §Assumptions A3, A4, A14 (validated by spike), A20, A24, A25
   - Decisions: → SPEC.md §Decisions D22 (in-band sync — observer-complete as data part), D26 (md-pen), D27 (agent generator composition), D28 (outputFormat), D29 (ResultMessage metrics)
   - Invariants established: → SPEC.md §Invariants I20, I21, I22
   - Invariants respected: → SPEC.md §Invariants I1, I5, I6, I9, I10, I12, I13, I17, I19
   - Acceptance: 147 tests pass (24 new); agent pattern refactored; observer persists entities with turn linkage and dependency edges; observer-complete emitted post-commit; SSE adapter encodes as data-observer-result; observer errors non-fatal; context uses md-pen; agent-metrics emitted
   - Branch: `ln/fe-537-observer-agent`
   - **Verification approach**: inner — unit tests for entity writes with dependency edges, observer-complete DomainEvent emission post-commit, SSE adapter data-part encoding, sdk translateStreamEvents parity, observer-error non-fatality, agent-metrics shape. Middle — differential oracle from spike fixtures (deferred to manual testing). Outer — debug mode and fixture capture (deferred to slice 6). → SPEC.md §Oracle Strategy

6. **Entity sidebar (read-only)** — React sidebar in interview workspace showing decisions, assumptions, requirements, and criteria on the active path. Tabbed display. TanStack Query (`useQuery`) for entity data; cache populated via `queryClient.setQueryData` from `useChat`'s `onData` callback when `observer-complete` data parts arrive (in-band sync per D22). Dependency edges visible. Stale badges for soft-invalidated entities. `not-started`
   - Requirements: → SPEC.md §Requirements #6
   - Assumptions: → SPEC.md §Assumptions A21
   - Decisions: → SPEC.md §Decisions D22 (TanStack Query + in-band sync)
   - Invariants to respect: → SPEC.md §Invariants I9, I10
   - Acceptance: entities appear in categorized tabs as interview progresses, `onData` → `setQueryData` reactively updates sidebar, dependency links navigable, stale badges render correctly
   - Ref: → docs/design/BREADBOARD.md §UI Affordances → P2 Entity sidebar
   - **Verification approach**: inner — unit tests for entity query on active path, stale badge computation. Middle — validate A21: `onData` → `setQueryData` updates sidebar without stale closure (if stale, fall back to parallel `EventSource`). Outer — manual visual inspection (entities render correctly, tabs work, stale badges appear). Debug mode overlay (observer extraction detail per-turn) should land here or in slice 5. → SPEC.md §Oracle Strategy (outer loop), §Acknowledged Blind Spots (cumulative graph integrity)

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
Phase 3:  3c ──→ 3b (rich chat UI) ──→ 4 (scope server) ──→ 4a (parts+context) ──→ 4b (client UI) ──→ 4c (UI foundation) ──→ 5 (observer)
          spike (observer fidelity) ──→ 5
          3d + 5 ──→ 6 (entity sidebar)
Phase 4:  6 ──→ 7 (transitions) ──→ 8 (design) ──→ 9 (requirements) ──→ 10 (criteria)
Phase 5:  6 ──→ 11 (branching)
          6 ──→ 12 (entity lifecycle API)
          10 ──→ 13 (export)
Phase 6:  13 ──→ 14 (npx + CLI)
```

### Parallelism opportunities

- ~~Slice 3b and 3d can proceed in parallel after 3c~~ (done — both landed)
- ~~Observer spike and slice 4 can proceed in parallel~~ (slice 4 server done — spike is next on critical path)
- Observer spike can proceed in parallel with 4a (parts persistence)
- Slice 7 (transitions) and 11 (branching) can start in parallel once slice 6 lands
- Slice 12 (entity lifecycle API) can proceed in parallel with slice 11
- Slice 14 (npx) can start early with a basic launcher, completing after slice 13
