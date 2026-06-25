## Problem Statement

Brunch currently has no single owner for **LLM context ingress**. Agent-facing text is spread by adapter or historical layer: prompt bodies live under the Pi surface, prompt composition and prompt-resource legality live under Pi extension internals, pushed context seed composition lives under session modules, reusable context renderers live under the generic renderer seam, and several tool-result texts are still formatted inside tool adapters.

That makes it hard to review or test the actual bytes and vocabulary entering the model. A developer asking “what does the agent see?” has to traverse Pi extensions, session helpers, renderers, graph adapters, and skill metadata. The current topology answers “which runtime adapter consumes this?” better than “who controls agent context?”

```pseudo tree
current LLM-context ownership
├── Pi markdown bodies
│   └── .pi agent body resources
├── Pi prompt extension internals
│   ├── foreground prompt composition
│   ├── prompt-resource manifest rendering
│   └── prompt-resource/tool legality helper
├── session helpers
│   ├── per-turn pushed context seed
│   └── origination/session-entry context seed
├── generic renderers
│   ├── graph/spec/workspace/session context text
│   └── exchange markdown text
└── adapter-local formatters
    ├── graph mutation/read-related diagnostics
    ├── elicitation agenda text
    └── reconciliation agenda text
```

## Solution

Create `src/agents/` as the central, Pi-independent owner of agent prompt bodies, Brunch prompt-resource skills, prompt composition policy, and all Brunch-authored LLM-context renderings. Pi extensions, session origination code, probes, and tools become callers: they gather data, then ask `src/agents/` to produce the model-facing text.

Keep tool schemas beside the tools. Schemas are the adapter contract. But tool **content**, session-entry **content**, and prompt **content** should be developed and golden-tested in the agent context home.

```pseudo tree
desired LLM-context ownership
src/agents/
├── prompts/
│   ├── foreground agent bodies
│   └── background agent bodies with spawn metadata where needed
├── skills/
│   ├── strategies/
│   ├── lenses/
│   └── methods/
├── runtime/
│   ├── foreground prompt composition
│   ├── prompt-resource manifest loading/rendering
│   ├── prompt-resource/tool legality projection
│   └── agent body loading/path registry
└── contexts/
    ├── primitives: markdown, section, tree, toon helpers for agent context
    ├── graph: overview, neighborhood, related, mutation-result text
    ├── workspace/specification/session: context blocks and runtime frames
    ├── exchanges: present/request markdown
    ├── elicitation: gap agenda/update text
    ├── reconciliation: need agenda/update text
    └── seeds: per-turn and origination/session-entry context composition

callers after refactor
├── Pi extensions: register tools/hooks, gather deps, call src/agents/* for text
├── session origination: gathers graph/workspace/gaps, calls src/agents/contexts/seeds
├── dev/probes: use agent-context renderers for probe-visible artifacts
└── product CLI/human renderers: remain outside unless the text enters LLM context
```

## Commits

1. ✓ Add the new `src/agents` topology and README as an empty central owner, and introduce central path/registry helpers that still point at the existing prompt and skill homes.
2. ✓ Move agent prompt bodies into the new prompt home and update foreground/body loading, background subagent loading, build asset copying, and prompt-body tests without changing prompt bytes.
3. ✓ Move Brunch prompt-resource skills into the new skills home and update manifest loading, build asset copying, resource-location snapshots, and skill topology docs without changing skill bytes.
4. Move foreground prompt composition and prompt-resource legality code into the new runtime home; leave Pi extension code as a thin hook adapter that imports the central composer.
5. Move per-turn pushed context composition and origination/session-entry seed composition into the new context seed home; update session and app callers to import from the central agent context layer.
6. Move reusable LLM-facing context renderers into the new context home, keeping product-only/human-only renderers outside unless they are deliberately agent-visible.
7. Promote adapter-local LLM text formatting into the new context home: graph mutation result text, related-node text, elicitation agenda/update text, and reconciliation agenda/update text.
8. Consolidate golden/preview tests for prompt composition and agent context renderers under the new agent tree, preserving existing semantic invariants while making “what enters the model” reviewable in one place.
9. Add a boundary guard that prevents Pi extension adapters from owning Brunch-authored tool/session/prompt content text, while explicitly allowing tool schemas, labels, descriptions, and prompt snippets to remain adapter-owned.
10. Reconcile topology READMEs, SPEC/PLAN references, build scripts, and direct-import docs so the new owner is canonical and the old `.pi`/`renderers` ownership claims are retired.

## Decisions

- Build or modify a new `agents` module as the central LLM-context ingress owner.
- Keep the name `skills` for Brunch prompt-resource skill bodies, not `resources`.
- Keep Pi extension modules as runtime adapters only: registration, hook binding, dependency gathering, and tool schemas stay there; Brunch-authored model-facing content moves out.
- Keep tool schemas near their tools because they are provider/adapter contracts, even though they are visible to the model.
- Split generic rendering by audience: agent-visible context text moves to the agent context home; product-only human renderers stay outside unless later made model-visible.
- Background agent metadata may remain frontmatter in prompt markdown, but discovery remains code-owned through explicit registries.
- Topology READMEs to update or retire include the Pi surface README, Pi agents README, Pi skills README, Pi extensions README, renderer README, session README, and root source README.

## Testing Decisions

- Existing prompt composition previews and renderer goldens are the core safety net; move or re-anchor them rather than rewriting expected content casually.
- First priority is byte stability for existing prompt bodies, skill bodies, and model-facing render outputs.
- Keep semantic invariants for graph code rendering, no raw structural leaks where already locked, readiness estimate parity, prompt-resource legality, and active-tool/prompt-manifest alignment.
- Add one boundary/architecture test after the moves: extension adapters may register schemas and call central renderers, but should not define Brunch-authored result/session/prompt body text locally.
- Run the full gate after each commit-sized move because this is import/topology-heavy and build asset copying is part of product behavior.

## Out of Scope

- Changing graph ontology vocabulary, node kinds, edge categories, readiness bands, or detail schemas.
- Rewriting prompt/skill prose for quality beyond path-sensitive updates required by the move.
- Changing tool schemas, tool availability, runtime policy behavior, or subagent spawnability.
- Changing Pi sealed-profile behavior or ambient discovery rules.
- Building a new renderer framework or generalized preview harness beyond relocating existing goldens and adding the boundary guard.
- Moving product-only CLI text unless it becomes agent-visible.
- Changing transcript debug rendering unless a later slice decides transcript reports are agent context rather than human/probe artifacts.
