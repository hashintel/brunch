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

The architecture:

- **Agent engine**: Claude Agent SDK (`query()`) — tool use, MCP, session resume, subagents, permissions, rich streaming events. Each interview phase is an agent skill.
- **Observer agent**: Separate extraction call after each turn — captures decisions, assumptions, and their dependency edges
- **Server**: Express.js — iterates SDK messages, translates to AI SDK's UI Message Stream SSE protocol. No AI SDK runtime server-side
- **Transport**: AI SDK UI Message Stream protocol (SSE with typed JSON events)
- **Client**: React + Vite + `@ai-sdk/react` `useChat` hook — consumes SSE natively
- **Database**: SQLite via `better-sqlite3` — zero-config, embedded
- **Output**: Flattened markdown spec exported on demand from the active path's entities

## Constraints & Non-goals

- **Anthropic-only** — no multi-provider support (OpenAI, Gemini, Ollama)
- **No belief invalidation cascading** — revisiting a decision soft-invalidates downstream (flags for review), but there is no automatic runtime propagation through the graph
- **No task planning** — consumers of the spec, not part of this tool
- **No exploratory pathway** — assumes user has a reasonably defined goal
- **Single-user** — no collaborative editing
- **No custom model selection UI** — single model, configurable via env var at most
- **No Dolt** — replaced by SQLite with turn-tree versioning
- **No AG-UI / CopilotKit** — AI SDK SSE protocol is sufficient
- **No assistant-ui** — its runtime abstraction layer (`AssistantRuntimeProvider`) adds unnecessary indirection over `useChat`; brunch emits custom SSE from Express, not from AI SDK server-side, so the adapter chain (useChat → useChatRuntime → AssistantRuntimeProvider) is overhead without benefit

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

| #   | Assumption                                                                                                                        | Confidence | Dependent decisions | Implicated slices          | Validation approach                                            |
| --- | --------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------- | -------------------------- | -------------------------------------------------------------- |
| A1  | AI SDK's UI Message Stream SSE protocol is documented and stable enough to emit conformantly without importing AI SDK server-side | **validated** | D8                | Walking skeleton           | Validated: skeleton emits conformant SSE, 15 tests pass        |
| A2  | Claude Agent SDK `query()` with `includePartialMessages` provides all streaming event types needed for CLI-quality feedback       | **validated** | D8                | Walking skeleton           | Validated: adapter translates stream_event messages correctly  |
| A3  | Separating interviewer from observer produces better interview quality than inline tool calling                                   | medium     | D1                  | Observer agent             | Compare interview coherence with and without tool-calling load |
| A4  | Observer extraction completes in 1-3s during user read/think time (10-60s), adding zero perceived latency                         | medium     | D1                  | Observer agent             | Measure extraction latency with realistic turn payloads        |
| A5  | `better-sqlite3` npm prebuilt binary works across macOS/Linux without native compilation issues                                   | **validated** | D7                | SQLite foundation          | Validated: installed on macOS without native compilation issues |
| A6  | Turn-tree branching in SQLite is sufficient for decision revisit and undo in a single-user tool                                   | high       | D7                  | Turn tree                  | Validate with realistic branch/merge scenarios                 |
| A7  | Users arriving at the tool have a reasonably defined goal                                                                         | medium     | —                   | Scope phase                | User testing; exploratory pathway deferred if false            |
| A8  | A single Express port serving API + static assets is sufficient for npx distribution                                              | **validated** | D10                | npx distribution           | Validated: Vite proxy to Express works in dev; single port     |
| A9  | TanStack AI is too immature for a deliverable (alpha, v0)                                                                         | medium     | D9                  | —                          | Re-evaluate if AI SDK becomes constraining                     |
| A10 | The `useChat` hook can consume custom SSE without AI SDK server runtime                                                           | **validated** | D9                | Walking skeleton           | Validated: useChat consumes custom SSE via DefaultChatTransport |
| A11 | Stateless `query()` with prompt-stuffed history is sufficient for multi-turn interviewing — SDK session persistence is unnecessary and undesirable | **validated** | D8, D12           | SQLite foundation          | Validated: formatting history into prompt works. SDK sessions rejected as competing source of truth — opaque, machine-local, incompatible with portable data goals (atomic YAML / git-versionable). Turn tree is sole session model. |
| A12 | `useChat` hook accepts initial messages to hydrate conversation state from server-stored history                                    | **validated** | D9                | SQLite foundation          | Validated: `useChat` doesn't have `initialMessages` prop but `setMessages` works for hydration |
| A13 | Claude Agent SDK supports defining interview phases as agent skills with distinct system prompts and tool sets                      | medium     | D2                  | Interview phases           | Test SDK skill/agent configuration API                         |
| A14 | A second-thread observer agent can reliably extract decisions, assumptions, and dependency edges from a single turn's Q&A          | medium     | D1                  | Observer agent             | Probe with realistic interview exchanges; measure extraction fidelity |
| A15 | The LLM can reliably judge when a phase interview has reached sufficient understanding (is_resolution)                             | medium     | D3                  | Phase resolution           | Probe across varied project types; measure false-positive resolution rate |
| A16 | AI SDK `useChat` hook's `ToolUIPart` state machine (`input-streaming` → `input-available` → `output-available` / `output-error` / `approval-requested` → `approval-responded` / `output-denied`) models all permutations of pending, error, and success for both interim (thinking, tool calls) and final (response) data | high | D14 | Rich chat UI | Validate by extending SSE adapter to emit tool-call events, confirm `useChat` surfaces all states |
| A17 | AI Elements copy-paste components can be restyled without forking — they are ownable source files, not npm-locked dependencies      | high       | D14                 | Rich chat UI               | Install via CLI, inspect source, confirm no hidden npm runtime dependency |

## Decisions

### Domain model

1. **Turn tree as version history** — The conversation is a tree, not a flat log. Each turn points to its parent. Revisiting a decision forks a new branch. `project.active_turn_id` is the HEAD pointer. The active path determines which entities are current — no snapshot tables needed. Depends on: A6. Supersedes: D5-old snapshot versioning model.
2. **Interview phases as agent skills** — Each phase (scope, design, requirements, criteria) is a separate agent skill with its own system prompt and tool configuration. The server orchestrates which skill to invoke based on phase completion state. Phases can be composed, reordered, or replaced independently. Depends on: A13. Supersedes: —.
3. **Phase resolution via LLM judgment** — A turn's `is_resolution` flag is set by the interviewing agent when it judges that shared understanding has been reached for that phase. The active path is resolved for a phase when its latest turn has `is_resolution = true`. Spec export requires all phases resolved. Depends on: A15. Supersedes: —.
4. **Two-agent pattern (interviewer + observer)** — The interviewer focuses solely on conducting the interview with structured questions. After each answered turn, a separate observer agent extracts decisions, assumptions, and dependency edges. The observer can use a cheaper/faster model. Keeps the interviewer prompt clean and extraction independently testable. Depends on: A3, A4, A14. Supersedes: —.
5. **Decision dependency graph** — Decisions depend on prior decisions and/or assumptions via `decision_parent_decision` and `decision_parent_assumption` join tables. Assumptions can depend on prior assumptions via `assumption_parent_assumption`. The observer agent captures these edges during extraction. Depends on: A14. Supersedes: —.
6. **Soft invalidation for requirements and criteria** — When a decision is revisited (branch fork), requirements traced to that decision are flagged for re-review via stale `reviewed_at` timestamps. Criteria inherit the flag transitively from their requirements. The agent handles re-qualification holistically, not mechanistically. Depends on: —. Supersedes: —.

12. **Stateless SDK integration — no session persistence** — Each `query()` call uses `persistSession: false`. Conversation context is reconstructed from the turn tree's active path and injected as formatted history + structured entity summaries. SDK sessions (`resume`, `fork`, session IDs) are not used. The turn tree is the sole session model. Rationale: SDK sessions are an opaque, machine-local competing source of truth incompatible with brunch's branching semantics and future portable-data goals (atomic YAML, git-versionable). Depends on: A11. Supersedes: implicit reliance on SDK session state.
13. **Observer captures derived intelligence** — The observer agent's extraction mandate extends beyond decisions and assumptions to include derived observations (e.g. codebase analysis, domain insights) that the interviewer surfaced through tool use during a turn. These are persisted so subsequent stateless `query()` calls can inject them as context. The exact entity model is TBD — candidates include a dedicated `observation` table, enriched `decision.rationale`, or a `notes` field on `turn`. Depends on: A14, D12. Supersedes: —.

14. **AI Elements for rich chat UI components** — Copy-paste component source files (via `npx ai-elements`) from Vercel's AI Elements registry, built on shadcn/ui + Radix. Components directly consume AI SDK's `ToolUIPart` types and `useChat` hook state. Provides `Tool` (7-state lifecycle), `Reasoning` (collapsible), `ChainOfThought` (groups reasoning + tool calls), `Message`, `Conversation`, `PromptInput`. Source files are owned, not npm-locked — full restyle control. No runtime abstraction layer. Depends on: A16, A17. Supersedes: hand-rolled message rendering in App.tsx.

### Technical stack

7. **SQLite via better-sqlite3** — Zero-config embedded DB. Turn tree, decisions, assumptions, requirements, criteria all in SQLite tables. Schema defined in `docs/design/schema.dbml`. Depends on: A5, A6. Supersedes: Dolt (docker-based).
8. **Express.js server emits AI SDK-conformant SSE** — Iterates SDK's `query()` async generator, translates each `SDKMessage` into SSE events matching AI SDK's UI Message Stream protocol via per-request translator factory. No AI SDK runtime imported server-side. Depends on: A1, A2. Supersedes: hand-rolled NDJSON streaming.
9. **React + Vite + @ai-sdk/react client** — `useChat` for conversation streaming. Custom components for decision/entity dashboard. Phase indicator and navigation. Depends on: A9, A10. Supersedes: Preact, both existing frontends.
10. **npx-launchable single-command distribution** — `bin` entry, launcher starts Express (serves built Vite assets + API on one port), opens browser. Single env var: `ANTHROPIC_API_KEY`. DB auto-created in project directory or `~/.brunch/`. Depends on: A8. Supersedes: multi-step Docker + env var setup.
11. **Drop list** — Dolt/mysql2, OpenCode sidecar, Preact, both existing frontend implementations, NDJSON protocol, JSON Schema definitions (→ Zod), @tanstack/react-table, @dnd-kit/, dompurify, marked, four streaming functions in claude.js, dispatch.js. Depends on: —. Supersedes: —.

## Invariants

<!-- Structural properties proven by implementation and protected by tests.
     Once established, must not regress.
     Each links to the decision it proves and the tests that protect it.
     Established by ln-build/ln-spike traceability.
     Referenced by PLAN.md slices (to establish / to respect). -->

| #   | Invariant                    | Established by     | Protected by                      | Proves |
| --- | ---------------------------- | ------------------ | --------------------------------- | ------ |
| I1  | SSE protocol conformance     | Slice 1 (skeleton) | sse-adapter.test.ts               | D8     |
| I2  | Stream lifecycle correctness | Slice 1 (skeleton) | app.test.ts                       | D8     |
| I3  | Thinking/text separation     | Slice 1 (skeleton) | sse-adapter.test.ts, app.test.ts  | D8     |
| I4  | Vite proxy routing           | Slice 1 (skeleton) | vite.config.ts (manual)           | D10    |
| I5  | DB lifecycle correctness     | Slice 2 (SQLite)   | db.test.ts                        | D7     |
| I6  | Turn persistence             | Slice 3 (turn tree) | db.test.ts, app.test.ts          | D1, D7 |
| I7  | Tool call SSE conformance    | Slice 3b (rich UI) | sse-adapter.test.ts               | D8, D14 |
| I8  | Tool part state rendering    | Slice 3b (rich UI) | manual (outer loop)               | D14    |
| I9  | Turn tree parent chain       | Slice 3 (turn tree) | db.test.ts                       | D1     |
| I10 | Active path resolution       | Slice 3 (turn tree) | db.test.ts                       | D1     |

## Lexicon

<!-- Canonical terms. Code names must match.
     Method terms come first, then project-specific domain terms.
     Survey with ln-review; realign with ln-refactor. -->

### Method terms

| Term            | Definition                                                                                    |
| --------------- | --------------------------------------------------------------------------------------------- |
| **assumption**  | A falsifiable belief accepted as true; tracked with confidence, linked to decisions and slices |
| **decision**    | A recorded choice that resolves a question; ordered, with supersession chain                  |
| **invariant**   | A structural property proven by implementation and protected by tests; must not regress       |
| **requirement** | A capability the system must provide                                                          |
| **slice**       | A thin end-to-end tracer-bullet path through all integration layers                          |
| **spike**       | A time-boxed throwaway investigation to answer one hard question                             |

### Domain terms

| Term                    | Definition                                                                                                                  |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **project**             | A spec elicitation session. Has a name, a HEAD pointer (`active_turn_id`), and phase completion state                      |
| **turn**                | One question-answer pair in the interview. Carries phase provenance, options, grounding ("why"), impact signal, and the user's answer. Points to its parent turn — the turn tree is the version history |
| **option**              | A structured alternative presented in a turn. At least two per turn. One may be recommended; one is selected by the user   |
| **decision**            | A resolved fork in the design tree. Extracted by the observer from an answered turn. Depends on prior decisions and/or assumptions. Traced back to its source turn via `turn_decision` |
| **assumption**          | A falsifiable belief a decision rests on. Extracted by the observer. Can depend on prior assumptions. Traced back to its source turn via `turn_assumption` |
| **requirement**         | What the system must do. Accumulated during the design drill-down, confirmed during the requirements review phase. Traced to source decisions via `requirement_decision`. Has `reviewed_at` for soft-invalidation |
| **criterion**           | A testable condition verifying a requirement. Proposed by the agent during the criteria phase, confirmed by the user. Has `reviewed_at` for soft-invalidation |
| **active path**         | The branch from HEAD to root in the turn tree. Determines which turns, decisions, and assumptions are currently active     |
| **phase**               | A stage of the interview: `scope`, `design`, `requirements`, `criteria`. Immutable provenance on each turn. Each phase is backed by an agent skill |
| **phase resolution**    | LLM judgment that shared understanding has been reached for a phase. Marked by `turn.is_resolution = true` on the last turn of a phase |
| **interviewer**         | The primary agent role: conducts the interview with structured questions, grounding, and impact signals. Does not extract entities |
| **observer**            | The secondary agent role: extracts decisions, assumptions, and dependency edges from each answered turn. Runs post-answer during user read time |
| **decision graph**      | The DAG of decisions and their dependencies (on prior decisions and assumptions). Revisiting a decision forks the turn tree |
| **soft invalidation**   | When a decision is revisited, requirements traced to it are flagged for re-review (stale `reviewed_at`). Criteria inherit the flag transitively. The agent re-qualifies holistically |
| **spec readiness**      | Compound predicate: all four phases resolved AND requirements reviewed AND criteria confirmed. Only then is export enabled |

## Verification Design

<!-- Three-tier feedback loops, cheapest first.
     Inner: agent-autonomous, always-on (ms–seconds).
     Middle: regression gates (seconds–minutes).
     Outer: human observer, strategy redirect (minutes–hours). -->

### Verification Commands

| Step | Check          | Command                |
| ---- | -------------- | ---------------------- |
| 1    | Type checking  | `npx tsc --noEmit`     |
| 2    | Unit tests     | `npx vitest run`       |
| 3    | Build          | `npx vite build`       |

### Verification Policy

End-to-end slices must be **user-testable**, not just programmatically tested. Each slice that touches the user-facing boundary should be manually verifiable via `npm run dev` (or equivalent). Use `/tool-cmux` for dev server panes and `/tool-cdp-cli` for browser interaction during outer-loop verification.

### Feedback Loops

- **Inner loop** (ms–seconds): type checks, fast unit tests, linting — agent-autonomous, always-on
  - SSE adapter: given an `SDKMessage`, assert correct SSE event string output → protects I1, I3
  - Turn persistence: given a turn with options, assert correct storage and retrieval → protects I5, I6
  - Observer extraction: given a turn's Q&A, assert correct decision/assumption output (snapshot fixtures)
  - Active path: given a branched turn tree, assert correct entity resolution from HEAD
  - Tool call SSE: given an SDK `tool_use` content block, assert correct `tool-call-streaming-start`, `tool-call-delta`, `tool-call` events → protects I7
- **Middle loop** (seconds–minutes): integration tests, regression gates
  - Interview flow: POST user message via Supertest, assert SSE stream contains expected event types in order → protects I2
  - DB lifecycle: create project → persist turns → close → reopen → assert state intact → protects I5
  - Decision revisit: create branch → verify active path resolves correctly → verify soft invalidation flags
- **Outer loop** (minutes–hours): e2e, human observer
  - Rich chat rendering: tool calls show all 7 states (input-streaming, input-available, approval-requested, approval-responded, output-available, output-error, output-denied), reasoning collapses, message parts render by type → protects I8
  - Full interview walkthrough in browser: structured questions render with options/grounding/impact, decisions appear in dashboard, phase transitions work
  - Resume test: close browser mid-interview, reopen, verify turn tree and entity state intact
  - Decision revisit: navigate to a previous decision, fork, verify dashboard updates and invalidation
  - Export test: complete all phases, export spec, verify markdown contains all active-path entities

### Current Coverage

<!-- Updated by ln-build traceability after each slice. -->

| File                     | Tests | Protects              |
| ------------------------ | ----- | --------------------- |
| sse-adapter.test.ts      | 12    | I1, I3                |
| db.test.ts               | 18    | I5, I6, I9, I10       |
| app.test.ts              | 9     | I2, I3, I6            |

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
