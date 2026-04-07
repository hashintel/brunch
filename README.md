# Brunch — AI Spec Elicitation

Brunch is an AI-guided spec elicitation tool that turns natural-language project goals into structured specifications through a multi-phase interview. An interviewer agent asks structured questions — each with options, a recommendation, and strategic grounding — while a separate observer agent extracts decisions and assumptions, building a dependency graph.

Built as a trial project at HASH. The stack is **React 19 + Vite** (frontend), **Express.js** (backend), **SQLite via Drizzle ORM** (database), and **Vercel AI SDK + Anthropic Claude** (AI).

## Quick start

```bash
npm install

# Create .env with your Anthropic API key
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env

# Start dev server (frontend on :5173, API on :3000)
npm run dev
```

Open http://localhost:5173.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key |
| `ANTHROPIC_MODEL` | No | Interviewer model (default: `claude-sonnet-4-20250514`) |
| `OBSERVER_MODEL` | No | Observer model (default: `claude-haiku-4-5-20251001`) |

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start frontend (Vite :5173) + API (:3000) with hot reload |
| `npm run server` | Start API server only |
| `npm run build` | Build frontend for production |
| `npm run test` | Run test suite (vitest) |
| `npm run verify` | Full gate: lint + format + test + build |
| `npm run fix` | Auto-fix lint + format issues |

## Architecture

```
src/
├── client/
│   ├── routes/
│   │   ├── InterviewWorkspace.tsx  # Main interview UI
│   │   ├── ProjectList.tsx         # Project dashboard
│   │   ├── ExportPreview.tsx       # (placeholder)
│   │   └── ComponentDebug.tsx      # Dev: component states
│   ├── components/
│   │   ├── ai-elements/            # Chat UI components (AI Elements)
│   │   └── EntitySidebar.tsx       # Decisions + assumptions sidebar
│   ├── router.tsx                  # TanStack Router (code-based)
│   └── main.tsx                    # React + QueryClient + Router
│
├── server/
│   ├── app.ts          # Express routes + AI SDK stream composition
│   ├── core.ts         # Turn preparation, project state, prompt extraction
│   ├── interview.ts    # ToolLoopAgent interviewer + ask_question tool
│   ├── observer.ts     # generateObject observer + entity persistence
│   ├── context.ts      # Typed context builders (interviewer, observer)
│   ├── db.ts           # SQLite via Drizzle + better-sqlite3
│   ├── schema.ts       # Drizzle schema (turns, options, decisions, assumptions, ...)
│   ├── parts.ts        # Zod-validated parts serialization/deserialization
│   └── tools/          # Core filesystem tools (read, write, edit, bash, grep, find, ls)
│
└── shared/
    ├── chat.ts         # BrunchUIMessage types, Zod schemas, tool definitions
    └── api-types.ts    # API response types derived from server functions
```

### Data flow

1. User input → `useChat` (AI SDK React) → `DefaultChatTransport` → POST `/api/projects/:id/chat`
2. Express validates incoming `BrunchUIMessage[]` via `validateUIMessages`
3. `prepareTurn()` creates a turn in the turn tree, builds interviewer context
4. `ToolLoopAgent` streams response → `toUIMessageStream()` → `pipeUIMessageStreamToResponse()`
5. On stream finish: observer runs (`generateObject`), entities persisted, `data-observer-result` part emitted in-band
6. Client `useChat` accumulates parts; `onData` invalidates entity query; `onFinish` refreshes project state

### Key patterns

- **Turn tree**: Conversations are branching trees, not flat logs. Each turn points to a parent. `active_turn_id` is HEAD. Active path resolved via recursive CTE.
- **Two-agent pattern**: Interviewer asks structured questions. Observer extracts decisions/assumptions after each turn. Different models, different prompts, independent testability.
- **Typed message contract**: `BrunchUIMessage` (AI SDK `UIMessage` with custom generics) spans server validation, persistence, streaming, and client hydration.
- **Parts-based persistence**: `assistant_parts` and `user_parts` JSON columns store the full UI state per turn. Scalar fields (`question`, `why`, `impact`) retained for queryability.
- **Zod everywhere**: Tool input/output schemas, data part schemas, parts deserialization, API payload validation.

## Current state

**Working**: Scope-phase interview with structured questions, observer entity extraction, entity sidebar, conversation persistence and resume, project management.

**Known issue**: Structured turn card does not render during live streaming — appears only after page refresh. Server persists correctly; hydration from DB works. Fix is next on the critical path (see `memory/PLAN.md` slice 6c).

**Not yet built**: Phase transitions (7), design/requirements/criteria phases (8-10), decision revisit/branching (11), entity lifecycle API (12), spec export (13), npx distribution (14). See `memory/PLAN.md` for the full roadmap.

## Tests

67 tests across 7 test files covering DB operations, app routes, core logic, interview flow, observer extraction, parts serialization, and context builders. Provider calls are mocked for CI; prompt quality depends on manual evaluation.

```bash
npm test
```

## Project planning

- `memory/SPEC.md` — What and why (requirements, assumptions, decisions, invariants, verification)
- `memory/PLAN.md` — What's next (phases, slices, spikes, dependencies)
- `AGENTS.md` — Agent/AI coding instructions (symlinked as `CLAUDE.md`)
