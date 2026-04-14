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
| `npm run seed <scenario>` | Seed a database with a named fixture scenario |

## Fixture scenarios

Seed the dev database with pre-built project states for testing and development:

```bash
# List available scenarios
npm run seed

# Seed into an explicit database file
npm run seed issue-tracker-all-phases-closed ./brunch.db

# Seed into a specific file
npm run seed issue-tracker-scope-closed ./tmp/test.db

# Wipe and re-seed the same file
rm -f brunch.db brunch.db-shm brunch.db-wal
npm run seed issue-tracker-all-phases-closed ./brunch.db
```

If you want `npm run dev` to use that same seeded file, launch it with `BRUNCH_DB=./brunch.db npm run dev`. For the full repeatable manual-testing workflow, use [docs/praxis/manual-testing.md](/Users/lunelson/.codex/worktrees/aed1/brunch/docs/praxis/manual-testing.md).

**Synthetic scenarios** — lightweight fixtures kept mainly for narrow server tests and export-caveat inspection:

| Scenario | State |
|---|---|
| `scope-closed` | Scope phase closed, design not started |
| `design-active` | Scope closed, one design turn |
| `requirements-ready` | Scope + design closed, requirements reviewed |
| `criteria-ready` | + requirements closed, criteria reviewed |
| `all-phases-closed` | All four phases closed |
| `forced-close-all-phases-closed` | All four phases closed, with design closed via user-forced closure |
| `low-readiness-all-phases-closed` | All four phases closed, with a synthetic low-readiness scope closure for export-caveat testing |

**Walkthrough scenarios** — rich manifest-backed fixtures with realistic interview content, structured parts, knowledge items, and cross-kind edges (domain: tiny issue tracker):

| Scenario | State | Items | Edges |
|---|---|---|---|
| `issue-tracker-kickoff-ready` | Empty kickoff workspace | 0 | 0 |
| `issue-tracker-scope-closed` | Scope closed (5 turns + proposal/confirm) | 12 (goals, terms, contexts, constraints) | 3 |
| `issue-tracker-design-active` | + 2 design turns | 18 (+ decisions, assumptions) | 7 |
| `issue-tracker-requirements-ready` | Requirements closed; criteria handoff is next | 23 (+ 5 requirements, mixed review) | 10 |
| `issue-tracker-criteria-ready` | Criteria review in progress; export still gated | 27 (+ 4 criteria, mixed review) | 14 |
| `issue-tracker-all-phases-closed` | All phases closed | 27 | 14 |

For manual walkthroughs, prefer the `issue-tracker-*` scenarios above. The unprefixed synthetic fixtures remain available when you need caveat-focused export states or very small server-side seeds.

### Source tracing

- **Programmatic**: `src/server/fixtures/scenarios.ts` — inline seed functions
- **Manifest**: `src/server/fixtures/manifests/issue-tracker.json` — static JSON content; `src/server/fixtures/manifest.ts` — seeder that wires manifests through DB functions
- Naming convention: `issue-tracker-*` scenarios come from the trusted manifest seam; unprefixed ones are synthetic helpers

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
- **Two-agent pattern**: Interviewer asks structured questions. Observer extracts typed knowledge items after each turn. Different models, different prompts, independent testability.
- **Typed message contract**: `BrunchUIMessage` (AI SDK `UIMessage` with custom generics) spans server validation, persistence, streaming, and client hydration.
- **Parts-based persistence**: `assistant_parts` and `user_parts` JSON columns store the full UI state per turn. Scalar fields (`question`, `why`, `impact`) retained for queryability.
- **Zod everywhere**: Tool input/output schemas, data part schemas, parts deserialization, API payload validation.

## Current state

**Working**: Full four-phase interview (scope → design → requirements → criteria), phase-aware observer extraction across all 8 canonical knowledge kinds, explicit phase outcomes with closure provenance, requirements and criteria review with approve/reject state, knowledge workspace, markdown export, project dashboard with workflow state, fixture scenarios with rich seeded content, local-first `.brunch/` storage, and greenfield/brownfield project kickoff with scope-grounded brownfield exploration.

**Not yet built**: Knowledge-graph revisit / edit-mode cascade flow (phase 8 stretch). See `memory/PLAN.md` for the full roadmap.

## Tests

288 tests across 33 test files covering DB operations, app routes, launcher/distribution seams, core logic, interview flow, observer extraction, parts serialization, context builders, workspace hydration/controller/data, client components, phase-close logic, and build boundaries. Provider calls are mocked for CI; prompt quality depends on manual evaluation.

```bash
npm test
```

## Project planning

- `memory/SPEC.md` — What and why (requirements, assumptions, decisions, invariants, verification)
- `memory/PLAN.md` — What's next (phases, slices, spikes, dependencies)
- `AGENTS.md` — Agent/AI coding instructions (symlinked as `CLAUDE.md`)
