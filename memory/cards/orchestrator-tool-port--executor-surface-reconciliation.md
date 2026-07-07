# Executor surface reconciliation

Frontier: orchestrator-tool-port
Status:   active
Mode:     slices
Created:  2026-07-07

## Orientation

- Containing seam: operational-mode runtime + Execute-mode executor surface. `src/session/schema/kinds.ts` owns mode ids/labels; `src/agents/runtime/*` maps modes to foreground agents; `src/executor/` is the pure run-lifecycle core over `ExecutionPorts`; Pi-facing execution tools are adapters.
- Relevant frontier: `orchestrator-tool-port` / FE-1107, re-baselined after KA's executor lane landed. The mechanism exists; this file closes mode/executor surface residue.
- Volatile state: KA's six `memory/cards/executor-*` cards appear exhausted but remain unconfirmed. Do not delete them in these cards.
- Restack delta (2026-07-07): the new FE-1155 branch removed the `orchestrator-stub/` source/registration/allowlist/tool constant, but stale prompt/tests/PLAN references remain. The new FE-1154 work adds executor observability and a passive `execute-run-updates` tool-result observer under `agent-runtime/`, increasing the case for a dedicated executor adapter home.
- PR #295/#297 induction delta (resolved comments included): executor-run local artifacts now have three contracts this reconciliation must not blur — tolerant/canonical artifact reads, ordered async stream updates, and centralized plan-mode defaults before source-policy decisions.
- Main open risk: stale model-facing control text, residual stub-era tests/docs, mixed mode vocabulary, and unowned executor-run observer contracts can make Execute mode behave/read as though the live execute path is pending or as though mode id, product label, agent role, run artifact truth, and source policy defaults are interchangeable.

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

## Card 0 — Shared foreground reference-resource parity

Status: done
Weight: full

### Target Behavior

Elicitor and executor foreground prompts share one code-owned static reference-resource surface, and the executor surface is concentric with the elicitor surface.

### Full-card cold-start reads

- `memory/SPEC.md` — D52-L, D58-L, D85-L, D97-L, D98-L; prompt-resource and operational-mode runtime decisions.
- `memory/PLAN.md` — frontier: `orchestrator-tool-port`; nearby `execute-entry-readiness` context-resource expectations.
- `src/agents/references/TOPOLOGY.md` — runtime-eligible static reference ownership and boundary rules.
- `src/agents/runtime/elicitor/compose-live-prompt.ts` — current elicitor foreground prompt composition.
- `src/agents/runtime/executor/compose-prompt.ts` — current executor foreground prompt composition.
- `src/agents/skills/registry.ts` — shared live skill manifest rendering pattern.

### Boundary Crossings

```text
→ static reference ownership (`src/agents/references/`)
→ shared prompt-resource renderer (`src/agents/`)
→ elicitor foreground prompt composition (`src/agents/runtime/elicitor/`)
→ executor foreground prompt composition (`src/agents/runtime/executor/`)
→ prompt-resource tests (`src/agents/runtime/*/__tests__/`, `src/.pi/extensions/__tests__/`)
```

### Risks and Assumptions

- RISK: inlining full reference bodies bloats foreground prompts and makes future reference edits high-churn.
  → MITIGATION: render a compact shared manifest/table with stable names, descriptions, and Markdown-link or absolute-path locations; do not inline bodies unless a later decision changes the shared renderer.
- RISK: executor gets a bespoke reference list that drifts from elicitor.
  → MITIGATION: one shared code path renders the static reference-resource surface for both agents; tests assert executor parity/superset against elicitor.
- ASSUMPTION: release confidence requires concentric resource discoverability, not raw prompt inclusion of every reference body.
  → IMPACT IF FALSE: prompt assembly would need to inline or eagerly load reference contents rather than list them.
  → VALIDATE: discriminating prompt tests prove shared manifest presence and executor parity.

### Posture check

Earned closure move:

- Locks in a shared prompt-resource invariant that recent executor wiring otherwise leaves implicit.
- Canonicalizes how foreground agents discover runtime-eligible static references.
- Prevents executor drift from the elicitor's product/data-model context without choosing a heavier inclusion strategy.

### Acceptance Criteria

✓ Shared renderer — one code path owns the static `src/agents/references/` prompt-resource manifest used by both foreground agents.

✓ Elicitor prompt witness — `composeLiveElicitorPrompt` includes the shared reference-resource manifest alongside the live skill manifest.

✓ Executor prompt witness — `composeExecutorPrompt` includes the same shared reference-resource manifest and remains at least concentric with Elicitor for prompt resources.

✓ Reference inventory witness — tests fail if any runtime-eligible file named in `src/agents/references/TOPOLOGY.md` is dropped from the shared manifest without an intentional update.

✓ No body inlining — prompt tests assert discoverability through the manifest, not raw contents from `data-model.md`, `node-neighbourhoods.md`, `product-concept.md`, or `readiness-bands.md`.

### Verification Approach

- Inner: targeted prompt composition tests — prove elicitor/executor manifest inclusion and parity.
- Middle: provider prompt hook test — prove Execute mode receives the shared manifest through the real Pi prompt-carrier path.
- Gate: `npm run verify` before commit.

### Cross-cutting obligations

- Preserve D40-L/D98-L concentric Execute authority: executor receives at least the prompt-resource surface Elicitor receives, plus executor-only conduct/tooling.
- Preserve `src/agents/references/` boundary: references are static runtime-eligible text loaded on demand, not rendered runtime context.
- Preserve existing live skill manifest behavior; this card adds a sibling static-reference manifest, not a replacement.

### Expected touched paths

```text
src/agents/
├── references/
│   ├── TOPOLOGY.md                         ?
│   └── registry.ts                         +
├── runtime/
│   ├── elicitor/
│   │   ├── compose-live-prompt.ts          ~
│   │   └── __tests__/compose-live-prompt.test.ts ~
│   └── executor/
│       ├── compose-prompt.ts               ~
│       └── __tests__/compose-prompt.test.ts ~
└── prompts/
    └── __tests__/registry.test.ts          ?
src/.pi/extensions/__tests__/
└── agent-runtime-system-prompts.test.ts    ~
```

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
- `memory/PLAN.md` — frontier: `orchestrator-tool-port`; nearby `execute-entry-readiness`, `orchestrator-stub-retirement`, `executor-run-observer`, and executor integrity/observability notes.
- `HANDOFF.md` — KA-card confirmation is deferred; do not garbage-collect executor cards here.
- `src/executor/TOPOLOGY.md` — pure core / side-effect boundary, observer-read tolerance, stream artifacts, and source-policy defaults.
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

- RISK: flattening `src/.pi/extensions/agent-runtime/execute-*/index.ts` to `src/.pi/extensions/executor/*.ts` now includes both active tools and passive executor observers/tests (`execute-run-updates`, orchestrate/run update tests), touching many imports and exports.
  → MITIGATION: move mechanically, keep tool names unchanged, move observer tests with the executor adapter family, and run targeted rg checks for old paths and `orchestrator_stub`.
- RISK: FE-1155 retired the stub implementation but not every stale witness, so tests may still use `orchestrator_stub` as a cheap executor-only representative.
  → MITIGATION: replace residual witnesses with representative live `execute_*` tools (`execute_status` for side-effect-free policy; one lifecycle/host-promotion/update observer surface where needed).
- RISK: resolved PR comments fixed local symptoms but left contracts implicit, especially stream ordering and plan-mode defaulting.
  → MITIGATION: add/keep narrow contract tests and topology notes while relocating executor adapters; do not let path moves erase the observer/integrity guarantees.
- ASSUMPTION: `orchestrator_stub` has no current product role beyond legacy smoke coverage.
  → VALIDATE: source registration/allowlist/tool constant are already gone after FE-1155; remaining prompt/test/PLAN references are stale and should be removed rather than preserved.

### Posture check

Earned closure move:

- Canonicalizes Pi adapter topology: executor tools move out of `agent-runtime/` into `src/.pi/extensions/executor/` because `agent-runtime/` is runtime-state/mode-switch policy, not execution lifecycle tooling.
- Deletes / retires obsolete bridge: `orchestrator_stub` leaves registration, allowlist, prompt, tests, exports, and tool-name constants.
- Locks in prompt/tool-policy agreement: executor prompt describes the same live `execute_*` surface admitted by `EXECUTOR_ALLOWED_TOOL_NAMES` and reported by `execute_status`.
- Materializes current topology in co-located docs and SPEC/PLAN so future readers do not reconstruct the merge from stale comments.
- Names executor-run observer contracts surfaced by PR #295/#297: run-artifact readers are best-effort/tolerant and choose canonical post-populate artifacts; async stream updates have an ordering owner; optional plan mode defaults are normalized before source policy decisions.

### Acceptance Criteria

✓ Adapter topology — all `execute_*` Pi adapters and executor-only passive tool-result observers live under `src/.pi/extensions/executor/*.ts` (with tests moved to that family); no `src/.pi/extensions/agent-runtime/execute-*` directories remain; `agent-runtime/` keeps runtime-state/prompt-hook responsibilities.

✓ Stub retirement completed — FE-1155's implementation removal is reconciled through prompt text, tests, PLAN/SPEC/topology, and any residual references; no live `orchestrator_stub` assertions remain.

✓ Prompt aligned — `src/agents/prompts/executor.md` teaches the live execute surface and explicit-acceptance host apply boundary; it no longer says lifecycle tools are inactive/pending.

✓ Authority/runtime tests updated — executor-only tool-policy witnesses use live `execute_*` tools, and prompt tests pin the new conduct boundary rather than the retired stub.

✓ Executor observer contracts preserved — relocation keeps or adds tests for: invalid run directories are unreadable entries rather than list-fatal; corrupt/torn JSONL lines do not poison observer/verifier reads; requirement status reads `populatedPlanPath ?? planPath`; active-slice stream tails are visible; worker/verify stream appends preserve emitted order.

✓ Plan-mode default centralized — source-policy selection uses the same normalized mode default as plan projection (`missing mode` means greenfield unless an explicit brownfield/host-source policy says otherwise); no strict `plan.mode === 'greenfield'` one-off remains in scheduler policy.

✓ Canonical docs aligned — `memory/SPEC.md`, `memory/PLAN.md`, `src/.pi/extensions/TOPOLOGY.md`, `src/executor/TOPOLOGY.md`, and `src/agents/runtime/executor/TOPOLOGY.md` no longer describe `orchestrator_stub` as the executor boundary, list execute adapters under `agent-runtime/`, or leave executor-run observer contracts implicit.

✓ Deferred card cleanup preserved — `memory/cards/executor-*` files are not deleted unless KA confirmation arrives separately.

### Verification Approach

- Inner: `npm run fix` after meaningful edits.
- Targeted tests: executor prompt tests, agent-runtime authority/runtime tests, executor adapter registry/update tests covering `execute_status`, `execute-run-updates`, and representative execute tools; executor observer/integrity tests covering tolerant reads, stream ordering, and plan-mode defaulting.
- Gate: `npm run verify` before commit.
- Drift check: `rg "orchestrator_stub|orchestrator-stub|agent-runtime/execute-|execute-\*/index" src memory docs` should return only intentional archive/history mentions, if any.

### Cross-cutting obligations

- Preserve D40-L concentric Execute authority: executor tools remain a superset of elicitor tools plus executor-only `execute_*` tools; raw shell/edit/write stay blocked.
- Preserve D111-L/I58-L: Pi adapters stay thin; real side effects remain in `src/executor/` helpers through injected `ExecutionPorts` and app-layer port implementations.
- Preserve executor-run observer truthfulness from FE-1141/FE-1154: local run artifacts are read best-effort, source-policy defaults are normalized once, and stream update order is either producer-serialized or core-persistence-serialized by an explicit contract.
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
│   ├── __tests__/execute-*-updates.test.ts           - / move
│   ├── index.ts                                      ~
│   └── execute-*/                                    -
├── executor/                                         +
│   ├── *.ts                                          +
│   ├── index.ts                                      +
│   └── __tests__/execute-*-updates.test.ts           +
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
├── agent-runner-port.ts                              ?
├── pi-extensions.ts                                  ~
└── test-runner-port.ts                               ?
src/executor/
├── TOPOLOGY.md                                       ~
├── observer-read.ts                                  ?
├── orchestrate.ts                                    ?
├── report-verdict.ts                                 ?
├── agent-result.ts                                   ?
├── test-result.ts                                    ?
└── __tests__/                                        ?
src/session/schema/
└── tool-names.ts                                     ~
```
