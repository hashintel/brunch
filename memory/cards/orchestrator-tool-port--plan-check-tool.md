# Orchestrator Plan Check Tool

Frontier: orchestrator-tool-port
Status:   active
Mode:     single
Created:  2026-06-25

## Orientation

- Containing seam: `execute` mode's foreground `executor` agent and the `.pi/extensions` adapter boundary; this slice replaces the branch-local standup stub with the first real cook-plan inspection tool.
- Relevant frontier item: `orchestrator-tool-port` / FE-1087, inherited as the Linear issue and branch boundary from `memory/PLAN.md`.
- Volatile handoff state: none in `HANDOFF.md` (absent); source context comes from the prior port analysis and the external `../brunch` orchestrator docs/source.
- Main open risk: accidentally importing the CLI's execution side effects before the read-only tool boundary is proved; preserve the D39-L sealed profile and D90-L-D93-L/I49-L code-owned authority model.

Posture: proving (inherited from `orchestrator-tool-port`)

## Target Behavior

The execute-mode executor can inspect a cook plan through a product-registered, read-only `cook_plan_check` tool whose result contains plan shape plus contract findings.

## Full-card cold-start reads

- `memory/SPEC.md` — decisions / invariants: D39-L, D40-L, D90-L, D91-L, D92-L, D93-L, I49-L.
- `memory/PLAN.md` — frontier: `orchestrator-tool-port`.
- `src/.pi/extensions/TOPOLOGY.md` — adapter-only ownership and boundary rules.
- `src/agents/prompts/executor.md` — current execute-mode foreground prompt and stub wording to retire.
- `src/agents/runtime/executor/TOPOLOGY.md` and `src/agents/runtime/TOPOLOGY.md` — current CODE-mode runtime split; execute tool policy is a live runtime seam under `runtime/executor/`, and new execute seams should stay in that live runtime tree.
- `src/session/schema/tool-names.ts` — shared tool-name constants.
- `/Users/lunelson/Code/hashintel/brunch/ORCHESTRATOR.md` — source CLI behavior and plan format.
- `/Users/lunelson/Code/hashintel/brunch/src/orchestrator/src/{types.ts,plan-loader.ts,plan-contract.ts,cook-cli.ts}` — portable plan model, loader, contract, and plan-resolution behavior to adapt.

## Boundary Crossings

```text
→ execute-mode foreground `executor` prompt
→ execute-mode tool grant / block list (new live seam; do not reintroduce a second legacy runtime-policy tree)
→ `.pi/extensions/agent-runtime` Pi tool adapter
→ product-owned `src/orchestrator` plan loader + contract core
→ workspace cook plan path
→ typed Pi tool result content/details
```

## Risks and Assumptions

- RISK: CLI code pulls in process exits, git worktree creation, model auth, or child Pi sessions too early → MITIGATION: port only pure/read-only plan loading and contract checking in this slice; no sandbox, engine, Petrinaut stream, or worker session imports.
- RISK: The foreground `executor` gains accidental write authority while replacing the stub → MITIGATION: keep `bash`, `edit`, and `write` blocked in the Pi runtime tool-call guard; register only the read-only `cook_plan_check` tool for this card.
- RISK: External source names leak as temporary compatibility aliases → MITIGATION: canonicalize the product-facing tool name now; delete the `orchestrator_stub` tool path when the real tool is registered.
- ASSUMPTION: The external cook plan contract is the right first tracer boundary for the port.
    → IMPACT IF FALSE: the later `cook_run` surface may need a different plan source/result model, but this slice's blast radius is limited to read-only validation and prompt/tool naming.
    → VALIDATE: focused tests over valid, malformed, and design-invalid plan fixtures plus runtime-policy assertions.

## Posture check

This is a proving tracer. It scores on proof of life by making execute mode call real cook-plan product code, on invariants by locking the foreground no-direct-write boundary while still exposing orchestration capability, and on uncertainty by testing that the external `brunch cook` plan contract can be ported without shell-wrapping the CLI.

No separate spike is cheaper than this slice: the useful proof is whether the product registry, prompt, runtime policy, and plan contract all line up through the real execute-mode tool boundary.

## Acceptance Criteria

✓ `cook_plan_check` is product-registered for execute mode and returns a typed result for a valid plan path containing mode, epic count, slice count, policy-relevant findings, and source path.
✓ Invalid or contract-failing plans return deterministic typed findings/errors without creating `.brunch/cook/runs`, git worktrees, Petrinaut artifacts, or child Pi sessions.
✓ The branch-local executor stub is no longer advertised to the foreground executor, and the old stub registration path is retired.
✓ The Pi runtime tool-call guard still blocks direct `bash`, `edit`, and `write` for `execute`, with tests or assertions covering the new tool grant.
✓ `src/agents/prompts/executor.md` tells the foreground agent to use the real plan-check tool and preserves the no-direct-write instruction.

## Verification Approach

- Inner: focused unit/contract tests — plan loader/contract result shape, tool execution result, runtime policy grant/block invariants.
- Middle: `npm run fix` — project lint/format after edits.
- Gate: `npm run verify` — full fix/test/build before tying off the branch.

## Cross-cutting obligations

- Preserve D39-L sealed-profile discipline: no ambient Pi discovery, dynamic import scanning, or shell-wrapped CLI escape hatch.
- Preserve D90-L-D93-L/I49-L authority: foreground `executor` remains low-privilege; any future write-capable worker must be code-owned and explicitly allowlisted.
- Keep `.pi/extensions` adapter-only: reusable plan-contract logic belongs in product core, not hidden extension memory.
- Treat `.brunch/cook/runs/` as an execution artifact for later `cook_run`, not an artifact this read-only slice creates.

## Expected touched paths (tentative)

```text
memory/
├── PLAN.md                                                ~
└── cards/
    └── orchestrator-tool-port--plan-check-tool.md         +
src/
├── orchestrator/
│   ├── plan-contract.ts                                   +
│   ├── plan-loader.ts                                     +
│   ├── types.ts                                           +
│   └── __tests__/
│       └── plan-check.test.ts                             +
├── agents/
│   ├── prompts/
│   │   └── executor.md                                    ~
│   └── runtime/
│       ├── TOPOLOGY.md                                    ~
│       └── shared/ or executor/                           ?  (new live execute policy seam if earned)
├── .pi/
│   ├── extensions/
│   │   ├── agent-runtime/                                 ~
│   │   └── agent-runtime/orchestrator-stub/                -
│   └── __tests__/                                         ?
├── app/
│   └── pi-extensions.ts                                   ~
└── session/
    └── schema/
        └── tool-names.ts                                  ~
package.json                                               ?
package-lock.json                                          ?
```
