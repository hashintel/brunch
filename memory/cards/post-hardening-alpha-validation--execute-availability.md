# FE-1348 deterministic Execute availability

Frontier: post-hardening-alpha-validation
Status:   ready
Mode:     single
Created:  2026-08-13

Posture: proving (inherited from `post-hardening-alpha-validation`).

## Target behavior

The real TUI mode-switch and `/brunch:consult` paths build the Execute orientation menu from one read-only deterministic availability result instead of always passing the static Prepare-only menu.

This is the bounded production prerequisite discovered by FE-1348's final open witness and explicitly transferred from FE-1187. FE-1187 retains A48-L's optional model-backed improvement, provider campaign, latency/cache policy, and broader S1–S3/E1–E4 evaluator catalog.

## Cold-start reads

- `memory/SPEC.md` — D109-L, D120-L, D142-L; I62-L; A48-L ownership boundary
- `memory/PLAN.md` — `post-hardening-alpha-validation` and paused `walkthrough-remediation-2`
- `testing/walkthroughs/2026-08-10/execute-mode-interaction-owned-gate.md`
- `src/.pi/extensions/TOPOLOGY.md` — menu ownership and fail-closed fallback
- `src/executor/TOPOLOGY.md` — plan projection and launch freshness
- `src/app/TOPOLOGY.md` — production TUI composition

## Boundary crossings

```text
selected spec + canonical graph projection + spec plan/provenance
→ existing deterministic plan-input check + launch freshness
→ ProcessMoveAvailability
→ shared menu resolver
→ real mode-switch and /brunch:consult menus
```

- `prepare_execution` remains available in Execute mode.
- `compile_plan` is available only when the existing default compile path passes all deterministic pre-admission checks: plan-input readiness, execution-contract blockers/conflicts, and an authored verification action. This does not claim model-backed planner synthesis will succeed.
- `execute_plan` is available only when the existing launch-freshness read reports a current executable plan.
- Missing/unreadable input or resolver failure falls back to Prepare only.
- Availability reads start no provider turn and write no graph, session, plan, run, cache, or transcript state.

## Exclusions

- FE-1187 A48-L evaluator/model path, campaign, cache, timeout, reconciliation-blocker work, and S1–S3 catalog
- provider invocation or foreground-turn consumption
- new plan or process-move RPC methods
- creation of plans, runs, worktrees, or execution artifacts
- selecting a process move or executing a plan
- KA-owned O7–O9 workflow conduct evidence
- `cli-mode-entry` pre-runtime mode activation

## Acceptance criteria

```text
✓ deterministic resolver rivals
  - thin/blocked/unreadable input -> Prepare only
  - plan-input readiness with a contract blocker/conflict or no authored verification action -> Prepare only
  - complete deterministic compile admission with no current plan -> Prepare + Compile
  - current launch-ready plan -> Prepare + Compile + Execute
  - stale/missing/blocked plan -> Execute hidden
✓ production wiring rivals
  - real mode switch and /brunch:consult use the same resolved menu
  - resolver failure uses the static Prepare-only fallback
  - dismissal records no brunch.process_move and fires no kick
✓ side-effect oracle
  - resolver reads leave graph LSN, active branch, plan/provenance bytes, and run inventory unchanged
✓ focused tests pass for the resolver, mode-switch command, consult registrar, and production app composition
```

Extract/reuse the complete deterministic pre-admission now embedded in `execute_plan_file` so the tool and menu cannot drift; reuse existing executor projection/launch functions and `buildSessionOrientationMenu`. Do not duplicate a readiness model or treat unpredictable planner synthesis as deterministic availability. Add a new module only where needed to make that existing admission shared.

## Verification approach

- Inner: contrastive resolver and menu-wiring tests.
- Middle: existing executor plan-check/launch suites remain canonical; app composition proves production supplies the resolver.
- Outer: after this scope lands, resume only the Execute row in `post-hardening-alpha-validation--usage-and-verification-sweep.md`.

## Owned outer witness after build

1. Establish one fresh disposable supported E3 target through product commands, with a real current executable plan and a public readable run projection only if needed for plan readback. Record every setup side effect; `execute_run_create` also prepares immutable plan/Petrinaut observer artifacts and must not be described as metadata-only.
2. Freeze the witness boundary after setup and stop provider activity.
3. Through the real TUI, switch Specify → Execute, observe and dismiss the Prepare + Compile + Execute menu, then reopen it with `/brunch:consult`.
4. Compare visible availability with `session.runtimeState` and public executor readbacks. Do not select a move or execute the plan.
5. Close the row only if both menu paths agree, frozen authority bytes remain unchanged, no provider call occurs after the boundary, and cleanup leaves no process/listener/writer residue.

E1/E2/E4 are contrastive inner/middle rivals, not four additional manual journeys. The single outer E3 journey proves that state-aware availability reaches both real production menu entrances.

## Expected touched paths (tentative)

```text
src/executor/                                                   ?  # pure adapter only if existing predicates need composition
src/.pi/extensions/session-orientation/                         ~
src/.pi/extensions/commands/                                    ~
src/.pi/extensions/TOPOLOGY.md                                  ~
src/app/                                                        ~
src/app/TOPOLOGY.md                                             ?
memory/cards/post-hardening-alpha-validation--execute-availability.md ~
memory/cards/post-hardening-alpha-validation--usage-and-verification-sweep.md ~  # outer status only after witness
```
