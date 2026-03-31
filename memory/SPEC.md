<!-- SPEC.md — single source of truth for WHAT we're building and WHY.
     Created by ln-spec · Read by all skills · Updated by ln-sync.
     Authority: requirements, constraints, assumptions, decisions, domain language, verification strategy.

     When re-running ln-spec: read this file first, preserve existing content, evolve sections that need change.
     Cross-referenced by PLAN.md slices and spikes via §-prefixed section links. -->

# Brunch v2 — Spec Elicitation Tool

## Concept & Goal

<!-- Why this exists and what success looks like. The "why" shapes the solution space. -->

Brunch is an AI-guided spec elicitation tool that turns natural-language project goals into structured specifications through a multi-phase interview. The current prototype works but is overbuilt: Docker (Dolt), optional OpenCode sidecar, two parallel frontends, hand-rolled NDJSON streaming that drops ~80% of available agent events, and domain terminology that doesn't match what the entities actually represent.

The goal is a clean v2 that runs with `npx brunch` and one env var (`ANTHROPIC_API_KEY`). The interview is driven by the Claude Agent SDK with the full event surface (thinking, tool progress, subagent events, permissions) streamed to a React frontend via the Vercel AI SDK's documented SSE protocol. Output is a fire-and-forget SPEC.md.

The architecture:

- **Agent engine**: Claude Agent SDK (`query()`) — tool use, MCP, session resume, subagents, permissions, rich streaming events
- **Server**: Express.js — iterates SDK messages, translates to AI SDK's UI Message Stream SSE protocol. No AI SDK runtime server-side
- **Transport**: AI SDK UI Message Stream protocol (SSE with typed JSON events)
- **Client**: React + Vite + `@ai-sdk/react` `useChat` hook — consumes SSE natively
- **Database**: SQLite via `better-sqlite3` — zero-config, embedded
- **Output**: Flattened markdown SPEC.md exported on demand

## Constraints & Non-goals

<!-- Boundaries and deliberate exclusions. What we will NOT do. -->

- **Anthropic-only** — no multi-provider support (OpenAI, Gemini, Ollama)
- **No decision DAG** — join tables and graph structure deferred; relationships captured in spec text
- **No belief invalidation / cascading** — fire-and-forget; no runtime propagation
- **No task planning** — consumers of the spec, not part of this tool
- **No exploratory pathway** — assumes user has a reasonably defined goal
- **Single-user** — no collaborative editing
- **No custom model selection UI** — single model, configurable via env var at most
- **No Dolt** — replaced by SQLite snapshots
- **No AG-UI / CopilotKit** — AI SDK SSE protocol is sufficient

## Requirements

<!-- What the system must do. Extensive — cover all aspects.
     Each numbered for cross-reference from PLAN.md slices. -->

1. Run `npx brunch` with just `ANTHROPIC_API_KEY` and have the tool open in the browser — setup is instant
2. Describe what you're building and have the AI walk through a structured interview — thorough spec without missing important decisions
3. See the AI's thinking process, tool usage, and progress in real-time — CLI-quality visibility
4. See accumulated entities (decisions, assumptions, requirements, acceptance criteria) in a dashboard as the interview progresses
5. AI presents structured questions with ≥2 options and a recommendation — each design fork explicit and recorded
6. Ask clarifying questions or push back without derailing the main flow — explore before committing
7. Summary and confirmation gate at each phase transition — review what's been captured before moving on
8. Export the spec as markdown at any time — hand to a coding agent or share
9. Close the browser and resume later — not forced to complete in one sitting
10. Revisit and change previous decisions, then re-export — spec evolves as understanding deepens

## Assumptions

<!-- Falsifiable beliefs accepted as true but not yet verified.
     Low-confidence assumptions are spike candidates during planning.
     Each links to the decisions it supports and the slices it implicates.
     When validated: promote to §Lexicon or §Decisions via ln-sync.
     When invalidated: record in §Decisions, flag implicated slices in PLAN.md. -->

| #   | Assumption                                                                                                                      | Confidence | Dependent decisions | Implicated slices              | Validation approach                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------- | ------------------------------ | ------------------------------------------------------------------- |
| A1  | AI SDK's UI Message Stream SSE protocol is documented and stable enough to emit conformantly without importing AI SDK server-side | high       | D6                  | Walking skeleton               | Spike: build minimal SSE emitter, verify useChat consumes it        |
| A2  | Claude Agent SDK `query()` with `includePartialMessages` provides all streaming event types needed for CLI-quality feedback       | high       | D6                  | Walking skeleton               | Proven in prototype; validate full event taxonomy in skeleton        |
| A3  | Separating interviewer from entity extraction produces better interview quality than inline tool calling                          | medium     | D1                  | Entity extraction pipeline     | Compare interview coherence with and without tool-calling load       |
| A4  | Entity extraction completes in 1-3s during user read/think time (10-60s), adding zero perceived latency                          | medium     | D1                  | Entity extraction pipeline     | Measure extraction latency with realistic exchange payloads          |
| A5  | `better-sqlite3` npm prebuilt binary works across macOS/Linux without native compilation issues                                  | high       | D5                  | SQLite foundation              | Widely tested; validate on CI matrix                                 |
| A6  | Snapshot-based versioning in SQLite is sufficient for undo/redo in a single-user tool                                            | high       | D5                  | Snapshot versioning            | Validate with realistic entity counts                                |
| A7  | Users arriving at the tool have a reasonably defined goal                                                                        | medium     | —                   | Interview Phase 1              | User testing; exploratory pathway deferred if false                  |
| A8  | A single Express port serving API + static assets is sufficient for npx distribution                                             | high       | D8                  | npx distribution               | Standard pattern; validate in skeleton                               |
| A9  | TanStack AI is too immature for a deliverable (alpha, v0)                                                                        | medium     | D7                  | —                              | Re-evaluate if AI SDK becomes constraining                           |
| A10 | The `useChat` hook can consume custom SSE without AI SDK server runtime                                                          | high       | D7                  | Walking skeleton               | Validated by protocol docs; confirm in skeleton                      |

## Decisions

<!-- Ordered list — latter supersedes former.
     Each names what it resolved and what assumptions it depends on.
     No file paths or code snippets — they go stale.
     Q&A rationale is folded into each decision's description. -->

1. **Two-LLM-call pattern (interviewer + extractor)** — The interviewer focuses solely on conducting a high-quality interview; it does not call entity CRUD tools. After each exchange, a separate structured-output call extracts entities from the exchange + current state. Runs during user read/think time. Extraction can use a cheaper/faster model (e.g. Haiku). Keeps the interviewer prompt clean and extraction independently testable. Depends on: A3, A4. Supersedes: —.

2. **Three interview phases with confirm gates** — (0) optional pre-prompting, (1) scope establishment, (2) design tree exploration, (3) acceptance criteria validation. Phase transitions are LLM-proposed, user-confirmed. The summary-and-confirm pattern serves as both UX checkpoint and entity consolidation moment. Interview length is emergent, not predetermined. Depends on: A7. Supersedes: —.

3. **Guided chat with structured escape hatch** — Main flow is LLM-driven with structured questions (≥2 options + recommendation + open-ended). Freeform digressions happen via a separate LLM call scoped to current question context, so tangents don't pollute the interview transcript or entity extraction. Depends on: —. Supersedes: —.

4. **Entity model: materialized for UI, derived from exchanges** — Entities materialize into SQLite for the dashboard, but the interview exchange is the source of truth. Tables: `project`, `interview_exchange`, `goal`, `scope`, `decision`, `assumption`, `requirement`, `acceptance_criterion`, `risk`, `spec_output`. Join tables deferred to v2 — relationships captured in spec text, not enforced in schema. Depends on: A3. Supersedes: —.

5. **SQLite via better-sqlite3 replaces Dolt** — Zero-config embedded DB. Snapshot versioning via `project_snapshot` table (serialized entity state, created at phase transitions and on-demand). Diff is client-side JSON comparison. Undo = restore from snapshot. Dolt's differentiator (cell-level merge across concurrent writers) is a multi-user problem this single-user tool doesn't have. Depends on: A5, A6. Supersedes: Dolt (docker-based).

6. **Express.js server emits AI SDK-conformant SSE** — Plain JS. Iterates SDK's `query()` async generator, translates each `SDKMessage` into SSE events matching AI SDK's UI Message Stream protocol. Event mapping: `SDKPartialAssistantMessage` → `text-delta`/`reasoning-delta`/`tool-input-*`; `SDKToolProgressMessage` → `data-tool-progress`; `SDKResultMessage` → `finish`; domain events use `data-*` custom part pattern. No AI SDK runtime imported server-side — value is purely the documented protocol and the React hook. Depends on: A1, A2. Supersedes: hand-rolled NDJSON streaming.

7. **React + Vite + @ai-sdk/react client** — `useChat` for conversation (streaming, status, stop, message state). Custom components for entity dashboard (updated via `data-*` events). Phase indicator. Freeform side-panel as separate `useChat` instance. AG-UI was rejected (no Claude Agent SDK integration; CopilotKit component model fights the custom interview UI). TanStack AI was too young (alpha, v0). Depends on: A9, A10. Supersedes: Preact, both existing frontends.

8. **npx-launchable single-command distribution** — `bin` entry, launcher starts Express (serves built Vite assets + API on one port), opens browser. Single env var: `ANTHROPIC_API_KEY`. DB auto-created in project directory or `~/.brunch/`. Depends on: A8. Supersedes: multi-step Docker + env var setup.

9. **Drop list** — Dolt/mysql2, OpenCode sidecar, Preact, both existing frontend implementations, NDJSON protocol, JSON Schema definitions (→ Zod), @tanstack/react-table, @dnd-kit/\*, dompurify, marked, four streaming functions in claude.js, dispatch.js. Depends on: —. Supersedes: —.

10. **Reference list** — Claude Agent SDK integration pattern (`query()` + `includePartialMessages`), Express server structure, Vite config (adapted for React), test structure (Vitest + Supertest), REMODEL.md domain model. Depends on: —. Supersedes: —.

## Lexicon

<!-- Canonical terms. Code names must match.
     Method terms come first, then project-specific domain terms.
     Survey with ln-review; realign with ln-refactor. -->

| Term                    | Definition                                                                                                       |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **assumption**          | A falsifiable belief accepted as true; tracked with confidence, linked to decisions and slices                    |
| **decision**            | A recorded choice that resolves a question; ordered, with supersession chain                                     |
| **requirement**         | A capability the system must provide                                                                             |
| **slice**               | A thin end-to-end tracer-bullet path through all integration layers                                             |
| **spike**               | A time-boxed throwaway investigation to answer one hard question                                                |
| **phase** (plan)        | A temporal grouping of slices and spikes in PLAN.md                                                             |
| **exchange**            | The universal interaction primitive: one question-answer pair in the interview. Stored in `interview_exchange`    |
| **entity**              | A structured data item extracted from exchanges: decision, assumption, requirement, acceptance criterion, risk, goal, scope |
| **extraction**          | The process of deriving entities from an exchange via a separate LLM call                                        |
| **interviewer**         | The primary LLM role: conducts the interview, presents structured questions. Does not call entity CRUD tools     |
| **extractor**           | The secondary LLM role: derives entities from exchanges. Runs post-exchange during user think time               |
| **interview phase**     | A stage of the interview flow: scope establishment → design tree exploration → acceptance criteria validation     |
| **phase transition**    | An LLM-proposed, user-confirmed checkpoint between interview phases, with summary review                         |
| **structured question** | A question with ≥2 options, a recommendation, and an open-ended "something else" escape                         |
| **side-channel**        | A freeform digression scoped to the current question, isolated from the main interview transcript                |
| **dashboard**           | The UI sidebar showing accumulated entities by type, updated live via SSE events                                 |
| **snapshot**            | A serialized dump of all entity state for a project, stored in `project_snapshot` for undo/redo                  |
| **spec output**         | The flattened markdown SPEC.md generated from entity state + exchanges                                           |
| **pathway**             | The interview approach (currently: structured; future: exploratory). Stored on the project                       |

## Verification Design

<!-- Three-tier feedback loops, cheapest first.
     Inner: agent-autonomous, always-on (ms–seconds).
     Middle: regression gates (seconds–minutes).
     Outer: human observer, strategy redirect (minutes–hours). -->

- **Inner loop** (ms–seconds): type checks, fast unit tests, linting — agent-autonomous, always-on
  - SSE adapter: given an `SDKMessage`, assert correct SSE event string output
  - Entity extraction: given an exchange + entity state, assert correct entity operations (snapshot fixtures)
  - Snapshot versioning: create → snapshot → modify → snapshot → restore → assert state match
- **Middle loop** (seconds–minutes): integration tests, regression gates
  - Interview flow: POST user message via Supertest, assert SSE stream contains expected event types in order
  - DB lifecycle: create project → persist exchanges → close → reopen → assert state intact
  - Prior art: existing Vitest + Supertest suite (64 tests, 3 files) — same pattern, new tests
- **Outer loop** (minutes–hours): e2e, human observer
  - Full interview walkthrough in browser: structured questions render, entities appear in dashboard, phase transitions work, export produces valid markdown
  - Resume test: close browser mid-interview, reopen, verify conversation and entity state intact

## Acceptance Criteria (exit conditions)

<!-- Observable, testable targets for completion. -->

1. `npx brunch` with `ANTHROPIC_API_KEY` in scope opens a working app in the browser
2. Typing a message produces a streamed response with visible thinking and text
3. AI conducts a structured interview with options and recommendations
4. Entities appear in the dashboard within seconds of answering
5. Phase transitions show summary, require user confirmation
6. Freeform digressions don't pollute the main interview transcript
7. Closing and reopening the browser resumes the interview
8. Clicking export produces a valid markdown spec
9. Snapshot restore reverts entity state to a previous point
10. All inner and middle loop tests pass
