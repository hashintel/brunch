# Brunch — AI Spec Elicitation

Brunch helps you turn natural-language project goals into structured specifications through an AI-guided clarification flow: goal input, clarifying questions, assumption review, and spec generation.

## Quick start (local)

```bash
npm install

# Create .env with your API keys (at least one provider required)
cp .env.example .env

# Start dev server (frontend on :5173, API on :3001)
npm run dev
```

Open http://localhost:5173.

## Docker

```bash
# Build
docker build -t brunch .

# Run — pass API keys via env, persist data with a volume
docker run -d \
  --name brunch \
  -p 3001:3001 \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -v brunch-data:/app/server/data \
  brunch
```

Open http://localhost:3001. The container serves both the frontend and API on a single port.

### Docker Compose

```yaml
services:
  brunch:
    build: .
    ports:
      - "3001:3001"
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    volumes:
      - brunch-data:/app/server/data

volumes:
  brunch-data:
```

```bash
docker compose up -d
```

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | At least one | Anthropic Claude API key |
| `OPENAI_API_KEY` | At least one | OpenAI API key |
| `GOOGLE_GENERATIVE_AI_API_KEY` | At least one | Google Gemini API key |
| `PORT` | No | Server port (default: `3001`) |

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start frontend + API in development mode |
| `npm run server` | Start API server only |
| `npm run build` | Build frontend for production |
| `npm test` | Run tests |

## Architecture

- **Frontend**: Preact + Vite, served as static files in production
- **Backend**: Express.js API server
- **Database**: SQLite (via better-sqlite3) with automatic migrations
- **AI**: Multi-provider support (Anthropic, OpenAI, Google)

Data is stored in `server/data/brunch.db`. In Docker, mount `/app/server/data` as a volume to persist across restarts.
