# agents/ — Agent intelligence layer

SPEC decisions: D25-L, D40-L, D52-L

## Owns

Everything that shapes what the LLM sees and does: state definitions,
prompt composition, strategy/lens content, and context snapshot orchestration.

### Agent state hierarchy

```
spec.grade
  grounding → elicitation I,II → commitment → export

session.mode          = elicitation | execution (future) | reconciliation (deferred)
session.agent         = elicitor | planner (future) | reconciler (deferred)
session.strategy      = per-agent interaction shape
session.lens          = per-mode topical focus
session.sub-agents    = research, explore, design, oracle, review, reconcile
```

### Strategy × lens (D25-L)

Strategies describe the interaction shape. Lenses describe topical focus.
The combination maps to the prior "lens catalogue" names:

| Strategy                 | Commitment path    | Example lens combinations          |
|--------------------------|--------------------|------------------------------------|
| `step-wise-decision-tree`| single-exchange    | any lens                           |
| `step-wise-disambiguate` | single-exchange    | any lens                           |
| `propose-graph`          | direct commit      | intent, design, oracle             |
| `project-graph`          | review-set         | intent                             |

### Context building

Snapshot functions live in `contexts/`. They orchestrate *which* snapshots
to inject based on mode/role/strategy/lens/grade, by calling into:

```
agents/contexts/
    │
    ├──▶  graph/   →  snapshotGraph(detail), snapshotNode(id, hops)
    │
    └──▶  session/ →  workspace/spec envelope
```

Graph snapshots support multiple detail levels (I35-L):
- **Cursory** — compact full-graph overview for orientation
- **Neighborhood** — detailed node + N-hop expansion for focused work

## Directory layout

```
agents/
├── README.md
├── state.ts              mode/role/strategy/lens type defs + valid combos
├── compose.ts            prompt orchestrator: reads state, picks packs, calls snapshots
├── modes/
│   └── elicit.md         elicitation mode rules, tool authority
├── strategies/
│   ├── step-wise-decision-tree.md
│   ├── step-wise-disambiguate.md
│   ├── propose-graph.md    ← graph vocabulary, category rubric, batch format
│   └── project-graph.md
├── lenses/
│   ├── intent.md
│   ├── design.md
│   └── oracle.md
└── contexts/
    ├── graph-context.ts    calls graph/ snapshot fns, formats for prompt
    └── readiness-context.ts
```

## Does NOT own

- Pi extension registration, tool definitions — those live in `.pi/extensions/`.
- Graph domain logic, CommandExecutor — those live in `graph/`.
- Session projection, transcript reading — those live in `session/`.

## Imported by

- `.pi/extensions/prompting.ts` — calls compose.ts at turn boundaries
- `.pi/extensions/operational-mode.ts` — reads state definitions

## Migration from .pi/context/

The current `src/tui-client/.pi/context/` layout migrates here:

| Current location                          | Target                        |
|-------------------------------------------|-------------------------------|
| `.pi/context/compose-brunch-prompt.ts`    | `agents/compose.ts`           |
| `.pi/context/prompt-packs/*.md`           | `agents/modes/`, `strategies/`, `lenses/` |
| `.pi/context/builders/graph-context.ts`   | `agents/contexts/graph-context.ts` |
| `.pi/context/builders/readiness-context.ts`| `agents/contexts/readiness-context.ts` |

Move incrementally as prompt composition is refactored.
