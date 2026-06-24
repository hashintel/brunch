# Slice 6 — execute mode live + orchestrator standup + stub Node tool

Frontier: subagent-reconciliation
Status:   done
Mode:     single
Created:  2026-06-24

## Orientation

- **Seam:** the collapsed op-mode↔foreground-agent roster (D93-L) — `OPERATIONAL_MODE_IDS` / `AGENT_ROLE_IDS` in `src/session/schema/kinds.ts`, `FOREGROUND_AGENT_ROSTER` in `src/projections/session/runtime-policy.ts`, tool activation in `src/.pi/extensions/runtime/state.ts`. Slice 1 made adding a mode a declarative record entry; this slice exercises that for the first time.
- **Frontier item:** `subagent-reconciliation` (FE-1054), branch `ln/fe-1054-subagent-reconciliation-ii`. The end-of-branch **readiness target**: an operable `execute`-mode `orchestrator` that calls a trivial Node stub tool — a baseline a colleague extends tomorrow into real task orchestration.
- **Volatile handoff state:** this is the last slice of the sequence; slices 1–5 are committed. The PLAN frontier definition (§Frontier Definitions, slice-6 bullet) still describes the *old, broader* slice-6 framing (declarative build-out covering both `execute`/`orchestrator` and `code`/`pi-coder`, colleague-owned). The re-scope this session narrowed it: **execute/orchestrator + stub tool, built on this branch; `code`/`pi-coder` stays planned.** Reconcile PLAN as part of this slice.
- **Open risk:** runnable-path wiring. Subagent loading is dev-gated (`context.dev` in `brunch-tui.ts`); the orchestrator + stub tool must be a real (non-dev) runnable path. Resolution below: they are code-owned registrations, not subagents, so no dev-gating change is needed (`orchestrator.canDelegate = []`).

**Resolved open questions** (handoff deferred these to scope time — confirm at routing):

- **Q1 — stub tool: custom Brunch tool, not `bash`.** D92-L is sovereign, code-owned tool grants; granting raw `bash` to a foreground execute agent contradicts the capability model (`bash` is in elicit's `blockedToolNames` as write-capable) and gives unbounded capability the demo does not need. A trivial custom tool *is* the stub for tomorrow's worker-calling code, and reads cleaner for a controlled demo.
- **Q2 — runnable path: register outside dev-gating, do not touch the dev gate.** The stub tool is a plain Brunch tool registered in `createBrunchPiExtensions` (like `registerBrunchWebTools`); the orchestrator manifest + execute mode are code-owned roster entries. None of these is dev-gated. The only dev-gated path is *subagent loading*, which the orchestrator does not use this branch (`canDelegate = []`). So execute mode runs in a normal boot; leave the `context.dev` subagent gate untouched.

**Posture:** proving (inherited from subagent-reconciliation).

## Target Behavior

In a normal (non-dev) boot, a user can switch to `execute` mode and the `orchestrator` foreground agent can invoke a code-owned trivial Node stub tool that runs and returns output.

## Full-card cold-start reads

```
- memory/SPEC.md   — decisions: D90-L, D92-L, D93-L; invariant I49-L (delegatable-set write-safety boundary)
- memory/PLAN.md    — frontier: subagent-reconciliation (§Frontier Definitions slice-6 bullet — note it is being reconciled by this slice)
- HANDOFF.md        — "Slice 6" section (readiness target, dev-gating note, build:pi-assets gotcha, target agent topography) + Decisions table (stub belongs to orchestrator directly; no worker this branch)
- src/.pi/agents/elicitor/SYSTEM.md — body shape to mirror for orchestrator/SYSTEM.md
- src/.pi/extensions/web/index.ts — Brunch custom-tool registrar pattern for the stub tool
```

## Boundary Crossings

```
→ kinds.ts: move 'execute' PLANNED → OPERATIONAL_MODE_IDS; add 'orchestrator' to AGENT_ROLE_IDS ('code'/'pi-coder' stay planned)
→ runtime-state.ts: extend ToolPolicyId union ('elicit-read-only' → + execute policy id); PromptPackId if the compiler demands it
→ runtime-policy.ts: FOREGROUND_AGENT_ROSTER gains required 'execute' key (Record<OperationalModeId> is now exhaustive-checked) → orchestrator ForegroundAgentManifest (kind foreground, body file, tools = read-only + stub, canDelegate []) + execute ToolPolicyDefinition (stub + read-only allowed; bash/edit/write blocked)
→ orchestrator-stub extension: new Brunch custom tool (single string param, trivial Node op, text result) + name const + registrar
→ pi-extensions.ts: register the stub tool unconditionally (not dev-gated); export its name
→ runtime/state.ts: activeToolNamesForPosture resolves stub into execute's active set via baseAllowedToolNames (no code change expected — verify)
→ src/.pi/agents/orchestrator/SYSTEM.md: foreground orchestrator body
→ package.json build:pi-assets: add src/.pi/agents/orchestrator to the cp enumeration
→ axis-picker: execute auto-moves planned→current via OPERATIONAL_MODE_IDS (no code change; tests reconcile)
→ exit: boot execute mode; orchestrator calls stub; it runs
```

## Risks and Assumptions

```
- RISK: Record<OperationalModeId> / exhaustive switches over op-mode break at compile once 'execute' is added
    → MITIGATION: this is the desired compiler tripwire — follow tsc to every keyed site (roster, prompt packs, picker) and fill the execute case; do not widen with `as`/casts.
- RISK: moving 'execute' live silently breaks display-surface tests asserting the planned set
    → MITIGATION: runtime-axis-picker.test.ts asserts "execute and code are not yet enabled" + execute grayed; update to singular "code is not yet enabled" and drop the execute-grayed assertion. (Slice 1 hit this exact class.)
- RISK: full vitest blocked by better-sqlite3 Node ABI mismatch (compiled 137 vs required 147)
    → MITIGATION: rebuild locally for the active Node ABI before the full run; do NOT run npm rebuild for a foreign ABI in the shared worktree.
- ASSUMPTION: the stub tool registered unconditionally + added to execute's baseAllowedToolNames is active in execute mode and inactive in elicit mode (elicit's allowlist omits it).
    → IMPACT IF FALSE: orchestrator cannot call the stub (readiness target fails) or elicit gains an unintended tool.
    → VALIDATE: unit test over activeToolNamesForPosture for both modes (cheap; inner loop).
- ASSUMPTION: orchestrator needs no subagents this branch (canDelegate = []), so the dev-gated subagent path is irrelevant to the runnable proof.
    → IMPACT IF FALSE: would require un-gating subagent loading — out of scope; escalate.
    → VALIDATE: orchestrator manifest canDelegate is []; boot proof runs without BRUNCH_DEV.
```

## Posture check

Proving — **proof of life** (dominant): lights up the first non-elicit foreground agent end-to-end, the first live `execute` operational mode, and the first sovereign code-owned tool grant invoked by a foreground agent. Also **materializes** D93-L's roster into topology (execute slot filled; "execute is planned" state retired). It is a true tracer bullet: if the roster entry, the execute tool policy, or the unconditional tool registration is wrong, the orchestrator cannot call the stub and the slice breaks. Build it.

## Acceptance Criteria

```
✓ kinds — 'execute' is in OPERATIONAL_MODE_IDS; 'orchestrator' is in AGENT_ROLE_IDS; 'code'/'pi-coder' remain in PLANNED_OPERATIONAL_MODE_IDS
✓ resolveBrunchAgentState({operationalMode:'execute'}) — resolves the orchestrator foreground manifest + execute tool policy without throw
✓ parseBrunchAgentState — accepts a persisted operationalMode:'execute' state
✓ active-tools (execute) — activeToolNamesForPosture in execute mode includes the stub tool name and excludes bash/edit/write
✓ active-tools (elicit) — the stub tool name is NOT active in elicit mode
✓ stub tool — execute() runs a trivial Node operation and returns deterministic text content
✓ architecture test — runtimeRegistryExpectations reconciled: kinds.ts `required` includes orchestrator in AGENT_ROLE_IDS; runtime-policy forbidden still excludes pi-coder; orchestrator SYSTEM.md added to agentDefinitionExpectations
✓ axis-picker test — execute renders as current (not grayed); planned note reads "code is not yet enabled"
✓ orchestrator body — src/.pi/agents/orchestrator/SYSTEM.md exists; build:pi-assets copies orchestrator/
✓ readiness proof — execute-mode boot drives the orchestrator to invoke the stub tool through the real registration path; it runs (no regression in full `npx vitest run`)
```

## Build Result

```
done:
  - execute moved live; code remains planned
  - orchestrator foreground manifest and SYSTEM.md added
  - orchestrator_stub registered on the normal product extension path
  - execute tool policy allows read-only + orchestrator_stub and blocks bash/edit/write
  - PLAN/SPEC/topology READMEs reconciled
verified:
  - focused slice tests: 84 passed
  - full vitest: 129 files passed; 1045 passed, 1 skipped, 1 todo
  - npm run check: passed; existing graph no-thenable warnings remain
retirement:
  - scope file is exhausted but untracked; deletion needs explicit confirmation
```

## Verification Approach

```
- Inner: vitest unit — runtime-policy execute resolution, activeToolNamesForPosture (both modes), stub tool execute(), parseBrunchAgentState accepts execute.
- Middle: architecture.test.ts + runtime-axis-picker.test.ts reconciled green; full `npx vitest run` shows no regression (recurring-regression warning: every prior slice shipped one caught only by the full run).
- Outer: readiness proof — prefer a Tier-2 faux-provider boot through the `agentServices` seam in brunch-tui that exercises the REAL createBrunchPiExtensions wiring in execute mode and asserts the orchestrator can call the stub (avoid harness-as-false-proof: do not inject the tool; drive the product registration). Manual TUI boot of execute mode is the human-confirmable backstop.
```

## Cross-cutting obligations

```
- D92-L / I49-L: the stub is a sovereign code-owned grant on the orchestrator foreground manifest, NOT a delegated background agent; orchestrator.canDelegate stays [] (no write-capable worker this branch — the capability-inversion demo is deferred to tomorrow).
- D39-L ambient seal: unchanged (no subagent-seal change in this slice); leave the dev-gated subagent loading path untouched.
- Co-tenancy: explicit `git add <path>`; do not run `npm rebuild better-sqlite3` for a foreign Node ABI in the shared worktree.
- Compiler-enforced exhaustiveness over OperationalModeId is the guardrail — fill every execute case the compiler surfaces; no casts.
```

## Expected touched paths (tentative)

```
src/session/
├── schema/kinds.ts                                  ~
└── runtime-state.ts                                 ~
src/projections/session/
├── runtime-policy.ts                                ~
└── runtime-policy.test.ts                           ?
src/.pi/extensions/orchestrator-stub/
├── index.ts                                         +
└── orchestrator-stub.test.ts                        +
src/.pi/agents/orchestrator/SYSTEM.md                +
src/app/pi-extensions.ts                             ~
src/.pi/__tests__/architecture.test.ts              ~
src/.pi/__tests__/runtime-axis-picker.test.ts       ~
package.json                                          ~
memory/PLAN.md                                        ~
memory/SPEC.md                                        ?
```
