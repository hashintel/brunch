# executor-orchestrate-loop — plain driver seam slice

## Orientation

- Containing seam: executor run lifecycle — the linear `execute_*` step chain in `src/executor/*.ts` (worktree → per-slice agent/test → run-complete → petri → promote), driven today by manual per-tool calls; side effects behind the injected `ExecutionPorts` bag (D52-L/I56-L).
- Frontier item: `executor-orchestrate-loop` (FE-1125) on `ka/fe-1125-executor-orchestrate-loop`, stacked on `ka/fe-1118-executor-host-promotion`.
- Main risk: the existing `execute_*` step fns were built for single manual invocation with their own status preconditions/idempotency (FE-1089/1109); a loop calling them must not double-advance or fight that idempotency.
- Design settled via `ln-design` and recorded as SPEC D102-L (scheduler seam: ready-set return, readiness from slice facts, pure scheduler in core).

## Scope Weight

Full scope card. Establishes a new seam (`RunScheduler` + `drive()`) and a new invariant (readiness from slice-completion facts; ready-set return). Promotion/land deliberately out of scope.

## Target Behavior

One `execute_orchestrate` call drives a worktree-ready run to `run_completed`, executing at each turn the single step chosen by an injected `RunScheduler` whose readiness is computed from recorded slice-completion facts.

## Boundary Crossings

```text
execute_orchestrate            (Pi tool, CODE mode, gated — app/.pi extension)
→ drive(run, plan, ports, { scheduler, halt })   (executor core — generic loop)
→ RunScheduler.ready(state, plan)                (executor core — LinearScheduler, PURE)
→ runReady(step) → existing execute_* step fn    (executor core)
→ ExecutionPorts (GitWorktree / AgentRunner / TestRunner)   (injected, app layer)
→ run.json + reports.jsonl                       (state fold)
→ exit: run.status = "run_completed"  OR  halted (status unchanged)
```

## Risks and Assumptions

- RISK: the loop double-advances a step the helper already advanced. → MITIGATION: `drive()` calls each step once at its precondition; reuse existing per-step idempotency (FE-1089/1109); assert single-execution.
- RISK: fact-derived readiness diverges from the linear status enum the step fns enforce. → MITIGATION: `LinearScheduler` derives per-slice readiness from `run.json` completedSlices; the coarse lifecycle phase still gates one-time setup steps. Facts-not-enum applies to the slice frontier, not the setup transitions.
- ASSUMPTION: `drive()` can call core step fns directly with the ports bag (not via Pi tools). → VALIDATE: matches the established pattern — each `execute_*.ts` is a core fn; the adapter injects `ExecutionPorts`.
- ASSUMPTION: agent/test steps are drivable in tests via injected deterministic ports. → VALIDATE: acceptance test drives a 2-slice plan with fake `AgentRunnerPort` / `TestRunnerPort` (as `src/executor/__tests__` already do). No real LLM this slice.

## Acceptance Criteria

✓ drives-to-completion — a created run + 2-slice plan reaches `run_completed` after one `execute_orchestrate` call; both slices marked completed in `run.json`.

✓ ready-set-contract — `RunScheduler.ready()` returns a length-1 array each turn and `[]` at `run_completed` (locks the set-return type so Petri can later return N).

✓ readiness-from-facts — with slice A completed and B pending, `ready()` selects B's next step from completedSlices, not from the global `status` string.

✓ halt-on-failure — an injected port failure halts the run, leaves status at the pre-step value (no advance), and `drive()` returns a halt outcome.

✓ single-execution — each `execute_*` step fn is invoked exactly once per run step (no double-advance).

✓ parity — the driven run's terminal `run.json` + `reports.jsonl` events equal the hand-cranked sequence's (the driver adds no new side effects).

## Verification Approach

- Inner: example-based Vitest over `drive()` + `LinearScheduler` with injected fake `ExecutionPorts` — proves composition, ready-set contract, fact-based readiness, halt-on-failure, single-execution.
- Middle: extend the existing executor lifecycle integration test to assert driven-run terminal state == hand-cranked terminal state (parity oracle).
- Outer: none this slice (real LLM / host land out of scope).
- Gate: `npm run verify`.

## Promotion Checklist

- [x] Does this change a requirement? Materializes D101-L's named `orchestrate` tool.
- [x] Does this create, retire, or invalidate an assumption? Establishes that a run can be driven end-to-end behind a scheduler seam.
- [x] Does this make or reverse a non-trivial design decision? Chooses a pure scheduler returning a ready-set, readiness from slice facts (SPEC D102-L).
- [x] Does this establish a new seam-level invariant? `ready()` returns a set; readiness derives from slice-completion facts, not the global status enum.
- [x] Does it cross more than two major seams? Pi tool → executor core → injected ports → run metadata.
- [x] Is this the first touch in an unfamiliar seam from a fresh thread? First touch of the driver seam.
- [ ] Can you not name the containing seam or current rationale from the live docs?

## Recommended Next Route

`ln-build` slice 1. Second slice extends the driver past `run_completed` through `petri` + `promotion` (still behind the same seam).
