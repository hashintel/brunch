# Chat Application Data Models: Conversation Turns, Structured Data & Generative UI Persistence

## Overview

A modern AI chat application needs two mostly-separate data layers: a **conversation history layer** that reconstructs what the UI should show, and an **inference context layer** that reconstructs what the LLM needs to reason. These collapse into the same object only in the simplest text-only apps. As soon as tool calls, structured outputs, and generative UI enter the picture, the two diverge — and conflating them is the most common source of persistence bugs in AI applications.

This report covers the canonical data models, the key design choices, and how persistence strategy must evolve as application complexity grows.

***

## Part 1: The Baseline — Simple Text Conversation Turns

### The Three Core Entities

Every chat persistence schema starts with three entities: `conversations` (or `threads`), `messages`, and `users`. In SQLite the minimum viable schema looks like this:[^1]

```sql
CREATE TABLE conversations (
  id          TEXT PRIMARY KEY,         -- UUID
  user_id     TEXT NOT NULL,
  title       TEXT,
  created_at  INTEGER NOT NULL,         -- Unix epoch ms
  updated_at  INTEGER NOT NULL
);

CREATE TABLE messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK(role IN ('user','assistant','system','tool')),
  content         TEXT NOT NULL,        -- plain text or JSON blob
  created_at      INTEGER NOT NULL,
  display_order   INTEGER NOT NULL
);

CREATE INDEX idx_messages_conv ON messages(conversation_id, display_order);
```

Index on `(conversation_id, display_order)` is essential for fast ordered retrieval. A `display_order` integer is safer than relying on `created_at` alone, because timestamps can collide in high-throughput systems.[^2][^1]

### Server-Side vs. Client-Side History

A naive implementation sends the entire message history from the client on every request. The AI SDK's default `useChat` hook does exactly this — it keeps messages in memory and transmits the full array with each new message. For persistence you need server-side ID generation and a server-side store: the client sends only its *current* message; the server loads prior history, appends, runs inference, then saves the updated history in an `onFinish` callback.[^3][^4]

```typescript
// Server route (AI SDK v5 pattern)
export async function POST(req: Request) {
  const { message, id: chatId } = await req.json();
  const previousMessages = await loadChat(chatId);
  const messages = [...previousMessages, message];

  const result = streamText({ model, messages: convertToModelMessages(messages) });
  result.consumeStream(); // ensure onFinish fires even on client disconnect

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    onFinish: ({ messages }) => saveChat({ chatId, messages }),
  });
}
```

This pattern — load → append → stream → save in `onFinish` — is the canonical persistence loop recommended by the AI SDK.[^5][^3]

### The UIMessage / ModelMessage Split

This is the most architecturally consequential distinction in the entire space. The AI SDK v5 formalises it explicitly:[^6][^2]

| Type | Purpose | What it contains |
|------|---------|------------------|
| `UIMessage` | Source of truth for UI state and persistence | `id`, `role`, `parts[]`, `metadata`, all tool states, file URLs |
| `ModelMessage` | Derived; sent to LLM provider | Leaner; generated on-the-fly via `convertToModelMessages()` |

**Always persist `UIMessage` objects, never `ModelMessage`s**. Persisting `ModelMessage`s ties your database to your current LLM provider's format, makes UI restoration brittle (you can't reconstruct which tool was running, what state it was in, what partial output was shown), and loses custom metadata. The `ModelMessage` is an ephemeral, derived artefact — reconstruct it at inference time, not storage time.[^2][^6]

***

## Part 2: Structured Schema Options

Once you commit to persisting `UIMessage` objects, the next question is *how* to lay them out in SQLite. There are three well-understood options:[^2]

### Option A: JSON Blob per Conversation

```sql
CREATE TABLE conversations (
  id       TEXT PRIMARY KEY,
  user_id  TEXT NOT NULL,
  messages TEXT NOT NULL  -- entire UIMessage[] as JSON
);
```

**Pros:** Trivially simple; one read to load the full history.  
**Cons:** Every append requires a read-modify-write on a potentially large blob; hard to paginate or query individual turns; no row-level indexing.

Best suited for prototypes or single-user local tools.[^7][^2]

### Option B: Hybrid (Recommended Default)

```sql
CREATE TABLE conversations (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL,
  parts           TEXT NOT NULL,   -- UIMessagePart[] as JSON
  metadata        TEXT,            -- custom metadata as JSON
  created_at      INTEGER NOT NULL,
  display_order   INTEGER NOT NULL
);

CREATE INDEX idx_messages_conv_order ON messages(conversation_id, display_order);
```

Each `UIMessage` is one row; its `parts` array (which captures text, tool calls, tool results, files, reasoning) is stored as a JSON column. This gives you efficient append (one `INSERT` per new message), fast per-conversation queries (`SELECT … WHERE conversation_id = ?`), and pagination at the message granularity — without requiring JOINs to reconstruct a full message.[^2]

### Option C: Fully Normalised

```sql
CREATE TABLE messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role            TEXT NOT NULL,
  metadata        TEXT,
  display_order   INTEGER NOT NULL
);

CREATE TABLE message_parts (
  id         TEXT PRIMARY KEY,
  message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  part_order INTEGER NOT NULL,
  part_type  TEXT NOT NULL,  -- 'text','tool-invocation','file','reasoning','data'
  content    TEXT NOT NULL   -- part-specific JSON payload
);
```

**Pros:** Full SQL queryability into individual parts; useful for analytics, moderation, or searching tool call arguments.  
**Cons:** Requires JOINs and application-level assembly to reconstruct a `UIMessage`; more complexity for minimal practical gain in most chat apps.[^2]

### Comparison

| Feature | JSON Blob | Hybrid | Fully Normalised |
|---------|-----------|--------|-----------------|
| Implementation | Simplest | Moderate | Most complex |
| Full history read | Fastest (1 read) | Fast (N row reads) | Slower (JOINs) |
| Append new message | Slow (RMW blob) | Fast (1 INSERT) | Fast (row INSERT) |
| Query individual messages | Hard | Easy (SQL WHERE) | Easy |
| Query inside parts | Hard | Hard (JSON path) | Easier (SQL WHERE on parts) |
| Recommended for | Prototypes | Most apps | Analytics/compliance |

[^2]

***

## Part 3: Structured Data — Inputs and Outputs

### Tool Calls in `UIMessage.parts`

When the LLM executes a tool call, the AI SDK v5 represents the full lifecycle as part types within the assistant's `UIMessage`:[^8][^6]

```
parts: [
  { type: 'text', text: 'Let me check the weather.' },
  { type: 'tool-getWeather', state: 'input-streaming', input: { location: 'Berl...' } },
  { type: 'tool-getWeather', state: 'input-available', input: { location: 'Berlin' } },
  { type: 'tool-getWeather', state: 'output-available', output: { temp: 12, conditions: 'cloudy' } }
]
```

The four tool states — `input-streaming`, `input-available`, `output-available`, `output-error` — are persisted as part of the `parts` blob. This means the UI can restore exactly the state it was in when the user left: showing a loading spinner, showing a result, showing an error. Nothing is re-computed on restore.[^6]

Crucially, in v5, **each static tool gets a type-specific part identifier** (`tool-getWeather` vs the old generic `tool-invocation`), enabling full TypeScript type safety all the way to the database and back.[^6]

### Structured Outputs (generateObject / streamObject)

When you use `generateObject` or `streamText` with a Zod schema for structured output, the result does *not* automatically surface as a message in `useChat`'s message stream. The common pattern is:[^9]

1. Run `streamText` with tools or a schema.
2. In `onFinish`, call a secondary `generateObject` on the completed text to produce the structured artefact.
3. Persist the artefact separately — either as a `data` part in the assistant `UIMessage`, or in a dedicated `artefacts` table with a foreign key to the message.

For more complex scenarios — e.g., a structured report generated alongside a chat response — a dedicated side-table is cleaner:

```sql
CREATE TABLE artefacts (
  id          TEXT PRIMARY KEY,
  message_id  TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  schema_name TEXT NOT NULL,      -- e.g. 'WeatherReport', 'CodeReview'
  version     INTEGER NOT NULL DEFAULT 1,
  data        TEXT NOT NULL,      -- validated JSON matching schema
  created_at  INTEGER NOT NULL
);
```

Versioning the schema name allows you to handle schema evolution without corrupting old artefacts.[^10]

### Custom Data Parts

The AI SDK `UIMessage` spec includes `dataPartsSchema` — a Zod schema you define — which attaches typed, arbitrary structured payloads to any message part. This is the idiomatic place to persist things like citation objects, search results, retrieved documents, or computed metrics that accompany a response but aren't the LLM's text. They round-trip through `validateUIMessages` on the server, ensuring schema integrity across upgrades.[^11][^3]

***

## Part 4: Generative UI — Persisting Component State

### The Problem

Generative UI means the LLM invokes a tool whose *return value* is rendered as a React component rather than text. A weather tool returns `{ temp: 12, conditions: 'cloudy' }`, and the frontend renders a `<WeatherCard />`. The challenge: when the user comes back to this conversation, you need to re-render that component with the same data. You can't re-run the tool call.[^12]

### The Solution: Tool Result as Persisted Data

The tool result lives in the `parts` array of the assistant message, inside the `tool-TOOLNAME` part with `state: 'output-available'`. Because you persist the full `UIMessage` (hybrid schema: `parts` column), the component data is already in the database. On restore, the frontend receives the `UIMessage[]`, finds the part with `state: 'output-available'`, and renders the same `<WeatherCard />` with the same props — no network call required.[^6]

This is the "persist once, render anywhere" principle. The `output` field of the tool part *is* the component's props. As long as the component contract (its prop schema) remains stable, the UI is fully replayable from persisted data.[^2]

### Component Contract Versioning

A practical risk: you refactor `<WeatherCard />` and change its prop shape. Old persisted tool outputs no longer match. The mitigation pattern is to version the tool output schema, just as you version the `artefacts` table:

```typescript
const tools = {
  getWeather: tool({
    parameters: z.object({ location: z.string() }),
    execute: async ({ location }) => ({
      _schemaVersion: 2,  // embed in output
      temp: 12,
      conditions: 'cloudy',
      feelsLike: 10
    })
  })
}
```

On restore, the renderer checks `_schemaVersion` and handles migrations client-side, or flags the message as needing re-execution.[^2]

***

## Part 5: Context Window Management

Persistent storage and inference context are separate concerns. Storing full `UIMessage` history in the database does not mean sending the full history to the LLM on every turn — you must manage the model's token budget independently.

### Strategy 1: Simple Windowing

Send the last N messages. Fast and predictable but loses early context silently. Common in simple apps; inadequate for sessions that build on early context (e.g., a coding session that references a schema defined in message 3).[^13][^14]

### Strategy 2: Sliding Window with Summarisation

The most widely recommended production pattern:[^15][^16][^13]

1. Monitor total token count of the message history.
2. When approaching the model's limit (e.g., at 80% capacity), extract the oldest messages.
3. Run a secondary LLM call to summarise them into a compact `system` or `user` message.
4. Replace the original messages with the summary in the *inference context* (not in the database).

This keeps the database complete while keeping inference context within budget. The summary is ephemeral — reconstructed on each request from the full stored history — or optionally cached as metadata on the conversation row.

```sql
ALTER TABLE conversations ADD COLUMN summary TEXT;         -- cached rolling summary
ALTER TABLE conversations ADD COLUMN summary_up_to_id TEXT; -- last message summarised
```

### Strategy 3: Structured Scratchpad

Rather than raw transcript, production agentic systems often maintain a separate structured context object:[^17]

```json
{
  "currentGoal": "Refactor the auth module",
  "activeEntities": ["AuthService", "JWTMiddleware"],
  "unresolvedQuestions": ["Which token expiry should we use?"],
  "rollingSummary": "User wants to migrate from session-based to JWT auth..."
}
```

This is updated each turn (by the LLM or deterministically) and injected as a system message. It is far more token-efficient than a rolling transcript and more semantically stable across long sessions. Google Agent Engine's Sessions feature implements exactly this pattern.[^17]

### Strategy 4: State Checkpointing

Before irreversible tool actions, save a full conversation snapshot to the database. This enables rollback and context rewind — discarding contaminated context and replaying from a known-good checkpoint. For SQLite, this is a simple row insert:[^17]

```sql
CREATE TABLE conversation_checkpoints (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  snapshot        TEXT NOT NULL,  -- UIMessage[] JSON at this point
  label           TEXT,
  created_at      INTEGER NOT NULL
);
```

***

## Part 6: The Event Log Pattern — An Alternative Foundation

An increasingly advocated alternative to mutable state is treating the conversation as an **immutable append-only event log**. Every user message, LLM chunk, tool call, tool result, interrupt, and UI action is appended as an event. The current conversation state — what the UI shows, what the model receives — is always *derived* by projecting over the event log.[^18]

```sql
CREATE TABLE conversation_events (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  sequence        INTEGER NOT NULL,
  event_type      TEXT NOT NULL,  -- 'user_message','llm_chunk','tool_call','tool_result','ui_action'
  payload         TEXT NOT NULL,  -- event-specific JSON
  created_at      INTEGER NOT NULL,
  UNIQUE(conversation_id, sequence)
);
```

**Advantages:** Full auditability; easy to replay state from any point; natural support for branching conversations (fork at sequence N); clean separation of storage from projection logic. **Trade-offs:** More complex projection logic required; querying "what is the current state of message X" requires folding over events rather than a simple `SELECT`. This pattern aligns well with TypeScript functional idioms (reducers, Effect-TS) and is well-suited to agentic workflows where step-level auditability matters.[^18]

***

## Part 7: Long-Form Structured Data — Artefact Tables

When a conversation produces rich structured outputs that have independent value — a generated code file, a filled-out form, a data table, a chart spec — modelling them as message parts starts to strain. The right pattern is to extract them into a dedicated `artefacts` table that:

- Has a primary key and is independently queryable.
- Has a foreign key to the originating message (for traceability).
- Carries its own schema name and version.
- Supports independent updates (the user edits the artefact after generation).

```sql
CREATE TABLE artefacts (
  id           TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  message_id   TEXT REFERENCES messages(id),  -- nullable: user-created artefacts
  type         TEXT NOT NULL,    -- 'code','form','table','chart','document'
  schema_name  TEXT NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1,
  content      TEXT NOT NULL,    -- structured JSON or raw text
  title        TEXT,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);
```

The message's `parts` column then contains a reference to the artefact rather than the artefact itself:

```json
{
  "type": "data",
  "dataType": "artefact-ref",
  "artefactId": "artefact_abc123",
  "title": "Auth Module Refactor Plan"
}
```

This model cleanly supports Claude-style "Artifacts" — documents that live alongside the chat, can be edited in a side panel, and persist across sessions independently of the conversation history.[^19]

***

## Part 8: Putting It Together — Recommended SQLite Schema

The following is a practical, composable starting schema for a React + AI SDK + SQLite application. It uses the hybrid approach as its core, with extension points for artefacts and checkpoints.

```sql
-- Core entities
CREATE TABLE users (
  id         TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL
);

CREATE TABLE conversations (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id),
  title            TEXT,
  summary          TEXT,           -- rolling context window summary
  summary_cursor   TEXT,           -- message_id up to which summary covers
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL
);

-- Hybrid: one row per UIMessage, parts stored as JSON
CREATE TABLE messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK(role IN ('user','assistant','system')),
  parts           TEXT NOT NULL,   -- JSON: UIMessagePart[]
  metadata        TEXT,            -- JSON: custom metadata (tokens, latency, etc.)
  display_order   INTEGER NOT NULL,
  created_at      INTEGER NOT NULL
);

-- Independent structured artefacts
CREATE TABLE artefacts (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  message_id      TEXT REFERENCES messages(id),
  type            TEXT NOT NULL,
  schema_name     TEXT NOT NULL,
  schema_version  INTEGER NOT NULL DEFAULT 1,
  content         TEXT NOT NULL,
  title           TEXT,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

-- Optional: conversation state checkpoints for agentic workflows
CREATE TABLE checkpoints (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  snapshot        TEXT NOT NULL,   -- full UIMessage[] JSON
  label           TEXT,
  created_at      INTEGER NOT NULL
);

-- Indexes
CREATE INDEX idx_msgs_conv  ON messages(conversation_id, display_order);
CREATE INDEX idx_art_conv   ON artefacts(conversation_id);
CREATE INDEX idx_art_msg    ON artefacts(message_id);
```

***

## Design Principles Summary

| Concern | Recommendation |
|---------|----------------|
| What to persist | `UIMessage[]` (not `ModelMessage[]`) as source of truth |
| Schema shape | Hybrid: one row per message, `parts` as JSON column |
| Tool call state | Persisted inline in `parts` — all 4 states (`input-streaming` through `output-available`) |
| Generative UI data | Tool output in `parts` is component props; re-renders without re-execution |
| Structured output artefacts | Separate `artefacts` table with schema versioning and FK to message |
| Context window | Managed independently at inference time (rolling window, summarisation, or structured scratchpad) |
| Summary caching | Optional `summary` column on `conversations`, updated asynchronously |
| Agentic checkpointing | `checkpoints` table; snapshot before irreversible actions |
| Event-sourced alternative | Append-only `conversation_events` table; project state from log |
| Atomicity | Always wrap multi-step saves in a SQLite transaction |
| ID generation | Server-side; never client-generated for persisted messages |

---

## References

1. [Persistent Chat History with Database Design (Practical Example)](https://blog.masteringbackend.com/persistent-chat-history-with-database-design-practical-example) - To ensure you have a strong chat schema, you must begin with three main entities: users, conversatio...

2. [Vercel AI SDK v5 Internals - Part 9 — Persisting Rich `UIMessage` Histories: The v5 'Persist Once, Render Anywhere' Model](https://dev.to/yigit-konur/vercel-ai-sdk-v5-internals-part-9-database-deep-dive-persisting-uimessages-effectively-362l) - Let's talk persistence. If you've been following along with the Vercel AI SDK v5 canary journey, you...

3. [Chatbot Message Persistence - AI SDK](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-message-persistence) - Being able to store and load chat messages is crucial for most AI chatbots. In this guide, we'll sho...

4. [Saving AI SDK v5 Chat Messages in Redis | Upstash Blog](https://upstash.com/blog/ai-sdk-chat-history) - Because messages are kept in memory by default, the AI SDK sends the entire message history along fo...

5. [Guidance on persisting messages · vercel ai · Discussion #4845](https://github.com/vercel/ai/discussions/4845) - The current Chatbot Message Persistence doc uses an unhelpful setup where the entire history is save...

6. [AI SDK 5](https://vercel.com/blog/ai-sdk-5) - Introducing type-safe chat, agentic loop control, new specification, tool enhancements, speech gener...

7. [Advanced integrations with ChatKit | OpenAI API](https://developers.openai.com/api/docs/guides/custom-chatkit/) - Implement chatkit.store.Store to persist threads, messages, and files using your preferred database....

8. [Vercel AI SDK v5 Internals - Part 2 — Streaming the Richness: Inside the UI Message Protocol & UIMessageStreamParts](https://dev.to/yigit-konur/vercel-ai-sdk-v5-internals-part-2-streaming-the-richness-inside-the-ui-message-protocol--2o34) - After our first look into the Vercel AI SDK v5 and its new UIMessage structure, it's time to pull...

9. [How to get structured output but use tools and retain messages #3323](https://github.com/vercel/ai/discussions/3323) - I have a rag chatbot, currently using usechat and streamtext, configured with openai. Ideally, I'd l...

10. [LLM Structured Outputs: Schema Validation for Real Pipelines (2026)](https://collinwilkins.com/articles/structured-output) - 3) Tool or function calling. All major platforms support “function calls” or “tools.” You provide a ...

11. [UIMessage - AI SDK Core](https://ai-sdk.dev/docs/reference/ai-sdk-core/ui-message)

12. [Generative User Interfaces - AI SDK UI](https://ai-sdk.dev/v4/docs/ai-sdk-ui/generative-user-interfaces) - Before enhancing your chat interface with dynamic UI elements, you need to create a tool and corresp...

13. [Context Management: Handling Long AI Conversations & Documents](https://fieldguidetoai.com/guides/context-management) - Master context window management for AI. Learn strategies for long conversations, document processin...

14. [Context Window Management: Strategies for Long Documents and ...](https://www.abstractalgorithms.dev/context-window-management-strategies-for-long-documents-and-extended-conversations) - Sliding windows, summarization, RAG, map-reduce, and selective memory strategies for production LLMs

15. [Context Window Management Strategies](https://apxml.com/courses/langchain-production-llm/chapter-3-advanced-memory-management/context-window-management)

16. [LLM Chat History Summarization Guide October 2025 - Mem0](https://mem0.ai/blog/llm-chat-history-summarization-guide-2025) - Learn how memory systems cut token costs by 80-90% while improving AI response. Complete guide to LL...

17. [Conversation Flow Architecture: Designing Multi-Turn Agent ...](https://www.pixelmojo.io/blogs/conversation-flow-architecture-designing-multi-turn-agent-interactions) - This guide covers conversation flow architecture, context persistence, handoff topologies, and state...

18. [ai that works: Event-driven agentic loops | BAML Podcast](https://boundaryml.com/podcast/2025-11-05-event-driven-agents) - Modeling user inputs, LLM chunks, tool calls, interrupts, and UI actions as a single event stream le...

19. [What are artifacts and how do I use them? | Claude Help Center](https://support.claude.com/en/articles/9487310-what-are-artifacts-and-how-do-i-use-them)

