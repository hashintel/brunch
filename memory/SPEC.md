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
- **Core**: Interface-agnostic service layer — turn tree operations, project-state loading, typed prompt/context building, entity lifecycle, observer invocation, phase management, export. No transport knowledge.
- **Agent engine**: AI SDK + Anthropic provider (`ai`, `@ai-sdk/anthropic`) — `ToolLoopAgent` powers the interviewer and `generateObject` powers the observer. Shared `BrunchUIMessage` / data-part contracts span request validation, persistence, server streaming, and client hydration. Future multi-step hardening builds on the AI SDK loop surface rather than a handwritten raw-event translator. (D30, D31)
- **Observer agent**: Separate extraction call after each turn — captures decisions, assumptions, and their dependency edges. Invoked by core after turn completion.
- **Web adapter**: Express.js returns AI SDK UI Message Stream SSE directly via `createUIMessageStream`. React + Vite + `@ai-sdk/react` `useChat` client consume the same typed message contract.
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

<!-- Pruned 2026-04-03: removed 18 assumptions that were validated and fully embedded in the
     architecture (A1, A2, A5, A8–A13, A17–A19, A22–A27). Their truths are now structural
     properties of the codebase, not open questions. IDs are stable — gaps are intentional. -->

| #   | Assumption | Confidence | Dependent decisions | Implicated slices | Validation approach |
| --- | --- | --- | --- | --- | --- |
| A3  | Separating interviewer from observer produces better interview quality than inline tool calling | high | D1 | Observer agent | Spike confirms extraction is viable as separate call; interviewer prompt stays clean. |
| A4  | Observer extraction completes in 1-3s during user read/think time (10-60s), adding zero perceived latency | medium | D1 | Observer agent | Spike measured 14-17s with Sonnet. Haiku expected 2-5s — validate with `generateObject` model switch. |
| A6  | Turn-tree branching in SQLite is sufficient for decision revisit and undo in a single-user tool | high | D7 | Turn tree, Branching | Validate with realistic branch/merge scenarios |
| A7  | Users arriving at the tool have a reasonably defined goal | medium | — | Scope phase | User testing; characterization kickoff mode mitigates if false |
| A14 | A second-thread observer agent can reliably extract decisions, assumptions, and dependency edges from a single turn's Q&A | **validated** | D1 | Observer agent | Validated (spike): decisions 100% capture, assumptions ~80% semantic overlap. Observer now uses `generateObject` with Zod schema. |
| A15 | The LLM can reliably judge when a phase interview has reached sufficient understanding (is_resolution) | medium | D3 | Phase resolution | Probe across varied project types; measure false-positive resolution rate |
| A16 | AI SDK `useChat` hook's `ToolUIPart` state machine models all permutations of pending, error, and success for tool calls | high | D14 | Rich chat UI | Partially validated: typed `tool-ask_question` parts render with correct state labels. Browser outer-loop pending. |
| A20 | Observer results can be delivered as typed data parts on the existing chat stream without holding the connection open unacceptably long | high | D22 | Observer agent, Entity sidebar | Measure observer latency with `generateObject`; if >5s, fall back to out-of-band SSE |
| A21 | `useChat` `onData` callback reliably bridges to `queryClient.invalidateQueries` without stale-closure issues | **validated** | D22 | Entity sidebar | Validated: `InterviewWorkspace.test.tsx` covers `data-observer-result` → query invalidation → sidebar refresh, plus manual outer-loop verification remains for live browser/runtime behavior. |
| A28 | AI SDK `ToolLoopAgent` with `stopWhen: stepCountIs(N)` is sufficient for brunch's multi-step tool execution needs — no custom agent loop required | high | D31 | Agent loop, Phase transitions | Validate with phase resolution slice (slice 7): agent must call `ask_question` AND judge `is_resolution`, requiring multi-step tool use with `tool_choice: auto`. |
| A29 | Models can reliably compose generic filesystem tools (read, write, edit, bash, grep, find, ls) to explore and characterize an existing project | **validated** | D32 | Characterization kickoff | Validated (spike): `ToolLoopAgent` with 7 core tools explored brunch in 22 tool calls across 23 steps. See `spike/filesystem-tools.ts`. |
| A30 | The client can detect when assistant content actually needs rich markdown or diagram enhancement and keep plain text rendering as the immediate default without creating a hydration or streaming mismatch | **validated** | D34, D36 | Refactor commit 4 — progressive rendering split | Validated by `src/client/capabilities/markdown-rendering.test.tsx` (plain path stays immediate, fenced code upgrades after lazy load) plus `src/client/build-boundary.test.ts` (entry excludes `streamdown` and eager highlighter implementation). |
| A31 | A workspace data adapter can centralize the boundary between durable project snapshots, durable entity snapshots, and ephemeral chat state without changing current user-visible behavior before concurrency and hydration policy changes land | **validated** | D37 | Refactor commits 5-7 — workspace state ownership | Validated by `src/client/workspace/workspace-data.test.ts` (durable vs ephemeral seed state separation is explicit and hydration timing is not owned by the adapter) plus unchanged green `src/client/routes/InterviewWorkspace.test.tsx` characterization coverage. |
| A32 | A project-scoped workspace loader can start durable project and entity snapshots together while seeding the entity query cache without reintroducing transcript hydration drift | **validated** | D38 | Refactor commit 6 — workspace loading concurrency | Validated by `src/client/routes/InterviewWorkspace.test.tsx` (initial sidebar data comes from the route loader with no post-mount entity fetch, same-project durable refresh updates sidebar state without rewriting the visible transcript, and observer-result invalidation still refetches entities through the same query boundary). |

## Decisions

30. **Vercel AI SDK replaces both Claude Agent SDK and raw Anthropic SDK** — `@ai-sdk/anthropic` provider with AI SDK primitives: `ToolLoopAgent` powers the interviewer (typed tools via `tool()` with Zod schemas, multi-step loop via `stopWhen`), `generateObject` powers the observer (structured extraction with Zod schema, no JSON parsing), `createUIMessageStream` + `pipeUIMessageStreamToResponse` handle server-side streaming, `validateUIMessages` validates incoming chat payloads. No hand-written stream translator, no DomainEvent layer on the web path. The `@anthropic-ai/sdk` package remains as a transitive dependency only. Depends on: —. Supersedes: Claude Agent SDK, raw Anthropic SDK approach, D27 (generator composition), D28 (outputFormat), D29 (ResultMessage metrics), custom agent loop plan (old D31).

31. **`ToolLoopAgent` as the agent loop** — AI SDK's built-in `ToolLoopAgent` provides the tool execution loop: model calls tool → SDK validates input via Zod → executes handler → re-submits result → repeats until `stopWhen` condition or `end_turn`. No custom `agentLoop()` function needed. `activeTools` and `prepareCall` enable per-step tool gating for future phase-specific behavior. Depends on: D30. Supersedes: planned custom agent loop modeled after pi-mono.

32. **Core filesystem tools following pi-mono pattern** — 7 generic tools (read, write, edit, bash, grep, find, ls) in `src/server/tools/`, each a factory function returning an AI SDK `tool()` bound to a working directory. Tools are thin wrappers around Node.js fs APIs and shell commands (rg, fd), with truncation limits (500 lines / 64KB) following pi-mono's defaults. Composed via `createCoreTools(cwd)`. First use case: project characterization kickoff mode. Depends on: D30, A29. Supersedes: —.

33. **Component-level workspace oracle before state refactors** — The interview workspace has a client integration harness (`InterviewWorkspace.test.tsx`) that uses the real React Query cache and component tree while mocking `useChat` transport boundaries. It locks four seam behaviors before state-ownership refactors: initial hydration from persisted turns, same-project refresh preserving local chat state, `data-observer-result` invalidating entities into the sidebar, and option selection flowing through route refresh and chat submission. Depends on: D19, D22. Supersedes: manual-only workspace seam verification.

34. **Heavy client capabilities live behind named boundaries before perf changes** — Streamed markdown rendering, reasoning rendering, code highlighting, and the developer debug route are each imported through dedicated client boundary modules (`src/client/capabilities/*`, `src/client/routes/debug-surface.tsx`) rather than directly from feature components. This keeps runtime behavior unchanged now while giving later refactor commits one place to introduce lazy loading, deferred enhancement, or alternative adapters without another cross-cutting import rewrite. Depends on: D9, D14. Supersedes: direct heavy-dependency imports from message, reasoning, code-block, and router modules.

35. **Developer debug surface is route-lazy, not startup-eager** — The `/debug` route remains declared in the main router, but its UI loads through a lazy client boundary so the default interview entrypoint does not inline developer-only debug content into the initial application chunk. This keeps the route available without charging normal startup for the debug surface. Depends on: D9, D34. Supersedes: eager debug-route component loading from the main router.

36. **Assistant rich rendering is progressive enhancement, not the baseline path** — Message and reasoning text render immediately through a plain text-safe boundary. Rich markdown, diagram rendering, and Shiki-backed highlighting load only after the content proves enhancement is needed, with the rich implementation and highlighter runtime emitted outside the default entry bundle. Depends on: D14, D34. Supersedes: startup-eager `streamdown` + highlighting on the default transcript path.

37. **Workspace state ownership lives behind a data adapter before semantics change** — The client reads workspace data through an explicit adapter that separates durable project snapshots, durable entity snapshots, and ephemeral chat seed state. This commit preserves current behavior, including the current project-scoped chat hydration boundary, while giving later commits one place to change fetch concurrency and hydration policy without another cross-cutting rewrite. Depends on: D19, D22. Supersedes: inline workspace ownership logic spread across `InterviewWorkspace` and `EntitySidebar`.

38. **Workspace route loading is the project-scoped durable-data entrypoint** — The interview route loader now starts project and entity snapshot fetches together, then seeds the entity query cache from that loader result so the sidebar can render from the same project entry boundary without a post-mount waterfall. Later observer-result invalidations still refetch through the entity query key, while same-project loader refreshes can update durable snapshots without implicitly rewriting the visible transcript. Depends on: D9, D22, D37. Supersedes: project-only route loading plus post-mount entity fetch from the sidebar path.

39. **Chat hydration is an explicit workspace boundary policy** — Persisted turns seed `useChat` only on initial project entry or when navigation changes the active project. Same-project route invalidations may refresh durable project/entity snapshots and derived affordances, but they do not rewrite the current in-flight transcript. The policy lives in a dedicated client boundary instead of being inferred indirectly from adapter memoization. Depends on: D19, D37, D38. Supersedes: implicit project-id-keyed hydration behavior hidden inside workspace adapter wiring.

40. **Client writes use a shared typed mutation boundary with visible failure states** — Project creation, option selection, and similar client-triggered writes go through one shared POST-mutation helper plus React Query mutation state. Server `error` payloads are surfaced as visible UI feedback instead of being swallowed by silent early returns, while successful writes keep their existing navigation or route-refresh follow-through. Depends on: D22, D37, D39. Supersedes: ad hoc `fetch` calls in route components with inconsistent error handling.

41. **Render-sensitive client primitives use explicit lifecycle boundaries** — Code highlighting now uses an effect-owned async path with cache reads kept synchronous and side-effect-free, message-branch bookkeeping re-synchronizes when branch identity changes and clamps stale indices when branch sets shrink, and transient copy-feedback timers are cleared explicitly on replacement or unmount. Depends on: D34, D39, D40. Supersedes: render-time state resets, callback-style async highlighting orchestration, and branch bookkeeping that only tracked collection length.

42. **Advanced rendering boundaries expose explicit preload surfaces without contaminating first paint** — Markdown and code-highlighting capabilities now export preload hooks so pointer, focus, or touch intent can warm rich rendering before full use, while the transcript keeps the plain path during active animation and the build oracle enforces both chunk separation and a default-entry size ceiling. Depends on: D34, D35, D36, D41. Supersedes: lazy-only enhancement with no intent-preload or budget guardrail.

43. **Workspace orchestration reads through one controller boundary backed by a pure core and imperative shells** — Route components now consume a single workspace controller interface, while durable-state shaping, transcript seeding, and view projection live in pure functions and React Query/chat side effects live in dedicated shells. Depends on: D37, D38, D39. Supersedes: workspace ownership spread across route components plus loosely coordinated helper modules.

44. **Domain-shaped client mutations own success choreography above the shared transport seam** — `client-mutation.ts` remains the shared POST/error boundary, but project creation and turn-option selection now flow through domain hooks that own navigation, invalidation, and chat follow-through so route/controller callsites do not repeat workflow logic. Depends on: D40, D43. Supersedes: route- or controller-local success choreography on top of the generic mutation helper.

26. **`md-pen` for programmatic markdown rendering** — Structured data (entity tables, dependency graphs, checklists) rendered to markdown via `md-pen` rather than hand-rolled string concatenation. Pure string-return functions (`table()`, `taskList()`, `mermaid()`, `heading()`, `alert()`, `details()`) compose by nesting — no AST, no intermediate representation. Escaping is context-aware per function (table cells, URLs, code fences), eliminating a class of bugs when rendering user-supplied text from interviews. Primary use cases: (1) observer context builders presenting growing entity graphs to agents (`table()` for decisions/assumptions with metadata, `taskList()` for reviewed/unreviewed items), (2) spec export rendering active-path entities into downloadable markdown (slice 13), (3) any future agent-facing or user-facing projection of structured data. Zero dependencies, ESM-only, TypeScript-first. Depends on: —. Supersedes: hand-rolled string assembly in context builders.

### Domain model

1. **Turn tree as version history** — The conversation is a tree, not a flat log. Each turn points to its parent. Revisiting a decision forks a new branch. `project.active_turn_id` is the HEAD pointer. The active path determines which entities are current — no snapshot tables needed. Depends on: A6. Supersedes: D5-old snapshot versioning model.
2. **Interview phases as agent skills** — Each phase (scope, design, requirements, criteria) is a separate agent skill with its own system prompt and tool configuration. The server orchestrates which skill to invoke based on phase completion state. Phases can be composed, reordered, or replaced independently. Depends on: A13. Supersedes: —.
3. **Phase resolution via LLM judgment** — A turn's `is_resolution` flag is set by the interviewing agent when it judges that shared understanding has been reached for that phase. The active path is resolved for a phase when its latest turn has `is_resolution = true`. Spec export requires all phases resolved. Depends on: A15. Supersedes: —.
4. **Two-agent pattern (interviewer + observer)** — The interviewer focuses solely on conducting the interview with structured questions. After each answered turn, a separate observer agent extracts decisions, assumptions, and dependency edges. The observer can use a cheaper/faster model. Keeps the interviewer prompt clean and extraction independently testable. Depends on: A3, A4, A14. Supersedes: —.
5. **Decision dependency graph** — Decisions depend on prior decisions and/or assumptions via `decision_parent_decision` and `decision_parent_assumption` join tables. Assumptions can depend on prior assumptions via `assumption_parent_assumption`. The observer agent captures these edges during extraction. Depends on: A14. Supersedes: —.
6. **Soft invalidation for requirements and criteria** — When a decision is revisited (branch fork), requirements traced to that decision are flagged for re-review via stale `reviewed_at` timestamps. Criteria inherit the flag transitively from their requirements. Mechanism specified in D17. Depends on: —. Supersedes: —.

17. **Two invalidation mechanisms — path exclusion and flag propagation** — Path exclusion (lazy): `revisitDecision` → `branch()` moves HEAD; entities on the abandoned branch leave the active path. Requirements are stale when their source decision is not on the active path — computed by the active-path query, no eager writes. Flag propagation (eager): `falsifyAssumption` walks dependency graph edges (`assumption_parent_assumption`, `decision_parent_assumption`), marks dependents. `updateRequirement` nulls `reviewed_at` on traced criteria. Cascade model: falsify assumption → walk graph → flag dependents; revisit decision → branch → path exclusion; update requirement → flag criteria. Depends on: D1, D5, D6. Supersedes: D6's unspecified "holistic" re-qualification.

13. **Observer captures derived intelligence** — The observer agent's extraction mandate extends beyond decisions and assumptions to include derived observations (e.g. codebase analysis, domain insights) that the interviewer surfaced through tool use during a turn. These are persisted so subsequent stateless `query()` calls can inject them as context. The exact entity model is TBD — candidates include a dedicated `observation` table, enriched `decision.rationale`, or a `notes` field on `turn`. Depends on: A14, D12. Supersedes: —.

14. **Part-type rendering via AI Elements** — Client renders message parts using AI Elements copy-paste components: `Reasoning` (auto-open/close collapsible with duration), `MessageResponse` (streaming markdown via `streamdown`), `Tool` (7-state collapsible with status badges). `Conversation` provides auto-scroll. `PromptInput` provides `ChatStatus`-aware submit/stop button. shadcn/ui (radix-nova preset) + Tailwind 4 as the styling foundation. Depends on: A16, A17. Supersedes: hand-rolled inline-styled message rendering.

23. **Parts-based persistence model (UIMessage/ModelMessage split)** — Two separate data layers: (1) **UI render state** (`UIMessage.parts[]` JSON) persisted per turn for faithful resume — captures reasoning blocks, tool-call lifecycle states, text, and custom Data Parts. (2) **Inference context** (`ModelMessage`-equivalent) derived at call time by typed context builders, never persisted. Turn table gains `user_parts` and `assistant_parts` JSON columns (nullable). On stream finish, core assembles final assistant `parts[]` from DomainEvents and persists alongside scalar fields. Hydration reads persisted parts when available, falls back to scalar synthesis for older turns. The turn tree remains canonical for domain semantics (branching, phase, entity joins); parts are the source of truth for rendering. Research: `docs/research/chat-application-data-models-conversation-turns-structured-data-generative-ui-persistence.md`. Depends on: A22. Supersedes: D15's scalar-only persistence model.

24. **Custom Data Parts for structured user input** — User responses are not always plain text. AI SDK Data Parts (`data-{name}` typed via Zod schema) model structured user input: `data-option-selection` (`{ turnId, selectedOptionId, rationale? }`), `data-confirmation` (`{ turnId, confirmed: boolean }`), plain `text` for freeform responses. Defined as a `BrunchDataParts` type passed as generic to `UIMessage<Metadata, DataParts, Tools>` for full-stack type safety. Assistant messages use the same mechanism for domain-specific content not covered by built-in part types: `data-phase-summary`, `data-observer-result`, `data-entity-snapshot`. Depends on: A22, A23. Supersedes: implicit assumption that `turn.answer` is always a text string.

25. **Typed context builders replace monolithic `formatHistory()`** — Different consumers of the turn tree need different projections of the same data. `buildInterviewerContext(activePath, currentInput, entities, phase)` for conversational continuity. `buildObserverContext(turn, activePathSummary, linkedEntities)` for extraction-optimized context (see §Observer History Projection). Future: `buildPhaseResolutionContext(...)`, `buildRequirementsReviewContext(...)`. Each builder reads from the domain model (turn scalars + entity tables), NOT from persisted `UIMessage.parts[]`. The parts are for rendering; context builders are for inference. Depends on: D23, D12. Supersedes: single `formatHistory()` function in core.ts.

### Technical stack

7. **SQLite via better-sqlite3** — Zero-config embedded DB. Turn tree, decisions, assumptions, requirements, criteria all in SQLite tables. Schema defined in Drizzle (see D18). Depends on: A5, A6. Supersedes: Dolt (docker-based).
8. **Express.js server emits AI SDK UI message streams directly** — The chat route validates incoming `BrunchUIMessage[]`, persists the new turn, merges the interviewer stream into `createUIMessageStream`, emits typed observer-result data parts in-band, and pipes the result to the response. No handwritten stream-translation layer remains on the web path. Depends on: A1, A19, D19. Supersedes: hand-rolled NDJSON and DomainEvent-to-SSE translation.
9. **React + Vite + @ai-sdk/react + @tanstack/react-router client** — `useChat` for conversation streaming. TanStack Router for type-safe routing with route loaders for data fetching on navigation (replaces manual `useEffect` hydration). Three routes for MVP: project list (`/`), interview workspace (`/project/:id`), export preview (`/project/:id/export`). See `docs/design/BREADBOARD.md`. Depends on: A9, A10. Supersedes: Preact, both existing frontends, single-page no-routing layout.
10. **npx-launchable single-command distribution** — `bin` entry, launcher starts Express (serves built Vite assets + API on one port), opens browser. Single env var: `ANTHROPIC_API_KEY`. DB auto-created in project directory or `~/.brunch/`. Depends on: A8. Supersedes: multi-step Docker + env var setup.
16. **Integer autoincrement primary keys** — All entity tables use `INTEGER PRIMARY KEY AUTOINCREMENT` instead of `TEXT` UUIDs. SQLite ROWID alias is simpler, matches the original DBML design, avoids UUID generation. No external systems reference these IDs. Client coerces to strings for `useChat` hydration (`turn-${id}-answer`, `turn-${id}-question`). Depends on: D7. Supersedes: `randomUUID()` TEXT PKs from slice 2.
18. **Drizzle ORM replaces raw DDL** — TypeScript schema definition (`drizzle/schema.ts`) is single source of truth for types, DDL, and migrations. Auto-applies from `drizzle/migrations/` at startup. Drizzle Studio available for DB inspection during development. Depends on: A18, D7. Supersedes: raw DDL strings in db.ts, DBML design document, hand-written TypeScript interfaces.
19. **Layered architecture with an AI SDK-native chat boundary** — Core interview orchestration is split into typed helpers (`prepareTurn`, `finalizeTurn`, context builders, persistence helpers) while Express owns the chat stream composition. The boundary between server and client is `BrunchUIMessage`, not a separate in-house event protocol. Observer-result data stays in-band on the same stream for cache coherence (see D22). CLI and MCP can still derive later from the stabilized domain operations, but the web path optimizes for the typed UI-message contract first. Depends on: A19, D8, D12. Supersedes: interview logic embedded in Express POST handler and the DomainEvent-to-SSE translation layer.
21. **oxlint + oxfmt + tsgolint replaces eslint + tsc** — oxlint for linting (including 59 type-aware rules via tsgolint, the Go-based TypeScript backend), oxfmt for formatting (single quotes, 110 width, sorted imports). `npm run fix` (lint:fix + fmt) is the fast inner loop; `npm run verify` (check + test + build) is the commit gate. `--type-check` flag replaces `tsc --noEmit`. Depends on: —. Supersedes: eslint (removed), separate `tsc --noEmit` step.
20. **CLI executable with subcommands** — `npx brunch` launches web UI (default). `npx brunch [command]` for CLI operations on the same DB. Future: sidecar MCP server. Depends on: D10, D19. Supersedes: web-only distribution model in D10.
22. **TanStack Query + in-band observer-result sync** — Observer-created entities sync to the React UI through typed `data-observer-result` parts on the existing chat stream. `useChat`'s `onData` callback invalidates the entity query for the active project; project-state refresh remains route-driven on stream completion. If the observer later becomes async, a dedicated `EventSource` remains the fallback. TanStack Query owns persisted entity state; the chat stream owns transient message state. TanStack DB remains unnecessary for the current server-authoritative model. Research: `docs/research/async-server-state-to-ui-sync-for-chat-observer-agents.md`. Depends on: A20, A21, D4, D9, D19. Supersedes: status-based sidebar refresh workarounds.

## Invariants

<!-- Structural properties proven by implementation and protected by tests.
     Once established, must not regress.
     Each links to the decision it proves and the tests that protect it.
     Established by ln-build/ln-spike traceability.
     Referenced by PLAN.md slices (to establish / to respect). -->

| #   | Invariant                    | Established by      | Protected by                     | Proves  |
| --- | ---------------------------- | ------------------- | -------------------------------- | ------- |
| I1  | SSE protocol conformance     | Slice 1 (skeleton)  | app.test.ts                      | D8      |
| I2  | Stream lifecycle correctness | Slice 1 (skeleton)  | app.test.ts                      | D8      |
| I3  | Thinking/text separation     | Slice 1 (skeleton)  | app.test.ts                      | D8      |
| I4  | Vite proxy routing           | Slice 1 (skeleton)  | vite.config.ts (manual)          | D10     |
| I5  | DB lifecycle correctness     | Slice 2 (SQLite)    | db.test.ts                       | D7      |
| I6  | Turn persistence             | Slice 3 (turn tree) | db.test.ts, app.test.ts          | D1, D7  |
| I7  | Tool call SSE conformance    | Slice 3b (rich UI)  | app.test.ts, manual (outer loop) | D8, D14 |
| I8  | Tool part state rendering    | Slice 3b (rich UI)  | manual (outer loop)              | D14     |
| I9  | Turn tree parent chain       | Slice 3 (turn tree) | db.test.ts                       | D1      |
| I10 | Active path resolution       | Slice 3 (turn tree) | db.test.ts                       | D1      |
| I11 | Drizzle migration auto-apply | Slice 3c (Drizzle)  | db.test.ts                       | D18     |
| I12 | Typed server chat boundary   | Slice 3c (Drizzle)  | core.test.ts, app.test.ts        | D19     |
| I13 | Core/adapter separation      | Slice 3c (Drizzle)  | core.test.ts, app.test.ts        | D19     |
| I14 | Project-scoped API routes    | Slice 3d (routing)  | app.test.ts                      | D9      |
| I15 | Route loader hydration       | Slice 3d (routing)  | manual (outer loop)              | D9      |
| I16 | Schema validation on agent tool output | Slice 4 (scope interview) | interview.test.ts | D2, A13 |
| I17 | Data Part schema validation | Slice 4a (parts persistence) | parts.test.ts (7 tests) | D24 |
| I18 | Parts round-trip fidelity | Slice 4a (parts persistence) | parts.test.ts (8 tests), core.test.ts | D23 |
| I19 | Context builder equivalence | Slice 4a (parts persistence) | context.test.ts (7 tests) | D25 |
| I20 | Entity persistence with turn linkage | Slice 5 (observer) | db.test.ts (7 tests), observer.test.ts | D4, D5 |
| I21 | Observer-result in-band sync | Slice 5 (observer) | observer.test.ts, app.test.ts | D22 |
| I22 | AI SDK-native interviewer path | Slice 6b (AI SDK pivot) | app.test.ts, interview.test.ts | D30, D31 |
| I23 | Entity sidebar reactive update | Slice 6 (sidebar) | app.test.ts, manual (outer loop) | D22 |
| I24 | Workspace hydration boundary stability | Slice 6b1 (workspace oracle) | InterviewWorkspace.test.tsx | D19, D22 |
| I25 | Workspace event bridge correctness | Slice 6b1 (workspace oracle) | InterviewWorkspace.test.tsx | D9, D22 |
| I26 | Progressive code-render fallback | Refactor commit 1 (client characterization coverage) | code-block.test.tsx | D14 |
| I27 | Equal-length branch replacement stability | Refactor commit 1 (client characterization coverage) | message.test.tsx | D14 |
| I28 | Client build boundary observability | Refactor commit 1 (client characterization coverage) | build-boundary.test.ts | — |
| I29 | Heavy client dependency indirection | Refactor commit 2 (client capability boundaries) | capability-boundaries.test.ts | D34 |
| I30 | Default entry excludes debug surface code | Refactor commit 3 (lazy debug route boundary) | build-boundary.test.ts | D35 |
| I31 | Assistant transcript rendering stays text-first until enhancement is needed | Refactor commit 4 (progressive rich rendering split) | markdown-rendering.test.tsx | D36 |
| I32 | Default entry excludes rich rendering and eager highlighting implementation | Refactor commit 4 (progressive rich rendering split) | build-boundary.test.ts | D36 |
| I33 | Workspace state ownership is explicit even while current hydration semantics are preserved | Refactor commit 5 (workspace data adapter) | workspace-data.test.ts, InterviewWorkspace.test.tsx | D37 |
| I34 | Workspace project and entity snapshots enter together through one project-scoped loader boundary | Refactor commit 6 (workspace loading concurrency) | InterviewWorkspace.test.tsx | D38 |
| I35 | Persisted chat state hydrates only on initial project entry or explicit project navigation | Refactor commit 7 (explicit chat hydration policy) | InterviewWorkspace.test.tsx, chat-hydration.test.ts | D39 |
| I36 | Client-triggered writes surface consistent visible failure states instead of silent no-ops | Refactor commit 8 (shared client mutations) | InterviewWorkspace.test.tsx, ProjectList.test.tsx | D40 |
| I37 | Code highlighting upgrades from lifecycle-owned async work and ignores stale completions during prop churn | Refactor commit 9 (render-sensitive primitive purity) | code-block.test.tsx | D41 |
| I38 | Message branch navigation stays aligned with the current branch set after replacement or shrink | Refactor commit 9 (render-sensitive primitive purity) | message.test.tsx | D41 |
| I39 | Advanced rendering boundaries expose intent-preload seams while keeping animated transcript content on the plain first-paint path | Refactor commit 10 (intent preloading + performance guardrails) | markdown-rendering.test.tsx, code-block.test.tsx, capability-boundaries.test.ts | D42 |
| I40 | The default client entry remains under an explicit size budget while excluding debug and rich-rendering payloads | Refactor commit 10 (intent preloading + performance guardrails) | build-boundary.test.ts | D42 |
| I41 | Workspace controller behavior is protected below the route boundary for loader seeding and same-project refresh stability | Refactor commit 14 (controller seam oracles) | workspace-controller.test.tsx | D43 |
| I42 | Shared client mutation transport reports network, non-JSON, and malformed-success failures consistently | Refactor commit 14 (mutation seam oracles) | client-mutation.test.ts | D44 |

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
| **phase**             | A stage of the interview: `scope`, `design`, `requirements`, `criteria`. Immutable provenance on each turn. Each phase is implemented via `getSystemPrompt(phase)` plus typed AI SDK tools. See D2, A13 |
| **phase resolution**  | LLM judgment that shared understanding has been reached for a phase. Marked by `turn.is_resolution = true` on the last turn of a phase                                                                            |
| **ask_question tool** | The typed AI SDK tool the interviewer must use each turn. Accepts `{ question, why, impact, options[] }`, validated by `structuredQuestionSchema` (Zod). The tool handler persists structured data to the turn and options tables via closure over `db` + `turnId`. Defined in `interview.ts` |
| **agent loop**        | The stepwise interviewer control path. Today this is provided by AI SDK `ToolLoopAgent`; future phase-resolution work may wrap or replace it for tighter multi-step control. See D31 |
| **interviewer**       | The primary agent role: conducts the interview with structured questions, grounding, and impact signals. Must use the `ask_question` tool every turn. Does not extract entities                                    |
| **observer**          | The secondary agent role: extracts decisions, assumptions, and dependency edges from each answered turn. Runs post-answer during user read time                                                                   |
| **core**              | The interface-agnostic service layer between the database and transport adapters. Owns turn preparation/finalization, context building, project state, and entity lifecycle. The web chat stream is assembled in Express over shared `BrunchUIMessage` contracts |
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
| **in-band sync**      | Observer entity updates delivered as typed data parts on the existing chat SSE stream. Default mechanism — zero additional infrastructure (D22)                                                                     |
| **out-of-band sync**  | Observer entity updates delivered via a dedicated `EventSource` SSE channel (`/api/events/:projectId`). Fallback mechanism if observer becomes async (D22)                                                        |
| **cache invalidation** | Signaling TanStack Query that cached data is stale. In the current web path, `useChat` `onData` invalidates the entity query from `data-observer-result`, while route invalidation refreshes project state on stream completion |
| **ToolLoopAgent**     | AI SDK's built-in agent class that manages the model → tool-call → execute → re-submit loop. Powers the interviewer. Configured with `tools`, `stopWhen`, `providerOptions`. Methods: `generate()` (non-streaming), `stream()` (streaming). See D31 |
| **generateObject**    | AI SDK function for structured output. Takes a Zod schema, returns a validated object. Powers the observer's entity extraction. No JSON parsing needed. See D30 |
| **core tools**        | 7 generic filesystem tools (read, write, edit, bash, grep, find, ls) in `src/server/tools/`. Factory: `createCoreTools(cwd)`. Follow pi-mono's pattern. See D32 |
| **BrunchUIMessage**   | `UIMessage<BrunchMessageMetadata, BrunchDataParts, BrunchUITools>` — the typed message contract spanning server validation, persistence, SSE streaming, and client hydration. Defined in `src/shared/chat.ts` |

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
| `onData` stale-closure correctness | The workspace seam now has a component-level integration oracle, but it still mocks `useChat` and does not prove the exact live browser/runtime behavior of the AI SDK hook. Known `onFinish` stale-closure bug (ai-sdk#550) may still affect production wiring. | `InterviewWorkspace.test.tsx` protects the app-side invalidation logic; manual outer-loop validation remains required for live browser/runtime confirmation. If broken, fall back to parallel `EventSource` (D22 Option 2). | If sidebar fails to update after observer extraction during manual testing. |
| Parts/scalar consistency | Persisted `assistant_parts` and scalar fields (`question`, `why`, `impact`, options) are two representations of the same turn content. No programmatic check that they agree. | Acceptable for initial delivery — scalars are written by MCP tool handler, parts assembled from stream. Both derive from the same `query()` call. Future: metamorphic oracle (text in parts matches scalars). | If turns appear correct in one view (parts-based UI) but wrong in another (scalar-based entity queries or export). |

### Current Coverage

<!-- Updated by ln-build traceability after each slice. -->

| File             | Tests | Protects                 |
| ---------------- | ----- | ------------------------ |
| db.test.ts       | 32    | I5, I6, I9, I10, I11, I20 |
| app.test.ts      | 6     | I1, I2, I3, I7, I14, I21, I23 |
| core.test.ts     | 6     | I12, I13, I18           |
| interview.test.ts| 6     | I16                     |
| parts.test.ts    | 7     | I17, I18                |
| context.test.ts  | 8     | I19                     |
| observer.test.ts | 2     | I20, I21                |
| InterviewWorkspace.test.tsx | 6 | I24, I25, I23, I33, I34, I35, I36 |
| ProjectList.test.tsx | 2 | I36 |
| workspace-data.test.ts | 4 | I33 |
| chat-hydration.test.ts | 3 | I35 |
| workspace-controller.test.tsx | 2 | I41 |
| client-mutation.test.ts | 3 | I42 |
| code-block.test.tsx | 4 | I26, I37, I39 |
| markdown-rendering.test.tsx | 3 | I31, I39 |
| message.test.tsx | 2 | I27, I38 |
| build-boundary.test.ts | 1 | I28, I30, I32, I40 |
| capability-boundaries.test.ts | 2 | I29, I39 |

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
