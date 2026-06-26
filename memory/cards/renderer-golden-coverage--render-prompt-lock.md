# Renderer and prompt assembly lock ledger

Frontier: renderer-golden-coverage
Status:   active
Mode:     sweep
Created:  2026-06-26

## Orientation

- Containing seam: the `context-pipeline` RENDER stage plus its deferred COMPOSE tripwire. Frontier `renderer-golden-coverage` / FE-1091 is the Linear + branch boundary; this scope file is only the row ledger for that frontier.
- Handoff state: system-prompt assembly must be golden/semantically locked, and the user's `src/agents/` topology sketch (`contexts`, foreground `prompts`, `runtime`, `shared`, `skills`, `subagents`) is directional pressure, not a license for an unbounded rewrite.
- The previous `data-model-legibility` work closed generated ontology + graph-authoring references, but `src/agents/docs/context-reference-harvest.md` still carries unresolved candidate references. This sweep must either materialize, retire, or explicitly defer those candidates instead of assuming the ledger is fully worked.
- Main risk: locking stale D98-sensitive prompt/runtime-axis wording or old prompt-body topology in snapshots. Closure should delete aliases/dual homes rather than preserve compatibility shims.

Posture: earned (inherited from `renderer-golden-coverage`).

Frontier-level cross-cutting obligations:

- Preserve D83-L house style for model-facing context text: markdown frame, TOON for large/unbounded uniform data, fenced tree for hierarchy, top-level `<workspace>` / `<specification>` / `<session>` scope clustering where applicable.
- Preserve D52-L / D60-L dependency direction: `agents/contexts` may render already-read facts but must not import adapters, app, RPC, web, or DB.
- Preserve D97-L provenance: generated vocabulary references come from typed graph sources; authored judgment references need concrete readers; prompt resources cite rather than restate shared references.
- Preserve D98-L: strategy/lens/method vocabulary may remain only as prompt-resource/internal conduct, not user-changeable session state or foreground-agent identity.
- Use deletion as closure: obsolete role/body aliases, stale docs, and superseded reference candidates should be removed or explicitly deferred, not bridged.

## Sweep preflight

1. **Boundary.** In scope: model-facing renderers under `src/agents/contexts/`, foreground/background prompt assembly, prompt body/reference topology under `src/agents/` when needed to make assembly lockable, and the local topology READMEs/tests that name those homes. Out of scope: new `project` capability behavior, CODE/orchestrator tool implementation, public RPC/UI changes, and human/product renderers except for README audience-split drift.
2. **Source-of-truth inputs.** SPEC D19-L, D40-L, D52-L, D58-L, D60-L, D62-L, D83-L, D97-L, D98-L; PLAN frontier `renderer-golden-coverage`; topology READMEs under `src/agents/`, `src/app/`, and `src/session/`; current renderer/prompt tests; `src/agents/docs/context-reference-harvest.md` for unresolved reference disposition only.
3. **Owners and closure oracles.** Each required row below names the canonical owner and a closure oracle: Vitest file snapshots, semantic invariant tests, import-boundary checks, topology README assertions, or a row-level explicit deferral tied to a plan assumption/frontier.
4. **Class.** Buildable-now. Deferred rows are marked `○` and tripwired to A33-L / `elicitor-project` or `orchestrator-tool-port`; they are not hidden required work for this sweep.
5. **Closed inventory.** This ledger is the inventory. If build discovers more than one genuinely missing renderer/prompt sub-seam, stop and route back through `ln-plan` instead of adding rows by symmetry.

Aggregate DoD: every `●` row is `have` or `built`, and every `partial` row is either closed or explicitly reclassified with a named owner/tripwire.

## Ledger — prompt topology and assembly

| Capability | Status | Req | Fill | Owner / next | Notes |
| --- | --- | --- | --- | --- | --- |
| Foreground prompt-body topology is canonical | `built` | ● | earned | `src/agents/registry.ts`, `src/agents/prompts/README.md`, prompt body tests | Closed: foreground prompt bodies now use D98 target ids (`elicitor` / `executor`); the old foreground `orchestrator` body/home is removed. The `orchestrator_stub` tool name remains owned by `orchestrator-tool-port`, not prompt-body topology. |
| Background subagent body topology is canonical | `built` | ● | earned | `src/.pi/extensions/subagents/agents.ts`, prompt/subagent topology docs | Closed: background bodies intentionally stay under `src/agents/prompts/<id>/SYSTEM.md` as shared manifest body files, while `BACKGROUND_SUBAGENT_IDS` owns spawnability; README/tests now state that they are subagent resources, not foreground prompts. |
| Foreground prompt assembly golden lock | `partial` | ● | earned | `src/agents/runtime/compose.ts`, `src/agents/runtime/__tests__/compose.test.ts`, snapshots | Existing elicitor preview snapshots are a start. Closure oracle: full provider-facing assembly has reviewed goldens/semantic invariants for the foreground role(s) this frontier owns, with stale readiness-grade/runtime-axis vocabulary guarded. |
| Pi `before_agent_start` assembly path is wired to the same lock | `partial` | ● | earned | `src/.pi/extensions/agent-runtime/system-prompts/` tests | Closure oracle: adapter-level test proves Brunch body + world reads + active-tool legality feed `composeAgentPrompt`; no harness-only snapshot path that product assembly bypasses. |
| Background subagent prompt assembly golden lock | `partial` | ● | earned | `src/.pi/extensions/subagents/prompt-assembly.ts`, `src/.pi/extensions/__tests__/subagents.test.ts` | Existing assertions prove sealing/tool grants. Closure oracle: file snapshot or equivalent semantic invariant locks assembled child prompt shape, injected-world snapshot, no foreground-only sections, no ambient Pi resources. |
| Context-reference harvest closure | `built` | ● | earned | `src/agents/docs/context-reference-harvest.md`, `src/agents/contexts/references/`, skill-local `references/` | Closed: materialized graph-authoring / ontology / oracle homes stay in their current owners; checkability/shared subtype candidates are rejected; elicitation-question hints are deferred to a future scoped reader; proposal/projection candidates are deferred to A33-L/`elicitor-project`. |

## Ledger — model-facing context renderers

| Capability | Status | Req | Fill | Owner / next | Notes |
| --- | --- | --- | --- | --- | --- |
| Workspace context renderer | `have` | ● | earned | `src/agents/contexts/workspace/` | Snapshot coverage exists for cwd + overview context; preserve D83-L audience split. |
| Specification context renderer | `partial` | ● | earned | `src/agents/contexts/spec/` | Move `specification/specification-context.ts` to `spec/spec-context.ts`; closure oracle: imports, README, and snapshot tests name the short `spec/` home while the rendered tag remains `<specification>`. |
| Spec markdown document output | `new` | ● | earned | `src/agents/contexts/spec/spec-output.ts` | Thin graph-derived flattened markdown output using md-pen; not a copy of `memory/SPEC.md`. Future web/download routes are consumers, not owners. |
| Plan markdown document output | `new` | ● | earned | `src/agents/contexts/plan/plan-output.ts` | Thin graph-derived flattened markdown output over plan-plane nodes (`milestone`, `frontier`, `slice`) using md-pen; not a copy of `memory/PLAN.md`. |
| Graph overview / neighborhood / related-node renderers | `have` | ● | earned | `src/agents/contexts/graph/` | Snapshot coverage exists for overview, neighborhoods, and related nodes; preserve code handles and no structural-leak assertions. |
| Session runtime frame renderer | `partial` | ● | earned | `src/agents/contexts/session/` | Existing snapshot still displays D98-sensitive strategy/lens runtime wording. Closure oracle: runtime frame wording either removes that state or frames it strictly as prompt-resource/internal conduct, then updates the golden. |
| Turn/origination seed renderers | `partial` | ● | earned | `src/agents/contexts/seeds/` | Existing tests are semantic asserts. Closure oracle: stable seed text is snapshot-locked or intentionally reduced to invariant asserts with a README note explaining why wording is not a golden contract. |
| Elicitation agenda/update text | `partial` | ● | earned | `src/agents/contexts/elicitation.ts` | No focused renderer test found. Closure oracle: agenda/update text has semantic invariant or snapshot coverage, including structural-illegal diagnostics. |
| Structured-exchange result renderers | `partial` | ● | earned | `src/agents/contexts/exchanges/` | `present_candidates` and `present_review_set` have semantic asserts, other request/present renderers need inventory. Closure oracle: every registered model-facing exchange result has snapshot/semantic coverage or is explicitly retired/unregistered. |
| Human/product render audience split | `have` | ● | earned | `src/app/README.md`, `src/session/README.md`, `src/agents/contexts/README.md` | Current READMEs name app/session human text and agents model-facing text. Preserve; update only if topology changes above create drift. |

## Ledger — deferred / tripwired rows

| Capability | Status | Req | Fill | Owner / next | Notes |
| --- | --- | --- | --- | --- | --- |
| `projection-guidance.md` shared reference | `spec` | ○ | proving | `elicitor-project` / A33-L | Wait-gated: project shape is design-gated; do not materialize a shared projection reference in this sweep unless a concrete second reader appears. |
| CODE executor tool behavior | `spec` | ○ | proving | `orchestrator-tool-port` | Out of this sweep except for prompt-body naming/topology needed to avoid locking a stale foreground body alias. Tool behavior and write-capable CODE policy stay with FE-1087. |
| New renderer family discovered during build | `new` | ○ | proving | route to `ln-plan` if more than one appears | Tripwire: adding several rows means this inventory was not closed. |

## Row build order recommendation

1. Close **Context-reference harvest closure** first so prompt/reference topology is not goldened against a half-dispositioned ledger.
2. Close **Foreground/background prompt-body topology** before accepting prompt assembly snapshots; snapshots should lock the final home, not a transitional shape.
3. Close foreground + adapter prompt assembly locks.
4. Close background subagent assembly lock.
5. Sweep remaining renderer partials (`session`, `seeds`, `elicitation`, `exchanges`) with file-scoped tests.

## Expected touched paths (tentative)

```text
memory/cards/
└── renderer-golden-coverage--render-prompt-lock.md +
memory/PLAN.md ?
src/agents/
├── README.md ?
├── registry.ts ?
├── __tests__/
│   └── registry.test.ts ?
├── docs/
│   └── context-reference-harvest.md ?
├── contexts/
│   ├── README.md ?
│   ├── elicitation.ts ~
│   ├── references/ ?
│   ├── plan/ ?
│   ├── seeds/ ?
│   ├── session/ ?
│   ├── spec/ ?
│   ├── specification/ -
│   └── exchanges/ ?
├── prompts/ ?
├── runtime/
│   ├── README.md ?
│   ├── compose.ts ?
│   ├── __tests__/compose.test.ts ?
│   └── __snapshots__/ ?
└── subagents/ ?
src/.pi/extensions/
├── agent-runtime/system-prompts/ ?
└── subagents/ ?
src/app/README.md ?
src/session/README.md ?
```
