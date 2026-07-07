# Executor surface reconciliation

Frontier: orchestrator-tool-port
Status:   active
Mode:     slices
Created:  2026-07-07

## Orientation

- Containing seam: operational-mode runtime + Execute-mode executor surface. `src/session/schema/kinds.ts` owns mode ids/labels; `src/agents/runtime/*` maps modes to foreground agents; `src/executor/` is the pure run-lifecycle core over `ExecutionPorts`; Pi-facing execution tools are adapters.
- Relevant frontier: `orchestrator-tool-port` / FE-1107, re-baselined after KA's executor lane landed. The mechanism exists; this file closes mode/executor surface residue.
- Volatile state: KA's six `memory/cards/executor-*` cards appear exhausted but remain unconfirmed. Do not delete them in these cards.
- Main open risk: stale model-facing control text, legacy stub wiring, and mixed mode vocabulary can make Execute mode behave/read as though the live execute path is pending or as though mode id, product label, and agent role are interchangeable.

Posture: earned (inherited from `orchestrator-tool-port` residue: mechanism delivered; closure target is canonical runtime/executor surface).

Canonical current operational-mode table for these cards:

| id      | label   | agent    |
| ------- | ------- | -------- |
| specify | Specify | elicitor |
| execute | Execute | executor |

Future direction, explicitly out of scope for this file:

| id      | label   | agent    |
| ------- | ------- | -------- |
| develop | Develop | engineer |
| testing | Testing | engineer |

`develop`, `testing`, and `engineer` require a later structural SPEC/PLAN pass. `testing` has a dev/local launch gate (`--mode testing`) and must not appear as active runtime behavior in this cleanup.

## Card 1 — Mode vocabulary canonicalization

Status: next
Weight: full

### Target Behavior

Brunch has one canonical two-row operational-mode contract in live code/docs: `specify` / `Specify` / `elicitor` and `execute` / `Execute` / `executor`.

### Full-card cold-start reads

- `memory/SPEC.md` — D40-L, D98-L, operational-mode / agent-role lexicon rows.
- `memory/PLAN.md` — `execute-entry-readiness` and `orchestrator-tool-port` references to SPEC/CODE and elicit/execute.
- `src/session/schema/kinds.ts` — current mode id/label constants.
- `src/agents/prompts/TOPOLOGY.md` — current naming contract.
- `src/agents/runtime/TOPOLOGY.md` — runtime policy ownership.

### Boundary Crossings

```text
→ session schema constants (`src/session/schema/kinds.ts`)
→ runtime-state parsing/projection (`src/session/runtime-state.ts`)
→ mode switch / orientation surfaces (`src/.pi/extensions/commands/`, `src/.pi/extensions/session-orientation/`)
→ prompt composition and topology (`src/agents/runtime/`, `src/agents/prompts/`)
→ canonical docs (`memory/SPEC.md`, `memory/PLAN.md`, relevant TOPOLOGY.md files)
```

### Risks and Assumptions

- RISK: renaming the runtime id from `elicit` to `specify` touches persisted/dev fixtures, snapshots, command arguments, and tests.
  → MITIGATION: prototype/free-rewrite posture allows direct breakage-driven repair; do not add an `elicit` compatibility alias unless a non-atomic external boundary is found and named.
- RISK: `SPEC` and `CODE` remain useful as historical shorthand in archive text but are misleading in live product docs.
  → MITIGATION: update live SPEC/PLAN/topology/prompt references; leave archive/history only when clearly historical.

### Posture check

Earned closure move:

- Canonicalizes operational-mode ids and labels.
- Separates mode concepts from agent-role concepts.
- Retires the old `elicit` runtime id and live `SPEC`/`CODE mode` wording.
- Does not add the future `develop`/`testing` modes or `engineer` agent.

### Acceptance Criteria

✓ `OPERATIONAL_MODE_IDS` and related live runtime types use `specify` and `execute` as ids; labels remain `Specify` and `Execute`.

✓ Foreground role derivation maps `specify → elicitor` and `execute → executor`; roles are not treated as modes.

✓ Live product prose and tests touched by this card use `Specify mode` / `Execute mode`, not `SPEC mode` / `CODE mode`, except intentional historical references.

✓ No active runtime behavior for `develop`, `testing`, or `engineer` is introduced.

### Verification Approach

- Inner: `npm run fix`.
- Targeted tests: session runtime-state tests, command mode-switch tests, session-orientation tests, prompt composition tests.
- Drift check: classify `rg "SPEC mode|CODE mode|\belicit\b|\bspecify\b|\bdevelop\b|\btesting\b|\bengineer\b" src memory` hits as live-canonical, historical, or out-of-scope future mention.

### Expected touched paths

```text
memory/
├── SPEC.md                                      ~
├── PLAN.md                                      ~
└── cards/orchestrator-tool-port--executor-surface-reconciliation.md ~
src/session/
├── schema/kinds.ts                              ~
├── runtime-state.ts                             ~
└── __tests__/session-orientation.test.ts        ?
src/.pi/extensions/
├── commands/                                    ~
├── session-orientation/                         ~
└── __tests__/
    ├── agent-runtime-runtime.test.ts            ~
    ├── agent-runtime-system-prompts.test.ts     ~
    └── commands-runtime-switch.test.ts          ~
src/agents/
├── prompts/TOPOLOGY.md                          ~
├── runtime/TOPOLOGY.md                          ~
├── runtime/elicitor/                            ~
└── runtime/executor/                            ~
```

## Card 2 — Execute tool surface relocation and stub retirement

Status: next after Card 1
Weight: full

### Target Behavior

Execute mode has one canonical executor surface: live `execute_*` tools under a dedicated Pi executor-adapter home, no `orchestrator_stub`, and prompt/topology/plan/spec/test evidence aligned with that surface.

### Full-card cold-start reads

- `memory/SPEC.md` — D39-L, D40-L, D52-L, D98-L, D111-L, D112-L, I58-L, `ExecutionPorts` lexicon row.
- `memory/PLAN.md` — frontier: `orchestrator-tool-port`; nearby `execute-entry-readiness` notes that mention `orchestrator_stub` successors.
- `HANDOFF.md` — KA-card confirmation is deferred; do not garbage-collect executor cards here.
- `src/executor/TOPOLOGY.md` — pure core / side-effect boundary.
- `src/.pi/extensions/TOPOLOGY.md` — Pi adapter ownership and layout.
- `src/agents/runtime/executor/TOPOLOGY.md` — executor runtime policy ownership.

### Boundary Crossings

```text
→ executor prompt body (`src/agents/prompts/executor.md`)
→ executor runtime policy/tests (`src/agents/runtime/executor/`)
→ Pi executor tool adapters (`src/.pi/extensions/executor/*.ts`)
→ Pi extension composition root (`src/app/pi-extensions.ts`)
→ session tool-name constants (`src/session/schema/tool-names.ts`)
→ canonical docs (`memory/SPEC.md`, `memory/PLAN.md`, `src/.pi/extensions/TOPOLOGY.md`, `src/agents/runtime/executor/TOPOLOGY.md`)
```

### Risks and Assumptions

- RISK: flattening `src/.pi/extensions/agent-runtime/execute-*/index.ts` to `src/.pi/extensions/executor/*.ts` touches many imports and exports.
  → MITIGATION: move mechanically, keep tool names unchanged, run targeted rg checks for old paths and `orchestrator_stub`.
- RISK: deleting `orchestrator_stub` can break tests that used it as a cheap executor-only witness.
  → MITIGATION: replace those witnesses with representative live `execute_*` tools (`execute_status` for side-effect-free policy; one lifecycle/host-promotion tool where needed).
- ASSUMPTION: `orchestrator_stub` has no current product role beyond legacy smoke coverage.
  → IMPACT IF FALSE: a hidden test/dev workflow may need a replacement smoke tool.
  → VALIDATE: rg references; removed registration should leave live execute witnesses intact.

### Posture check

Earned closure move:

- Canonicalizes Pi adapter topology: executor tools move out of `agent-runtime/` into `src/.pi/extensions/executor/` because `agent-runtime/` is runtime-state/mode-switch policy, not execution lifecycle tooling.
- Deletes / retires obsolete bridge: `orchestrator_stub` leaves registration, allowlist, prompt, tests, exports, and tool-name constants.
- Locks in prompt/tool-policy agreement: executor prompt describes the same live `execute_*` surface admitted by `EXECUTOR_ALLOWED_TOOL_NAMES` and reported by `execute_status`.
- Materializes current topology in co-located docs and SPEC/PLAN so future readers do not reconstruct the merge from stale comments.

### Acceptance Criteria

✓ Adapter topology — all `execute_*` Pi adapters live under `src/.pi/extensions/executor/*.ts`; no `src/.pi/extensions/agent-runtime/execute-*` directories remain; `agent-runtime/` keeps runtime-state/prompt-hook responsibilities.

✓ Stub retired — `orchestrator_stub` is absent from tool-name constants, Pi registration/export barrels, executor allowlist, prompt text, and tests.

✓ Prompt aligned — `src/agents/prompts/executor.md` teaches the live execute surface and explicit-acceptance host apply boundary; it no longer says lifecycle tools are inactive/pending.

✓ Authority/runtime tests updated — executor-only tool-policy witnesses use live `execute_*` tools, and prompt tests pin the new conduct boundary rather than the retired stub.

✓ Canonical docs aligned — `memory/SPEC.md`, `memory/PLAN.md`, `src/.pi/extensions/TOPOLOGY.md`, and `src/agents/runtime/executor/TOPOLOGY.md` no longer describe `orchestrator_stub` as the executor boundary or list execute adapters under `agent-runtime/`.

✓ Deferred card cleanup preserved — `memory/cards/executor-*` files are not deleted unless KA confirmation arrives separately.

### Verification Approach

- Inner: `npm run fix` after meaningful edits.
- Targeted tests: executor prompt tests, agent-runtime authority/runtime tests, `.pi/extensions` registry tests covering `execute_status` and representative execute tools.
- Gate: `npm run verify` before commit.
- Drift check: `rg "orchestrator_stub|orchestrator-stub|agent-runtime/execute-|execute-\*/index" src memory docs` should return only intentional archive/history mentions, if any.

### Cross-cutting obligations

- Preserve D40-L concentric Execute authority: executor tools remain a superset of elicitor tools plus executor-only `execute_*` tools; raw shell/edit/write stay blocked.
- Preserve D111-L/I58-L: Pi adapters stay thin; real side effects remain in `src/executor/` helpers through injected `ExecutionPorts` and app-layer port implementations.
- Preserve topology-home depth rule: update `src/.pi/extensions/TOPOLOGY.md`; do not add a deeper `src/.pi/extensions/executor/TOPOLOGY.md` unless explicitly requested.

### Expected touched paths

```text
memory/
├── SPEC.md                                             ~
├── PLAN.md                                             ~
└── cards/
    ├── orchestrator-tool-port--executor-surface-reconciliation.md ~
    └── executor-*.md                                  ? read-only unless KA confirms separately
src/.pi/extensions/
├── TOPOLOGY.md                                        ~
├── agent-runtime/
│   ├── index.ts                                      ~
│   ├── orchestrator-stub/                            -
│   └── execute-*/                                    -
├── executor/                                         +
│   ├── *.ts                                          +
│   └── index.ts                                      +
└── __tests__/
    ├── agent-runtime-authority-matrix.test.ts        ~
    ├── agent-runtime-runtime.test.ts                 ~
    ├── agent-runtime-system-prompts.test.ts          ?
    ├── commands-runtime-switch.test.ts               ?
    └── registry.test.ts                              ~
src/agents/
├── prompts/executor.md                               ~
└── runtime/executor/
    ├── TOPOLOGY.md                                   ~
    ├── active-tools.ts                               ~
    └── __tests__/compose-prompt.test.ts              ~
src/app/
└── pi-extensions.ts                                  ~
src/session/schema/
└── tool-names.ts                                     ~
```
