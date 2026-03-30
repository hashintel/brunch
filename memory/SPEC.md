# Brunch v2 — Spec Elicitation Tool

## Problem Statement

Brunch is an inherited prototype that turns natural-language project goals into structured specifications through an AI-guided interview. The prototype works but is overbuilt: it requires Docker (Dolt), an optional OpenCode sidecar process, has two parallel frontend implementations, a hand-rolled NDJSON streaming protocol that drops ~80% of available agent events, and domain terminology that doesn't match what the entities actually represent.

The tool cannot be launched with a single command. It requires multiple env vars, a running Docker container, and manual setup. The codebase is plain JS with no type safety, duplicated CRUD logic across two tool surfaces, and four near-identical streaming functions.

The user needs a clean, focused v1 that can be installed and run with `npx brunch` and at most one or two environment variables.

## Solution

Rebuild Brunch as a single-command local tool that guides users through a structured AI interview to produce a fire-and-forget SPEC.md. The interview is driven by the Claude Agent SDK with the full event surface (thinking, tool progress, subagent events, permissions) streamed to a React frontend via the Vercel AI SDK's documented SSE protocol.

The architecture:

- **Agent engine**: Claude Agent SDK (`query()`) — provides tool use, MCP, session resume, subagents, permissions, and rich streaming events
- **Server**: Express.js (plain JS) — iterates SDK messages, translates them to AI SDK's SSE data stream protocol. No AI SDK runtime imported server-side; just emit conformant SSE
- **Transport**: AI SDK UI Message Stream protocol (SSE with typed JSON events: `text-delta`, `reasoning-delta`, `tool-input-*`, `data-*` custom parts)
- **Client**: React + Vite + `@ai-sdk/react` `useChat` hook — consumes the SSE stream natively, manages message state, provides status/stop/regenerate
- **Database**: SQLite via `better-sqlite3` — zero-config, embedded, ships as npm prebuilt binary
- **Output**: Flattened markdown SPEC.md exported on demand

## User Stories

1. As a developer, I want to run `npx brunch` with just an `ANTHROPIC_API_KEY` env var and have the tool open in my browser, so that setup is instant.

2. As a user, I want to describe what I'm building and have the AI walk me through a structured interview, so that I produce a thorough spec without missing important decisions.

3. As a user, I want to see the AI's thinking process, tool usage, and progress in real-time as it streams, so that I have CLI-quality visibility into what the agent is doing.

4. As a user, I want to see accumulated entities (decisions, assumptions, requirements, acceptance criteria) appear in a dashboard as the interview progresses, so that I can see what's been established so far.

5. As a user, I want the AI to present structured questions with at least two options and a recommendation, so that each design fork is explicit and my choices are recorded.

6. As a user, I want to be able to ask clarifying questions or push back on any interview question without derailing the main flow, so that I can explore before committing.

7. As a user, I want a summary and confirmation gate at each phase transition (scope → design → criteria), so that I can review what's been captured before moving on.

8. As a user, I want to export the current spec as a markdown file at any time, so that I can hand it to a coding agent or share it with my team.

9. As a user, I want to close the browser and come back later to resume my interview where I left off, so that I'm not forced to complete it in one sitting.

10. As a user, I want to revisit and change previous decisions, then re-export, so that the spec evolves as my understanding deepens.

## Implementation Decisions

### Architecture: two-LLM-call pattern (interviewer + extractor)

The interviewer LLM focuses solely on conducting a high-quality interview — asking questions, providing options, responding to answers. It does not call entity CRUD tools.

After each exchange completes, a separate structured-output LLM call extracts entities (decisions, assumptions, requirements, etc.) from the exchange + current entity state. This runs during user read/think time (zero perceived latency). The extraction call can use a cheaper/faster model (e.g. Haiku).

Rationale: separating interviewer from entity extraction keeps the interview prompt clean and the extraction testable independently.

### Interview phases

0. **Pre-prompting** (optional) — category-narrowing quiz to set context
1. **Scope establishment** — user states intent, LLM interviews to surface boundaries, hard requirements, non-goals. Initial acceptance criteria accumulate in background.
2. **Design tree exploration** — LLM works down every aspect of how things should work. Every question is a fork with ≥2 options + recommendation + open-ended "something else." Sub-routines may include feature exploration (shape-up style) and module design.
3. **Acceptance criteria validation** — all criteria (explicit + background) surfaced and validated. LLM proposes additional criteria, walks risks, failure modes, caveats.

Phase transitions: LLM proposes, user confirms. The summary-and-confirm pattern serves as both UX checkpoint and entity consolidation moment.

Interview length is emergent, not predetermined. The LLM drives the conversation until shared understanding is reached.

### Interaction model: guided chat with structured escape hatch

The main flow is LLM-driven: it presents structured questions, user responds. But at any question, the user can enter a freeform digression ("ask me about this"). Freeform chat is a separate LLM call scoped to the current question's context, so tangents don't pollute the interview transcript or entity extraction.

### Entity model (materialized for UI, derived from exchanges)

Entities are materialized into SQLite for the dashboard, but the interview exchange is the source of truth. The extraction step creates/updates entities after each exchange.

**Tables:**

- `project` — identity, phase, pathway, model, timestamps
- `interview_exchange` — the universal interaction primitive: question, why, options, recommendation, answer, phase, lens, sort_order
- `goal` — versioned refined goal text
- `scope` — inclusions, exclusions, constraints (linked to source exchange)
- `decision` — resolved design forks with options considered, chosen, rationale, lens (linked to source exchange)
- `assumption` — falsifiable beliefs with confidence and impact_if_wrong (linked to source exchange)
- `requirement` — what the system must do, with rationale and priority (linked to source exchange)
- `acceptance_criterion` — testable conditions linked to requirements, with verification_type
- `risk` — failure modes with severity, likelihood, mitigation
- `spec_output` — versioned rendered markdown specs

Join tables deferred to v2: `decision_assumption`, `decision_dependency`, `risk_decision`, `risk_criterion`. For v1, relationships are captured in the spec text, not enforced in schema.

### Snapshot-based versioning (replaces Dolt)

A `project_snapshot` table with `(project_id, version, snapshot_json, created_at)`. The snapshot is a serialized dump of all entity state for the project. Created at phase transitions and on-demand. Diff is client-side JSON comparison. Undo = restore from previous snapshot.

### Server: Express.js, plain JS

The server stays plain JS. The Claude Agent SDK's `query()` async generator is iterated in an Express route handler. Each `SDKMessage` is translated into an SSE event conforming to AI SDK's UI Message Stream protocol:

- `SDKPartialAssistantMessage` (type `stream_event`) → `text-delta`, `reasoning-delta`, `tool-input-*` events
- `SDKToolProgressMessage` → `data-tool-progress` custom event
- `SDKResultMessage` → `finish` event with usage metadata
- `SDKSystemMessage` → `data-system-init` custom event
- `SDKTaskStartedMessage` / `SDKTaskProgressMessage` → `data-task-*` custom events

Response headers: `Content-Type: text/event-stream`, `x-vercel-ai-ui-message-stream: v1`.

Domain-specific events (entity extraction results, phase transitions) use AI SDK's `data-*` custom part pattern.

### Client: React + Vite + @ai-sdk/react

- `useChat` hook for the conversation column (streaming, status, stop, message state)
- Custom React components for the entity dashboard (reads from app state, updated via `data-*` stream events)
- Phase indicator (scope → design → criteria → complete)
- Freeform "explore this" side-panel as a separate `useChat` instance scoped to current question context

### Distribution: npx-launchable

- `bin` entry in package.json pointing to a launcher script
- Launcher: starts Express server (serves built Vite assets + API on one port), opens browser
- Single required env var: `ANTHROPIC_API_KEY`
- SQLite DB file created automatically in project directory or `~/.brunch/`
- `vite build` produces static assets; Express serves them from `/dist`

### What gets dropped from current codebase

- Dolt and all `mysql2` code
- OpenCode sidecar (`opencode.js`, `opencode-mcp-server.js`, `opencode.json`)
- Preact (replaced by React)
- Both existing frontend page implementations (Home/ and CreateSpec/)
- Hand-rolled NDJSON streaming protocol
- JSON Schema definitions (replaced by Zod)
- `@tanstack/react-table`, `@dnd-kit/*`, `dompurify`, `marked` (dead or replaceable deps)
- Four streaming functions in `claude.js` (replaced by one adapter)
- `dispatch.js` (no longer routing between backends)

### What survives as reference

- The Claude Agent SDK integration pattern (proof that `query()` + `includePartialMessages` works)
- Express server structure (routes, middleware)
- Vite config (adapted for React)
- Test structure (Vitest + Supertest pattern)
- REMODEL.md domain model (entity definitions, relationship thinking)

## Testing Decisions

- **Entity extraction**: unit-testable. Given an exchange and current entity state, does the extractor produce correct entity operations? Use snapshot fixtures from real interview exchanges.
- **SSE adapter**: unit-testable. Given an `SDKMessage`, does the adapter emit the correct SSE event string? Mock the SDK message types, assert output format.
- **Interview flow**: integration-testable via Supertest. POST a user message, assert SSE stream contains expected event types in expected order.
- **Snapshot versioning**: unit-testable. Create entities, snapshot, modify, snapshot again, restore, assert state matches.
- **Prior art**: existing test suite uses Vitest + Supertest with 64 tests across 3 files. Same pattern, new tests.

## Out of Scope

- **Multi-provider support** — v1 is Anthropic-only via Claude Agent SDK. No OpenAI, Gemini, or Ollama.
- **Decision DAG tracking** — join tables and graph structure deferred. Relationships captured in spec text.
- **Belief invalidation / cascading updates** — fire-and-forget model; no runtime propagation.
- **Task planning / execution orchestration** — consumers of the spec, not part of this tool.
- **Exploratory pathway** — assumes user has a reasonably defined goal.
- **Multi-user / collaborative editing** — single-user local tool.
- **Custom model selection UI** — single model, configurable via env var at most.
- **Dolt version control UI** — replaced by snapshot tables.
- **AG-UI / CopilotKit integration** — not needed; AI SDK SSE protocol is sufficient.

## Q&A

**Q: Why keep the Claude Agent SDK instead of using AI SDK end-to-end?**
A: The Claude Agent SDK is the full Claude Code engine — it provides MCP support, session resume, subagent orchestration, permission flow, file checkpointing, tool progress events, and 20+ typed message types. AI SDK's Anthropic provider is a thinner wrapper that loses all of this. For CLI-quality feedback in the UI, the rich event surface matters.

**Q: How does AI SDK fit if we're not using its server functions?**
A: AI SDK's value here is purely the documented SSE protocol and the React `useChat` hook. The server emits SSE events matching AI SDK's UI Message Stream format (documented, public, stable). The client imports only `@ai-sdk/react`. No AI SDK runtime code on the server. Clean seam.

**Q: Why not AG-UI?**
A: AG-UI is a protocol for multi-backend interop; the actual React components come from CopilotKit. No Claude Agent SDK integration exists. Adopting it means coupling to CopilotKit's component model, which fights the custom interview UI. The AI SDK SSE protocol gives us what we need without the abstraction tax.

**Q: Why not TanStack AI?**
A: Alpha software (v0, 269 commits). Promising — has `ThinkingPart` first-class, flexible connection adapters — but too young for a deliverable. Worth revisiting if AI SDK becomes constraining.

**Q: Why SQLite over Dolt?**
A: The product needs versioning/time-travel (undo to previous spec state) but not branching/merging. Dolt's differentiator is cell-level merge conflict resolution across concurrent writers — a multi-user, multi-branch problem this single-user tool doesn't have. A `project_snapshot` table on SQLite gives undo/redo with zero external dependencies. Dolt embedded mode (no Docker) still requires users to `brew install dolt` before `npx brunch` works.

**Q: Why separate the interviewer from entity extraction?**
A: The interview quality is the core product differentiator. Loading the interviewer prompt with "also call these 12 entity CRUD tools as you go" splits its attention. The current codebase shows this tension — the prompts try to do both and the spec output tends to reiterate rather than add. Pattern B (separate extraction) keeps the interviewer focused and makes extraction independently testable.

**Q: Does entity extraction add latency?**
A: No perceived latency. The extraction call fires as soon as the LLM's question streams to completion. It runs during user read/think time (typically 10-60 seconds). A structured-output call to a fast model completes in 1-3 seconds.

**Q: Does the interview need to survive browser refresh?**
A: Yes. Sessions are persistent — user can close the tab and resume later. The Claude Agent SDK has built-in `resume` (pass a session_id). Application state (phase, entities, exchange history) persists in SQLite.

**Q: What's the interaction model — wizard or chat?**
A: Guided chat with structure. The LLM drives the conversation (not a fixed-step wizard), but each question has structured options. The user can enter freeform digressions via a side-channel without polluting the main interview transcript. Phase transitions are explicit confirm gates.
