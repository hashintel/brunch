## Problem Statement

The LLM-context ingress refactor moved the bulk of prompts, skills, prompt runtime, and model-facing context text into `src/agents/`, but three topology problems remain.

First, foreground agent runtime ownership still leaks through `projections/session/runtime-policy.ts`. That file owns the foreground roster, body path references, model/thinking choices, skill grants, tool policy, and delegatable-agent allowlist. Those are agent-runtime facts, not projection facts. The current `projections/session -> agents/registry` edge is documented as temporary; leaving it in place makes `src/agents/runtime/` look central while its most important source of truth is still outside it.

Second, `read_graph related` was relocated into `src/agents/contexts/graph/related-nodes.ts`, but the actual wording shape still leaks structural internals (`-[category/direction]->`, `plane/kind`) and lacks a focused golden. This preserves the old problem under the new path.

Third, `src/renderers/` is now an orphan topology: after model-facing renderers moved to `src/agents/contexts/`, it contains only two small human/product renderers. A top-level renderer layer for two isolated outputs adds navigation cost without hiding meaningful complexity. Those outputs now read better beside their real owners: print-mode state near `app/`, transcript debug markdown near `session/`.

```pseudo tree
current remaining topology
src/
├── agents/
│   ├── runtime/                 mostly central, but imports projection-owned runtime policy
│   └── contexts/graph/related   moved, but still structurally leaky
├── projections/session/
│   └── runtime-policy           owns foreground roster + tool policy + body paths
└── renderers/                   orphan layer
    ├── workspace/workspace-state
    └── session/transcript
```

## Solution

Finish the topology by making `src/agents/runtime/` the actual owner of foreground runtime policy, repairing or collapsing the `related` graph render into the clean graph-context vocabulary, and deleting the now-shallow `src/renderers/` layer.

```pseudo tree
desired topology
src/
├── agents/
│   ├── runtime/
│   │   ├── foreground roster
│   │   ├── tool policy
│   │   ├── prompt-resource/tool legality
│   │   └── body path lookup
│   └── contexts/graph/
│       ├── overview/neighborhood
│       └── related uses the same semantic relation vocabulary or disappears behind filtered neighborhood rendering
├── projections/session/
│   └── runtime-state projection only; no agent roster ownership
├── app/
│   └── print-mode workspace-state text beside the only product caller
└── session/
    └── debug transcript markdown beside transcript JSONL/projection utilities
```

The key judo move is deletion, not another rearrangement: remove the temporary projections→agents edge and remove the orphan `renderers/` topology once its two remaining functions have obvious homes.

## Commits

1. [x] Add or move characterization tests for the two remaining orphan human/product renderers at their target owners: print-mode workspace text under the app layer, and debug transcript markdown under the session layer. Keep expected bytes unchanged.
2. [ ] Move the foreground agent roster and tool-policy definitions into the agent runtime owner, then update projection and adapter callers to import runtime policy from `src/agents/runtime/`. Leave transcript-state projection in `projections/session`.
3. [ ] Delete the `projections/session -> agents/registry` temporary edge and update topology docs/tests so projections no longer own or import agent body locations, foreground roster, or tool policy.
4. [ ] Repair `read_graph related` by making it share the semantic relation vocabulary already used by neighborhood rendering, or by deleting the separate related formatter in favor of a filtered-neighborhood render. Add a focused golden/invariant for the related mode so raw category/direction arrows and raw fallback ids do not silently return.
5. [ ] Move print-mode workspace-state text out of `src/renderers/` to the app/print owner, update `brunch --mode print` imports, and delete the old workspace renderer file/directory.
6. [ ] Move debug transcript markdown out of `src/renderers/` to the session owner, update `session-transcript.ts` imports, and delete the old session renderer file/directory.
7. [ ] Delete `src/renderers/README.md` and the now-empty `src/renderers/` topology. Update root/topology READMEs, SPEC/PLAN references, and lint/import-boundary comments to remove `renderers/` as a live source layer.
8. [ ] Reconcile stale path fossils found during the move: old `.pi/extensions/system-prompts`, `.pi/extensions/graph`, `../web`, and renderers references in co-located READMEs and memory files.

## Decisions

- `src/agents/runtime/` owns foreground agent roster, agent body locations, skill grants, tool policy, delegatable set, and prompt-resource/tool legality.
- `projections/session/` owns transcript-backed runtime-state projection only; it may consume agent runtime definitions but must not own them.
- `src/renderers/` should be deleted if, after the move, it has no remaining multi-consumer human/product text seam.
- Print-mode workspace-state text belongs near the `app` print-mode path because it has one product caller and no model-facing role.
- Debug transcript markdown belongs near `session` because it is a transcript/debug artifact over Pi JSONL semantics, not a general renderer layer.
- `read_graph related` must not be considered fixed by relocation alone; it needs semantic vocabulary parity with graph neighborhood rendering or removal as a separate path.
- Topology READMEs touched: `src/README.md`, `src/agents/README.md`, `src/agents/runtime/README.md`, `src/agents/contexts/README.md`, `src/agents/contexts/graph/README.md`, `src/.pi/README.md`, `src/.pi/extensions/subagents/README.md`, `src/projections/README.md`, `src/session/README.md`, and any removed `src/renderers/README.md` references in `memory/SPEC.md` / `memory/PLAN.md`.

## Testing Decisions

- Existing `agents/runtime` tests cover prompt-resource/tool legality; extend or move them so the foreground roster move is witnessed at the new owner.
- Existing runtime-state projection tests should continue to prove transcript projection behavior, not agent roster ownership.
- Add a related-mode graph golden/invariant before or with the wording repair. The important behavior is semantic relation text and stable graph codes, not the internal helper used.
- Preserve existing print-mode output tests and transcript markdown tests through their move; these are characterization tests for deletion of the `renderers/` layer.
- Keep `npm run verify` as the gate for each commit-sized step; this refactor touches build asset paths, import boundaries, and topology docs.

## Out of Scope

- Changing graph ontology vocabulary, edge categories, node kinds, readiness bands, or detail schemas.
- Changing tool availability, Pi sealed-profile behavior, or subagent spawnability.
- Rewriting prompt bodies, skill bodies, or unrelated context wording.
- Moving product web/RPC rendering or introducing a new human-rendering framework.
- Solving the larger `elicitor-project` design question or adding new agent capabilities.
