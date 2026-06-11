# .pi/agents/ — Pi-harness agent prompt assembly

SPEC decisions: D25-L, D29-L, D40-L, D52-L, D58-L, D59-L, D60-L

## Owns

Everything that shapes the foreground Pi session agent before a provider request: role definitions, legal runtime-state tuple filtering, active resource manifests, and compact agent-context orchestration.

The markdown resources the agent reads on demand live beside this layer but are split by purpose:

```text
.pi/agents/definitions/   keyed agent role prompts
.pi/skills/goals/         capability-readiness-derived objectives
.pi/skills/strategies/    interaction shapes
.pi/skills/lenses/        topical focus lenses
.pi/skills/methods/       tool-routing / sequencing guidance
```

## Does NOT own

- Pi extension hook registration — `.pi/extensions/system-prompts/`.
- Pi tool definitions and UI collection — `.pi/extensions/*`.
- Reusable product DTO projection or markdown rendering — target `projections/` and `renderers/` seams.
- Graph domain logic or read/query PULL — `graph/`.
- Session transcript/workspace semantics — `session/`.

## Layout

```text
agents/
├── README.md
├── state.ts          resource manifests + gap-driven method/tool legality;
│                       reuses runtime-policy for goal/strategy/lens legality
├── compose.ts        projection + elicitation gaps -> runtime header + gated manifest
├── previews.test.ts  COMPOSE-stage golden harness
├── __previews__/     approved composed-prompt goldens
├── index.ts          public entry for prompt assembly imports
├── definitions/      keyed agent role prompts; body = system-prompt resource
│   ├── elicitor.md
│   └── reviewer.md
└── contexts/         agent-context selection/render orchestration (D60-L)
    ├── cwd.ts
    ├── graph.ts
    └── node.ts
```

## Composition model

`composeAgentPrompt(agentId, sessionState, spec, workspace, context, gaps)` emits:

1. agent control header — identity, model/thinking expectation, role derived from `op_mode`, tool authority;
2. runtime-state header — current pinned/AUTO `goal`/`strategy`/`lens`, current spec line with the soft per-band readiness estimate, posture;
3. elicitation recommendation — one deterministic next open gap from the selected-spec `elicitation_gaps` read, when any eligible gap remains;
4. compact pushed context — minimal context handles and rendered context blocks;
5. resource manifests — `<available_goals>`, `<available_strategies>`, `<available_lenses>`, `<available_methods>` entries, filtered by `op_mode`/allow-list plus capability-readiness over selected-spec elicitation gaps; AUTO axes list only currently legal choices, while role/mode-legal pinned axes remain visible even when readiness negotiates and gated methods/tools stay withheld;
6. prompt-resource routing rules.

Detailed goal/strategy/lens/method bodies are markdown resources under `.pi/skills/` and are loaded with `read` when detail matters. Manifest metadata is code-owned in `state.ts`, not filesystem-discovered.

## COMPOSE preview ledger

`previews.test.ts` locks approved provider-facing composed prompts under `__previews__/` with repo-local paths normalized to `<repo>/…`. The normalization belongs to the preview oracle only; `compose.ts` keeps real absolute manifest paths for runtime use.

| Case | Status | Oracle / disposition |
| --- | --- | --- |
| `elicitor--auto-floor-gaps-open` | locked | Golden approved 2026-06-11; low grounding coverage narrows AUTO manifests, shows `grounding=0.00`, and surfaces the top open gap recommendation. |
| `elicitor--auto-high-coverage` | locked | Golden approved 2026-06-11; high grounding coverage widens AUTO manifests, shows `grounding=1.00`, and omits the recommendation block because no eligible open gap remains. |
| `elicitor--pinned-strategy-lens` | locked | Golden approved 2026-06-11; pinned strategy/lens render singleton manifests and omit the recommendation block because no eligible open gap remains. |
| `elicitor--pushed-context` | locked | Golden approved 2026-06-11; fixture `renderedContexts` strings lock pushed-context framing/indentation while bracketing the renderer dependency; also locks recommendation placement ahead of pushed context. |
| `reviewer--auto-default` | wait-gated | Tripwire on async reviewer pipeline. Reviewer is a side-chain worker (D29-L/D40-L), not a foreground compose role today. |
| full-stack real rendered context | deferred | Tripwire on `renderer-golden-coverage`; COMPOSE goldens use fixture strings until renderer goldens stabilize. |

Definition body lock disposition:

| Definition | Status | Lock disposition |
| --- | --- | --- |
| `definitions/elicitor.md` | required | Source file is the lock; no COMPOSE copy-golden because `compose.ts` emits manifest metadata only, not body text. |
| `definitions/reviewer.md` | deferred | Source file is retained for the future async reviewer path; no foreground COMPOSE golden until that path exists. |

## Context split

```pseudo
PULL    -> graph/, session/                [typed, read-only]
RENDER  -> reusable renderers eventually; .pi/agents/contexts chooses audience/detail
SURFACE -> extensions/system-prompts/ or read_graph / context read tools
```

`contexts/` is not a `<available_*>` manifest resource family. It chooses which typed pull to expose, how much detail to include, and how lens/gaps/mode shape the prompt-facing string.

## Imported by

- `.pi/extensions/system-prompts/` — calls `composeAgentPrompt()` at turn boundaries.
- `.pi/extensions/runtime/` — reads state helpers for active tool policy.
