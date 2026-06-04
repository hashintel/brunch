# agents/ — Agent intelligence layer

SPEC decisions: D25-L, D40-L, D52-L, D58-L, D59-L, D60-L

## Owns

Everything that shapes what the LLM sees and does: the session-agent state
definitions and legal-combination table, per-turn prompt composition, the
Brunch-owned prompt resources (markdown the agent reads on demand), and the
snapshot render layer.

## Session-agent state (D40-L, D59-L)

Projected from linear `brunch.agent_runtime_state` entries at turn start
(last-writer-wins). One WHO field, three optional objective axes:

```
op_mode      = elicit | execute (future)        ← the only stored WHO field
                 foreground role (elicitor) is DERIVED from op_mode, never stored
goal         = grounding-advance | elicit-expand | commit-converge
                 | capture-posture               [pinned | AUTO]   grade-derived (D59-L)
strategy     = step-wise-decision-tree | step-wise-disambiguate
                 | propose-graph | project-graph  [pinned | AUTO]   (D25-L)
lens         = intent | design | oracle           [pinned | AUTO]   (future: plan/sync/scope)
```

Gates that condition composition but are not session-agent axes:

```
spec.readiness_grade   grounding_onboarding → elicitation_ready
                         → commitments_ready → planning_ready   (forward gate, D45-L)
workspace posture      persisted in .brunch/workspace.json as workspace-scoped state;
                         surfaced in the runtime header and refined via capture-posture
agent allow-list       per-definition: which goals/strategies/lenses/methods are legal
```

The legal `(op_mode × goal × strategy × lens)` tuple table lives in `state.ts`.

## Composition model (D58-L) — thin header + gated manifest, not eager packs

`compose(agentId, sessionState, spec, workspace, snapshots)` is **projection,
not a state machine**. It runs before Pi provider requests and emits:

1. **agent control header** — identity, model/thinking, role derived from `op_mode`, tool authority.
2. **runtime-state header** — current pinned/AUTO `goal`/`strategy`/`lens`, `readiness_grade`, posture.
3. **resource manifests** — `<available_goals>`, `<available_strategies>`, `<available_lenses>`,
   `<available_methods>`: each entry `{name, description, location}`, filtered by tuple/grade/`op_mode`/allow-list.
4. **compact pushed context** — minimal snapshot summary/handles (detail governed by D60-L).

Detailed goal/strategy/lens/method bodies are **markdown the agent loads with
`read`** when detail matters — the same mechanism Pi uses for skills. The
composer never concatenates large semantic bodies on the agent's behalf.

- **AUTO** axis → the manifest lists exactly the legal set; a router rule tells the agent to
  choose only from that manifest. **Pinned** axis → the manifest points at the pinned resource.
- Manifest `{name, description, location}` metadata is **code-owned in `state.ts`**, never
  filesystem-discovered (honors the D39-L profile seal).

## Directory layout

```
agents/
├── README.md
├── state.ts          axis enums + legal (op_mode × goal × strategy × lens) tuple table;
│                       also owns each resource's {name, description, location} manifest entry
├── compose.ts        projection → runtime header + gated manifest
├── index.ts          public entry / resource registry
├── definitions/      keyed agents; frontmatter = model/thinking + tool authority + allow-lists,
│   ├── elicitor.md     body = system prompt
│   └── reviewer.md
├── goals/            grounding-advance, elicit-expand, commit-converge, capture-posture
├── strategies/       step-wise-decision-tree, step-wise-disambiguate, propose-graph, project-graph
├── lenses/           intent, design, oracle
├── methods/          run-structured-exchange, infer-and-capture, generate-proposal,
│                       read-snapshot, commit-graph, review-for-gaps
└── contexts/         snapshot RENDER (D60-L) — TypeScript, NOT a manifest resource family
    ├── cwd.ts
    ├── graph.ts
    └── node.ts
```

## Snapshots (D60-L) — pull / render / surface

- **PULL** — typed, read-only; owned by the data layer (`graph/snapshot.ts` for graph/node,
  `session/` for cwd). The typed value *is* the JSON form. `agents/` never re-implements pulls.
- **RENDER** — `agents/contexts/*.ts` turn a typed snapshot into an LLM string, scaled by
  lens-plane and grade-depth (I35-L). This is the only place LLM-string rendering lives.
- **SURFACE** — *pushed* (compose injects the compact summary) or *pulled* (`snapshot-{cwd,graph,nodes}`
  Pi tools wrap the renderer: markdown in `toolResult.content`, typed JSON in `toolResult.details`).

`contexts/` is render-only and carries no `<available_*>` manifest family. Reserve
"snapshot" for this agent-context family; `workspace.snapshot` is product/UI state (D60-L).

## Does NOT own

- Pi extension registration, tool definitions, `snapshot-*` tool wrappers — `.pi/extensions/`.
- Graph domain logic, CommandExecutor, snapshot PULL — `graph/`.
- Session projection, transcript reading, cwd PULL — `session/`.

## Imported by

- `.pi/extensions/` prompt registrar — calls `compose()` at turn boundaries.
- `.pi/extensions/operational-mode.ts` — reads the state enums from `state.ts`.

## Migration from .pi/context/ (complete)

Product prompting imports `agents/compose.ts`; prompt-resource metadata is
code-owned in `state.ts`; detailed prompt resources live under
`definitions/`, `goals/`, `strategies/`, `lenses/`, and `methods/`; context
rendering lives under `contexts/`. The old `src/.pi/context/` prompt-pack
subtree is deleted rather than retained as a compatibility path.

| Former (.pi/context/)                           | Current home                        |
|-------------------------------------------------|-------------------------------------|
| `compose-brunch-prompt.ts`                      | `agents/compose.ts`                 |
| `prompt-packs/{brunch-base,elicit,elicitor}.md` | `agents/definitions/elicitor.md`    |
| `prompt-packs/structured-exchange.md`           | `agents/methods/run-structured-exchange.md` |
| `prompt-packs/capture-analysis.md`              | `agents/methods/infer-and-capture.md` |
| `prompt-packs/candidate-proposals.md`           | `agents/methods/generate-proposal.md` |
| `builders/graph-context.ts`                     | `agents/contexts/graph.ts`          |
| `builders/readiness-context.ts`                 | `agents/compose.ts` runtime header  |
| `builders/structured-exchange-context.ts`       | `agents/methods/run-structured-exchange.md` |
