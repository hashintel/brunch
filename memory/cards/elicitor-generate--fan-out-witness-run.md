# generate fan-out witness — real-model A31-L proof (oracle plane)

Frontier: elicitor-generate
Status:   active
Mode:     slices
Created:  2026-06-24

> Slice order (planner cross-check #3): **S1 = P3 oracle fan-out witness** (the core A31-L proof). **S2 = A1 extractive-oracle anti-prompt** (separate no-fire claim + hang risk; optional follow-up, do not block S1 on it). Build S1 first; S2 only after S1 produces a clean run.

## Orientation

- **Seam:** a new **dev** probe entry (`src/dev/**`, because it uses `bootTier2RuntimeFromFixture`) that boots the real `runBrunchTui` runtime **on the real product services path** (no `agentServices` override — Brunch/Pi creates real services), over an **idle resumed fixture** (no pending kick), pins the `oracle` lens, seeds graph truth, sends a `probes.md` prompt under a **bounded turn timeout**, and reads **process markers** off the canonical `session.jsonl`. This is the automated half of the deferred `probes.md` outer-loop witness — the A31-L "one spine, no structural fork" proof on the third (oracle) plane.
- **Entrypoint topology (planner #1):** the *runner* lives in `src/dev/**` (it imports the build-excluded `bootTier2RuntimeFromFixture`). Only **pure marker/report utilities** may live in `src/probes/**`, and only if extracted later — `src/probes/**` must stay buildable and must never import `src/dev/**`.
- **Real services, not a custom registrar (planner #2):** omit `agentServices` so `bootTier2RuntimeFromFixture` takes the real product path (`createBrunchAgentSessionRuntimeFactory` builds real `services`); gate the skip on the product's own signal — `runtime.services.modelRegistry.getAvailable().length > 0` (the same check `runBrunchTui` uses for `modelAvailable`). Do **not** mirror `createTier2FauxAgentServices` with a real provider — that would invent a parallel harness path.
- **Frontier:** `elicitor-generate` (FE-1059, branch `ln/fe-1059-elicitor-generate`). Proving posture. Deterministic activation already landed (`8faea49f`): real-boot registry+active-tool proof + regenerated compose goldens.
- **What this witnesses vs what it cannot (the honest ceiling, both planners agree):**
  - **Automatable here (fan-out half):** branch selection (oracle), context-pointer follow (`read` of `SKILL.md` → `references/oracle.md`), `present_candidates` emission, and the **I51-L no-write** marker (precise wording below). This *is* the core A31-L claim.
  - **NOT automatable here (fan-in completion):** the same-turn continuation through the model's own `request_response` → `present_review_set`. Free-text/choice `request_response` waits on the live UI/answer broker headlessly (`request_response requires interactive UI`). That proof is **manual-TUI**, a separate card.
- **I51-L no-write marker — precise wording (planner #4):** `present_review_set` is **not** a commit, so do not treat its presence as a write. The no-write marker is: the selected spec's **graph LSN / node / edge counts are unchanged** across the turn, **no `mutate_graph` tool result** appears in the transcript, and **no approved review result** appears. Optionally also flag if `present_review_set` appears *before* any candidate pick — but classify that as ordering-anomaly, not "commit."
- **Load-bearing prerequisites (from the cross-check):**
  1. **Idle boot, no auto-kick** (planner #1) — a fresh-session real boot fires the product-originated opening turn, which would contaminate the P3 witness. Use `bootTier2RuntimeFromFixture` with a transcript that rests at an assistant/idle leaf (no unresolved debt), so the boot does not kick before `session.prompt(P3)`.
  2. **Real product services + model-availability skip (planner #2)** — omit `agentServices`; the real product path builds services. If `runtime.services.modelRegistry.getAvailable().length === 0`, the probe records `status: skipped` with a named reason — never a silent pass.
  3. **Oracle-meaningful graph** — seed accepted intent + design nodes so an oracle-plane proposal is sensible (foreign-writer `commandExecutor.createNode`, as the gap-legality test does).
  4. **Bounded turn timeout (planner #6)** — *any* real-model turn (not just A1) can wander into a broker-waiting path. Wrap the `session.prompt` turn in a global timeout; on expiry classify the run `status: blocked` (timeout) with markers read up to that point — never hang.

## Target Behavior

A dev-only probe boots the real Brunch runtime with a real model over an idle oracle-pinned seeded session, sends the P3 oracle-compose prompt, and records whether the elicitor took the oracle branch, followed the `references/oracle.md` pointer, emitted `present_candidates`, and made no graph write before any pick.

## Full-card cold-start reads

```
- memory/SPEC.md   — A31-L (spine plane-shared, partially validated — this run is the oracle witness), A32-L (fan-in triple; compose), I51-L (candidates never commit), D96-L (plane-keyed conduct), D30-L (density/epistemic honesty)
- src/.pi/skills/methods/generate-proposal/SKILL.md + references/oracle.md + probes.md  — the skill under witness; P3 is the should-fire oracle-compose probe, A1 the extractive-oracle anti-prompt
- src/dev/tier-2-harness.ts  — bootTier2RuntimeFromFixture (idle resume boot), createTier2FauxAgentServices (the agentServices-seam shape to mirror for a REAL model), createNoModelAgentServices (skip-path precedent)
- src/dev/introspection-launcher.ts  — runBrunchIntrospectionTurn: the precedent for a real session.prompt turn that writes artifacts to .fixtures/scratch/<loop>/<run-id>/
- src/probes/portable-report.ts  — report.json schema/writer (schemaVersion, probeId, runId, artifact paths)
- src/probes/project-graph-review-cycle-proof.ts  — precedent for marker-reading off transcript tool calls (toolName scan)
- docs/architecture/probes-and-transcripts.md + .fixtures/README.md  — evidence convention: scratch first, promote to .fixtures/runs/<probe-id>/<run-id>/ on review
- docs/praxis/manual-testing.md  — the sibling manual-TUI path for the fan-in completion (separate card)
```

## Boundary Crossings

```
→ build idle fixture: createSetupSession + seed accepted intent/design nodes (foreign writer) + transcript resting at an idle leaf (no kick debt)
→ bootTier2RuntimeFromFixture({ real agentServices, fixtureEntries }) → real runBrunchTui runtime
→ pin oracle: extensionRunner.getCommand('brunch:lens').handler('oracle', ...) → emitBeforeAgentStart
→ session.prompt(P3 oracle-compose prompt, { source: 'rpc' }) UNDER a global turn timeout   # one real-model turn
→ read markers off session.jsonl transcript entries (+ graph LSN/counts before/after):
    ? read(SKILL.md) then read(references/oracle.md)            # pointer followed
    ? present_candidates tool call emitted                      # fan-out
    ! graph LSN/node/edge unchanged + no mutate_graph result + no approved review   # I51-L no-write
→ write artifacts to .fixtures/scratch/generate-fan-out/<run-id>/{session.jsonl,report.json}
→ [S2, separate slice] A1 anti-prompt run, bounded: inspect markers up to the pending question; assert generate did NOT fire
```

## Risks and Assumptions

```
- RISK: auto-kick contaminates the witness (planner #1).
    → MITIGATION: idle resumed fixture (bootTier2RuntimeFromFixture) resting at an assistant/idle leaf; assert no brunch.kick before the probe prompt.
- RISK: any real-model turn wanders into a broker-waiting path and hangs (planner #6, generalizes the old A1-only concern).
    → MITIGATION: a GLOBAL turn timeout around session.prompt for every run (P3 and A1). On expiry: status: blocked (timeout), markers read up to that point, never hang.
- RISK: A1 anti-prompt specifically may call present_question -> request_response (free-text waits on the broker) (planner #2).
    → MITIGATION: A1 is a SEPARATE slice (S2). Inspect markers only up to the pending question; a pending present_question is an acceptable terminal for the anti-prompt; assert generate-proposal did NOT fire. Do not block S1 (P3) on S2.
- RISK: no available model in the environment -> probe silently "passes" (planner #2).
    → MITIGATION: use the product's own signal — runtime.services.modelRegistry.getAvailable().length === 0 -> status: skipped with a named reason. A skip is not a pass. Do NOT build a custom real-provider registrar to force a model.
- RISK: harness-as-false-proof — markers asserted on a path the product never drove.
    → MITIGATION: markers are read ONLY off the canonical session.jsonl produced by the real session.prompt turn; the probe never injects the tool calls it checks for.
- ASSUMPTION (A31-L): on the oracle plane the live elicitor takes the branch, follows references/oracle.md, and emits present_candidates with no structural fork.
    → IMPACT IF FALSE: the spine is not plane-shared at runtime; routes back to ln-plan.
    → VALIDATE: this run's markers; a clean fan-out across all three planes (intent already pick, design synthesize, oracle compose) graduates A31-L's runtime half.
    → [→ memory/SPEC.md §Assumptions A31-L]
- ASSUMPTION (planner #3, to code-verify when building fan-in card, NOT here): session.submitExchangeResponse can drive a candidate pick ({answer:{optionId}}) since present_candidates projects to single-select.
    → NOTE: this is a SYNTHETIC terminal response, not proof of in-turn request_response; it belongs to the fan-in card, flagged here so it is not conflated.
```

## Posture check

Proving. Scores on **uncertainty**: this is the first *behavioral* (live-model) evidence for A31-L — the static/registry proofs are landed, but whether a real elicitor drives the branch+pointer+fan-out has not been witnessed. Secondary **proof of life**: the oracle-plane generative path runs end-to-fan-out against a real model. It deliberately does **not** attempt the fan-in completion (manual-TUI card), so its scope is honest and bounded. Reshape not needed — the run *is* the A31-L runtime witness.

## Acceptance Criteria

```
S1 — P3 oracle fan-out witness (core A31-L proof):
✓ a dev runner in src/dev/** boots the real runBrunchTui runtime on the REAL product services path (no agentServices override) over an idle resumed fixture (no auto-kick), oracle lens pinned, with seeded accepted intent+design graph truth
✓ it sends the P3 oracle-compose prompt via one real session.prompt turn UNDER a global turn timeout, and writes session.jsonl + report.json to .fixtures/scratch/generate-fan-out/<run-id>/
✓ markers are computed from the canonical transcript (not injected): branch=oracle, references/oracle.md read after SKILL.md, present_candidates emitted; I51-L no-write = graph LSN/node/edge unchanged + no mutate_graph result + no approved review (present_review_set presence is NOT a commit)
✓ no available model -> status: skipped with a named reason (runtime.services.modelRegistry.getAvailable().length === 0); timeout -> status: blocked; neither is a pass
✓ report.json carries schemaVersion, probeId, runId, model stamp, per-marker pass/fail, and run status (ok|skipped|blocked)
✓ the runner lives in src/dev/**; any pure marker/report util that gets extracted into src/probes/** must not import src/dev/**

S2 — A1 extractive-oracle anti-prompt (separate slice, optional follow-up; do not block S1):
✓ A1 runs under the global timeout, inspects markers only up to a pending present_question, records that generate-proposal did NOT fire, and never hangs

Durable-doc updates (planner #5 — promoted evidence only):
✓ probes.md "Observed:" lines and the A31-L SPEC evidence line are updated ONLY after a scratch run is reviewed and promoted to .fixtures/runs/generate-fan-out/<run-id>/; never cite .fixtures/scratch or a skipped/blocked run
```

## Verification Approach

```
- The probe IS the verification artifact (outer-loop, process-marker). It is not a CI gate — real-model runs are not deterministic.
- Inner (deterministic, CI-safe): if a marker-reader module is extracted (markers.ts), unit-test the PURE marker functions against a committed sample session.jsonl fixture — branch detection, pointer-follow detection, present_candidates detection, premature-write detection. This is the only part that belongs in vitest.
- Evidence promotion (planner #5): a reviewed run moves from .fixtures/scratch/generate-fan-out/<run-id>/ to .fixtures/runs/generate-fan-out/<run-id>/ (tracked); ONLY then do probes.md Observed lines / the A31-L SPEC evidence line cite the promoted run-id. Scratch and skipped/blocked runs never reach durable docs.
- Do NOT gate the branch on a real-model run; it informs A31-L graduation, it does not block.
```

## Build status

```
- S1 implementation: done in src/dev/generate-fan-out-witness.ts with pure report/marker tests in src/dev/__tests__/generate-fan-out-witness.test.ts and topology note in src/dev/README.md.
- S1 local outer-loop run: blocked before Brunch boot by local better-sqlite3 native ABI mismatch (installed binding NODE_MODULE_VERSION 137, current Node requires 147), so no scratch report was produced and no A31-L evidence was promoted.
- S2 anti-prompt: not started; remains a separate follow-up slice.
```

## Cross-cutting obligations

```
- I51-L: the witness asserts the no-write marker; it never commits graph truth itself. The seeded graph is set up by a foreign writer (commandExecutor), not by the witnessed turn.
- Honest labeling (both planners): this card witnesses the FAN-OUT half only. The fan-in completion (model's own request_response -> present_review_set) is manual-TUI, a SEPARATE card — do not claim it here.
- Marker purity: never inject the tool calls being checked; read only off the real session.jsonl.
- src/dev vs src/probes boundary: src/probes must stay buildable and must not import src/dev/**. If the boot helper (real-model agentServices over bootTier2RuntimeFromFixture) must live in src/dev, the entry that uses it is a dev test/script, and only the PURE marker reader is shareable into src/probes.
- No activation framework (both planners): this is one probe entry + (later) one pure marker module. Do not add ActivationPosture/Backend/Snapshot.
- One branch per frontier (FE-1059). Do not build the fan-in driver, the manual-TUI card, or a generalized arranger here.
```

## Expected touched paths (tentative)

```
src/dev/
└── generate-fan-out-witness.ts        +  real product-services boot (idle fixture + oracle pin + seeded graph) + P3 turn under global timeout + artifact write   [S1; src/dev because it imports bootTier2RuntimeFromFixture]
src/probes/capability-activation/
└── markers.ts                         ?  PURE marker readers over session.jsonl — extract ONLY after the first run shows what is needed (both planners); buildable, no src/dev import; unit-tested against a sample fixture
src/.pi/skills/methods/generate-proposal/probes.md   ~  Observed: lines — updated ONLY from a promoted run (planner #5)
.fixtures/scratch/generate-fan-out/<run-id>/         +  ephemeral run output (gitignored)
.fixtures/runs/generate-fan-out/<run-id>/            ?  promoted evidence on review (tracked)
memory/SPEC.md                                        ?  A31-L evidence line — only if a reviewed run is promoted
```

## Routing

Recommended next: **ln-build** `memory/cards/elicitor-generate--fan-out-witness-run.md` — but note this is an outer-loop evidence harness, not a gated test, so the "build" produces a runnable probe + a reviewed run, not a green CI assertion. Defer the `markers.ts` extraction until the first run shows which markers are actually needed (both planners). If a real model key is unavailable in this environment, build the harness + skip-path and hand the run command to the user.
