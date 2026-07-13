# Explicit Worker Brief From Scope Request

Frontier: build-architect-scope-consumer
Status:   proposed
Mode:     single
Created:  2026-07-09

## Orientation

- Seam: scope-derived `request.json` -> app-layer worker brief rendering -> sealed worker task text.
- Parent frontier: `build-architect-scope-consumer` (FE-1179) already proved the executor handoff is load-bearing from committed `scope` through `plan.yaml` into worker requests.
- This slice is a follow-on seam hardening pass: keep the deterministic lowering exactly as-is, but make the worker-facing brief explicit rather than a raw JSON dump.
- Main risk: the executor now preserves rich scope context, but the app-layer handoff still teaches the worker by serialized field names instead of by a named brief contract.

## Target Behavior

The sealed worker receives an explicit task brief rendered from the scope-derived execution request: implementation goal, done criteria, requirement provenance, and any shared design / verification context are all visible in stable prose sections rather than only inside raw JSON.

## Full-card cold-start reads

- `memory/SPEC.md` — D103-L, D111-L, D112-L, I58-L.
- `memory/PLAN.md` — `build-architect-scope-consumer` frontier definition.
- `memory/cards/build-architect-scope-consumer--scope-to-build-tracer.md` — accepted boundary for the parent frontier.
- `src/executor/TOPOLOGY.md` — execute-mode ownership and app-layer port boundary.
- `src/executor/slice-execute.ts` — current request artifact shape.
- `src/app/agent-runner-port.ts` — worker brief rendering seam.
- `src/app/__tests__/agent-runner-port.test.ts` — current model-facing proof.

## Boundary Crossings

```text
scope-derived request artifact
-> AgentRunnerPort brief renderer
-> sealed worker task text
```

## Risks and Assumptions

- RISK: the fix drifts into planner behavior or app-layer prompt invention. -> MITIGATION: render only existing request facts (`definition`, `criteria`, `derivedFrom`, `designContext`, `verificationContext`, ids/paths); do not synthesize new decomposition.
- RISK: the app layer forks a second contract away from `request.json`. -> MITIGATION: treat the request as the single source of truth and only improve presentation.
- ASSUMPTION: an explicit prose brief is a seam improvement even with the same underlying request payload. -> IMPACT IF FALSE: the raw JSON passthrough is good enough and this slice should be dropped. -> VALIDATE: tests assert the worker task string by named sections, not by incidental JSON formatting.

## Posture Check

This is a small productization slice, not a new frontier. It should deepen the worker-facing seam without widening the executor model or reopening planning-process work.

## Acceptance Criteria

✓ `src/app/agent-runner-port.ts` renders a stable worker brief with explicit sections for the slice goal and completion criteria instead of only dumping raw request JSON.
✓ When present, the rendered brief includes `derivedFrom`, `designContext`, and `verificationContext` as named context sections.
✓ `src/app/__tests__/agent-runner-port.test.ts` proves the worker task text contains the named brief content at the string layer.
✓ Existing request-artifact proofs in executor tests stay unchanged unless the rendering slice truly needs a request-shape adjustment.

## Verification Approach

- Inner: targeted Vitest for `src/app/__tests__/agent-runner-port.test.ts`.
- Middle: targeted executor/app regression if a small request-shape change becomes necessary (`slice-execute.test.ts`).
- Gate: focused checks on touched files if repo-wide `npm run verify` is still blocked by the unrelated `@earendil-works/pi-ai/compat` issue.

## Cross-cutting Obligations

- Preserve executor/app boundary clarity: executor owns request facts; app layer owns rendering for the worker.
- Preserve sealed-worker discipline: no new tools, no planner role, no hidden decomposition step.
- Preserve wording honesty: do not overstate what the request knows; absent context stays absent.

## Expected Touched Paths (Tentative)

```text
src/app/
├── agent-runner-port.ts             ~
└── __tests__/
    └── agent-runner-port.test.ts    ~
src/agents/subagents/
└── worker.md                        ?
memory/cards/
└── build-architect-scope-consumer--explicit-worker-brief.md +
```
