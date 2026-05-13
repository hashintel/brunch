---
name: ln-diagnose
description: "Disciplined debugging for hard bugs and regressions. Use when something is broken, failing, throwing, flaky, slow, or when the user says diagnose/debug this. Builds a feedback loop, reproduces, hypothesizes, instruments, fixes, regression-tests, then routes back into ln-* canonical planning."
argument-hint: "[bug report, failing command, error, or regression description]"
---

# Ln Diagnose

Diagnose one bug or regression before implementing the fix. The core deliverable is a trusted feedback loop plus a falsified/confirmed causal explanation. Do not jump straight to code changes unless the cause is already proven.

## Input

Bug, failure, flake, or regression to diagnose: $ARGUMENTS

Orient first:

1. Read `memory/SPEC.md` if present and use its lexicon / live invariants.
2. Read `memory/PLAN.md` if present and identify the containing frontier item if one exists.
3. Read `HANDOFF.md` if present for volatile context.
4. For runtime/UI failures, read the relevant project praxis doc before inspecting logs or driving browsers.

Write a 2-4 bullet orientation note naming the observed symptom, suspected seam, current feedback loop (if any), and what would count as proof.

## Phase 1 — Build a feedback loop

This is the skill. A fast deterministic loop turns debugging into hypothesis testing. If no loop exists, build one before reasoning deeply.

Try, in rough order:

1. failing unit/integration/e2e test at the seam that reaches the bug
2. CLI or script with fixture input and asserted output
3. HTTP/curl script against a running server
4. headless browser or browser-automation script asserting DOM/console/network
5. replayed captured artifact: request payload, trace, event log, fixture, HAR
6. throwaway harness around the smallest subsystem that exercises the path
7. property/fuzz loop for intermittent wrong output
8. bisection/differential loop across commits, versions, datasets, or configs
9. structured HITL loop only when a human must observe/click

Improve the loop before moving on:

- make it faster
- make the assertion sharper than "did not crash"
- remove flake by pinning time, randomness, network, filesystem, or concurrency
- for nondeterministic bugs, raise reproduction rate with repetition/stress until it is debuggable

If no loop can be built, stop and report exactly what was tried. Ask for access, logs, traces, fixtures, screen recordings with timestamps, or permission to add temporary instrumentation. Do not continue with vibe-based diagnosis.

## Phase 2 — Reproduce

Run the loop and confirm it demonstrates the user's bug, not a nearby failure.

Capture:

- exact command/script/test used
- exact symptom: error, diff, timing, screenshot, console/network evidence
- reproduction rate for flakes
- any fixture or artifact saved for replay

Do not proceed until the bug reproduces, or until lack of reproduction is the explicit diagnosis result.

## Phase 3 — Hypothesize

Generate 3-5 ranked hypotheses before testing any one of them. Each must be falsifiable:

```md
If [cause] is true, then [probe/change] will make [specific observation] happen.
```

Prefer hypotheses that distinguish seams or invariants from `memory/SPEC.md`. Show the ranked list to the user if they are present; proceed with the best available ranking if they are AFK.

## Phase 4 — Instrument

Probe one hypothesis at a time. Every probe must map to a prediction.

Tool preference:

1. debugger/REPL inspection when available
2. targeted boundary logs
3. minimal temporary assertions or counters

Tag every temporary log or probe with a unique prefix like `[DEBUG-a4f2]` so cleanup is grep-able. Avoid "log everything and grep".

For performance regressions: measure first. Establish baseline timing/profiler/query-plan evidence, then bisect or compare. Do not optimize before the measurement identifies the seam.

## Phase 5 — Fix path and regression test

Before coding the fix, decide the correct route:

- If the fix is trivial and already inside a settled seam, continue directly into `ln-build` style red-green-refactor in this session.
- If the fix changes a seam, invariant, requirement, assumption, or frontier shape, route to `ln-scope` or `ln-spec` first.
- If the diagnosis answered a hard question but the fix is non-obvious, route to `ln-spike` or `ln-design`.

Write the regression test before the fix when there is a correct seam. A correct seam exercises the real bug pattern as it occurs at the call site; shallow tests that cannot fail for the original bug create false confidence.

If no correct seam exists, that is an architectural finding. Record it and route to `ln-review` or `ln-refactor` after the immediate fix decision.

## Phase 6 — Cleanup and postmortem

Before declaring done:

- [ ] original repro loop no longer reproduces the bug, or the non-repro diagnosis is explicit
- [ ] regression test exists and passes, or absence of a correct seam is documented
- [ ] all `[DEBUG-...]` instrumentation is removed
- [ ] throwaway harnesses are deleted or clearly marked and still needed
- [ ] causal hypothesis is stated in the final report / commit message

Ask: what would have prevented this bug? If the answer is a missing invariant, unclear seam, weak oracle, or bad module shape, route it into the appropriate `ln-*` skill rather than burying it in the diagnosis.

## Canonical reconciliation

After diagnosis, reconcile only durable truth:

- New/retired assumption → update `memory/SPEC.md` §Assumptions.
- New seam-level invariant or oracle gap → update `memory/SPEC.md` and/or route to `ln-oracles`.
- Frontier status changed because the bug blocks/unblocks work → update `memory/PLAN.md`.
- Pure local bug with no durable design implication → no canonical update required beyond any tracked PLAN status.

Do not create `CONTEXT.md`, ADRs, or alternate planning documents. This project's canonical docs are `memory/SPEC.md` and `memory/PLAN.md`.

## Output

```md
## Diagnosis: [symptom]

**Feedback loop:** [command/script/test and reproduction rate]
**Confirmed cause:** [one sentence]
**Evidence:** [key observations]
**Fix route:** [direct fix | ln-scope | ln-build | ln-spike | ln-review | ln-refactor]
**Regression oracle:** [test/harness or why unavailable]
**Canonical updates:** [none | specific SPEC/PLAN changes needed]
```

## Routing

After diagnosis, present these options to the user (use `tool-ask-question`):

| #   | Label            | Target        | Why |
| --- | ---------------- | ------------- | --- |
| 1   | Scope the fix    | `ln-scope`    | The fix needs a buildable card or durable seam update |
| 2   | Build the fix    | `ln-build`    | The fix is settled and ready for red-green-refactor |
| 3   | Spike deeper     | `ln-spike`    | A hard question remains after reproduction |
| 4   | Review structure | `ln-review`   | No good seam/regression oracle exists or architecture contributed |
| 5   | Back to triage   | `ln-consult`  | Diagnosis changed priority or scope |

Recommended: **2** only when the cause and seam are proven; otherwise **1**.

---
*Adapted from [mattpocock/skills/engineering/diagnose](https://github.com/mattpocock/skills/tree/main/skills/engineering/diagnose).* 
