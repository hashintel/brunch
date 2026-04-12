# Brownfield Exploration Design

> Design exploration from 2026-04-12. Referenced by SPEC.md D82, D83.
> Status: **implemented** — Scope-only exploration via prompt + read-only exploration tools.

## Shape

No new module boundary. Brownfield exploration is a prompt/context/tool-configuration concern:

1. **Tool set:** During brownfield scope only, the interviewer agent receives a read-only exploration subset (`read`, `grep`, `find`, `ls`) alongside interview tools (`ask_question`, `propose_phase_closure`).
2. **System prompt:** A brownfield variant of the scope system prompt instructs the agent to explore the codebase before asking its first scope question. Later phases keep their normal phase prompts.
3. **Context builder:** `buildInterviewerContext()` receives the project's `cwd` and `mode` (greenfield/brownfield) to construct the appropriate first-turn prompt.

## Interviewer configuration change

```typescript
// interview.ts — createInterviewerAgent()
const tools = {
  ask_question,
  ...(closeable ? { propose_phase_closure } : {}),
  ...(phase === 'scope' && mode === 'brownfield' ? createExplorationTools(projectCwd) : {}),
}

const instructions = phase === 'scope' && mode === 'brownfield'
  ? getBrownfieldScopePrompt(projectCwd)
  : getSystemPrompt(phase)
```

## First-turn UX

The user sees one continuous streamed turn:
1. Agent uses tool calls (read_file, grep, find_files) to explore the codebase
2. Agent synthesizes findings into a summary
3. Agent transitions into the first scope question, grounded in what it found
4. Observer extracts knowledge items from this turn as usual

## Data model change

The `project` table needs a `mode` field:
```typescript
mode: text('mode', { enum: ['greenfield', 'brownfield'] }).notNull().default('greenfield')
```

The project's `cwd` is stored alongside it (needed for tool factory):
```typescript
cwd: text('cwd') // absolute path where the project was created
```

## First-screen routing

The client's project creation flow asks:
- "New concept from scratch" → greenfield
- "Feature within existing codebase" → brownfield

Both create a project record; brownfield sets `mode: 'brownfield'` and stores `cwd`.

## Design alternatives considered

- **B (Separate pre-interview agent call):** Dedicated exploration agent runs before the first chat turn. Clean separation but adds latency (two serial agent calls) and the exploration is non-interactive — user can't guide it or interrupt.
- **A (Conditional tool set only):** Just add tools, no special prompt. Relies entirely on the agent figuring out it should explore. Too unpredictable.

## Prompt engineering notes

The brownfield system prompt should:
- Name the project directory explicitly
- Instruct: "Before asking your first scope question, use your tools to explore the codebase"
- Suggest a strategy: look for README, package.json/Cargo.toml/etc., directory structure, then key files
- Set a budget: "Spend no more than 5-8 tool calls on exploration before synthesizing"
- Transition: "Once you have a working understanding, summarize what you found and begin scope questions grounded in that context"

## Current implementation notes

- Brownfield exploration is deliberately **scope-only**; later phases keep their normal prompts and tool surface.
- The exploration tool surface is deliberately **read-only** — no `write`, `edit`, or `bash` during brownfield discovery.
- The exploration summary is not stored as a special data part; it remains part of the first assistant turn.
- Brownfield scope raises the `ToolLoopAgent` step budget from 4 to 12 to allow exploration before the first structured question.
