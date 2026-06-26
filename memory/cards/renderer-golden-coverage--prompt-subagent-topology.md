# Prompt and subagent topology flattening

Frontier: renderer-golden-coverage
Status:   active
Mode:     single
Created:  2026-06-26

## Orientation

- Containing seam: `src/agents/` prompt-resource topology inside FE-1091 / `renderer-golden-coverage`; this is the remaining RENDER/COMPOSE closure after the renderer/assembly evidence sweep.
- The prior sweep locked current behavior but stopped short of the user's accepted topology: foreground prompts must be flat files under `prompts/`, and subagent bodies must have their own flat `subagents/` resource home.
- Main open risk: code/tests currently encode the nested `prompts/<id>/SYSTEM.md` convention and package copying likely follows that tree. This slice should change the canonical paths directly, not add aliases or compatibility readers.
- Cross-cutting obligations: preserve D39-L sealed/code-owned resource lists, D58-L thin composition, D90-L shared `AgentManifest` model, D91-L assembled subagent prompts, and D98-L SPEC/CODE foreground role vocabulary.

Posture: earned (inherited from `renderer-golden-coverage`).

## Target Behavior

Brunch agent body resources use the accepted flat topology: foreground prompts at `src/agents/prompts/{elicitor,executor}.md` and background subagents at `src/agents/subagents/{explorer,researcher,projector,reviewer}.md`.

## Full-card cold-start reads

- `memory/SPEC.md` — D44-L, D58-L, D85-L, D90-L, D91-L, D92-L, D93-L, D98-L; I29-L
- `memory/PLAN.md` — frontier: `renderer-golden-coverage`
- `src/agents/README.md` — current `src/agents/` ownership and topology
- `src/agents/prompts/README.md` — foreground prompt ownership to update
- `src/.pi/extensions/subagents/README.md` — subagent loading/assembly topology to update
- `src/agents/registry.ts` and `src/.pi/extensions/subagents/agents.ts` — current path registries/loaders
- `package.json` — `build:pi-assets` prompt/subagent asset copying

## Boundary Crossings

```text
→ src/agents/registry.ts foreground body path registry
→ src/agents/runtime/policy.ts / state.ts foreground body lookup
→ src/.pi/extensions/agent-runtime/system-prompts foreground adapter
→ src/.pi/extensions/subagents/agents.ts background body loader
→ src/.pi/extensions/subagents/session.ts / prompt-assembly.ts child prompt assembly
→ package asset copy
→ topology docs and tests
```

## Risks and Assumptions

- RISK: hidden tests or build assets still expect `prompts/<id>/SYSTEM.md` directories → MITIGATION: search the repo for `SYSTEM.md`, `prompts/<id>`, and each concrete old path; update package asset copying and topology tests in the same slice.
- RISK: flattening subagents could accidentally make them foreground prompt resources → MITIGATION: keep explicit `BACKGROUND_SUBAGENT_IDS` loading and foreground `BUNDLED_AGENT_BODY_IDS` / policy lists separate; assert subagent files are not in the foreground prompt list.
- ASSUMPTION: no external packaged consumer depends on the nested prompt asset layout.
    → IMPACT IF FALSE: this would need a migration bridge in packaged assets.
    → VALIDATE: pre-release/free-rewrite posture plus package-local tests; do not preserve old paths unless a build/runtime test proves an atomic update is impossible.

## Posture check

Earned closure target:

- **Canonicalizes** prompt-resource locations to the user's accepted topology.
- **Deletes / retires** nested `SYSTEM.md` body directories for agent bodies.
- **Materializes** separate `prompts/` foreground and `subagents/` background homes into filesystem topology, READMEs, registry tests, and package asset copying.
- **Locks in** no stale `prompts/<agent>/SYSTEM.md` convention in docs/tests/build scripts.

## Acceptance Criteria

✓ Foreground prompt body tests — `elicitor` and `executor` load from `src/agents/prompts/elicitor.md` and `src/agents/prompts/executor.md`; old nested foreground paths are absent.
✓ Subagent loader tests — `explorer`, `researcher`, `projector`, and `reviewer` load from `src/agents/subagents/<id>.md`; planted unlisted subagent files remain unspawnable.
✓ Registry/topology tests — foreground body ids exclude background subagents; subagent registry owns background ids; docs name the split.
✓ Build asset check — `build:pi-assets` copies flat foreground prompt files and flat subagent files into the corresponding dist homes.
✓ Repo search invariant — no canonical doc/test/source path still presents `src/agents/prompts/<agent>/SYSTEM.md` as the live convention.

## Verification Approach

- Inner: targeted Vitest over `src/agents`, `src/agents/runtime`, and `src/.pi/extensions/__tests__/subagents.test.ts` — proves loaders, policy paths, and prompt assembly still work.
- Inner: `npm run check` — catches stale docs/format/skill/data-model drift after path edits.
- Gate: `npm run verify` — required before committing because package asset copying and build output are touched.

## Cross-cutting obligations

- D39-L: explicit/code-owned resource paths only; no directory discovery except explicit registry ids.
- D58-L: prompt composition remains thin; this slice moves files and loaders, not prompt behavior.
- D90-L/D91-L: foreground/background share manifest shape while retaining distinct homes and execution authority.
- D98-L: foreground vocabulary is SPEC/elicitor and CODE/executor; do not preserve orchestrator/pi-coder as product-role aliases.

## Expected touched paths (tentative)

```text
memory/cards/
└── renderer-golden-coverage--prompt-subagent-topology.md +
memory/PLAN.md ~
memory/SPEC.md ~
package.json ~
src/agents/
├── README.md ~
├── registry.ts ~
├── __tests__/
│   └── registry.test.ts ~
├── prompts/
│   ├── README.md ~
│   ├── elicitor.md +
│   ├── executor.md +
│   ├── elicitor/ -
│   └── executor/ -
├── subagents/
│   ├── README.md +
│   ├── explorer.md +
│   ├── researcher.md +
│   ├── projector.md +
│   └── reviewer.md +
└── runtime/ ?
src/.pi/extensions/subagents/
├── README.md ~
├── agents.ts ~
└── tests ?
```
