# Brunch — AI Spec Elicitation

Brunch is an AI-guided spec elicitation tool that turns natural-language project goals into structured specifications through a multi-phase interview. An interviewer agent asks structured questions — each with options, a recommendation, and strategic grounding — while a separate observer agent extracts decisions and assumptions, building a dependency graph.

The current architecture is organized around a turn-centered workspace stream: durable conversational turns provide the branch-bearing lineage spine, while kickoff / recovery / handoff affordances, phase markers, and activity states are increasingly being treated as projected stream elements rather than ordinary durable turns.

Built as a trial project at HASH. The stack is **React 19 + Vite** (frontend), **Express.js** (backend), **SQLite via Drizzle ORM** (database), and **Vercel AI SDK + Anthropic Claude** (AI).

## Canonical docs

If you are orienting to the current system shape, start here:

- `memory/SPEC.md` — canonical product and architecture truth: requirements, decisions, invariants, and verification stance
- `memory/PLAN.md` — the live frontier, including the active code-alignment map and the next action seams
- `docs/design/state-machines/README.md` — the current runtime/state-machine design authority for hydration, workflow legality, projected controls, and runtime ownership

Older `docs/design/*` files are design explorations unless they explicitly say otherwise; use the three docs above as the source of truth when they disagree.

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

# Seed into the default project-local database (.brunch/brunch.db)
npm run seed issue-tracker-all-phases-closed

# Wipe and re-seed the default project-local database
mkdir -p .brunch
rm -f .brunch/brunch.db .brunch/brunch.db-shm .brunch/brunch.db-wal
npm run seed issue-tracker-all-phases-closed

# Seed into a specific alternate file instead
npm run seed issue-tracker-scope-closed ./tmp/test.db
```

`npm run dev` uses the same project-local default database unless you override it with `BRUNCH_DB`. For the full repeatable manual-testing workflow, use [docs/praxis/manual-testing.md](docs/praxis/manual-testing.md).

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
| `issue-tracker-kickoff-ready` | Empty workspace with projected grounding entry control | 0 | 0 |
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
│   ├── routes/                     # TanStack file routes + routed workspace shells
│   ├── components/
│   │   ├── ai-elements/            # Chat UI primitives
│   │   ├── question-cards.tsx      # Active turn-card family
│   │   ├── review-set-card.tsx     # Review-specific cards + completion states
│   │   └── EntitySidebar.tsx       # Knowledge sidebar projection
│   ├── router.tsx                  # TanStack Router
│   └── main.tsx                    # React + QueryClient + Router bootstrap
│
├── server/
│   ├── app.ts          # Express routes + AI SDK stream composition
│   ├── core.ts         # Frontier preparation, project state loading, active-path helpers
│   ├── interview.ts    # ToolLoopAgent interviewer + prompting/tool config
│   ├── observer.ts     # generateObject observer + knowledge persistence
│   ├── context.ts      # Typed context builders
│   ├── db.ts           # SQLite via Drizzle + workflow/knowledge projections
│   ├── schema.ts       # Drizzle schema
│   ├── fixtures/       # Manifest/scenario seeds and corpus capture
│   ├── parts.ts        # Zod-validated parts serialization/deserialization
│   └── tools/          # Read-only/workspace tools and mutation helpers
│
└── shared/
    ├── chat.ts         # BrunchUIMessage types, data-part schemas, tool contracts
    ├── api-types.ts    # API response types
    ├── phase-close.ts  # Workflow phase + closure logic
    └── project-state-turn.ts # Helpers over persisted turn state and replay artifacts
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
- **Merged workspace stream**: the rendered center column is broader than the turn tree. Durable turns remain the lineage spine; phase outcomes, projected controls, phase markers, and activity states are assembled around them.
- **Zod everywhere**: Tool input/output schemas, data part schemas, parts deserialization, API payload validation.

## Current state

**Working**: Full four-phase interview (scope → design → requirements → criteria), phase-aware observer extraction across the canonical knowledge ontology, explicit phase outcomes with closure provenance, accepted-set review authority for requirements/criteria, knowledge workspace/sidebar, markdown export, project dashboard with workflow state, fixture scenarios with rich seeded content, local-first `.brunch/` storage, and greenfield/brownfield grounding flows.

**Active architectural cleanup**: the codebase is still in the middle of replacing kickoff/recovery-as-turn assumptions with projected control cards and a merged stream projector. See `memory/PLAN.md` for the active code-alignment map and current next action.

**Not yet built**: Knowledge-graph revisit / edit-mode cascade flow. See `memory/PLAN.md` for the live frontier.

## Tests

288 tests across 33 test files covering DB operations, app routes, launcher/distribution seams, core logic, interview flow, observer extraction, parts serialization, context builders, workspace hydration/controller/data, client components, phase-close logic, and build boundaries. Provider calls are mocked for CI; prompt quality depends on manual evaluation.

```bash
npm test
```

## Project planning

- `memory/SPEC.md` — What and why (requirements, assumptions, decisions, invariants, verification)
- `memory/PLAN.md` — What's next (phases, slices, spikes, dependencies)
- `docs/design/state-machines/README.md` — runtime/state-machine design authority for the current workflow seam
- `AGENTS.md` — Agent/AI coding instructions (symlinked as `CLAUDE.md`)

## Technical note

If the app loads as a blank page in development and the browser console shows `504 Outdated Optimize Dep`, Vite's optimized dependency cache has usually drifted out of sync with the running dev server.

Brunch now keeps a separate Vite cache per dev-server port and refuses to silently move the default frontend off `:5173`, which makes accidental duplicate dev sessions much less likely to corrupt the active cache.

If you still need to recover a wedged local dev session, stop the listeners on Brunch's dev ports, clear the Vite cache, and restart:

```bash
lsof -tiTCP:5173 -sTCP:LISTEN | xargs kill
lsof -tiTCP:3000 -sTCP:LISTEN | xargs kill
rm -rf node_modules/.vite-*
npm run dev
```
