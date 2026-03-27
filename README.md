# Brunch — AI Spec Elicitation

Brunch is a prototype tool that turns natural-language project goals into structured specifications through an AI-guided workflow. A user describes what they want to build, and the system walks them through clarifying questions, assumption review, and hierarchical requirement generation — producing a spec document at each stage.

Built as a trial project at HASH. The stack is **Preact + Vite** (frontend), **Express.js** (backend), **Dolt** (MySQL-compatible database with git-like version control), and **Anthropic Claude Agent SDK** as the primary AI backend.

## What was built

### Two frontend versions

There are two versions of the UI, both functional:

1. **Home** (`/`, `/session/:id`) — the original, more feature-complete interface. Includes:
   - Goal input with example prompts and AI assistant fallback for weak prompts
   - Clarifying questions flow
   - Assumption review with inline AI editing
   - Hierarchical requirements with sub-requirements and test/check generation
   - Three requirement views: list, table, and canvas with drag-and-drop reordering/nesting
   - Dolt version control sidebar (commit, history, diff, checkout, revert)
   - LLM call log viewer (model, tokens, duration, prompt/response)
   - Model selector (switch models per query)

2. **CreateSpec wizard** (`/create-spec/:projectId/:step`) — a redesign adhering to Figma designs. Includes:
   - Step-by-step wizard navigation with progress sidebar
   - Clarifying questions with single-choice and multi-choice support
   - Cleaner assumption editing UX
   - Inline AI assistant panel
   - Spec regenerated after each step

### Backend

- Express.js API with streaming (NDJSON) responses
- Multi-provider AI dispatch: Claude models use Anthropic SDK directly, other models route through OpenCode
- MCP (Model Context Protocol) tool integration — the AI assistant can call tools to mutate goals, assumptions, and requirements
- Structured output with JSON Schema validation for AI responses
- Full request/response logging to database (`api_call` and `claude_call` tables)
- Automatic database migration on startup

### Database

Dolt (MySQL-compatible) with 6 tables:
- `project` — session metadata, goal, clarifying state, spec content
- `entry` — hierarchical requirement tree (self-referencing via `parent_id`)
- `assumption` — normalized assumptions with status tracking
- `goal_iteration` — goal refinement history
- `api_call` — HTTP request/response log
- `claude_call` — LLM interaction log with token counts

Dolt's git-like features (commit, diff, checkout, revert) are exposed in the v1 UI. These operate at the database level, so changes across projects can get mixed — filters are implemented to reduce confusion, but proper isolation would require per-project Dolt branches.

### Tests

64 tests across 3 test files (server integration, schema validation, Claude service), all passing. Uses Vitest + Supertest.

## Quick start (local)

```bash
npm install

# Create .env with your API keys (at least one provider required)
cp .env.example .env

# Start Dolt database (requires Docker):
npm run dolt
# OR without Docker:
dolt sql-server  # then: dolt sql -> CREATE DATABASE brunch;

# Optionally run OpenCode for multi-model support
opencode serve

# Start dev server (frontend on :5173, API on :3001)
npm run dev
```

Open http://localhost:5173.

## Docker Compose

Starts both Dolt and the app in a single command:

```bash
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY (or another provider key)

docker compose up -d
```

Open http://localhost:3001. The container serves both frontend and API on a single port.

## Docker (app only)

If you have Dolt running separately:

```bash
docker build -t brunch .

docker run -d \
  --name brunch \
  -p 3001:3001 \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -e DOLT_HOST=host.docker.internal \
  brunch
```

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | At least one provider key | Anthropic Claude API key |
| `OPENAI_API_KEY` | At least one provider key | OpenAI API key |
| `GOOGLE_GENERATIVE_AI_API_KEY` | At least one provider key | Google Gemini API key |
| `PORT` | No | Server port (default: `3001`) |
| `DOLT_HOST` | No | Dolt host (default: `localhost`) |
| `DOLT_PORT` | No | Dolt port (default: `3307` for local dev, `3306` inside Docker network) |
| `DOLT_USER` | No | Dolt user (default: `root`) |
| `DOLT_PASSWORD` | No | Dolt password (default: empty) |
| `DOLT_DATABASE` | No | Dolt database name (default: `brunch`) |
| `OPENCODE_URL` | No | OpenCode server URL (enables GPT-4o, Gemini models) |

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start frontend (Vite :5173) + API (:3001) concurrently |
| `npm run server` | Start API server only |
| `npm run build` | Build frontend for production (`/dist`) |
| `npm test` | Run Vitest test suite |
| `npm run dolt` | Start a Dolt Docker container on port 3307 |

## Architecture

```
client/src/
├── pages/
│   ├── Home/           # v1 interface — hooks + components per feature
│   └── CreateSpec/     # v2 wizard — step-based screens
├── components/         # Shared (Header, LoadingIndicator)
└── assets/

server/
├── server.js           # Express app, middleware, route registration
├── db.js               # Dolt connection pool, auto-migration
├── schemas.js          # JSON Schema definitions for AI responses
├── models.js           # Available model definitions
├── routes/             # One file per endpoint group
│   ├── stream.js       # POST /api/stream (streaming queries)
│   ├── clarifying.js   # POST /api/clarifyingquestions
│   ├── requirements.js # Requirements CRUD + generation
│   ├── assumptions.js  # Assumptions CRUD
│   ├── sessions.js     # Session lifecycle
│   ├── spec.js         # Spec generation/storage
│   ├── specWizard.js   # Wizard-mode endpoints
│   ├── versions.js     # Dolt version control
│   └── history.js      # LLM call log
├── services/
│   ├── dispatch.js     # Route to Claude or OpenCode by model
│   ├── claude.js       # Anthropic Claude SDK (streaming, tools, structured output)
│   └── opencode.js     # OpenCode SDK wrapper
├── middleware/          # Logging, validation, error handling
└── migrations/         # SQL schema migrations (auto-applied)
```

### Data flow

1. User input → Preact component → API call
2. Express route → validation middleware → service layer
3. Service dispatches to Claude SDK or OpenCode SDK (streaming NDJSON)
4. AI response parsed → database upsert (Dolt)
5. NDJSON stream → frontend hook → UI update

### Key patterns

- **Streaming**: All AI endpoints stream NDJSON chunks to the frontend
- **Tool use**: Claude Agent SDK with MCP tools for mutations (set goal, manage assumptions/requirements)
- **Hierarchical data**: Requirements are a self-referencing tree (`entry.parent_id`)
- **UUID stability**: Entities use UUIDs for identity across AI-generated upserts
- **Auto-migration**: `db.js` checks table/column existence on startup and applies missing migrations

## OpenCode (optional — multi-model support)

By default, Brunch uses the Anthropic Claude API directly. To use additional models (GPT-4o, Gemini, etc.), run [OpenCode](https://opencode.ai) as an alternative backend.

1. Install: `npm i -g opencode`
2. Start: `opencode serve`
3. Set `OPENCODE_URL=http://localhost:4096` in `.env`
4. Start Brunch normally — the model dropdown will include additional models

OpenCode runs as a separate process with a REST+SSE API. The `opencode.json` config registers Brunch's assistant tools as an MCP server. Claude models always use the Anthropic API directly.

For Docker Compose: `export OPENCODE_URL=http://host.docker.internal:4096` before `docker compose up`.

## Next steps

### DX / Architecture

- **Consolidate to one frontend**: Keep the v2 wizard as the primary UI. Repurpose v1 as an admin/debug dashboard (LLM logs, Dolt version control). This was started on the `branch` branch.
- **Fix Dolt project isolation**: Currently all projects share a single Dolt branch, so commits/reverts affect everything. Each project should get its own Dolt branch, merging only at strategic points. This requires tracking active branches and applying migrations per branch.
- **Proper migration runner**: The current approach in `db.js` checks for specific tables/columns and runs migrations conditionally. A numbered migration runner with a `schema_version` table would be more maintainable.
- **Consider SQLite compatibility**: Dolt is powerful but heavy for single-user local installs. Supporting SQLite as an alternative (dropped early on) would lower the barrier to entry.
- **Use AI SDK (Vercel) directly**: Replace the OpenCode dependency with `ai` (Vercel AI SDK) for multi-provider support without requiring a separate server process. OpenCode's `@opencode-ai/sdk` already depends on it.
- **Block-based data model**: The current schema (project → entries + assumptions) is rigid. A more flexible block-based model (like Notion) would better support evolving spec structures and richer content types.

### User-facing improvements

- **Better prompts and workflow**: Clarifying questions are the most useful step. After that, the spec tends to reiterate what was already said. The prompt engineering and workflow sequencing need work to produce genuinely additive output at each stage.
- **Executable test generation**: Requirements currently generate test descriptions (plain text). The goal should be generating actual executable test cases that coding agents can run against implementations.
- **Richer requirement editing**: Inline editing of requirements is basic. Support for markdown content, attachments, and linking between requirements would make the spec more useful as a working document.
- **Export formats**: Generate specs in formats that integrate with existing tools (GitHub Issues, Linear, Markdown docs, YAML task definitions).
- **Multi-user support**: Currently single-user. Adding auth and collaborative editing would make it usable in team settings.
- **Feedback loop**: Let users rate AI-generated questions/assumptions/requirements so the system can improve over time.
