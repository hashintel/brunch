# Claude Agent SDK — Cookbook Patterns vs Brunch Usage

> Compiled 2026-04-02
> Sources: `src/server/core.ts`, `src/server/interview.ts`, `src/server/sse-adapter.ts`, `memory/SPEC.md`, [anthropics/claude-cookbooks/claude_agent_sdk](https://github.com/anthropics/claude-cookbooks/tree/main/claude_agent_sdk)
> Cross-references: D4, D8, D12, A2, A11, A13, A14

## Purpose

Evaluate Brunch's Claude Agent SDK usage against Anthropic's official cookbook examples. Identify gaps, validate deliberate omissions, and surface low-hanging improvements.

## Cookbook Overview

The cookbook is a six-notebook progressive tutorial with four full agent implementations:

| # | Notebook | Agent | Key patterns |
|---|---|---|---|
| 00 | One-Liner Research Agent | Research assistant | Stateless `query()`, `ClaudeSDKClient` multi-turn, `allowed_tools`, multimodal |
| 01 | Chief of Staff Agent | Orchestrator | CLAUDE.md memory, `permission_mode="plan"`, subagent orchestration via `Task`, output styles, slash commands, hooks |
| 02 | Observability Agent | CI/DevOps monitor | External MCP servers (subprocess), `disallowed_tools`, `permission_mode="acceptEdits"` |
| 03 | SRE Incident Response | Incident responder | Custom MCP server (JSON-RPC subprocess), `PreToolUse` hooks, explicit `ResultMessage` inspection, safety guardrails |
| 04 | Migrating from OpenAI | Expense policy agent | In-process MCP (`create_sdk_mcp_server` + `@tool`), `HookMatcher`, `UserPromptSubmit` hooks, session resume |
| 05 | Session Browser | Session management | `list_sessions`, `fork_session`, `resume=`, `tag_session`, `max_turns` |

## Brunch's Current SDK Surface

Brunch uses three SDK imports across two files:

| Import | File | Usage |
|---|---|---|
| `query()` | `core.ts` | Stateless streaming call per turn; prompt-stuffed history via `buildInterviewerContext()` |
| `createSdkMcpServer()` | `interview.ts` | In-process MCP server exposing `ask_question` tool per turn |
| `tool()` | `interview.ts` | Defines `ask_question` with Zod-derived schema; handler persists structured data via closure over `db` + `turnId` |

The stream consumer in `core.ts` manually walks raw `stream_event` messages (`message_start`, `content_block_start`, `content_block_delta`, `content_block_stop`, `message_stop`) and translates them to `DomainEvent` types for transport-agnostic consumption.

## Pattern-by-Pattern Comparison

### Aligned Patterns

| Cookbook pattern | Brunch status | Notes |
|---|---|---|
| Stateless `query()` | ✅ Used | Deliberate — D12 rejects SDK sessions. Turn tree is sole session model |
| In-process MCP via `create_sdk_mcp_server` + `tool()` | ✅ Used | Matches NB04. `ask_question` tool with Zod schema validation |
| `maxTurns: 1` | ✅ Used | Single agent turn per user message — correct for interview flow |
| `systemPrompt` per phase | ✅ Used | `getSystemPrompt(phase)` switches prompt by interview phase (A13) |
| `mcpServers` option | ✅ Used | Per-turn in-process server passed to `query()` |
| Manual `stream_event` parsing | ✅ Used | More explicit than any cookbook example — walks raw content blocks |

### Deliberately Rejected Patterns

These patterns are available in the SDK and demonstrated in the cookbooks, but Brunch has documented reasons for not using them.

| Cookbook pattern | Notebooks | SPEC decision | Rationale |
|---|---|---|---|
| Session persistence (`resume=`, `fork_session`) | NB04, NB05 | D12, A11 | SDK sessions are opaque, machine-local, competing source of truth. Turn tree provides branching semantics incompatible with SDK's linear session model. Portable data goals (atomic YAML, git-versionable) require owning the persistence layer |
| `AgentDefinition` subagents via `Task` tool | NB01 | A13 | Phase-specific behavior achieved via `getSystemPrompt(phase)` + per-turn MCP server. Simpler, less indirection, validated in slice 4 (88 tests) |
| `ClaudeSDKClient` context manager | NB00, NB01 | D12 | Stateful multi-turn sessions rejected — same rationale as session persistence |
| `continue_conversation` flag | NB00, NB01 | D12 | Implies SDK-managed conversation state |

### Gaps Worth Evaluating

Patterns demonstrated in the cookbooks that Brunch does not use, without a documented rejection reason.

#### 1. `ResultMessage` Inspection — **High relevance**

**Cookbook source:** NB03 (SRE agent), NB05 (session browser)

The SDK's `ResultMessage` (emitted at stream end) carries metadata that Brunch currently discards:

```typescript
// Available on ResultMessage (Python SDK names; TS equivalents likely similar)
{
  result: string,        // final text output
  session_id: string,    // SDK session identifier
  is_error: boolean,     // whether the query errored
  usage: {               // token counts
    input_tokens: number,
    output_tokens: number,
  },
  total_cost_usd: number, // API cost for this query
  num_turns: number,       // agentic turns taken
  duration_ms: number,     // wall-clock time
}
```

**Current gap:** `core.ts` catches errors via try/catch but does not inspect `ResultMessage` for usage, cost, or duration. This is free observability data relevant to:
- A4 (observer latency measurement — currently unmonitored)
- Blind spot "Performance under realistic load" (cost per turn, token growth over 20+ turns)
- Future billing or rate-limit awareness

**Recommendation:** After the `for await` loop in `conductTurn()`, inspect the final message for `ResultMessage` fields. Emit as a new `DomainEvent` type (e.g., `turn-metrics`) or log for diagnostics.

**Risk:** Low. The TS SDK may not expose identical fields to the Python SDK. Requires verifying the actual TS `ResultMessage` shape.

#### 2. `disallowed_tools` — **Low relevance**

**Cookbook source:** NB02 (observability agent), NB03 (SRE agent)

The cookbook emphasizes that `allowed_tools` controls permission prompting, not availability. Without `disallowed_tools`, the agent could still access `Bash`, `Read`, `Write`, etc. — the full built-in tool set.

**Current gap:** Brunch sets `allowed_tools` implicitly (only MCP tools are available since no built-in tools are enabled), but does not explicitly `disallowed_tools` to prevent the agent from attempting to use built-in tools.

**Recommendation:** Not actionable unless the agent starts hallucinating tool calls to `Bash` or `Read`. The constraint is structural — only `mcp__interview__ask_question` is available.

#### 3. `PreToolUse` Hooks — **Medium relevance**

**Cookbook source:** NB03 (SRE agent — validates config changes before execution)

Brunch validates `ask_question` output after execution via Zod parse in the tool handler. A `PreToolUse` hook could validate *before* execution, but the current approach is equivalent since the tool handler itself does the validation.

**Recommendation:** Not actionable. Zod validation inside the tool handler is simpler and equally effective for a single-tool agent.

#### 4. `UserPromptSubmit` Hooks — **Low relevance**

**Cookbook source:** NB04 (input guardrail — blocks prompts without dollar amounts)

Could validate user messages before they reach the agent (e.g., reject empty input). Currently handled by the Express route layer.

**Recommendation:** Not actionable. Input validation belongs in the transport layer, not the SDK layer.

#### 5. `permission_mode` — **Low relevance**

**Cookbook source:** NB01 (`"plan"`), NB02/03 (`"acceptEdits"`)

`"plan"` mode makes the agent think without acting — interesting for a "preview next question" feature but not in current scope. `"acceptEdits"` is for CI/DevOps agents with filesystem access.

**Recommendation:** Not actionable for current requirements.

#### 6. Subagent Orchestration for Observer — **Medium relevance**

**Cookbook source:** NB01 (Chief of Staff delegates to financial-analyst, recruiter via `Task` tool)

The observer agent is currently a separate manual `query()` call (spike, planned for slice 5). The cookbook's `Task` tool pattern would let the interviewer *delegate* to the observer as a subagent within its own turn, rather than core orchestrating two separate calls.

**Current approach (D4):** Core calls interviewer `query()`, then separately calls observer `query()`. Two independent calls, sequenced by core.

**Alternative (NB01 pattern):** Interviewer is given `Task` tool access. After answering, it delegates extraction to an observer `AgentDefinition`. The observer runs as a subagent within the same SDK session.

**Trade-off analysis:**

| Dimension | Current (core-orchestrated) | Alternative (SDK-orchestrated) |
|---|---|---|
| Separation of concerns | ✅ Clean — core owns sequencing | ❌ Interviewer knows about extraction |
| Model flexibility | ✅ Observer can use cheaper model | ❌ Subagents inherit parent model (verify) |
| Testability | ✅ Each agent independently testable | ❌ Coupled via session |
| Latency | Neutral — sequential either way | Potentially better — SDK manages handoff |
| Session state | ✅ Turn tree owns history | ❌ SDK session is shared state |

**Recommendation:** Keep current approach. D4's rationale (clean separation, independent testability, model flexibility) is stronger than the SDK orchestration benefit.

## SDK API Reference: `ClaudeAgentOptions` Parameters

Complete parameter surface observed across all six notebooks:

| Parameter | Type | Used by Brunch | Notes |
|---|---|---|---|
| `model` | `string` | ✅ | `process.env.ANTHROPIC_MODEL \|\| 'claude-sonnet-4-20250514'` |
| `allowed_tools` | `string[]` | ❌ (implicit) | Only MCP tools available; no built-in tools enabled |
| `disallowed_tools` | `string[]` | ❌ | Not needed — structural constraint |
| `system_prompt` / `systemPrompt` | `string` | ✅ | Phase-specific via `getSystemPrompt()` |
| `cwd` | `string` | ❌ | Used for CLAUDE.md loading; not relevant |
| `mcp_servers` / `mcpServers` | `dict/object` | ✅ | Per-turn `interview` server |
| `permission_mode` | `string` | ❌ | Not applicable |
| `hooks` | `object` | ❌ | Not needed currently |
| `continue_conversation` | `boolean` | ❌ | Rejected (D12) |
| `resume` | `string` | ❌ | Rejected (D12) |
| `max_buffer_size` / `maxBufferSize` | `number` | ❌ | No multimodal content |
| `max_turns` / `maxTurns` | `number` | ✅ | Set to `1` |
| `setting_sources` | `string[]` | ❌ | No filesystem settings |
| `settings` | `string` | ❌ | No output styles |
| `includePartialMessages` | `boolean` | ✅ | Enables streaming events |

## SDK Message Type Taxonomy

Stream messages observed in the cookbook examples:

| Message type | When emitted | Brunch handles? |
|---|---|---|
| `SystemMessage` | Session init | ❌ (stateless — no session init) |
| `AssistantMessage` | Agent response blocks | ✅ Via `stream_event` content blocks |
| `UserMessage` | Tool results | ✅ Implicitly (SDK handles tool loop) |
| `ResultMessage` | Stream end | ❌ **Gap — free metrics discarded** |

## MCP Tool Naming Convention

The SDK uses a double-underscore convention for MCP tool names:

```
mcp__{server_name}__{tool_name}

Brunch example: mcp__interview__ask_question
```

Prefix-matching works in `allowed_tools` — e.g., `"mcp__interview"` allows all tools from the `interview` server.

## Hook Architecture (Reference)

Three hook events demonstrated across the cookbooks:

| Hook event | Trigger | Cookbook use case |
|---|---|---|
| `PreToolUse` | Before any tool executes | Safety validation, config checks (NB03) |
| `PostToolUse` | After tool completes | Audit trail (NB01) |
| `UserPromptSubmit` | Before prompt reaches Claude | Input guardrails (NB04) |

Hooks can be shell commands (exit code = allow/block) or async functions returning `{ decision: "block", reason: "..." }`.

## Recommendations Summary

| # | Action | Priority | Effort | Impacted decisions |
|---|---|---|---|---|
| 1 | Inspect `ResultMessage` for usage/cost/duration metrics | **High** | Low | New (observability) |
| 2 | Keep core-orchestrated observer (reject subagent pattern) | — | — | D4 confirmed |
| 3 | Keep stateless `query()` (reject session persistence) | — | — | D12 confirmed |
| 4 | Keep phase-via-prompt (reject `AgentDefinition`) | — | — | A13 confirmed |
| 5 | Consider `PreToolUse` hook if adding write-capable tools | Low | Low | Future |
| 6 | Consider `disallowed_tools` if agent hallucinates built-in tools | Low | Low | Future |

## Open Questions

1. **TS SDK `ResultMessage` shape** — The cookbook examples are Python. Does the TS SDK (`@anthropic-ai/claude-agent-sdk`) expose the same `ResultMessage` fields (`usage`, `total_cost_usd`, `duration_ms`)? Need to verify against the actual package types.
2. **Observer as subagent cost** — If the observer moved to a subagent via `Task`, would it inherit the parent's model or allow model override? The cookbook doesn't clarify this for the TS SDK.
3. **`stream_event` vs higher-level messages** — Brunch parses raw `stream_event` types. The cookbook's NB03 uses higher-level `AssistantMessage`/`TextBlock`/`ToolUseBlock` types. Are both available in the TS SDK? The higher-level API would simplify `conductTurn()`.
