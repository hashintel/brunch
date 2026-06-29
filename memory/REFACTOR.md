## Problem Statement

The elicitor's live behavior is currently co-authored by too many control layers: prompt-resource routing, runtime state axes, capability-readiness, elicitation-gap recommendation, and method-derived tool activation. That makes it hard to answer the basic product question "what prompt and context does the elicitor actually run with right now?" because the answer depends on several interacting pseudo-mechanics instead of a small explicit source of truth.

The topology also hides the live path. `src/agents/` already claims prompt/context ownership, but the current elicitor path still spreads meaning across prompt-resource manifests, graph-gap policy, transcript-backed axis state, and Pi adapter composition rules. This makes suspension difficult because there is no obvious place where "the simplified elicitor" lives apart from the suspended control system.

```pseudo
tree current
src/agents/
├── contexts/
│   ├── session/readiness-estimate
│   ├── seeds/turn-context
│   ├── spec/spec-context
│   └── ...
├── prompts/
│   ├── elicitor.md
│   └── executor.md
├── runtime/
│   ├── compose
│   ├── state
│   ├── policy
│   ├── capability-readiness
│   └── prompt-skills
├── skills/
│   ├── strategies/*
│   ├── lenses/*
│   └── methods/*
└── subagents/

tree current wiring
pi prompt adapter
  -> runtime state projection
  -> gap/world reads
  -> active tools from methods/readiness
  -> context seed with lens-dependent render
  -> prompt composer with skill manifests + elicitation recommendation
```

## Solution

Suspend `lens`, `strategy`, `method`, and `elicitation-gaps` as live elicitor control concepts. The live elicitor path should become a centralized, easy-to-find assembly inside `src/agents/`: one fixed elicitor prompt body, one plain context assembly path, and one explicit active-tool policy. Pi extensions should only wire those sources of truth into the host runtime.

Suspended mechanisms should remain available only as clearly isolated legacy material until deletion is safe. The key outcome is topological legibility: a reader should be able to open `src/agents/` and immediately find the live elicitor system without needing to traverse old prompt-resource infrastructure.

```pseudo
tree desired
src/agents/
├── contexts/
│   ├── live/
│   │   ├── elicitor-context
│   │   └── selected-spec-context
│   ├── spec/
│   ├── workspace/
│   └── suspended/
├── prompts/
│   ├── elicitor.md
│   └── executor.md
├── runtime/
│   ├── elicitor/
│   │   ├── compose-live-prompt
│   │   ├── active-tools
│   │   └── prompt-context
│   ├── shared/
│   └── suspended/
├── shared/
├── skills/
│   ├── teach/
│   ├── capture/
│   ├── project/
│   ├── elicit/
│   ├── review/
│   ├── design/
│   └── suspended/
└── subagents/

tree desired wiring
pi prompt adapter
  -> read live elicitor prompt body
  -> read plain selected-spec/workspace context bundle
  -> apply fixed active-tool set
  -> append composed live prompt

suspended control system
  -> isolated under suspended topology
  -> not consulted by live elicitor path
```

## Commits

1. ✓ Establish the new live-vs-suspended topology and co-located documentation so the simplified elicitor path has an obvious home before behavior changes.
2. ✓ Introduce a new live elicitor prompt/context assembly path that produces a plain prompt and plain selected-spec/workspace context without consulting prompt-resource routing or elicitation-gap logic.
3. ✓ Rewire the Pi prompt adapter to consume the new live elicitor assembly path while leaving the suspended control system uncalled.
4. ✓ Replace method- and readiness-derived tool activation for the live elicitor with one explicit fixed tool policy.
5. ✓ Remove live prompt/context reads of readiness estimates, elicitation recommendations, lens emphasis, and runtime axis selections from the elicitor path.
6. Quarantine the old runtime control modules, prompt-resource manifests, and gap-driven helpers under suspended topology with compatibility shims only where needed to keep non-elicitor surfaces working.
7. Simplify session/runtime reporting so operational mode remains meaningful but strategy/lens-specific live surfaces no longer claim authority over the elicitor.
8. Rename and regroup surviving skill directories into the new simpler conceptual set, with the old strategy/lens/method taxonomy retired or moved under suspended topology.
9. Prune obsolete tests and snapshots, then add focused live-path snapshots proving that the elicitor prompt and active tools now come from the centralized simplified path.

## Decisions

- The refactor keeps `src/agents/` as the sole source of truth for prompt and context rendering; Pi extensions remain host wiring only.
- Operational mode survives as the only live runtime control concept unless later evidence proves a stronger control surface is necessary.
- The first phase is suspension, not immediate deletion: old control modules move behind an explicit suspended boundary so the live path can stabilize before permanent retirement.
- The live elicitor gets one explicit prompt assembly path and one explicit active-tool policy; no dynamic skill/resource negotiation remains in that path.
- Context rendering for the live elicitor becomes plain and neutral rather than lens-shaped or readiness-shaped.
- Skill topology is simplified around durable user-facing activities, while the legacy strategy/lens/method taxonomy is no longer the live organizing principle.
- Topology READMEs for the agents and extension ownership boundaries will be updated in the same commits that move or retire those topologies.

## Testing Decisions

- The strongest tests are end-to-end prompt-assembly and active-tool snapshots for the live elicitor path, because they prove what the agent actually sees rather than what helper functions claim.
- Characterization tests should protect the plain selected-spec/workspace context rendering so the simplification does not accidentally drop necessary orientation.
- Existing prompt and runtime snapshot tests are useful prior art, but many should be retired or split into live-path vs suspended-path coverage to avoid preserving the very control complexity being suspended.
- The Pi adapter should keep a thin integration test that proves it wires the centralized live path into the host runtime without re-owning prompt logic.

## Out of Scope

- Deleting the underlying graph-gap persistence or command substrate in the first phase.
- Rewriting executor behavior beyond whatever minimal adjustments are necessary to share reorganized runtime helpers.
- Redesigning subagents beyond making sure they do not keep the suspended elicitor control system alive by accident.
- Replacing every legacy test, probe, or document in the same slice; non-blocking cleanup can follow once the live elicitor path is stable.
