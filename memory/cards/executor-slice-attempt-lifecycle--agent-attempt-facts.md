# Agent attempt facts — bounded in-run retry with a durable attempt vocabulary

Frontier: executor-slice-attempt-lifecycle
Status:   active
Mode:     single
Created:  2026-07-13

Posture: proving (inherited from executor-slice-attempt-lifecycle)

Shape decisions settled by the user at pickup 2026-07-13: (1) attempt facts first —
compiled net topology unchanged, attempts are journal facts, drive owns the retry loop
(Petri-native self-loop topology is an explicit follow-up slice); (2) retry bound is a
named executor constant with a `ceiling:` comment (upgrade: plan-declared per-slice);
(3) agent step only (`agent_run_failed`) — shape the mechanism so `test_run_failed`
joins in a follow-up slice on this branch.

## Target Behavior

A slice whose agent attempt fails retries in-run up to a named bound, with every attempt
durably journaled before any hint or further step, and only exhausts into the existing
halted/replan flow.

## Full-card cold-start reads

```
- memory/SPEC.md   — D111-L, D112-L, I58-L; §Future Direction "Plan execution &
                     Petri-net compatibility" (fail-closed journal + journal-ordered
                     completion sentences constrain the new event kind)
- memory/PLAN.md   — frontier: executor-slice-attempt-lifecycle
- src/executor/TOPOLOGY.md — journal/observer paragraphs (fail-closed appends,
                     wake-up hints, replay truth) + orchestrate.ts driver paragraph
- src/executor/agent-result.ts — the agent_run_failed return shape (run.json
                     unchanged, no durable trace today)
- src/executor/orchestrate.ts — the step-no-progress halt path this slice intercepts,
                     and emitNetEvent's fail-closed {journaled} contract the new
                     attempt event must ride
```

## Boundary Crossings

```
→ src/executor/orchestrate.ts        (drive loop: agent_run_failed + attempts remaining
                                      → journal attempt fact, persist counter, re-fire;
                                      exhausted → existing step_halted classification)
→ src/executor/orchestrate-topology.ts (ExecutorNetEvent gains 'attempt_failed' kind;
                                      transition_fired gains optional attempt field)
→ src/executor/petri-events.ts       (parsePetriEvent accepts the new kind; appends ride
                                      the existing fail-closed/wake-up machinery as-is)
→ src/executor/petri-replay*.ts + petrinaut/replay-export.ts
                                     (attempt facts are non-marking journal facts:
                                      replay skips them without corrupting eligibility;
                                      Petrinaut replay export EXCLUDES them this slice)
→ src/executor/run.ts                (RunMetadata gains an active-slice attempt counter
                                      so the bound survives drive restarts — journal is
                                      observer truth, not recovery truth)
→ HITL retry seam                    (explicit execute_replan_retry_current_step resets
                                      the counter: bounded in-run, unbounded via human)
```

Design constraints the builder must hold:

- The attempt fact is appended through the same durable-append-before-hint path as every
  other journal event, so fail-closed semantics apply automatically: an unjournaled
  attempt halts the drive.
- The retry bound is a named constant (default: 2 retries → 3 attempts max) with a
  `ceiling:` comment naming the plan-declared upgrade path.
- Counter semantics: incremented per failed attempt, persisted in run.json (single-writer
  discipline per I58-L — exact write ownership between drive and step decided at build),
  cleared on successful ingest/slice completion, reset by explicit HITL retry.
- No Petrinaut SSE frame contract change this slice: attempt facts do not enter the
  replay export or stream frames (no fabricated zero-delta firings). They surface
  through executor read paths (`petriEventsTail` / run detail) only. Petrinaut-visible
  attempts belong to the Petri-native follow-up.

## Risks and Assumptions

```
- RISK: replay/eligibility layers treat unknown journal kinds as corruption (torn or
  unreplayable), breaking replay for any run that had attempts
  → MITIGATION: extend parsePetriEvent + replay/eligibility deliberately to classify
    attempt facts as non-marking; oracle below pins replay over an attempt-bearing journal
- RISK: the Bristol Petrinaut contract ({definition, initialState, transitionFirings})
  breaks if attempt facts leak into the export
  → MITIGATION: exclusion is an acceptance leaf with a stream-shape oracle
- ASSUMPTION: HITL retry resets the in-run bound (human override semantics)
    → IMPACT IF FALSE: one small semantics flip, no structural rework
    → VALIDATE: declared in the acceptance leaf; cheap to change if the user disagrees
- ASSUMPTION: an additive optional RunMetadata field breaks no metadata parser/projection
    → IMPACT IF FALSE: touch-up in run.ts readers/projections
    → VALIDATE: full executor + rpc suites
```

## Posture check

Proving; scores on all three axes: **proof of life** — the in-run attempt loop
(fail → journaled attempt → retry → success) lights up end-to-end and is visible in the
journal; **invariants** — attempt identity becomes the stable vocabulary the rest of the
sequence builds on; **uncertainty** — retires the frontier's validate-at-pickup shape
question with a landed tracer instead of more design.

## Acceptance Criteria

```
✓ orchestrate.test.ts 'retries a failed agent attempt in-run and journals every attempt' —
  agent runner failing twice then succeeding: drive resolves completed/promotion_prepared;
  journal contains attempt_failed (attempt 1, 2, sliceId, reason agent_run_failed) followed
  by the successful agent_result transition_fired carrying attempt: 3; the run.json
  counter is cleared by the end
✓ orchestrate.test.ts 'halts through the existing replan flow when attempts exhaust' —
  always-failing runner: drive halts with the existing step_halted/agent_run_failed
  classification after exactly 1 + bound attempts, all journaled; run.json records the
  exhausted counter
✓ orchestrate.test.ts (or execute suite) 'explicit HITL retry resets the attempt bound' —
  after an exhausted halt, execute_replan_retry_current_step (or its executor helper)
  clears the counter so the retried drive gets a fresh bound
✓ petri.test.ts 'replays an attempt-bearing journal without corrupting eligibility or
  marking' — parsePetriEvent accepts attempt_failed; replay over a journal interleaving
  attempt facts yields the same marking/terminal as without them
✓ web-host.test.ts 'Petrinaut stream frames are unchanged by attempt facts' — a run with
  failed attempts streams the same frame kinds as today (no attempt frames, no fabricated
  deltas, terminal still journal-ordered)
✓ Existing suites stay green un-skipped: src/executor/__tests__/orchestrate.test.ts,
  petri.test.ts, observer-read.test.ts; src/rpc/__tests__/web-host.test.ts;
  src/rpc/methods/__tests__/execute.test.ts
✓ npm run verify passes
```

## Invariants preserved

```
- Fail-closed journal appends + journal-ordered completion — guarded by: web-host
  'closes an active stream when a durable journal append fails mid-run' + 'delivers the
  journal terminal when the wake-up outruns the marking snapshot' (STOP-THE-LINE)
- I58-L side-effect honesty (metadata advances with declared side effects) — guarded by:
  src/executor/__tests__/ per-helper suites (STOP-THE-LINE)
- run.json lifecycle authority; observers cannot mutate execution — guarded by:
  web-host stream-authority test
- Petrinaut SSE frame contract ({definition, initialState, transitionFirings}) — guarded
  by: web-host replay/stream suites + the new frames-unchanged leaf
- HITL replan family behavior (retry/regenerate/supersede/abandon) — guarded by:
  execute.test.ts replan suites
```

## Verification Approach

```
- Inner: vitest unit/integration on drive retry loop + parse/replay (mechanism)
- Middle: real-HTTP web-host stream test (composed contract; frames unchanged)
- Outer: npm run verify; a live run with an intermittently failing fake agent is the
  demo-shaped evidence if wanted (not gating)
```

## Cross-cutting obligations

```
- Journal-truth ordering: attempt facts ride durable-append-before-hint; no hint surface
  learns of an unjournaled attempt
- Frozen SDCPN definitions stay byte-identical — this slice must not touch net.sdcpn.json
  compilation
- Doc reconciliation lands with the build: src/executor/TOPOLOGY.md (attempt facts as
  non-marking journal vocabulary), SPEC §Future Direction FE-1192 sentence, PLAN frontier
  status/execution pointer
- Follow-up boundary is explicit: test_run_failed coverage and Petri-native attempt
  topology are named follow-ups, not silent scope creep
```

## Expected touched paths (tentative)

```
src/executor/
├── orchestrate.ts                  ~   (retry loop, attempt emission, exhausted halt)
├── orchestrate-topology.ts         ~   (ExecutorNetEvent attempt_failed + attempt field)
├── petri-events.ts                 ~   (parsePetriEvent)
├── petri-replay.ts                 ~   (skip non-marking attempt facts)
├── petri-replay-eligibility.ts    ?   (only if eligibility inspects kinds)
├── petrinaut/replay-export.ts      ~   (exclude attempt facts from export)
├── run.ts                          ~   (RunMetadata attempt counter, additive optional)
├── run-retry-eligibility.ts        ?   (counter reset on HITL retry)
├── TOPOLOGY.md                     ~
└── __tests__/
    ├── orchestrate.test.ts         ~   (shared suite also named by the parked
    │                                    executor-run-environment card — disjoint new
    │                                    cases, different frontier; no collision)
    ├── petri.test.ts               ~
    └── observer-read.test.ts       ?
src/.pi/extensions/executor/execute-replan-retry-current-step/index.ts ?  (counter reset)
src/rpc/__tests__/web-host.test.ts  ~   (frames-unchanged leaf)
memory/SPEC.md                      ~   (one sentence: attempt facts vocabulary)
```
