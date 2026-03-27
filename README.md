# Brunch — AI Spec Elicitation

Brunch helps you turn natural-language project goals into structured specifications through an AI-guided clarification flow: goal input, clarifying questions, assumption review, and spec generation.


## Features
There are two versions of the application, one runs at / (1) and other at /create-spec (2). Later version adheres to figma designs. Former is slightly more feature complete. 

Set a goal. Version (1) gives you example prompts, or an option to open AI assistant if prompt is considered to be insufficient. Version (2) just goes with it. 

Spec is regenerated after each step. Version (2) supports clarifyquestions single and multichoice. 

It's possible to set a local folder and tell the system to define goal based on the files present. 

Assumptions can be be edited by AI Assistant. Version (2) has nicer UX. 

Requirements have subrequirements and checks/tests. Currently these are just labeled descriptions. Code/Static Analysis tests are not valid, only instructions. Requirements in Version (1) can be displayed as list/table/canvas with drag and drop reordering/nesting. 

Server uses dolt-db, and it needs to be running with database `brunch` created. Migration of tables happens automatically. Dolt features are visible in version (1). You can view uncommited changes, commit diffs, checkout to past version, or even revert (not recommended). This features are problematic as it works on the db-level, so changes across projects can get mixed. There are filters implemented so the UI is less confusing, but it's not possible to resolve this problem without using separate branch for each project.

LLM calls are recorded in db table `claude_call`, and displayed in version (1) - UI is updated only after response is handled. 

Models can be changed before each query. Currently it's setup to work with local Anthropic Agent SDK, and OpenCode models. 

## How to improve
To improve this I'd keep only single version of front-end 2) and turn 1) into admin dashboard. This was already attempted in `branch` branch. As already mentioned dolt should create a separate branch for each project, and merge only at strategic points. This would require us to keep track of active branches and apply migration scripts on each. Alternatively we could focus on improving changes tracking with traditional sql record-keeping approach. This was already tested a little bit in the beginning as you can see in db goal_iterations. 

If we want many users to install this keeping SQLite compatibility would make sense, but it was dropped with introduction of dolt. 

I'd focus on improving the prompts, and potentially the workflow, so that the app generates more useful output. Right now clarify_questions tend to be useful, but after that it's largely a reiteration of what was already said with different UI. 

I'd potentially add support for AI-sdk directly (it's dependency of OpenCode), for scenarios where we don't work with local filesystem. 

I'd spend more time thinking about database structure, probably pushing it closer to something like `block` model. 

I'd focus on generating valid test suite, and making complete tests cases with coding agents executing the output. 

## Quick start (local)

```bash
npm install

# Create .env with your API keys (at least one provider required)
cp .env.example .env

# Start Dolt database (requires Docker)
npm run dolt

# Start dev server (frontend on :5173, API on :3001)
npm run dev
```

Open http://localhost:5173.

## Docker Compose (recommended)

Starts both Dolt and the app in a single command:

```bash
# Create .env with your API key (at least one provider required)
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY

# Start everything
docker compose up -d
```

Open http://localhost:3001. The container serves both the frontend and API on a single port.

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
| `ANTHROPIC_API_KEY` | At least one | Anthropic Claude API key |
| `OPENAI_API_KEY` | At least one | OpenAI API key |
| `GOOGLE_GENERATIVE_AI_API_KEY` | At least one | Google Gemini API key |
| `PORT` | No | Server port (default: `3001`) |
| `DOLT_HOST` | No | Dolt host (default: `localhost`) |
| `DOLT_PORT` | No | Dolt port (default: `3307`) |
| `DOLT_USER` | No | Dolt user (default: `root`) |
| `DOLT_PASSWORD` | No | Dolt password (default: empty) |
| `DOLT_DATABASE` | No | Dolt database name (default: `brunch`) |
| `OPENCODE_URL` | No | OpenCode server URL (enables GPT-4o, Gemini models) |

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start frontend + API in development mode |
| `npm run server` | Start API server only |
| `npm run build` | Build frontend for production |
| `npm test` | Run tests |
| `npm run dolt` | Start a Dolt container for local development |

## OpenCode (optional — multi-model support)

By default, Brunch uses the Anthropic Claude API directly. To unlock additional models (GPT-4o, Gemini 2.5 Flash, etc.), you can run [OpenCode](https://opencode.ai) as an alternative AI backend.

### Setup

1. Install OpenCode: `npm i -g opencode`
2. Configure your providers in OpenCode (it reads `OPENAI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, etc. from your environment)
3. Start the OpenCode server:

```bash
opencode serve
```

4. Point Brunch at it by setting `OPENCODE_URL` in your `.env`:

```
OPENCODE_URL=http://localhost:4096
```

5. Start Brunch normally (`npm run dev` or `docker compose up`). The model dropdown will now include GPT-4o and Gemini 2.5 Flash alongside the Claude models.

### How it works

- OpenCode runs as a separate process and exposes a REST+SSE API
- Brunch connects to it via `@opencode-ai/sdk` when you select a non-Claude model
- The `opencode.json` config in the project root registers Brunch's assistant tools (set goal, manage assumptions/requirements) as an MCP server that OpenCode spawns automatically
- Claude models continue to use the Anthropic API directly — OpenCode is only used for other providers

### Docker Compose

Pass `OPENCODE_URL` to connect to an OpenCode server running on your host:

```bash
export OPENCODE_URL=http://host.docker.internal:4096
docker compose up -d
```

## Architecture

- **Frontend**: Preact + Vite, served as static files in production
- **Backend**: Express.js API server
- **Database**: Dolt (MySQL-compatible with git-like version control)
- **AI**: Multi-provider support (Anthropic, OpenAI, Google)

### Version control

Dolt provides git-like versioning for your database. The app exposes version control through the UI sidebar:
- **Commit**: Save a snapshot of all project data with a message
- **History**: View commit log with diffs showing what changed
- **Revert**: Roll back to any previous commit

Data is persisted in the `dolt-data` Docker volume. For local development, the Dolt container stores data in the `brunch-dolt` volume.
