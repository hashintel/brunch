<!-- SPEC.md — single source of truth for WHAT we're building and WHY.
     Created by ln-spec · Read by all skills · Updated by ln-sync.
     Authority: requirements, constraints, assumptions, decisions, invariants, domain language, verification strategy.

     When re-running ln-spec: read this file first, preserve existing content, evolve sections that need change.
     Cross-referenced by PLAN.md slices and spikes via §-prefixed section links. -->

# Brunch v2 — Spec Elicitation Tool

## Concept & Goal

Brunch is an AI-guided spec elicitation tool that turns natural-language project goals into structured specifications through a multi-phase interview. The interview is driven by an agent that relentlessly asks structured questions — each with options, a recommendation, and strategic grounding ("why this matters") — until shared understanding is reached. A second observer agent extracts decisions and assumptions from each turn, building a dependency graph. The output is a fire-and-forget specification document.

The core data model:

- **Turn tree** — The conversation is a tree of turns (question + options + answer), not a flat log. Turns branch when a decision is revisited. The active path from HEAD determines the current state. The turn tree *is* the version history — no snapshots needed.
- **Decision graph** — Decisions are the atoms of the spec. Each is a resolved fork with options, a chosen path, and a rationale. Decisions depend on prior decisions and assumptions, forming a DAG. Revisiting a decision forks the turn tree and soft-invalidates downstream entities.
- **Assumption graph** — Assumptions are the falsifiable beliefs that decisions rest on. They have their own dependency structure (assumptions can rest on prior assumptions).
- **Requirements & criteria** — Downstream projections. Requirements accumulate during the decision drill-down and are reviewed in a dedicated phase. Criteria are proposed against confirmed requirements.

The architecture (layered: db → core → adapters):

- **Database**: SQLite via Drizzle ORM + `better-sqlite3` — TypeScript schema is single source of truth for types, DDL, and migrations. Auto-applies at startup.
- **Core**: Interface-agnostic service layer — turn tree operations, interview orchestration, entity lifecycle, observer, phase management, export. `conductTurn()` returns `AsyncIterable<DomainEvent>` for streaming. No transport knowledge.
- **Agent engine**: Claude Agent SDK (`query()`) — tool use, MCP, session resume, subagents, permissions, rich streaming events. Each interview phase is an agent skill. Called by core, not by adapters.
- **Observer agent**: Separate extraction call after each turn — captures decisions, assumptions, and their dependency edges. Invoked by core after turn completion.
- **Web adapter**: Express.js translates `DomainEvent` stream to AI SDK UI Message Stream SSE. React + Vite + `@ai-sdk/react` `useChat` client.
- **CLI adapter**: (future) Terminal I/O consuming the same `DomainEvent` stream
- **MCP adapter**: (future) MCP server exposing core operations as tools
- **Output**: Flattened markdown spec exported on demand from the active path's entities

## Constraints & Non-goals

- **Anthropic-only** — no multi-provider support (OpenAI, Gemini, Ollama)
- **No automatic deletion cascading** — invalidation flags entities for review but does not delete or modify them. Two mechanisms: path exclusion (lazy, via HEAD movement) and flag propagation (eager, via dependency graph walk). See D17
- **No task planning** — consumers of the spec, not part of this tool
- **No exploratory pathway** — assumes user has a reasonably defined goal
- **Single-user** — no collaborative editing
- **No custom model selection UI** — single model, configurable via env var at most
- **No Dolt** — replaced by SQLite with turn-tree versioning
- **No AG-UI / CopilotKit** — AI SDK SSE protocol is sufficient
- **No assistant-ui** — its runtime abstraction layer (`AssistantRuntimeProvider`) adds unnecessary indirection over `useChat`; brunch emits custom SSE from Express, not from AI SDK server-side, so the adapter chain (useChat → useChatRuntime → AssistantRuntimeProvider) is overhead without benefit
- **No TanStack DB** — designed for local-first client-side collections with sync engines (ElectricSQL, PowerSync); brunch is server-authoritative, single-user, with no offline or multi-tab requirements. TanStack Query + SSE-driven invalidation is sufficient. Re-evaluate if offline, multi-tab, or complex cross-collection client queries become requirements

## Requirements

1. Run `npx brunch` with just `ANTHROPIC_API_KEY` and have the tool open in the browser — setup is instant
2. Start a new project and have the agent begin a structured interview — framing questions establish context before the design drill-down
3. Each turn presents a question with ≥2 options, a recommendation, and a "why this matters" grounding block — the user sees the strategic significance of each fork
4. See the AI's thinking process, tool usage, and progress in real-time — CLI-quality visibility of the agent's streaming output
5. The observer agent extracts decisions and assumptions from each answered turn, building the dependency graph in the background
6. See accumulated decisions, assumptions, requirements, and criteria in a dashboard as the interview progresses
7. The interviewing agent determines when shared understanding is reached and marks the phase resolved — interview length is emergent, not predetermined
8. Phase transitions show a summary and require user confirmation before moving on
9. Revisit any previous decision by navigating the turn tree — this forks a new branch and soft-invalidates dependent entities for re-review
10. Abandon a revisit branch to return to the previous path — like git checkout
11. The requirements review phase walks the accumulated requirements list, checks for gaps, and confirms completeness
12. The criteria phase proposes testable acceptance criteria against confirmed requirements
13. Export the spec as markdown when all phases are resolved — spec readiness is the compound predicate of phase resolution + requirements reviewed + criteria confirmed
14. Close the browser and resume later — the turn tree, decisions, and assumptions persist in SQLite
15. The project dashboard shows all projects with their phase completion status

## Assumptions

| #   | Assumption                                                                                                                                                                                                                                                                                                                | Confidence    | Dependent decisions | Implicated slices | Validation approach                                                                                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A1  | AI SDK's UI Message Stream SSE protocol is documented and stable enough to emit conformantly without importing AI SDK server-side                                                                                                                                                                                         | **validated** | D8                  | Walking skeleton  | Validated: skeleton emits conformant SSE, 15 tests pass                                                                                                                                                                              |
| A2  | Claude Agent SDK `query()` with `includePartialMessages` provides all streaming event types needed for CLI-quality feedback                                                                                                                                                                                               | **validated** | D8                  | Walking skeleton  | Validated: adapter translates stream_event messages correctly                                                                                                                                                                        |
| A3  | Separating interviewer from observer produces better interview quality than inline tool calling                                                                                                                                                                                                                           | medium        | D1                  | Observer agent    | Compare interview coherence with and without tool-calling load                                                                                                                                                                       |
| A4  | Observer extraction completes in 1-3s during user read/think time (10-60s), adding zero perceived latency                                                                                                                                                                                                                 | medium        | D1                  | Observer agent    | Measure extraction latency with realistic turn payloads                                                                                                                                                                              |
| A5  | `better-sqlite3` npm prebuilt binary works across macOS/Linux without native compilation issues                                                                                                                                                                                                                           | **validated** | D7                  | SQLite foundation | Validated: installed on macOS without native compilation issues                                                                                                                                                                      |
| A6  | Turn-tree branching in SQLite is sufficient for decision revisit and undo in a single-user tool                                                                                                                                                                                                                           | high          | D7                  | Turn tree         | Validate with realistic branch/merge scenarios                                                                                                                                                                                       |
| A7  | Users arriving at the tool have a reasonably defined goal                                                                                                                                                                                                                                                                 | medium        | —                   | Scope phase       | User testing; exploratory pathway deferred if false                                                                                                                                                                                  |
| A8  | A single Express port serving API + static assets is sufficient for npx distribution                                                                                                                                                                                                                                      | **validated** | D10                 | npx distribution  | Validated: Vite proxy to Express works in dev; single port                                                                                                                                                                           |
| A9  | TanStack AI is too immature for a deliverable (alpha, v0)                                                                                                                                                                                                                                                                 | medium        | D9                  | —                 | Re-evaluate if AI SDK becomes constraining                                                                                                                                                                                           |
| A10 | The `useChat` hook can consume custom SSE without AI SDK server runtime                                                                                                                                                                                                                                                   | **validated** | D9                  | Walking skeleton  | Validated: useChat consumes custom SSE via DefaultChatTransport                                                                                                                                                                      |
| A11 | Stateless `query()` with prompt-stuffed history is sufficient for multi-turn interviewing — SDK session persistence is unnecessary and undesirable                                                                                                                                                                        | **validated** | D8, D12             | SQLite foundation | Validated: formatting history into prompt works. SDK sessions rejected as competing source of truth — opaque, machine-local, incompatible with portable data goals (atomic YAML / git-versionable). Turn tree is sole session model. |
| A12 | `useChat` hook accepts initial messages to hydrate conversation state from server-stored history                                                                                                                                                                                                                          | **validated** | D9                  | SQLite foundation | Validated: `useChat` doesn't have `initialMessages` prop but `setMessages` works for hydration                                                                                                                                       |
| A13 | Phase-specific interview behavior is achievable via system prompt switching + in-process MCP tools on `query()` — the SDK's formal `AgentDefinition` skill system is unnecessary                                                                                                                                          | **validated** | D2                  | Interview phases  | Validated: slice 4 uses `getSystemPrompt(phase)` + `createInterviewMcpServer()` per turn; 88 tests pass. SDK `AgentDefinition` subagent system not used — simpler approach with less indirection.                                     |
| A14 | A second-thread observer agent can reliably extract decisions, assumptions, and dependency edges from a single turn's Q&A                                                                                                                                                                                                 | medium        | D1                  | Observer agent    | Probe with realistic interview exchanges; measure extraction fidelity                                                                                                                                                                |
| A15 | The LLM can reliably judge when a phase interview has reached sufficient understanding (is_resolution)                                                                                                                                                                                                                    | medium        | D3                  | Phase resolution  | Probe across varied project types; measure false-positive resolution rate                                                                                                                                                            |
| A16 | AI SDK `useChat` hook's `ToolUIPart` state machine (`input-streaming` → `input-available` → `output-available` / `output-error` / `approval-requested` → `approval-responded` / `output-denied`) models all permutations of pending, error, and success for both interim (thinking, tool calls) and final (response) data | high          | D14                 | Rich chat UI      | Partially validated: SSE adapter emits tool-call events, client renders `dynamic-tool` parts with state labels (input-streaming, input-available, output-available, output-error). Browser outer-loop pending.                         |
| A17 | AI Elements copy-paste components can be restyled without forking — they are ownable source files, not npm-locked dependencies                                                                                                                                                                                            | high          | D14                 | Rich chat UI      | Install via CLI, inspect source, confirm no hidden npm runtime dependency                                                                                                                                                            |
| A18 | Drizzle ORM migration runner reliably auto-applies schema changes from a migrations folder at startup with better-sqlite3                                                                                                                                                                                                 | **validated** | D18                 | Drizzle refactor  | Validated: migrate() auto-applies at startup in createDb(); all 39 existing tests pass against Drizzle-managed schema                                                                                                                |
| A19 | `AsyncIterable<DomainEvent>` from core can be consumed by both SSE streaming (web) and line-by-line terminal output (CLI) without buffering issues                                                                                                                                                                        | **validated** | D19                 | Core extraction   | Validated: conductTurn() yields DomainEvents consumed by Express SSE adapter; 12 new core tests + 9 app integration tests pass                                                                                                       |
| A20 | Observer results can be delivered as typed data parts on the existing chat SSE stream without holding the connection open unacceptably long — observer is synchronous, runs within the same `conductTurn()` request, completes during user read time                                                                        | high          | D22                 | Observer agent, Entity sidebar | Measure observer latency in slice 5; if >5s, fall back to out-of-band SSE (Option 2 in research doc)                                                                                                                                 |
| A21 | `useChat` `onData` callback reliably bridges to `queryClient.setQueryData` without stale-closure issues — known `onFinish` stale-closure bug (ai-sdk#550) may or may not affect `onData`                                                                                                                                   | medium        | D22                 | Entity sidebar    | Test in slice 6: verify `setQueryData` from `onData` updates sidebar reactively; if stale, use parallel `EventSource` instead                                                                                                        |
| A22 | AI SDK `UIMessage.parts[]` with custom Data Parts (typed via `dataPartsSchema`) persisted as JSON on the turn table is sufficient for faithful UI resume — no separate `turn_message` table needed for current scope                                                                                                         | **validated** | D23, D24            | Parts persistence | Validated: parts assembler converts DomainEvents to typed parts, round-trips through JSON persistence (I18). Client hydration from parts deferred to 4b (outer-loop). |
| A23 | Custom Data Parts for structured user input (option selection, confirmation) can replace scalar `turn.answer` as the primary user-response model without breaking `formatHistory()` or observer context                                                                                                                      | **validated** | D24                 | Parts persistence | Validated: Data Part schemas defined with Zod (I17), context builders read scalars not parts (I19), structured user input round-trip tested. Full UI wiring deferred to 4b. |

## Decisions

26. **`md-pen` for programmatic markdown rendering** — Structured data (entity tables, dependency graphs, checklists) rendered to markdown via `md-pen` rather than hand-rolled string concatenation. Pure string-return functions (`table()`, `taskList()`, `mermaid()`, `heading()`, `alert()`, `details()`) compose by nesting — no AST, no intermediate representation. Escaping is context-aware per function (table cells, URLs, code fences), eliminating a class of bugs when rendering user-supplied text from interviews. Primary use cases: (1) observer context builders presenting growing entity graphs to agents (`table()` for decisions/assumptions with metadata, `taskList()` for reviewed/unreviewed items), (2) spec export rendering active-path entities into downloadable markdown (slice 13), (3) any future agent-facing or user-facing projection of structured data. Zero dependencies, ESM-only, TypeScript-first. Depends on: —. Supersedes: hand-rolled string assembly in context builders.

### Domain model

1. **Turn tree as version history** — The conversation is a tree, not a flat log. Each turn points to its parent. Revisiting a decision forks a new branch. `project.active_turn_id` is the HEAD pointer. The active path determines which entities are current — no snapshot tables needed. Depends on: A6. Supersedes: D5-old snapshot versioning model.
2. **Interview phases as agent skills** — Each phase (scope, design, requirements, criteria) is a separate agent skill with its own system prompt and tool configuration. The server orchestrates which skill to invoke based on phase completion state. Phases can be composed, reordered, or replaced independently. Depends on: A13. Supersedes: —.
3. **Phase resolution via LLM judgment** — A turn's `is_resolution` flag is set by the interviewing agent when it judges that shared understanding has been reached for that phase. The active path is resolved for a phase when its latest turn has `is_resolution = true`. Spec export requires all phases resolved. Depends on: A15. Supersedes: —.
4. **Two-agent pattern (interviewer + observer)** — The interviewer focuses solely on conducting the interview with structured questions. After each answered turn, a separate observer agent extracts decisions, assumptions, and dependency edges. The observer can use a cheaper/faster model. Keeps the interviewer prompt clean and extraction independently testable. Depends on: A3, A4, A14. Supersedes: —.
5. **Decision dependency graph** — Decisions depend on prior decisions and/or assumptions via `decision_parent_decision` and `decision_parent_assumption` join tables. Assumptions can depend on prior assumptions via `assumption_parent_assumption`. The observer agent captures these edges during extraction. Depends on: A14. Supersedes: —.
6. **Soft invalidation for requirements and criteria** — When a decision is revisited (branch fork), requirements traced to that decision are flagged for re-review via stale `reviewed_at` timestamps. Criteria inherit the flag transitively from their requirements. Mechanism specified in D17. Depends on: —. Supersedes: —.

17. **Two invalidation mechanisms — path exclusion and flag propagation** — Path exclusion (lazy): `revisitDecision` → `branch()` moves HEAD; entities on the abandoned branch leave the active path. Requirements are stale when their source decision is not on the active path — computed by the active-path query, no eager writes. Flag propagation (eager): `falsifyAssumption` walks dependency graph edges (`assumption_parent_assumption`, `decision_parent_assumption`), marks dependents. `updateRequirement` nulls `reviewed_at` on traced criteria. Cascade model: falsify assumption → walk graph → flag dependents; revisit decision → branch → path exclusion; update requirement → flag criteria. Depends on: D1, D5, D6. Supersedes: D6's unspecified "holistic" re-qualification.

12. **Stateless SDK integration — no session persistence** — Each `query()` call uses `persistSession: false`. Conversation context is reconstructed from the turn tree's active path and injected as formatted history + structured entity summaries. SDK sessions (`resume`, `fork`, session IDs) are not used. The turn tree is the sole session model. Rationale: SDK sessions are an opaque, machine-local competing source of truth incompatible with brunch's branching semantics and future portable-data goals (atomic YAML, git-versionable). Depends on: A11. Supersedes: implicit reliance on SDK session state.
13. **Observer captures derived intelligence** — The observer agent's extraction mandate extends beyond decisions and assumptions to include derived observations (e.g. codebase analysis, domain insights) that the interviewer surfaced through tool use during a turn. These are persisted so subsequent stateless `query()` calls can inject them as context. The exact entity model is TBD — candidates include a dedicated `observation` table, enriched `decision.rationale`, or a `notes` field on `turn`. Depends on: A14, D12. Supersedes: —.

14. **Part-type rendering for rich chat UI** — Client renders message parts by type: `reasoning` (collapsible `<details>`), `text` (paragraph), `dynamic-tool` (tool name + state indicator with lifecycle labels). AI Elements (copy-paste components via `npx ai-elements`) deferred — hand-built rendering is sufficient for current slices. AI Elements remain the target for when richer tool-call state rendering (7 states) is needed. Depends on: A16. Supersedes: hand-rolled message rendering in App.tsx.
15. **~~Transitional turn-field inversion~~** — **Superseded by D23 (parts-based persistence)**. Previously: `turn.answer` held user text, `turn.question` held assistant text with inverted semantics during slices 1–3. This was always marked transitional. D23 replaces both scalar fields with persisted `UIMessage.parts[]` as the source of truth for UI rendering and resume. Scalar fields (`question`, `why`, `impact`, `answer`) retained for queryability only — domain queries (active path, phase filtering, entity joins) read scalars; UI hydration reads parts. Depends on: D1. Supersedes: flat `message` table with `role` field from slice 2.

23. **Parts-based persistence model (UIMessage/ModelMessage split)** — Two separate data layers: (1) **UI render state** (`UIMessage.parts[]` JSON) persisted per turn for faithful resume — captures reasoning blocks, tool-call lifecycle states, text, and custom Data Parts. (2) **Inference context** (`ModelMessage`-equivalent) derived at call time by typed context builders, never persisted. Turn table gains `user_parts` and `assistant_parts` JSON columns (nullable). On stream finish, core assembles final assistant `parts[]` from DomainEvents and persists alongside scalar fields. Hydration reads persisted parts when available, falls back to scalar synthesis for older turns. The turn tree remains canonical for domain semantics (branching, phase, entity joins); parts are the source of truth for rendering. Research: `docs/research/Chat Application Data Models Conversation Turns, Structured Data & Generative UI Persistence.md`. Depends on: A22. Supersedes: D15's scalar-only persistence model.

24. **Custom Data Parts for structured user input** — User responses are not always plain text. AI SDK Data Parts (`data-{name}` typed via Zod schema) model structured user input: `data-option-selection` (`{ turnId, selectedOptionId, rationale? }`), `data-confirmation` (`{ turnId, confirmed: boolean }`), plain `text` for freeform responses. Defined as a `BrunchDataParts` type passed as generic to `UIMessage<Metadata, DataParts, Tools>` for full-stack type safety. Assistant messages use the same mechanism for domain-specific content not covered by built-in part types: `data-phase-summary`, `data-observer-result`, `data-entity-snapshot`. Depends on: A22, A23. Supersedes: implicit assumption that `turn.answer` is always a text string.

25. **Typed context builders replace monolithic `formatHistory()`** — Different consumers of the turn tree need different projections of the same data. `buildInterviewerContext(activePath, currentInput, entities, phase)` for conversational continuity. `buildObserverContext(turn, activePathSummary, linkedEntities)` for extraction-optimized context (see §Observer History Projection). Future: `buildPhaseResolutionContext(...)`, `buildRequirementsReviewContext(...)`. Each builder reads from the domain model (turn scalars + entity tables), NOT from persisted `UIMessage.parts[]`. The parts are for rendering; context builders are for inference. Depends on: D23, D12. Supersedes: single `formatHistory()` function in core.ts.

### Technical stack

7. **SQLite via better-sqlite3** — Zero-config embedded DB. Turn tree, decisions, assumptions, requirements, criteria all in SQLite tables. Schema defined in Drizzle (see D18). Depends on: A5, A6. Supersedes: Dolt (docker-based).
8. **Express.js server emits AI SDK-conformant SSE** — Thin adapter: iterates `DomainEvent` stream from `conductTurn()`, translates each event to AI SDK UI Message Stream protocol via `createDomainAdapter()`. No AI SDK runtime imported server-side. The SDK is called by core, not by Express. Depends on: A1, A2, D19. Supersedes: hand-rolled NDJSON streaming, direct SDK iteration in Express (pre-3c).
9. **React + Vite + @ai-sdk/react + @tanstack/react-router client** — `useChat` for conversation streaming. TanStack Router for type-safe routing with route loaders for data fetching on navigation (replaces manual `useEffect` hydration). Three routes for MVP: project list (`/`), interview workspace (`/project/:id`), export preview (`/project/:id/export`). See `docs/design/BREADBOARD.md`. Depends on: A9, A10. Supersedes: Preact, both existing frontends, single-page no-routing layout.
10. **npx-launchable single-command distribution** — `bin` entry, launcher starts Express (serves built Vite assets + API on one port), opens browser. Single env var: `ANTHROPIC_API_KEY`. DB auto-created in project directory or `~/.brunch/`. Depends on: A8. Supersedes: multi-step Docker + env var setup.
11. **Drop list** — Dolt/mysql2, OpenCode sidecar, Preact, both existing frontend implementations, NDJSON protocol, JSON Schema definitions (→ Zod), @tanstack/react-table, @dnd-kit/, dompurify, marked, four streaming functions in claude.js, dispatch.js. Depends on: —. Supersedes: —.
16. **Integer autoincrement primary keys** — All entity tables use `INTEGER PRIMARY KEY AUTOINCREMENT` instead of `TEXT` UUIDs. SQLite ROWID alias is simpler, matches the original DBML design, avoids UUID generation. No external systems reference these IDs. Client coerces to strings for `useChat` hydration (`turn-${id}-answer`, `turn-${id}-question`). Depends on: D7. Supersedes: `randomUUID()` TEXT PKs from slice 2.
18. **Drizzle ORM replaces raw DDL** — TypeScript schema definition (`drizzle/schema.ts`) is single source of truth for types, DDL, and migrations. Auto-applies from `drizzle/migrations/` at startup. Drizzle Studio available for DB inspection during development. Depends on: A18, D7. Supersedes: raw DDL strings in db.ts, DBML design document, hand-written TypeScript interfaces.
19. **Layered architecture with DomainEvent streaming** — Core interview orchestration extracted from Express handlers into interface-agnostic service layer. Core operations: turn tree (createProject, conductTurn, getActivePath, branch, checkout), entity lifecycle (revisitDecision, falsifyAssumption, verifyAssumption, CRUD for requirements/criteria, reviewRequirement/reviewCriterion), observer (runObserver), phase (getPhaseStatus), export (exportSpec). `conductTurn()` returns `AsyncIterable<DomainEvent>` — domain events (`stream-start`, `thinking`, `text-delta`, `tool-call-start`, `tool-call-delta`, `tool-call-end`, `stream-end`, `turn-created`, `error`, `observer-complete`; future: `phase-resolved`) that each adapter translates to its transport format. `observer-complete` is emitted post-commit (after SQLite transaction) and carries created entity IDs for cache coherence (see D22). Web (Express+SSE), CLI, and MCP adapters are thin transport layers. Depends on: A19, D8, D12. Supersedes: interview logic embedded in Express POST handler.
21. **oxlint + oxfmt + tsgolint replaces eslint + tsc** — oxlint for linting (including 59 type-aware rules via tsgolint, the Go-based TypeScript backend), oxfmt for formatting (single quotes, 110 width, sorted imports). `npm run fix` (lint:fix + fmt) is the fast inner loop; `npm run verify` (check + test + build) is the commit gate. `--type-check` flag replaces `tsc --noEmit`. Depends on: —. Supersedes: eslint (removed), separate `tsc --noEmit` step.
20. **CLI executable with subcommands** — `npx brunch` launches web UI (default). `npx brunch [command]` for CLI operations on the same DB. Future: sidecar MCP server. Depends on: D10, D19. Supersedes: web-only distribution model in D10.
22. **TanStack Query + SSE-driven invalidation for observer entity sync** — Observer-created entities (decisions, assumptions, edges) sync to the React UI via two mechanisms: (1) **In-band data parts** (default): `conductTurn()` yields `observer-complete` DomainEvents after the SQLite transaction commits; the Express SSE adapter emits these as typed data parts on the existing chat stream; `useChat`'s `onData` callback bridges to `queryClient.setQueryData` for instant sidebar updates. (2) **Out-of-band SSE** (fallback): if the observer moves to async post-processing, a dedicated `/api/events/:projectId` `EventSource` in a React context drives `queryClient.invalidateQueries`. TanStack Query owns all persisted entity state; a small Zustand store handles transient UI state only (observer-running indicator, phase progress). TanStack DB evaluated and rejected — overkill for server-authoritative single-user app without offline, multi-tab, or complex cross-collection query needs. Research: `docs/research/Async Server-State to UI Sync for Chat + Observer Agents.md`. Depends on: A20, A21, D4, D9, D19. Supersedes: —.

## Invariants

<!-- Structural properties proven by implementation and protected by tests.
     Once established, must not regress.
     Each links to the decision it proves and the tests that protect it.
     Established by ln-build/ln-spike traceability.
     Referenced by PLAN.md slices (to establish / to respect). -->

| #   | Invariant                    | Established by      | Protected by                     | Proves  |
| --- | ---------------------------- | ------------------- | -------------------------------- | ------- |
| I1  | SSE protocol conformance     | Slice 1 (skeleton)  | sse-adapter.test.ts              | D8      |
| I2  | Stream lifecycle correctness | Slice 1 (skeleton)  | app.test.ts                      | D8      |
| I3  | Thinking/text separation     | Slice 1 (skeleton)  | sse-adapter.test.ts, app.test.ts | D8      |
| I4  | Vite proxy routing           | Slice 1 (skeleton)  | vite.config.ts (manual)          | D10     |
| I5  | DB lifecycle correctness     | Slice 2 (SQLite)    | db.test.ts                       | D7      |
| I6  | Turn persistence             | Slice 3 (turn tree) | db.test.ts, app.test.ts          | D1, D7  |
| I7  | Tool call SSE conformance    | Slice 3b (rich UI)  | sse-adapter.test.ts              | D8, D14 |
| I8  | Tool part state rendering    | Slice 3b (rich UI)  | manual (outer loop)              | D14     |
| I9  | Turn tree parent chain       | Slice 3 (turn tree) | db.test.ts                       | D1      |
| I10 | Active path resolution       | Slice 3 (turn tree) | db.test.ts                       | D1      |
| I11 | Drizzle migration auto-apply | Slice 3c (Drizzle)  | db.test.ts                       | D18     |
| I12 | DomainEvent streaming        | Slice 3c (Drizzle)  | core.test.ts                     | D19     |
| I13 | Core/adapter separation      | Slice 3c (Drizzle)  | core.test.ts, app.test.ts        | D19     |
| I14 | Project-scoped API routes    | Slice 3d (routing)  | app.test.ts                      | D9      |
| I15 | Route loader hydration       | Slice 3d (routing)  | manual (outer loop)              | D9      |
| I16 | Schema validation on agent tool output | Slice 4 (scope interview) | interview.test.ts | D2, A13 |
| I17 | Data Part schema validation | Slice 4a (parts persistence) | parts.test.ts (7 tests) | D24 |
| I18 | Parts round-trip fidelity | Slice 4a (parts persistence) | parts.test.ts (8 tests), core.test.ts | D23 |
| I19 | Context builder equivalence | Slice 4a (parts persistence) | context.test.ts (7 tests) | D25 |

## Lexicon

<!-- Canonical terms. Code names must match.
     Method terms come first, then project-specific domain terms.
     Survey with ln-review; realign with ln-refactor. -->

### Method terms

| Term            | Definition                                                                                     |
| --------------- | ---------------------------------------------------------------------------------------------- |
| **assumption**  | A falsifiable belief accepted as true; tracked with confidence, linked to decisions and slices |
| **decision**    | A recorded choice that resolves a question; ordered, with supersession chain                   |
| **invariant**   | A structural property proven by implementation and protected by tests; must not regress        |
| **requirement** | A capability the system must provide                                                           |
| **slice**       | A thin end-to-end tracer-bullet path through all integration layers                            |
| **spike**       | A time-boxed throwaway investigation to answer one hard question                               |

### Domain terms

| Term                  | Definition                                                                                                                                                                                                        |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **project**           | A spec elicitation session. Has a name, a HEAD pointer (`active_turn_id`), and phase completion state                                                                                                             |
| **turn**              | One question-answer pair in the interview. Carries phase provenance, options, grounding ("why"), impact signal, and the user's answer. Points to its parent turn — the turn tree is the version history           |
| **option**            | A structured alternative presented in a turn. At least two per turn. One may be recommended; one is selected by the user                                                                                          |
| **decision**          | A resolved fork in the design tree. Extracted by the observer from an answered turn. Depends on prior decisions and/or assumptions. Traced back to its source turn via `turn_decision`                            |
| **assumption**        | A falsifiable belief a decision rests on. Extracted by the observer. Can depend on prior assumptions. Traced back to its source turn via `turn_assumption`                                                        |
| **requirement**       | What the system must do. Accumulated during the design drill-down, confirmed during the requirements review phase. Traced to source decisions via `requirement_decision`. Has `reviewed_at` for soft-invalidation |
| **criterion**         | A testable condition verifying a requirement. Proposed by the agent during the criteria phase, confirmed by the user. Has `reviewed_at` for soft-invalidation                                                     |
| **active path**       | The branch from HEAD to root in the turn tree. Determines which turns, decisions, and assumptions are currently active                                                                                            |
| **branch** (verb)     | Fork the turn tree from a given turn, creating a new path and moving HEAD. Analogous to git branch + checkout                                                                                                    |
| **checkout** (verb)   | Move HEAD to an existing turn on a different branch without creating new turns. Analogous to git checkout                                                                                                        |
| **phase**             | A stage of the interview: `scope`, `design`, `requirements`, `criteria`. Immutable provenance on each turn. Each phase is implemented via `getSystemPrompt(phase)` + a per-turn MCP tool server (`createInterviewMcpServer`). See D2, A13 |
| **phase resolution**  | LLM judgment that shared understanding has been reached for a phase. Marked by `turn.is_resolution = true` on the last turn of a phase                                                                            |
| **ask_question tool** | The MCP tool the interviewer must use each turn. Accepts `{ question, why, impact, options[] }`, validated by `structuredQuestionSchema` (Zod). The tool handler persists structured data to the turn and options tables via closure over `db` + `turnId`. Defined in `interview.ts` |
| **interview MCP server** | A per-turn MCP server created by `createInterviewMcpServer(db, turnId)`. Exposes the `ask_question` tool. The closure captures the current turn ID so the tool handler writes to the correct row. Passed to `query()` via `mcpServers` option. Defined in `interview.ts` |
| **interviewer**       | The primary agent role: conducts the interview with structured questions, grounding, and impact signals. Must use the `ask_question` tool every turn. Does not extract entities                                    |
| **observer**          | The secondary agent role: extracts decisions, assumptions, and dependency edges from each answered turn. Runs post-answer during user read time                                                                   |
| **core**              | The interface-agnostic service layer between the database and transport adapters. Owns interview orchestration, entity lifecycle, observer invocation. Returns `AsyncIterable<DomainEvent>` for streaming          |
| **domain event**      | A typed event yielded by `conductTurn()` — `stream-start`, `thinking`, `text-delta`, `tool-call-start`, `tool-call-delta`, `tool-call-end`, `stream-end`, `turn-created`, `error`, `observer-complete`. Future: `phase-resolved`. Each adapter translates to its transport format (SSE, terminal, MCP). `observer-complete` is emitted post-commit and drives cache coherence (D22) |
| **decision graph**    | The DAG of decisions and their dependencies (on prior decisions and assumptions). Revisiting a decision forks the turn tree                                                                                       |
| **path exclusion**    | Invalidation by moving HEAD so entities on the abandoned branch leave the active path. Lazy — computed by the active-path query, no eager writes. Triggered by `revisitDecision` / `branch`                       |
| **flag propagation**  | Invalidation by walking dependency graph edges and marking entities stale (nulling `reviewed_at`). Eager — triggered by `falsifyAssumption` or `updateRequirement`                                                |
| **soft invalidation** | Umbrella term for both path exclusion and flag propagation. Entities are flagged for re-review but never deleted or modified. See D17                                                                             |
| **spec readiness**    | Compound predicate: all four phases resolved AND requirements reviewed AND criteria confirmed. Only then is export enabled                                                                                        |
| **UIMessage**         | AI SDK source of truth for UI state. `{ id, role, parts[], metadata? }`. Persisted for faithful resume. Reconstructed from stored `user_parts`/`assistant_parts` JSON on hydration. See D23                       |
| **ModelMessage**      | AI SDK representation optimized for LLM inference. Derived at call time by context builders (D25), never persisted. Leaner than `UIMessage` — no tool states, no reasoning, no custom data parts                  |
| **parts[]**           | Ordered array of typed content blocks in a `UIMessage`. Built-in types: `text`, `reasoning`, `tool-{name}` (4 states), `file`. Custom types via Data Parts: `data-option-selection`, `data-confirmation`, `data-phase-summary`, etc. Source of truth for rendering. See D23, D24 |
| **Data Part**         | Custom typed `UIMessage` part (`data-{name}`) defined via Zod schema. Enables structured user input (option selection, confirmation) and domain-specific assistant output (phase summary, observer result). Persisted in `parts[]` JSON. See D24 |
| **context builder**   | A typed function that projects turn-tree + entity data into inference context for a specific consumer (interviewer, observer, phase judge). Reads from domain model, not from persisted parts. See D25              |
| **in-band sync**      | Observer entity updates delivered as typed data parts on the existing `conductTurn()` SSE stream. Default mechanism — zero additional infrastructure (D22)                                                         |
| **out-of-band sync**  | Observer entity updates delivered via a dedicated `EventSource` SSE channel (`/api/events/:projectId`). Fallback mechanism if observer becomes async (D22)                                                        |
| **cache invalidation** | Signaling TanStack Query that cached data is stale. Two forms: `queryClient.setQueryData` (push new data directly into cache) and `queryClient.invalidateQueries` (trigger background refetch). Driven by `observer-complete` events (D22) |

## Verification Design

<!-- Verification is first-class work, not accessory. Designing and creating oracles is
     second only to building the product itself. Every slice must declare its verification
     approach as part of scoping; a slice without an oracle strategy is not scoped.

     Three-tier feedback loops, cheapest first.
     Inner: agent-autonomous, always-on (ms–seconds).
     Middle: regression gates (seconds–minutes).
     Outer: human observer, strategy redirect (minutes–hours).

     Oracle taxonomy (Regehr): the best oracle removes the most bad degrees of freedom
     per unit time. Coverage is easy to game; choose oracles that constrain actual wrongness. -->

### Verification Stance

Verification is not a phase that follows implementation — it is integral to every slice. A slice that ships code without declaring and building its oracles is incomplete. The `ln-scope` skill must name the oracle strategy; `ln-build` must implement it alongside the production code; `ln-review` must audit oracle coverage alongside code quality.

### Diagnostic Assessment

Scored per the arc-oracle diagnostic framework (high / partial / low):

| Dimension | Score | Notes |
| --- | --- | --- |
| **Observability** | partial | Inner/middle: high (all text-native — tests, SSE, DB). Outer: low for observer extraction quality (hidden from surface UI) and LLM judgment calls (phase resolution, interview quality). Mitigated by debug mode (planned) and differential testing (spike). |
| **Reproducibility** | partial | Deterministic systems (turn tree, DB, SSE encoding): high. LLM boundary (interviewer output, observer extraction): low — non-deterministic. Mitigated by schema validation (structural) and golden master fixtures with capture-rate thresholds (statistical). |
| **Controllability** | high | Single-user, local SQLite, no external dependencies beyond Claude API. Agent drives full inner loop autonomously (`npm run fix` / `npm run verify`). Human review reserved for outer loop. |

### Verification Commands

| Step | Check              | Command                                   |
| ---- | ------------------ | ----------------------------------------- |
| 1    | Formatting         | `npm run fmt:check`                       |
| 2    | Lint + type check  | `npm run lint`                            |
| 3    | Unit tests         | `npm run test`                            |
| 4    | Build              | `npm run build`                           |
| all  | Full pipeline      | `npm run verify`                          |

Tooling: oxfmt (formatting), oxlint + tsgolint (lint + type-aware + type-check), vitest (tests), vite (build). Replaces eslint + `tsc --noEmit`.

### Verification Policy

End-to-end slices must be **user-testable**, not just programmatically tested. Each slice that touches the user-facing boundary should be manually verifiable via `npm run dev` (or equivalent). Use `/cli-cmux` for dev server panes and `/cli-cdp` for browser interaction during outer-loop verification.

### Oracle Strategy by Loop Tier

<!-- Oracle families drawn from Regehr's taxonomy. Each oracle is mapped to the invariant
     or claim it proves, the loop tier it belongs to, and its cost/signal tradeoff.
     The combination principle: the best oracle is often a pair of independent artifacts. -->

**Inner loop** (ms–seconds): agent-autonomous, always-on

| Oracle family | What it proves | Protects | Cost |
| --- | --- | --- | --- |
| Schema validation | Agent tool output conforms to structured turn schema (question, options, grounding, impact) | I16 (planned) | Negligible — Zod parse on tool output |
| Fast unit tests — SSE | `SDKMessage` → correct SSE event strings | I1, I3, I7 | ms |
| Fast unit tests — DB | Turn persistence with phase provenance, entity writes with dependency edges | I5, I6, I9, I10, I11 | ms |
| Fast unit tests — core | DomainEvent streaming, core/adapter separation, structured turn creation | I12, I13 | ms |
| Fast unit tests — parts | Parts round-trip (DomainEvents → assemble → persist JSON → load → hydrate); Data Part schema validation (Zod parse on structured user input); context builder output shape | I17, I18, I19 | ms |
| Fast unit tests — observer sync | `observer-complete` emitted post-commit with entity IDs matching DB state; SSE adapter encodes as typed data part | D22, A20 | ms |
| Type-aware linting | Semantic static checks (oxlint + tsgolint) | All | ms |

**Middle loop** (seconds–minutes): regression gates

| Oracle family | What it proves | Protects | Cost |
| --- | --- | --- | --- |
| Differential testing (observer) | Observer extraction meets ≥80% entity capture rate against golden master fixtures | A14 | seconds per fixture; requires Claude API |
| Round-trip oracle (turn tree) | Structured turns → active path → entity resolution intact | I6, I9, I10 | ms |
| Integration tests | SSE stream contains expected event types in order; DB lifecycle survives close/reopen | I2, I5, I13, I14 | seconds |
| Round-trip oracle (observer sync) | Full `conductTurn()` with observer → `observer-complete` is last event before `stream-end` → entity IDs in event match committed DB rows | D22 | seconds; requires Claude API |

**Outer loop** (minutes–hours): human observer

| Oracle family | What it proves | Cost |
| --- | --- | --- |
| Debug mode (observer visibility) | Observer extraction is inspectable per-turn during manual testing | UI delta on slice 5/6 |
| Manual interview walkthrough | Structured questions render correctly; interview quality is acceptable | Human time |
| Fixture capture from manual runs | Bootstrap golden master fixtures by querying DB after confirmed-good sessions | Human judgment + SQL query |
| Rich chat rendering | Tool call states, reasoning collapse, message parts render by type | Human + `/cli-cdp` |
| Resume test | Close/reopen browser, verify state intact | Human + browser |
| Observer → sidebar reactivity | `onData` → `setQueryData` bridge updates sidebar after observer extraction; validates A21 | Human + `/cli-cdp` (slice 6) |

### Observer History Projection

<!-- Design note for the observer's verification context. -->

The observer and interviewer receive the same conversation but through different projections. The interviewer receives conversational context ("where are we in the design space"). The observer receives extraction context: the existing entity graph (decisions, assumptions, edges established so far) plus the current turn's Q&A. This makes each extraction incremental — "given what we already know, what did *this turn* add?" — which sharpens the differential oracle: comparing the delta, not the total.

This projection difference is a deliberate design choice, not an implementation detail. It affects prompt design, fixture structure, and evaluation criteria.

### Acknowledged Blind Spots

<!-- Arc-oracle requires naming what verification does NOT cover and why.
     A verification design with no blind spots is incomplete. -->

| Blind spot | Why uncovered | Mitigation | Revisit trigger |
| --- | --- | --- | --- |
| Interview quality | LLM judgment; no programmatic oracle. Skill paradigm (D2) is the primary quality lever. | Manual outer-loop testing. | If interview quality proves inconsistent across project types. |
| Observer extraction variance | Spike measures capture rate single-shot per fixture; multi-run variance not measured. | Acceptable for initial delivery. | If extraction consistency degrades as history grows. |
| Cumulative entity graph integrity | Individual extractions may be correct but compose into an incoherent graph over 15-20 turns. No programmatic check for drift. | Debug mode (human eyeballs the growing graph). Future: structural property tests (no orphaned edges, no DAG cycles, monotonic entity count). | After observer slice lands and manual testing reveals graph-level issues. |
| Phase transition UX | Summary quality, resolution timing, confirmation flow. Fully visual. | Manual testing during slices 7-10. | If phase transitions feel wrong during testing. |
| Performance under realistic load | 20+ turns, growing history summaries, observer latency. No budget oracle. | Acceptable for single-user tool. | If latency becomes noticeable during manual testing. |
| `onData` stale-closure correctness | Client-side `useChat` `onData` → `queryClient.setQueryData` bridge cannot be tested in inner/middle loop (requires browser runtime). Known `onFinish` stale-closure bug (ai-sdk#550) may affect `onData`. | Manual outer-loop validation in slice 6; if broken, fall back to parallel `EventSource` (D22 Option 2). | If sidebar fails to update after observer extraction during manual testing. |
| Parts/scalar consistency | Persisted `assistant_parts` and scalar fields (`question`, `why`, `impact`, options) are two representations of the same turn content. No programmatic check that they agree. | Acceptable for initial delivery — scalars are written by MCP tool handler, parts assembled from stream. Both derive from the same `query()` call. Future: metamorphic oracle (text in parts matches scalars). | If turns appear correct in one view (parts-based UI) but wrong in another (scalar-based entity queries or export). |

### Current Coverage

<!-- Updated by ln-build traceability after each slice. -->

| File                | Tests | Protects                    |
| ------------------- | ----- | --------------------------- |
| sse-adapter.test.ts | 18    | I1, I3, I7                  |
| db.test.ts          | 25    | I5, I6, I9, I10, I11, I18   |
| app.test.ts         | 22    | I2, I3, I6, I7, I13, I14    |
| core.test.ts        | 16    | I12, I13, I18               |
| interview.test.ts   | 16    | I16                         |
| parts.test.ts       | 23    | I17, I18                    |
| context.test.ts     | 7     | I19                         |

## Acceptance Criteria (exit conditions)

1. `npx brunch` with `ANTHROPIC_API_KEY` in scope opens a working app in the browser
2. Starting a new project launches an interview with structured turns (question + options + grounding + impact)
3. The observer extracts decisions and assumptions from each answered turn, visible in the dashboard
4. The decision dependency graph is navigable — user can see what each decision depends on
5. Phase transitions show a summary, require user confirmation, and mark `is_resolution`
6. Revisiting a decision forks the turn tree and soft-invalidates downstream requirements
7. Abandoning a branch restores the previous active path
8. Requirements review phase walks the list, agent suggests gaps, user confirms
9. Criteria phase proposes testable conditions for each requirement
10. Export produces valid markdown spec when all phases are resolved and entities reviewed
11. Closing and reopening the browser resumes the interview from the active turn
12. All inner and middle loop tests pass
