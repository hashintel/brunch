## Problem Statement

The last topology pass removed the orphan renderer layer and moved the foreground roster into the agent runtime owner, but two policy seams still keep the agent-runtime model from reading as one settled topology.

First, capability-readiness is still housed in the session projection area even though it is runtime posture policy: it decides whether strategy/lens/method surfaces are legal or advisory for an agent turn. Agent runtime policy imports it, so the policy owner still depends on a projection module for its own gating vocabulary.

Second, the runtime affordance projection is now a test-only wrapper around agent-runtime policy. It no longer earns a reusable DTO layer: the real policy functions already live in the agent runtime owner, and there is no product/RPC/web consumer for the wrapper shape.

A small amount of durable documentation and script vocabulary also preserves old topology names: subagent proof text still names the retired prompt-body home, and test scripts still say renderers after the renderer layer was deleted.

One unrelated but current gate failure remains: the settings-audit test is red because Pi added a getter that the audited Brunch settings list has not acknowledged. The refactor cannot be considered safely complete while the normal verification gate is red.

```pseudo tree
current residual shape
src/
├── agents/runtime/
│   ├── policy              foreground roster + axis/tool policy
│   └── state               manifest/tool activation policy
├── projections/session/
│   ├── capability-readiness  agent capability policy still outside agents/runtime
│   ├── affordances           test-only wrapper over agents/runtime policy
│   └── runtime-state         real reusable transcript DTO projection
└── package scripts/docs       old renderer and prompt-home vocabulary remains
```

## Solution

Collapse runtime posture policy fully under the agent runtime owner, delete the test-only projection wrapper, and reconcile vocabulary so durable truth matches the new topology. Keep the projection layer focused on reusable DTOs over session/transcript facts.

```pseudo tree
desired residual shape
src/
├── agents/runtime/
│   ├── policy
│   ├── state
│   └── capability-readiness   capability→gap policy used by policy/state
├── projections/session/
│   └── runtime-state + transcript/readiness DTOs only
└── scripts/docs                current names: context/text surfaces, agents/prompts
```

The judo move is deletion: remove the affordance wrapper instead of relocating it, and move only the capability policy that is still load-bearing.

## Commits

- [x] Restore the verification gate by acknowledging the new audited Pi settings getter in the Brunch settings boundary test/policy, without broadening any ambient settings behavior.
- [ ] Move capability-readiness into the agent runtime owner and update direct consumers/tests so agent posture policy no longer imports capability policy from the projection layer.
- [ ] Delete the runtime-affordance projection wrapper and point its remaining test obligations at the canonical agent-runtime policy functions. Keep the required/deferred affordance ledger but make it cite the runtime owner, not a projection module.
- [ ] Reconcile projection topology docs and boundary tests so session projections no longer claim capability-readiness or affordances as projection-owned modules.
- [ ] Reconcile durable SPEC and README path fossils from the retired prompt-body home to the current prompt home.
- [ ] Rename the renderer test scripts to match the current context/text-surface topology, preserving backwards compatibility only if there is a real user-facing reason; otherwise delete the old renderer names.
- [ ] Retire this refactor plan once the cleanup is committed and the normal verification gate passes.

## Decisions

- Agent runtime owns capability-readiness because it is posture/tool/resource legality policy, not an information-preserving session DTO.
- Session projections keep runtime-state and transcript/readiness DTOs; they do not own agent roster, agent body locations, tool policy, capability gates, or affordance menus.
- The runtime-affordance wrapper is deleted unless a real product/RPC/web consumer appears during implementation; tests should not justify a production module.
- The required/deferred affordance ledger remains useful, but it should name the canonical runtime policy owner directly.
- Script names should reflect live topology. Retired renderer vocabulary should not remain unless explicitly preserved as a compatibility alias.
- The settings-audit gate repair is a prerequisite cleanup, not part of the agent-context topology model.
- Topology READMEs touched: root source topology, agents runtime, projections, session, and any Pi/subagent docs that still name retired prompt-body paths.

## Testing Decisions

- Capability-readiness tests move with the module and keep the same behavioral oracle: capability→gap map, proceed / low-epistemic / negotiate outcomes, no refusal state, live coverage flip, and loud failure for missing required gap kinds.
- Runtime-policy tests should own axis/menu legality directly after deleting the affordance wrapper: AUTO excludes freestyle, pin surfaces retain freestyle, gated lenses negotiate on uncovered gaps, and missing gap registers fail loud.
- Projection boundary tests should prove projections no longer import or own agent runtime policy beyond the explicit runtime-state DTO consumer edge.
- The settings-audit test should pass by explicitly tracking the new getter; do not loosen the audit into a wildcard.
- Final gate is `npm run verify`; the pass is not done while the known settings-audit failure remains.

## Out of Scope

- Changing capability-readiness semantics, readiness bands, graph-write floor behavior, or the no-refusal invariant.
- Adding new runtime affordance transport to RPC/web.
- Reworking the foreground roster shape, prompt bodies, or prompt-resource skill content.
- Touching the extra Knip configuration work except to preserve it as someone else's already-tracked work if it remains in the branch.
- Any broader cleanup of archived planning history beyond current durable SPEC/README references that would mislead active work.
