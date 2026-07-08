# Executor Replanning Auto Policy

Frontier: executor-replanning
Linear:   FE-1114
Status:   done
Mode:     single
Created:  2026-07-08

## Orientation

- Containing seam: executor replanning over explicit run-state diagnosis plus bounded recovery mutations.
- Relevant frontier item: `executor-replanning` / FE-1114 exists as the active card family and Graphite branch (`ka/fe-1114-executor-replanning`); `memory/PLAN.md` needs later reconciliation because the frontier is not currently defined there as a first-class entry.
- Volatile handoff state: FE-1141 makes stale/evidence/lineage state visible, but automation must not rely on the web UI and must remain safe in headless executor use.
- Main open risk: “automatic replanner” can easily erase HITL evidence discipline unless the first policy is conservative and refuses supersession-by-default.

Posture: proving (inherited from `executor-replanning`).

## Target Behavior

A conservative auto-replan policy executes only evidence-preserving safe recovery actions for one run.

## Full-card cold-start reads

- `memory/SPEC.md` — D98-L, D111-L, D112-L, I58-L.
- `memory/PLAN.md` — indirect `executor-replanning` branch reference; `executor-run-observer`; `orchestrator-tool-port`.
- `src/executor/TOPOLOGY.md` — run freshness, retry eligibility, recommendation, side-effect boundaries, and run driver rules.
- Existing cards: `memory/cards/executor-replanning--retry-eligibility.md`, `memory/cards/executor-replanning--recommendation.md`, `memory/cards/executor-replanning--retry-current-step-tool.md`, `memory/cards/executor-replanning--regenerate-plan-tool.md`, `memory/cards/executor-replanning--start-new-run-tool.md`, `memory/cards/executor-replanning--abandon-run-tool.md`.

## Boundary Crossings

```text
→ execute auto-replan entry point
→ recommendation / retry eligibility
→ conservative policy decision
→ one existing bounded replanning action or refusal
→ run update publication
```

## Risks and Assumptions

- RISK: automatic mode silently creates a replacement run and surprises the user. → MITIGATION: first policy auto-executes only `retry_current_step` and early-run `regenerate_plan`; stale started runs return `needs_human_start_new_run` unless an explicit future setting is scoped.
- RISK: retry loops can burn compute or hide repeated failures. → MITIGATION: require an explicit small retry budget parameter or policy default and report `retry_budget_exhausted` without mutation.
- RISK: automation duplicates lifecycle-driver orchestration. → MITIGATION: delegate retry to the existing one-step retry helper; do not add a new scheduler path.
- ASSUMPTION: `retry_current_step` and early `regenerate_plan` are safe automatic actions because they preserve or refresh pre-evidence state under existing guards.
  → IMPACT IF FALSE: the policy must downgrade to recommendation-only or ask-human for every action.
  → VALIDATE: core policy tests assert no mutation for stale-started, terminal, missing, blocked, or budget-exhausted runs.

## Posture check

This is a proving tracer: it tells whether automatic replanning can exist without weakening the existing evidence-preserving HITL invariant. Landing it should prove the safe subset is useful and sharply name what remains human-gated.

## Acceptance Criteria

✓ `src/executor/__tests__/run-auto-replan-policy.test.ts` — fresh active runs with budget recommend and execute exactly one retry-current-step action through the injected retry delegate.
✓ `src/executor/__tests__/run-auto-replan-policy.test.ts` — stale early runs execute exactly one regenerate-plan action through the injected regenerate delegate.
✓ `src/executor/__tests__/run-auto-replan-policy.test.ts` — stale started runs refuse with `needs_human_start_new_run` and never call supersession.
✓ `src/executor/__tests__/run-auto-replan-policy.test.ts` — terminal, abandoned, missing, blocked, and budget-exhausted states perform no mutation.
✓ `src/.pi/extensions/__tests__/registry.test.ts` — any exposed `execute_replan_auto` tool is executor-only, reports side effects honestly, and returns the policy decision.

Implemented 2026-07-08 as pure executor core in `run-auto-replan-policy.ts`, with no Pi tool exposed in this slice. The policy delegates only `retry_current_step` and `regenerate_plan`, refuses stale-started/missing runs with human start-new-run, and keeps terminal/blocked/budget-exhausted runs mutation-free. Verification: `npm run test -- src/executor/__tests__/run-auto-replan-policy.test.ts`; `npm run verify`.

## Verification Approach

- Inner: pure executor policy tests with injected delegates — proves action selection without filesystem coupling.
- Inner: registry/tool tests if `execute_replan_auto` is exposed — proves executor-only tool admission and honest side-effect reporting.
- Middle: existing replanning core/helper tests — prove each delegated action keeps its state guard.

## Cross-cutting obligations

- Do not auto-supersede stale started runs in this slice.
- Do not delete artifacts, mutate graph state, or rewrite run plans after execution evidence exists.
- Preserve run-driver separation: automatic replanning chooses a bounded recovery action; it does not become a second orchestrator.
- If Slice 1 from `executor-replanning--web-actions.md` lands first, keep web auto-action wiring out of this card unless separately scoped.

## Expected touched paths (tentative)

```text
src/executor/
├── run-auto-replan-policy.ts                    +
├── __tests__/run-auto-replan-policy.test.ts     +
└── TOPOLOGY.md                                  ~
src/.pi/extensions/executor/
├── execute-replan-auto/index.ts                 ?
└── TOPOLOGY.md                                  ?
src/.pi/extensions/__tests__/registry.test.ts    ?
src/agents/runtime/executor/active-tools.ts      ?
src/session/schema/tool-names.ts                 ?
```
